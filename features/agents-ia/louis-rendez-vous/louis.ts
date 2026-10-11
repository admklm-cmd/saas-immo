/**
 * Louis — rendez-vous: server-side orchestration.
 *
 * Takes an authenticated Supabase client (RLS applies) so the same code is used
 * by the server action and by the integration tests. The server action
 * (`actions.ts`) only builds the client and delegates here.
 *
 * Sequence, in this exact order — every decision with a consequence is taken by
 * the CODE, before or after the AI call, never by the AI:
 *
 *   session + agency (server-side)  →  guard rails (kill switch, daily volume,
 *   human takeover, contact ownership)  →  precheck: eligibility (stage, no
 *   appointment already active), channel + CONSENT, free slots on the diary —
 *   a refusal is journaled as a `blocked` run (a rule doing its job, not an
 *   error), with a human task when a conseiller has something to do  →  run
 *   opened in `ai_agent_runs`  →  eligibility, channel + CONSENT re-checked on
 *   data re-read inside the run (a change in between is a race: `failed`)  →
 *   FREE SLOTS COMPUTED BY THE CODE  →  AI call, given
 *   only that closed list  →  zod validation, slot must be in the list  →
 *   appointment `proposed` (double booking refused by the database) →  message
 *   `pending_validation`, flagged simulation  →  CRM history  →  run closed.
 *
 * What Louis deliberately does NOT do:
 *   * he never sends anything (no provider is wired, and the draft waits for a
 *     human validation — first contact rule);
 *   * he never moves the contact to `rdv_planifie`: that stage means a confirmed
 *     appointment, and a human confirms it;
 *   * he never writes a date of his own.
 */

import { generateValidated } from "@/lib/agents/ai-task";
import { resolveAgentContext } from "@/lib/agents/context";
import { databaseErrorCode, failFromDatabase, failFromUnexpected, failWith } from "@/lib/agents/errors";
import { logAgentActivity, openHumanTask } from "@/lib/agents/journal";
import { AGENT_STEP_LABELS, AGENT_TASK_TEXTS, type AgentErrorCode } from "@/lib/agents/messages";
import { finishRun, startGuardedRun, type RunRefusal } from "@/lib/agents/runner";
import type { RecordedRunStep } from "@/lib/agents/steps";
import type { AgentContact, AgentContext, Tables, TypedClient } from "@/lib/agents/types";
import { getAiProvider } from "@/lib/claude/client";
import type { AiChoice, AiProvider, AiScenario, AiUsage } from "@/lib/claude/provider";
import { ok, type Result } from "@/lib/utils/result";
import type { Database, Json } from "@/types/database";

import { buildLouisPromptContext } from "../prompt-context";

import {
  checkEligibility,
  chooseChannel,
  composeMessageBody,
  LOUIS_DECISION_TEXTS,
  type LouisDecisionReason,
  type MessageChannel,
} from "./decision";
import { LOUIS_PROMPT_VERSION, LOUIS_SYSTEM_PROMPT } from "./prompt";
import { createLouisAppointmentSchema } from "./schema";
import { APPOINTMENT_DURATION_MINUTES, computeFreeSlots, SLOT_HORIZON_DAYS, type BusyInterval, type FreeSlot } from "./slots";

export const LOUIS_AGENT = "louis" as const;
export const LOUIS_TASK = "louis_appointment" as const;

/** How many recent history entries are given to the agent as context. */
const HISTORY_LIMIT = 5;

/** Appointment statuses that really hold a slot. */
const ACTIVE_APPOINTMENT_STATUSES = ["proposed", "confirmed"] as const;

type ConsentChannel = Database["public"]["Enums"]["consent_channel"];
type ConsentStatus = Database["public"]["Enums"]["consent_status"];

export type LouisRunResult = {
  /** Contract with the UI (see docs/workflows.md). */
  appointmentId: string;
  /** ISO 8601 instant of the proposed slot. */
  startsAt: string;
  endsAt: string;
  messageId: string;
  messageBody: string;
  isSimulation: boolean;
  provider: string;
  /** Set only when a guard rail stopped the run (never on a successful run). */
  blocked?: { reason: string };

  // --- additional, non-breaking details -------------------------------------
  runId: string;
  contactId: string;
  model: string;
  /** French label of the slot, e.g. "mardi 22 septembre 2026, de 10:00 à 11:00…". */
  slotLabel: string;
  slotId: string;
  /** Slots the code offered for this run (the AI could only choose among these). */
  offeredSlots: FreeSlot[];
  channel: MessageChannel;
  messageSubject: string;
  messageStatus: Database["public"]["Enums"]["outbound_message_status"];
  appointmentStatus: Database["public"]["Enums"]["appointment_status"];
  assignedUserId: string;
  /** Contact stage, unchanged: `rdv_planifie` requires a human confirmation. */
  stage: Database["public"]["Enums"]["pipeline_stage"];
  decision: LouisDecisionReason;
  decisionText: string;
  reason: string;
  confidence: number;
  usage: AiUsage;
  /**
   * Steps really measured during this run, in order. Same content as
   * `ai_agent_run_steps` for this run: the UI can replay immediately without a
   * second read, and `getRunSteps(runId)` returns the same thing later.
   */
  steps: readonly RecordedRunStep[];
};

export type RunLouisOptions = {
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

/**
 * Louis's refusals, ALL decided before the run is opened (see runner.ts), in
 * the same order as inside the run: eligibility (stage, no appointment already
 * active), then channel and CURRENT consent, then free slots computed by the
 * code on the agency's diary. A refusal is journaled as a `blocked` run — a
 * rule doing its job, never an error — with no AI call, no quota consumed and
 * no write by the agent; when a conseiller has something to do, a human task is
 * opened (`afterBlock`). The run re-reads the diary and the consents once it is
 * opened: a condition that changed in between (race) still ends `failed`.
 */
async function checkLouisPrecheck(
  client: TypedClient,
  context: AgentContext,
  contact: AgentContact,
  now: Date,
): Promise<Result<RunRefusal | null>> {
  // Same window and filters as the diary read inside the run.
  const horizonEnd = new Date(now.getTime() + (SLOT_HORIZON_DAYS + 1) * 86_400_000);
  const diaryQuery = await client
    .from("appointments")
    .select("contact_id, starts_at, ends_at")
    .eq("agency_id", context.agencyId)
    .in("status", ACTIVE_APPOINTMENT_STATUSES)
    .gte("ends_at", now.toISOString())
    .lte("starts_at", horizonEnd.toISOString());
  if (diaryQuery.error) {
    return failFromDatabase<RunRefusal | null>("runLouisAppointment.precheck", diaryQuery.error);
  }
  const diary = diaryQuery.data ?? [];

  // --- A. eligibility ---------------------------------------------------------
  const hasActiveAppointment = diary.some((row) => row.contact_id === contact.id);
  const eligibility = checkEligibility({ stage: contact.stage, hasActiveAppointment });
  if (!eligibility.eligible) {
    return ok({
      code: eligibility.code,
      decision: LOUIS_DECISION_TEXTS.not_eligible,
      detail: {
        decision: "not_eligible",
        contact_stage: contact.stage,
        active_appointment: hasActiveAppointment,
        appointment_created: false,
        message_created: false,
      },
    });
  }

  /** Opens the conseiller's task once the blocked run is journaled. */
  const taskAfterBlock = (taskType: "appointment_consent_missing" | "appointment_channel_missing" | "appointment_no_slot") =>
    async (): Promise<void> => {
      const task = await openHumanTask(client, context, {
        contactId: contact.id,
        type: taskType,
        title: AGENT_TASK_TEXTS[taskType].title,
        details: AGENT_TASK_TEXTS[taskType].details,
        agent: LOUIS_AGENT,
        assignedUserId: contact.assigned_user_id,
      });
      if (task.error) console.error(`[agents] Louis afterBlock task failed (${task.error.code})`);
    };

  // --- B. channel and CURRENT consent, checked server-side --------------------
  const consentsQuery = await client
    .from("current_consents")
    .select("channel, status")
    .eq("agency_id", context.agencyId)
    .eq("contact_id", contact.id);
  if (consentsQuery.error) {
    return failFromDatabase<RunRefusal | null>("runLouisAppointment.precheck.consents", consentsQuery.error);
  }
  const consents: Partial<Record<ConsentChannel, ConsentStatus>> = {};
  for (const row of consentsQuery.data ?? []) {
    if (row.channel && row.status) consents[row.channel] = row.status;
  }
  const channelChoice = chooseChannel({
    hasEmail: Boolean(contact.email),
    hasPhone: Boolean(contact.phone),
    consents,
  });
  if (channelChoice.channel === null) {
    const consentMissing = channelChoice.code === "consent_not_granted";
    const decision: LouisDecisionReason = consentMissing ? "consent_missing" : "channel_missing";
    const taskType = consentMissing ? "appointment_consent_missing" : "appointment_channel_missing";
    return ok({
      code: consentMissing ? "consent_not_granted" : "appointment_no_reachable_channel",
      decision: LOUIS_DECISION_TEXTS[decision],
      detail: {
        decision,
        contact_stage: contact.stage,
        consent_checked: true,
        task_type: taskType,
        appointment_created: false,
        message_created: false,
      },
      afterBlock: taskAfterBlock(taskType),
    });
  }

  // --- C. free slots, computed by the code on the diary just read -------------
  const slots = computeFreeSlots({
    now,
    busy: diary.map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at })),
  });
  if (slots.length === 0) {
    return ok({
      code: "appointment_no_available_slot",
      decision: LOUIS_DECISION_TEXTS.no_slot,
      detail: {
        decision: "no_slot",
        contact_stage: contact.stage,
        consent_checked: true,
        free_slots: 0,
        horizon_days: SLOT_HORIZON_DAYS,
        task_type: "appointment_no_slot",
        appointment_created: false,
        message_created: false,
      },
      afterBlock: taskAfterBlock("appointment_no_slot"),
    });
  }

  return ok(null);
}

/**
 * Why the appointment could not be written. These codes all mean the same thing
 * for the agency: nothing was booked, nothing was written, the attempt lost a
 * race against another booking. Measured on the local stack, two concurrent
 * bookings of the same range produce an exclusion violation (23P01) and, from
 * time to time, a deadlock (40P01) — both are the database doing its job.
 * Neither can leave a half-created appointment behind: each PostgREST write is
 * its own transaction and was rolled back.
 */
function appointmentConflictCode(error: { code?: string | null; message?: string | null }): AgentErrorCode {
  switch ((error.code ?? "").trim()) {
    case "23P01": // appointments_no_overlap
    case "40P01": // deadlock_detected
    case "40001": // serialization_failure
      return "appointment_slot_taken";
    default:
      return databaseErrorCode(error);
  }
}

export async function runLouisAppointment(
  client: TypedClient,
  contactId: string,
  options: RunLouisOptions = {},
): Promise<Result<LouisRunResult>> {
  try {
    if (!UUID_PATTERN.test(contactId)) {
      // Same generic answer as "belongs to another agency": no information leak.
      return failWith<LouisRunResult>("contact_not_found");
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

    // Journalled input: metadata only, never the prospect's free text.
    const runInput: Json = {
      task: LOUIS_TASK,
      prompt_version: LOUIS_PROMPT_VERSION,
      contact_id: contactId,
    };

    const now = options.now ?? new Date();

    const started = await startGuardedRun(client, context, {
      agent: LOUIS_AGENT,
      contactId,
      input: runInput,
      provider,
      now: options.now,
      // Eligibility is decided BEFORE the run opens, so a refusal is journaled
      // as `blocked` (a rule doing its job), never as an error.
      precheck: (subject) => checkLouisPrecheck(client, context, subject, now),
    });
    if (started.error) return { data: null, error: started.error };
    const { runId, contact, agency, steps } = started.data;

    /** Closes the run without any business write, optionally opening a task. */
    const abort = async (input: {
      code: AgentErrorCode;
      decision: LouisDecisionReason;
      task?: { type: keyof typeof AGENT_TASK_TEXTS; activityType: string };
      usage?: AiUsage;
    }): Promise<Result<LouisRunResult>> => {
      // The user must see why Louis stopped, and that nothing was booked.
      await steps.step({
        phase: "decision",
        label: LOUIS_DECISION_TEXTS[input.decision],
        status: "failed",
        detail: {
          decision: input.decision,
          error_code: input.code,
          task_type: input.task?.type ?? null,
          appointment_created: false,
          message_created: false,
        },
      });
      if (input.task) {
        await openHumanTask(client, context, {
          contactId: contact.id,
          type: input.task.type,
          title: AGENT_TASK_TEXTS[input.task.type].title,
          details: AGENT_TASK_TEXTS[input.task.type].details,
          agent: LOUIS_AGENT,
          assignedUserId: contact.assigned_user_id,
        });
        await logAgentActivity(client, context, {
          contactId: contact.id,
          type: input.task.activityType,
          summary: `Louis — rendez-vous : ${LOUIS_DECISION_TEXTS[input.decision]}`,
          payload: { agent: LOUIS_AGENT, run_id: runId, error_code: input.code },
          agent: LOUIS_AGENT,
          isSimulation: provider.isSimulation,
        });
      }
      await finishRun(client, runId, {
        status: "failed",
        error: input.code,
        decision: LOUIS_DECISION_TEXTS[input.decision],
        usage: input.usage,
      });
      return failWith<LouisRunResult>(input.code);
    };

    // --- inputs: property, active appointments, consents, history -------------
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
      return failFromDatabase<LouisRunResult>("runLouisAppointment.property", propertyQuery.error);
    }
    const property: PropertyRow | null = propertyQuery.data;

    // Every slot already held in the agency's diary, from now to the horizon.
    const horizonEnd = new Date(now.getTime() + (SLOT_HORIZON_DAYS + 1) * 86_400_000);
    const appointmentsQuery = await client
      .from("appointments")
      .select("id, contact_id, starts_at, ends_at, status")
      .eq("agency_id", context.agencyId)
      .in("status", ACTIVE_APPOINTMENT_STATUSES)
      .gte("ends_at", now.toISOString())
      .lte("starts_at", horizonEnd.toISOString());

    if (appointmentsQuery.error) {
      await steps.step({
        phase: "context_loaded",
        label: "Lecture de l'agenda impossible : aucune action.",
        status: "failed",
        detail: { error_code: "appointments_read_failed" },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: "appointments_read_failed",
        decision: "Lecture de l'agenda impossible : aucune action.",
      });
      return failFromDatabase<LouisRunResult>("runLouisAppointment.appointments", appointmentsQuery.error);
    }
    const activeAppointments = appointmentsQuery.data ?? [];

    await steps.step({
      phase: "context_loaded",
      label: AGENT_STEP_LABELS.context_loaded,
      detail: {
        contact_stage: contact.stage,
        property_known: property !== null,
        active_appointments: activeAppointments.length,
        horizon_days: SLOT_HORIZON_DAYS,
      },
    });

    // --- eligibility, re-checked on the diary read inside the run -------------
    // The precheck already refused (as `blocked`) everything it could see; what
    // is refused from here on changed in between: a race, journaled `failed`.
    const eligibility = checkEligibility({
      stage: contact.stage,
      hasActiveAppointment: activeAppointments.some((row) => row.contact_id === contact.id),
    });
    if (!eligibility.eligible) {
      return abort({ code: eligibility.code, decision: "not_eligible" });
    }

    // --- channel and consent, checked server-side -----------------------------
    const consentsQuery = await client
      .from("current_consents")
      .select("channel, status")
      .eq("agency_id", context.agencyId)
      .eq("contact_id", contact.id);

    if (consentsQuery.error) {
      await steps.step({
        phase: "context_loaded",
        label: "Lecture des consentements impossible : aucune action.",
        status: "failed",
        detail: { error_code: "consents_read_failed" },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: "consents_read_failed",
        decision: "Lecture des consentements impossible : aucune action.",
      });
      return failFromDatabase<LouisRunResult>("runLouisAppointment.consents", consentsQuery.error);
    }

    const consents: Partial<Record<ConsentChannel, ConsentStatus>> = {};
    for (const row of consentsQuery.data ?? []) {
      if (row.channel && row.status) consents[row.channel] = row.status;
    }

    const channelChoice = chooseChannel({
      hasEmail: Boolean(contact.email),
      hasPhone: Boolean(contact.phone),
      consents,
    });
    if (channelChoice.channel === null) {
      return channelChoice.code === "consent_not_granted"
        ? abort({
            code: "consent_not_granted",
            decision: "consent_missing",
            task: { type: "appointment_consent_missing", activityType: "ai_consent_missing" },
          })
        : abort({
            code: "appointment_no_reachable_channel",
            decision: "channel_missing",
            task: { type: "appointment_channel_missing", activityType: "ai_contact_details_missing" },
          });
    }
    const channel: MessageChannel = channelChoice.channel;

    // --- FREE SLOTS: computed by the code, never by the AI ---------------------
    const busy: BusyInterval[] = activeAppointments.map((row) => ({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    }));
    const slots = computeFreeSlots({ now, busy });

    if (slots.length === 0) {
      return abort({
        code: "appointment_no_available_slot",
        decision: "no_slot",
        task: { type: "appointment_no_slot", activityType: "ai_no_available_slot" },
      });
    }

    const slotById = new Map(slots.map((slot) => [slot.id, slot]));
    const choices: AiChoice[] = slots.map((slot) => ({ id: slot.id, label: slot.label }));

    // Everything that has a consequence has already been decided, BY THE CODE,
    // before the AI is even called: eligibility, channel, consent, free slots.
    await steps.step({
      phase: "decision",
      label:
        "Règles du code appliquées : éligibilité, canal et consentement vérifiés, créneaux libres calculés.",
      detail: {
        stage: contact.stage,
        channel,
        consent_checked: true,
        free_slots: slots.length,
        slot_ids: slots.map((slot) => slot.id),
      },
    });

    // --- history (untrusted) ---------------------------------------------------
    const historyQuery = await client
      .from("activities")
      .select("summary, occurred_at")
      .eq("agency_id", context.agencyId)
      .eq("contact_id", contact.id)
      .order("occurred_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    const history = historyQuery.data ?? [];

    // --- AI call: it may only choose a slot and write the wording --------------
    const { facts, untrusted } = buildLouisPromptContext({
      agencyName: agency.name,
      contactFirstName: contact.first_name,
      contactStage: contact.stage,
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
      channel,
      appointmentDurationMinutes: APPOINTMENT_DURATION_MINUTES,
      contactText: {
        notes: contact.notes,
        historySummaries: history.map((entry) => entry.summary),
      },
    });

    await steps.step({
      phase: "prompt_built",
      label: AGENT_STEP_LABELS.prompt_built,
      detail: {
        prompt_version: LOUIS_PROMPT_VERSION,
        // Counts only: the prospect's text itself never enters the journal.
        untrusted_blocks: untrusted.length,
        untrusted_chars: untrusted.reduce((total, block) => total + block.content.length, 0),
        offered_slots: choices.length,
        scenario: options.scenario ?? null,
      },
    });

    const generation = await generateValidated(
      provider,
      {
        task: LOUIS_TASK,
        systemPrompt: LOUIS_SYSTEM_PROMPT,
        promptVersion: LOUIS_PROMPT_VERSION,
        facts,
        choices,
        untrusted,
        scenario: options.scenario,
      },
      createLouisAppointmentSchema(slots.map((slot) => slot.id)),
      { steps },
    );

    if (!generation.ok) {
      // Safe fallback: no appointment, no message, a human takes over. This is
      // also the path taken when the AI picked a slot outside the list.
      const task = await openHumanTask(client, context, {
        contactId: contact.id,
        type: "ai_response_invalid",
        title: AGENT_TASK_TEXTS.ai_response_invalid.title,
        details: AGENT_TASK_TEXTS.ai_response_invalid.details,
        agent: LOUIS_AGENT,
        assignedUserId: contact.assigned_user_id,
      });
      await logAgentActivity(client, context, {
        contactId: contact.id,
        type: "ai_response_invalid",
        summary:
          "Louis : réponse IA invalide ou créneau hors liste, aucune action. Une tâche a été créée pour un conseiller.",
        payload: { agent: LOUIS_AGENT, run_id: runId, error_code: generation.error.code },
        agent: LOUIS_AGENT,
        isSimulation: provider.isSimulation,
      });
      await steps.step({
        phase: "persisted",
        label: AGENT_STEP_LABELS.no_write,
        status: "failed",
        detail: {
          error_code: generation.error.code,
          task_type: task.data?.type ?? null,
          appointment_created: false,
          message_created: false,
        },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: generation.error.code,
        decision: LOUIS_DECISION_TEXTS.invalid_output,
        usage: generation.usage,
        output: task.data ? { task_id: task.data.id, task_type: task.data.type } : null,
      });
      return { data: null, error: generation.error };
    }

    const proposal = generation.output;
    // Defence in depth: the slot is re-read from the code's own map, never from
    // anything the model wrote.
    const slot = slotById.get(proposal.slot_id);
    if (!slot) {
      return abort({
        code: "ai_response_invalid",
        decision: "invalid_output",
        task: { type: "ai_response_invalid", activityType: "ai_response_invalid" },
        usage: generation.usage,
      });
    }

    await steps.step({
      phase: "decision",
      label: `Créneau retenu, relu depuis la table du code : ${slot.label}`,
      detail: {
        slot_id: slot.id,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        offered_slots: slots.length,
        confidence: proposal.confidence,
        // The pipeline stage is deliberately untouched: `rdv_planifie` means a
        // CONFIRMED appointment, and a human confirms it.
        stage_changed: false,
      },
    });

    // --- writes ---------------------------------------------------------------
    const assignedUserId = contact.assigned_user_id ?? context.userId;

    const appointmentInsert = await client
      .from("appointments")
      .insert({
        agency_id: context.agencyId,
        contact_id: contact.id,
        property_id: property?.id ?? null,
        assigned_user_id: assignedUserId,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        // Proposed, never confirmed: a human confirms an appointment.
        status: "proposed",
        is_simulation: provider.isSimulation,
      })
      .select("id, status")
      .single();

    if (appointmentInsert.error) {
      // 23P01 (exclusion constraint) = the slot was taken between the read and
      // the write. The database, not the code, is what makes this race safe.
      const code = appointmentConflictCode(appointmentInsert.error);
      await steps.step({
        phase: "persisted",
        label:
          code === "appointment_slot_taken"
            ? "Créneau pris entre-temps : la base a refusé, rien n'a été réservé."
            : "Réservation refusée par la base : aucune action.",
        status: "failed",
        detail: { error_code: code, appointment_created: false, message_created: false },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: code,
        decision:
          code === "appointment_slot_taken"
            ? LOUIS_DECISION_TEXTS.slot_taken
            : "Réservation refusée par la base : aucune action.",
        usage: generation.usage,
      });
      console.error(
        `[agents] runLouisAppointment.appointment failed (${appointmentInsert.error.code ?? "?"}): ${appointmentInsert.error.message}`,
      );
      return failWith<LouisRunResult>(code);
    }
    const appointment = appointmentInsert.data;

    const messageBody = composeMessageBody(proposal.message_body, null);
    const messageInsert = await client
      .from("outbound_messages")
      .insert({
        agency_id: context.agencyId,
        contact_id: contact.id,
        channel,
        subject: proposal.message_subject,
        body: messageBody,
        // Nothing leaves the product: a human of the agency validates first.
        status: "pending_validation",
        is_simulation: true,
        created_by_agent: LOUIS_AGENT,
        idempotency_key: `louis-${runId}`,
      })
      .select("id, status")
      .single();

    if (messageInsert.error) {
      // Compensate: no orphan appointment holding a slot for a message that
      // does not exist.
      await client
        .from("appointments")
        .delete()
        .eq("agency_id", context.agencyId)
        .eq("id", appointment.id);
      await steps.step({
        phase: "persisted",
        label: "Message impossible à préparer : le créneau réservé a été libéré, aucune action.",
        status: "failed",
        detail: {
          error_code: "outbound_message_insert_failed",
          appointment_created: false,
          appointment_rolled_back: true,
          message_created: false,
        },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: "outbound_message_insert_failed",
        decision: "Message impossible à préparer : le créneau réservé a été libéré, aucune action.",
        usage: generation.usage,
      });
      return failFromDatabase<LouisRunResult>("runLouisAppointment.message", messageInsert.error);
    }
    const message = messageInsert.data;

    // --- CRM history -----------------------------------------------------------
    await logAgentActivity(client, context, {
      contactId: contact.id,
      type: "appointment_proposed",
      summary: `Louis — rendez-vous : créneau proposé, ${slot.label}. ${LOUIS_DECISION_TEXTS.proposed}`,
      payload: {
        agent: LOUIS_AGENT,
        run_id: runId,
        prompt_version: LOUIS_PROMPT_VERSION,
        appointment_id: appointment.id,
        message_id: message.id,
        channel,
        slot_id: slot.id,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        offered_slots: slots.length,
        confidence: proposal.confidence,
      },
      agent: LOUIS_AGENT,
      isSimulation: provider.isSimulation,
    });

    await steps.step({
      phase: "persisted",
      label:
        "Rendez-vous créé en « proposé » et message mis en attente de validation : rien n'est envoyé.",
      detail: {
        appointment_id: appointment.id,
        appointment_status: appointment.status,
        message_id: message.id,
        message_status: message.status,
        channel,
        is_simulation: true,
      },
    });

    await finishRun(client, runId, {
      status: "succeeded",
      output: {
        slot_id: slot.id,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        appointment_id: appointment.id,
        appointment_status: appointment.status,
        message_id: message.id,
        message_status: message.status,
        channel,
        offered_slots: slots.length,
        reason: proposal.reason,
        confidence: proposal.confidence,
        // The pipeline stage is deliberately untouched.
        stage: contact.stage,
      } as Json,
      decision: LOUIS_DECISION_TEXTS.proposed,
      usage: generation.usage,
    });

    return ok({
      appointmentId: appointment.id,
      // Canonical ISO-8601 UTC ("…Z"), as computed by the code. PostgREST
      // echoes back "+00:00", which is the same instant in another spelling:
      // the UI must always receive one stable format.
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      messageId: message.id,
      messageBody,
      isSimulation: provider.isSimulation,
      provider: provider.name,

      runId,
      contactId: contact.id,
      model: provider.model,
      slotLabel: slot.label,
      slotId: slot.id,
      offeredSlots: slots,
      channel,
      messageSubject: proposal.message_subject,
      messageStatus: message.status,
      appointmentStatus: appointment.status,
      assignedUserId,
      stage: contact.stage,
      decision: "proposed",
      decisionText: LOUIS_DECISION_TEXTS.proposed,
      reason: proposal.reason,
      confidence: proposal.confidence,
      usage: generation.usage,
      steps: steps.steps,
    });
  } catch (cause) {
    return failFromUnexpected<LouisRunResult>("runLouisAppointment", cause);
  }
}
