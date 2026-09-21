/**
 * Hugo — qualification: server-side orchestration.
 *
 * Takes an authenticated Supabase client (RLS applies) so the same code is
 * used by the server action and by the integration tests. The server action
 * (`actions.ts`) only builds the client and delegates here.
 *
 * Sequence, in this exact order:
 *   session + agency (server-side)  →  guard rails (kill switch, daily volume,
 *   human takeover, contact ownership)  →  run opened in `ai_agent_runs`  →
 *   prompt built with the prospect text isolated as untrusted DATA  →  AI call
 *   →  zod validation (limited retry)  →  writes that only fill holes  →
 *   explicit stage rules  →  CRM activity  →  run closed.
 *
 * Any invalid AI output leads to: no business write at all, a task for a human,
 * and a `failed` run.
 *
 * Every stage of that sequence is journaled as it happens in
 * `ai_agent_run_steps` (see lib/agents/steps.ts), with measured timestamps, so
 * the UI can replay the execution instead of staging it. Hugo's business
 * behaviour is unchanged by this: the steps only observe.
 */

import { generateValidated } from "@/lib/agents/ai-task";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected, failWith } from "@/lib/agents/errors";
import { logAgentActivity, openHumanTask, type HumanTaskResult } from "@/lib/agents/journal";
import {
  AGENT_STEP_LABELS,
  AGENT_TASK_TEXTS,
  listFieldLabels,
  type QualificationField,
} from "@/lib/agents/messages";
import { finishRun, startGuardedRun } from "@/lib/agents/runner";
import type { RecordedRunStep } from "@/lib/agents/steps";
import type { AgentContext, PipelineStage, Tables, TypedClient } from "@/lib/agents/types";
import { getAiProvider } from "@/lib/claude/client";
import type { AiProvider, AiScenario, AiUsage } from "@/lib/claude/provider";
import { ok, type Result } from "@/lib/utils/result";
import type { Json } from "@/types/database";

import { buildHugoPromptContext } from "../prompt-context";

import {
  decideStage,
  HUGO_DECISION_TEXTS,
  mergeQualification,
  type StageDecisionReason,
} from "./decision";
import { HUGO_PROMPT_VERSION, HUGO_SYSTEM_PROMPT } from "./prompt";
import { hugoQualificationSchema, type HugoField, type HugoQualification } from "./schema";

export const HUGO_AGENT = "hugo" as const;
export const HUGO_TASK = "hugo_qualification" as const;

/** How many recent history entries are given to the agent as context. */
const HISTORY_LIMIT = 5;

export type HugoRunResult = {
  runId: string;
  contactId: string;
  previousStage: PipelineStage;
  stage: PipelineStage;
  stageChanged: boolean;
  decision: StageDecisionReason;
  decisionText: string;
  qualification: HugoQualification;
  missingFields: HugoField[];
  /** Columns actually written, e.g. ["contacts.sale_motivation"]. */
  updatedColumns: string[];
  task: HumanTaskResult | null;
  isSimulation: boolean;
  provider: string;
  model: string;
  usage: AiUsage;
  /**
   * Steps really measured during this run, in order. Same content as
   * `ai_agent_run_steps` for this run: the UI can replay immediately without a
   * second read, and `getRunSteps(runId)` returns the same thing later.
   */
  steps: readonly RecordedRunStep[];
};

export type RunHugoOptions = {
  /** Injected provider (tests). Defaults to the one selected by AI_PROVIDER. */
  provider?: AiProvider;
  /** Simulator-only scenario, to exercise the guard rails. */
  scenario?: AiScenario;
  now?: Date;
};

type PropertyRow = Pick<
  Tables["properties"]["Row"],
  "id" | "property_type" | "city" | "sector" | "postal_code" | "surface_m2" | "rooms"
>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function runHugoQualification(
  client: TypedClient,
  contactId: string,
  options: RunHugoOptions = {},
): Promise<Result<HugoRunResult>> {
  try {
    if (!UUID_PATTERN.test(contactId)) {
      // Same generic answer as "belongs to another agency": no information leak.
      return failWith<HugoRunResult>("contact_not_found");
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

    // Journalled input: metadata only. The prospect's free text is personal
    // data and is never copied into the AI journal.
    const runInput: Json = {
      task: HUGO_TASK,
      prompt_version: HUGO_PROMPT_VERSION,
      contact_id: contactId,
    };

    const started = await startGuardedRun(client, context, {
      agent: HUGO_AGENT,
      contactId,
      input: runInput,
      provider,
      now: options.now,
    });
    if (started.error) return { data: null, error: started.error };
    const { runId, contact, steps } = started.data;

    // --- inputs: contact, property, recent history ---------------------------
    const propertyQuery = await client
      .from("properties")
      .select("id, property_type, city, sector, postal_code, surface_m2, rooms")
      .eq("agency_id", context.agencyId)
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (propertyQuery.error) {
      await steps.step({
        phase: "context_loaded",
        label: "Lecture du bien impossible : aucune action.",
        status: "failed",
        detail: { error_code: "property_read_failed" },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: "property_read_failed",
        decision: "Lecture du bien impossible : aucune action.",
      });
      return failFromDatabase<HugoRunResult>("runHugoQualification.property", propertyQuery.error);
    }
    const property: PropertyRow | null = propertyQuery.data;

    const historyQuery = await client
      .from("activities")
      .select("type, summary, occurred_at")
      .eq("agency_id", context.agencyId)
      .eq("contact_id", contact.id)
      .order("occurred_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    const history = historyQuery.data ?? [];

    await steps.step({
      phase: "context_loaded",
      label: AGENT_STEP_LABELS.context_loaded,
      detail: {
        contact_stage: contact.stage,
        property_known: property !== null,
        history_entries: history.length,
        has_notes: Boolean(contact.notes && contact.notes.length > 0),
      },
    });

    // --- AI call: prospect content is passed as untrusted DATA ----------------
    const { facts, untrusted } = buildHugoPromptContext({
      stage: contact.stage,
      source: contact.source,
      hasEmail: contact.email !== null,
      hasPhone: contact.phone !== null,
      saleMotivation: contact.sale_motivation,
      saleTimeline: contact.sale_timeline,
      property: {
        known: property !== null,
        type: property?.property_type ?? null,
        city: property?.city ?? null,
        sector: property?.sector ?? null,
        postalCode: property?.postal_code ?? null,
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
        prompt_version: HUGO_PROMPT_VERSION,
        // Counts only: the prospect's text itself never enters the journal.
        untrusted_blocks: untrusted.length,
        untrusted_chars: untrusted.reduce((total, block) => total + block.content.length, 0),
        scenario: options.scenario ?? null,
      },
    });

    const generation = await generateValidated(
      provider,
      {
        task: HUGO_TASK,
        systemPrompt: HUGO_SYSTEM_PROMPT,
        promptVersion: HUGO_PROMPT_VERSION,
        facts,
        untrusted,
        scenario: options.scenario,
      },
      hugoQualificationSchema,
      { steps },
    );

    if (!generation.ok) {
      // Safe fallback: no business write at all, a human takes over.
      const task = await openHumanTask(client, context, {
        contactId: contact.id,
        type: "ai_response_invalid",
        title: AGENT_TASK_TEXTS.ai_response_invalid.title,
        details: AGENT_TASK_TEXTS.ai_response_invalid.details,
        agent: HUGO_AGENT,
        assignedUserId: contact.assigned_user_id,
      });
      await logAgentActivity(client, context, {
        contactId: contact.id,
        type: "ai_response_invalid",
        summary: "Hugo : réponse IA invalide, aucune action. Une tâche a été créée pour un conseiller.",
        payload: { agent: HUGO_AGENT, error_code: generation.error.code },
        agent: HUGO_AGENT,
        isSimulation: provider.isSimulation,
      });
      await steps.step({
        phase: "persisted",
        label: AGENT_STEP_LABELS.no_write,
        status: "failed",
        detail: {
          error_code: generation.error.code,
          task_type: task.data?.type ?? null,
          updated_columns: [],
        },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: generation.error.code,
        decision: "Repli sûr : aucune action, tâche créée pour un humain.",
        usage: generation.usage,
        output: task.data ? { task_id: task.data.id, task_type: task.data.type } : null,
      });
      return { data: null, error: generation.error };
    }

    const qualification = generation.output;

    // --- merge (never overwrite an existing value) and stage rules ------------
    const merged = mergeQualification(
      {
        saleMotivation: contact.sale_motivation,
        saleTimeline: contact.sale_timeline,
        propertyType: property?.property_type ?? null,
        propertyCity: property?.city ?? null,
        propertySector: property?.sector ?? null,
      },
      qualification,
    );

    const decision = decideStage({
      currentStage: contact.stage,
      known: merged.known,
      timeline: merged.timeline,
      confidence: qualification.confidence,
    });

    await steps.step({
      phase: "decision",
      label: HUGO_DECISION_TEXTS[decision.reason],
      detail: {
        decision: decision.reason,
        previous_stage: contact.stage,
        stage: decision.stage,
        stage_changed: decision.changed,
        missing_fields: merged.missingFields,
        confidence: qualification.confidence,
      },
    });

    // --- writes ---------------------------------------------------------------
    const updatedColumns: string[] = [];
    const contactUpdate: Tables["contacts"]["Update"] = { ...merged.contactUpdates };
    if (decision.changed) contactUpdate.stage = decision.stage;

    if (Object.keys(contactUpdate).length > 0) {
      const { error } = await client
        .from("contacts")
        .update(contactUpdate)
        .eq("agency_id", context.agencyId)
        .eq("id", contact.id);
      if (error) {
        await steps.step({
          phase: "persisted",
          label: "Écriture du contact refusée : aucune action.",
          status: "failed",
          detail: { error_code: "contact_update_failed" },
        });
        await finishRun(client, runId, {
          status: "failed",
          error: "contact_update_failed",
          decision: "Écriture refusée : aucune action.",
          usage: generation.usage,
        });
        return failFromDatabase<HugoRunResult>("runHugoQualification.contactUpdate", error);
      }
      updatedColumns.push(...Object.keys(contactUpdate).map((column) => `contacts.${column}`));
    }

    if (Object.keys(merged.propertyUpdates).length > 0) {
      const { error } = property
        ? await client
            .from("properties")
            .update(merged.propertyUpdates)
            .eq("agency_id", context.agencyId)
            .eq("id", property.id)
        : await client
            .from("properties")
            .insert({ agency_id: context.agencyId, contact_id: contact.id, ...merged.propertyUpdates });
      if (error) {
        await steps.step({
          phase: "persisted",
          label: "Écriture du bien refusée : aucune autre action.",
          status: "failed",
          detail: { error_code: "property_write_failed", updated_columns: updatedColumns },
        });
        await finishRun(client, runId, {
          status: "failed",
          error: "property_write_failed",
          decision: "Écriture du bien refusée : aucune autre action.",
          usage: generation.usage,
        });
        return failFromDatabase<HugoRunResult>("runHugoQualification.propertyWrite", error);
      }
      updatedColumns.push(...Object.keys(merged.propertyUpdates).map((column) => `properties.${column}`));
    }

    // --- human task when something is missing or unreliable -------------------
    let task: HumanTaskResult | null = null;
    if (decision.reason === "missing_information") {
      const fields = merged.missingFields as readonly QualificationField[];
      const created = await openHumanTask(client, context, {
        contactId: contact.id,
        type: "missing_information",
        title: AGENT_TASK_TEXTS.missing_information.title,
        details: AGENT_TASK_TEXTS.missing_information.details.replace("{fields}", listFieldLabels(fields)),
        agent: HUGO_AGENT,
        assignedUserId: contact.assigned_user_id,
      });
      task = created.data;
    } else if (decision.reason === "low_confidence") {
      const created = await openHumanTask(client, context, {
        contactId: contact.id,
        type: "qualification_to_review",
        title: AGENT_TASK_TEXTS.qualification_to_review.title,
        details: AGENT_TASK_TEXTS.qualification_to_review.details,
        agent: HUGO_AGENT,
        assignedUserId: contact.assigned_user_id,
      });
      task = created.data;
    }

    // --- CRM history -----------------------------------------------------------
    const decisionText = HUGO_DECISION_TEXTS[decision.reason];
    const activityType =
      decision.reason === "missing_information"
        ? "ai_information_missing"
        : decision.reason === "low_confidence"
          ? "ai_qualification_to_review"
          : "ai_qualification_done";

    await logAgentActivity(client, context, {
      contactId: contact.id,
      type: activityType,
      summary: `Hugo — qualification : ${qualification.summary} ${decisionText}`,
      payload: {
        agent: HUGO_AGENT,
        run_id: runId,
        prompt_version: HUGO_PROMPT_VERSION,
        previous_stage: contact.stage,
        stage: decision.stage,
        missing_fields: merged.missingFields,
        confidence: qualification.confidence,
        updated_columns: updatedColumns,
      },
      agent: HUGO_AGENT,
      isSimulation: provider.isSimulation,
    });

    await steps.step({
      phase: "persisted",
      label: AGENT_STEP_LABELS.persisted,
      detail: {
        updated_columns: updatedColumns,
        activity_type: activityType,
        task_type: task?.type ?? null,
        task_created: task?.created ?? false,
      },
    });

    await finishRun(client, runId, {
      status: "succeeded",
      output: {
        ...qualification,
        decision: decision.reason,
        stage: decision.stage,
        stage_changed: decision.changed,
        updated_columns: updatedColumns,
        task_type: task?.type ?? null,
      } as Json,
      decision: decisionText,
      usage: generation.usage,
    });

    return ok({
      runId,
      contactId: contact.id,
      previousStage: contact.stage,
      stage: decision.stage,
      stageChanged: decision.changed,
      decision: decision.reason,
      decisionText,
      qualification,
      missingFields: merged.missingFields,
      updatedColumns,
      task,
      isSimulation: provider.isSimulation,
      provider: provider.name,
      model: provider.model,
      usage: generation.usage,
      steps: steps.steps,
    });
  } catch (cause) {
    return failFromUnexpected<HugoRunResult>("runHugoQualification", cause);
  }
}
