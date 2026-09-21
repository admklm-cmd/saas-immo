/**
 * Sarah — suivi: server-side orchestration.
 *
 * Takes an authenticated Supabase client (RLS applies) so the same code is used
 * by the server action and by the integration tests. The server action
 * (`actions.ts`) only builds the client and delegates here.
 *
 * Sequence, in this exact order — every decision with a consequence is taken by
 * the CODE, never by the AI:
 *
 *   session + agency (server-side)  →  the appointment must belong to the
 *   agency  →  guard rails on ITS contact (kill switch, daily volume, human
 *   takeover)  →  run opened  →  eligibility (the appointment is done AND a
 *   human wrote its report)  →  AI call, report isolated as untrusted data  →
 *   zod validation (limited retry)  →  STAGE CHOSEN BY THE CODE from a
 *   whitelist  →  follow-up tasks  →  CRM history  →  run closed.
 *
 * What Sarah deliberately does NOT do:
 *   * she never reaches `mandat_signe`. Her schema has no stage field, and the
 *     code picks the stage from `SARAH_ALLOWED_TARGET_STAGES`, which contains
 *     only `estimation_faite` (CLAUDE.md: a mandate is confirmed by a human);
 *   * she never writes the meeting report, nor `report_recorded_by` /
 *     `report_recorded_at`: that is the conseiller's evidence, stamped by the
 *     database;
 *   * she never writes an amount in euros — the schema refuses one in every
 *     free-text field, and the database refuses `properties.estimated_value_eur`
 *     to an agent outright;
 *   * she never sends anything.
 */

import { generateValidated } from "@/lib/agents/ai-task";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected, failWith } from "@/lib/agents/errors";
import { logAgentActivity, openHumanTask, type HumanTaskResult } from "@/lib/agents/journal";
import { AGENT_STEP_LABELS, AGENT_TASK_TEXTS, listOrNone, type AgentErrorCode } from "@/lib/agents/messages";
import { finishRun, startGuardedRun } from "@/lib/agents/runner";
import type { RecordedRunStep } from "@/lib/agents/steps";
import type { AgentContext, PipelineStage, Tables, TypedClient } from "@/lib/agents/types";
import { getAiProvider } from "@/lib/claude/client";
import type { AiProvider, AiScenario, AiUsage } from "@/lib/claude/provider";
import { ok, type Result, type ResultError } from "@/lib/utils/result";
import type { Json } from "@/types/database";

import { buildSarahPromptContext } from "../prompt-context";

import {
  decideFollowThroughStage,
  isStageAllowedForSarah,
  planFollowThroughTasks,
  SARAH_DECISION_TEXTS,
  SARAH_STEP_LABELS,
  sellerDecisionLabel,
  type SarahDecisionReason,
} from "./decision";
import { SARAH_PROMPT_VERSION, SARAH_SYSTEM_PROMPT } from "./prompt";
import { sarahFollowThroughSchema, type SarahFollowThrough } from "./schema";

export const SARAH_AGENT = "sarah" as const;
export const SARAH_TASK = "sarah_follow_through" as const;

/** How many recent history entries are given to the agent as context. */
const HISTORY_LIMIT = 5;

type AppointmentRow = Pick<
  Tables["appointments"]["Row"],
  "id" | "contact_id" | "property_id" | "assigned_user_id" | "starts_at" | "status" | "report_notes"
>;

type PropertyRow = Pick<
  Tables["properties"]["Row"],
  "id" | "property_type" | "city" | "sector" | "surface_m2" | "rooms"
>;

export type SarahRunResult = {
  runId: string;
  appointmentId: string;
  contactId: string;
  previousStage: PipelineStage;
  stage: PipelineStage;
  stageChanged: boolean;
  decision: SarahDecisionReason;
  decisionText: string;
  /** Validated AI output: a summary and a classification, nothing actionable. */
  followThrough: SarahFollowThrough;
  /** French label of the seller's position, ready to display. */
  sellerDecisionLabel: string;
  /** Tasks opened for humans (never executed automatically). */
  tasks: HumanTaskResult[];
  isSimulation: boolean;
  provider: string;
  model: string;
  usage: AiUsage;
  /** Steps really measured during this run, in order. */
  steps: readonly RecordedRunStep[];
};

export type RunSarahOptions = {
  /** Injected provider (tests). Defaults to the one selected by AI_PROVIDER. */
  provider?: AiProvider;
  /** Simulator-only scenario, to exercise the guard rails. */
  scenario?: AiScenario;
  now?: Date;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function runSarahFollowThrough(
  client: TypedClient,
  appointmentId: string,
  options: RunSarahOptions = {},
): Promise<Result<SarahRunResult>> {
  try {
    if (!UUID_PATTERN.test(appointmentId)) {
      // Same generic answer as "belongs to another agency": no information leak.
      return failWith<SarahRunResult>("appointment_not_found");
    }

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    let provider = options.provider ?? null;
    if (!provider) {
      const providerResult = getAiProvider();
      if (providerResult.error) return { data: null, error: providerResult.error };
      provider = providerResult.data;
    }

    // --- the appointment must belong to the agency ---------------------------
    const appointmentQuery = await client
      .from("appointments")
      .select("id, contact_id, property_id, assigned_user_id, starts_at, status, report_notes")
      .eq("agency_id", context.agencyId)
      .eq("id", appointmentId)
      .maybeSingle();

    if (appointmentQuery.error) {
      return failFromDatabase<SarahRunResult>("runSarahFollowThrough.appointment", appointmentQuery.error);
    }
    if (!appointmentQuery.data) return failWith<SarahRunResult>("appointment_not_found");
    const appointment: AppointmentRow = appointmentQuery.data;

    // Journalled input: metadata only, never the report nor the prospect's text.
    const runInput: Json = {
      task: SARAH_TASK,
      prompt_version: SARAH_PROMPT_VERSION,
      appointment_id: appointment.id,
      contact_id: appointment.contact_id,
    };

    const started = await startGuardedRun(client, context, {
      agent: SARAH_AGENT,
      contactId: appointment.contact_id,
      input: runInput,
      provider,
      now: options.now,
    });
    if (started.error) return { data: null, error: started.error };
    const { runId, contact, steps } = started.data;

    const now = options.now ?? new Date();

    /** A failed task/activity write must never be reported as a successful run. */
    const stopAfterPersistenceFailure = async (
      error: ResultError,
      usage?: AiUsage,
      stageChanged = false,
    ): Promise<Result<SarahRunResult>> => {
      await steps.step({
        phase: "persisted",
        label: SARAH_STEP_LABELS.persistence_failed,
        status: "failed",
        detail: { error_code: error.code, stage_changed: stageChanged },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: error.code,
        decision: SARAH_STEP_LABELS.persistence_failed,
        usage,
      });
      return { data: null, error };
    };

    /** Closes the run without any business write, optionally opening a task. */
    const abort = async (input: {
      code: AgentErrorCode;
      decision: SarahDecisionReason;
      task?: { type: keyof typeof AGENT_TASK_TEXTS; activityType: string; details?: string };
      usage?: AiUsage;
    }): Promise<Result<SarahRunResult>> => {
      await steps.step({
        phase: "decision",
        label: SARAH_DECISION_TEXTS[input.decision],
        status: "failed",
        detail: {
          decision: input.decision,
          error_code: input.code,
          task_type: input.task?.type ?? null,
          stage_changed: false,
        },
      });
      if (input.task) {
        const task = await openHumanTask(client, context, {
          contactId: contact.id,
          type: input.task.type,
          title: AGENT_TASK_TEXTS[input.task.type].title,
          details: input.task.details ?? AGENT_TASK_TEXTS[input.task.type].details,
          agent: SARAH_AGENT,
          assignedUserId: appointment.assigned_user_id,
        });
        if (task.error) return stopAfterPersistenceFailure(task.error, input.usage);

        const activity = await logAgentActivity(client, context, {
          contactId: contact.id,
          type: input.task.activityType,
          summary: `Sarah — suivi : ${SARAH_DECISION_TEXTS[input.decision]}`,
          payload: {
            agent: SARAH_AGENT,
            run_id: runId,
            appointment_id: appointment.id,
            error_code: input.code,
          },
          agent: SARAH_AGENT,
          isSimulation: provider.isSimulation,
        });
        if (activity.error) return stopAfterPersistenceFailure(activity.error, input.usage);
      }
      await finishRun(client, runId, {
        status: "failed",
        error: input.code,
        decision: SARAH_DECISION_TEXTS[input.decision],
        usage: input.usage,
      });
      return failWith<SarahRunResult>(input.code);
    };

    // --- inputs: property and recent history ---------------------------------
    const propertyQuery = await client
      .from("properties")
      .select("id, property_type, city, sector, surface_m2, rooms")
      .eq("agency_id", context.agencyId)
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const property: PropertyRow | null = propertyQuery.data ?? null;

    const historyQuery = await client
      .from("activities")
      .select("summary, occurred_at")
      .eq("agency_id", context.agencyId)
      .eq("contact_id", contact.id)
      .order("occurred_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const history = historyQuery.data ?? [];

    const daysSinceAppointment = Math.max(
      0,
      Math.floor((now.getTime() - Date.parse(appointment.starts_at)) / 86_400_000),
    );

    await steps.step({
      phase: "context_loaded",
      label: SARAH_STEP_LABELS.report_loaded,
      detail: {
        contact_stage: contact.stage,
        appointment_status: appointment.status,
        // Counts and flags only: the report itself is personal data.
        has_report: appointment.report_notes !== null,
        report_chars: (appointment.report_notes ?? "").length,
        days_since_appointment: daysSinceAppointment,
        property_known: property !== null,
        history_entries: history.length,
      },
    });

    // --- eligibility: a report written by a HUMAN is mandatory ---------------
    if (appointment.status !== "done" || appointment.report_notes === null) {
      return abort({
        code: "appointment_report_missing",
        decision: "report_missing",
        task: { type: "appointment_report_missing", activityType: "ai_information_missing" },
      });
    }

    // --- AI call: the report is isolated as untrusted DATA --------------------
    // It is written by a member of the agency, but it quotes the seller and can
    // contain anything: it gets the same treatment as any prospect content.
    const { facts, untrusted } = buildSarahPromptContext({
      stage: contact.stage,
      appointmentStatus: appointment.status,
      daysSinceAppointment,
      report: appointment.report_notes,
      property: {
        known: property !== null,
        type: property?.property_type ?? null,
        city: property?.city ?? null,
        sector: property?.sector ?? null,
        surfaceM2: property?.surface_m2 ?? null,
        rooms: property?.rooms ?? null,
      },
      contactText: {
        notes: contact.notes,
        historySummaries: history.map((entry) => entry.summary),
      },
    });

    await steps.step({
      phase: "prompt_built",
      label: AGENT_STEP_LABELS.prompt_built,
      detail: {
        prompt_version: SARAH_PROMPT_VERSION,
        untrusted_blocks: untrusted.length,
        untrusted_chars: untrusted.reduce((total, block) => total + block.content.length, 0),
        scenario: options.scenario ?? null,
      },
    });

    const generation = await generateValidated(
      provider,
      {
        task: SARAH_TASK,
        systemPrompt: SARAH_SYSTEM_PROMPT,
        promptVersion: SARAH_PROMPT_VERSION,
        facts,
        untrusted,
        scenario: options.scenario,
      },
      sarahFollowThroughSchema,
      { steps },
    );

    if (!generation.ok) {
      // Safe fallback: no write at all, a human takes over.
      const task = await openHumanTask(client, context, {
        contactId: contact.id,
        type: "ai_response_invalid",
        title: AGENT_TASK_TEXTS.ai_response_invalid.title,
        details: AGENT_TASK_TEXTS.ai_response_invalid.details,
        agent: SARAH_AGENT,
        assignedUserId: appointment.assigned_user_id,
      });
      if (task.error) return stopAfterPersistenceFailure(task.error, generation.usage);

      const activity = await logAgentActivity(client, context, {
        contactId: contact.id,
        type: "ai_response_invalid",
        summary:
          "Sarah : réponse IA invalide, aucune action. Une tâche a été créée pour un conseiller.",
        payload: {
          agent: SARAH_AGENT,
          run_id: runId,
          appointment_id: appointment.id,
          error_code: generation.error.code,
        },
        agent: SARAH_AGENT,
        isSimulation: provider.isSimulation,
      });
      if (activity.error) return stopAfterPersistenceFailure(activity.error, generation.usage);
      await steps.step({
        phase: "persisted",
        label: AGENT_STEP_LABELS.no_write,
        status: "failed",
        detail: {
          error_code: generation.error.code,
          task_type: task.data?.type ?? null,
          stage_changed: false,
        },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: generation.error.code,
        decision: SARAH_DECISION_TEXTS.invalid_output,
        usage: generation.usage,
        output: task.data ? { task_id: task.data.id, task_type: task.data.type } : null,
      });
      return { data: null, error: generation.error };
    }

    const followThrough = generation.output;

    // --- STAGE: chosen by the code, from a whitelist -------------------------
    const stageDecision = decideFollowThroughStage({
      currentStage: contact.stage,
      confidence: followThrough.confidence,
    });
    const plan = planFollowThroughTasks(followThrough);

    await steps.step({
      phase: "decision",
      label: SARAH_DECISION_TEXTS[stageDecision.reason],
      detail: {
        decision: stageDecision.reason,
        previous_stage: contact.stage,
        stage: stageDecision.stage,
        stage_changed: stageDecision.changed,
        // Stated explicitly because it is the guarantee the product sells.
        mandate_reachable_by_agent: false,
        seller_decision: followThrough.seller_decision,
        objections: followThrough.objections.length,
        missing_documents: followThrough.missing_documents.length,
        next_steps: followThrough.next_steps.length,
        estimation_presented: followThrough.estimation_presented,
        confidence: followThrough.confidence,
      },
    });

    // --- writes ---------------------------------------------------------------
    // Belt and braces: even if the decision above were ever broken by a future
    // change, an unauthorised stage never reaches the database.
    if (stageDecision.changed && isStageAllowedForSarah(stageDecision.stage)) {
      const { data: updatedContact, error } = await client
        .from("contacts")
        .update({ stage: stageDecision.stage })
        .eq("agency_id", context.agencyId)
        .eq("id", contact.id)
        // Optimistic lock: a human decision made while the model was working
        // always wins, especially `mandat_signe` and `perdu`.
        .eq("stage", contact.stage)
        .select("stage")
        .maybeSingle();
      if (error) {
        await steps.step({
          phase: "persisted",
          label: "Écriture de l'étape refusée : aucune action.",
          status: "failed",
          detail: { error_code: "contact_update_failed", stage_changed: false },
        });
        await finishRun(client, runId, {
          status: "failed",
          error: "contact_update_failed",
          decision: "Écriture de l'étape refusée : aucune action.",
          usage: generation.usage,
        });
        return failFromDatabase<SarahRunResult>("runSarahFollowThrough.contactUpdate", error);
      }
      if (!updatedContact) {
        await steps.step({
          phase: "persisted",
          label: SARAH_STEP_LABELS.concurrent_stage_change,
          status: "failed",
          detail: { error_code: "contact_stage_changed", stage_changed: false },
        });
        await finishRun(client, runId, {
          status: "failed",
          error: "contact_stage_changed",
          decision: SARAH_STEP_LABELS.concurrent_stage_change,
          usage: generation.usage,
        });
        return failWith<SarahRunResult>("contact_stage_changed");
      }
    }

    const tasks: HumanTaskResult[] = [];

    if (stageDecision.reason === "low_confidence") {
      const created = await openHumanTask(client, context, {
        contactId: contact.id,
        type: "follow_through_to_review",
        title: AGENT_TASK_TEXTS.follow_through_to_review.title,
        details: AGENT_TASK_TEXTS.follow_through_to_review.details,
        agent: SARAH_AGENT,
        assignedUserId: appointment.assigned_user_id,
      });
      if (created.error) {
        return stopAfterPersistenceFailure(created.error, generation.usage, stageDecision.changed);
      }
      if (created.data) tasks.push(created.data);
    }

    if (plan.nextSteps.length > 0) {
      const created = await openHumanTask(client, context, {
        contactId: contact.id,
        type: "follow_through_next_steps",
        title: AGENT_TASK_TEXTS.follow_through_next_steps.title,
        details: AGENT_TASK_TEXTS.follow_through_next_steps.details.replace(
          "{steps}",
          listOrNone(plan.nextSteps),
        ),
        agent: SARAH_AGENT,
        assignedUserId: appointment.assigned_user_id,
      });
      if (created.error) {
        return stopAfterPersistenceFailure(created.error, generation.usage, stageDecision.changed);
      }
      if (created.data) tasks.push(created.data);
    }

    if (plan.missingDocuments.length > 0) {
      const created = await openHumanTask(client, context, {
        contactId: contact.id,
        type: "missing_documents",
        title: AGENT_TASK_TEXTS.missing_documents.title,
        details: AGENT_TASK_TEXTS.missing_documents.details.replace(
          "{documents}",
          listOrNone(plan.missingDocuments),
        ),
        agent: SARAH_AGENT,
        assignedUserId: appointment.assigned_user_id,
      });
      if (created.error) {
        return stopAfterPersistenceFailure(created.error, generation.usage, stageDecision.changed);
      }
      if (created.data) tasks.push(created.data);
    }

    // --- CRM history -----------------------------------------------------------
    const decisionText = SARAH_DECISION_TEXTS[stageDecision.reason];
    const activity = await logAgentActivity(client, context, {
      contactId: contact.id,
      type: "ai_follow_through_done",
      summary: `Sarah — suivi : ${followThrough.summary} ${decisionText}`,
      payload: {
        agent: SARAH_AGENT,
        run_id: runId,
        prompt_version: SARAH_PROMPT_VERSION,
        appointment_id: appointment.id,
        previous_stage: contact.stage,
        stage: stageDecision.stage,
        seller_decision: followThrough.seller_decision,
        estimation_presented: followThrough.estimation_presented,
        missing_fields: followThrough.missing_fields,
        confidence: followThrough.confidence,
        tasks: tasks.map((task) => task.type),
      },
      agent: SARAH_AGENT,
      isSimulation: provider.isSimulation,
    });
    if (activity.error) {
      return stopAfterPersistenceFailure(activity.error, generation.usage, stageDecision.changed);
    }

    await steps.step({
      phase: "persisted",
      label: SARAH_STEP_LABELS.persisted,
      detail: {
        stage: stageDecision.stage,
        stage_changed: stageDecision.changed,
        tasks_opened: tasks.filter((task) => task.created).length,
        task_types: tasks.map((task) => task.type),
        activity_type: "ai_follow_through_done",
      },
    });

    await finishRun(client, runId, {
      status: "succeeded",
      output: {
        seller_decision: followThrough.seller_decision,
        objections: followThrough.objections.length,
        missing_documents: followThrough.missing_documents,
        next_steps: followThrough.next_steps.map((step) => step.title),
        estimation_presented: followThrough.estimation_presented,
        missing_fields: followThrough.missing_fields,
        confidence: followThrough.confidence,
        decision: stageDecision.reason,
        previous_stage: contact.stage,
        stage: stageDecision.stage,
        stage_changed: stageDecision.changed,
        task_types: tasks.map((task) => task.type),
      } as Json,
      decision: decisionText,
      usage: generation.usage,
    });

    return ok({
      runId,
      appointmentId: appointment.id,
      contactId: contact.id,
      previousStage: contact.stage,
      stage: stageDecision.stage,
      stageChanged: stageDecision.changed,
      decision: stageDecision.reason,
      decisionText,
      followThrough,
      sellerDecisionLabel: sellerDecisionLabel(followThrough.seller_decision),
      tasks,
      isSimulation: provider.isSimulation,
      provider: provider.name,
      model: provider.model,
      usage: generation.usage,
      steps: steps.steps,
    });
  } catch (cause) {
    return failFromUnexpected<SarahRunResult>("runSarahFollowThrough", cause);
  }
}
