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
 *   human takeover, contact ownership)  →  run opened in `ai_agent_runs`  →
 *   eligibility (stage, no appointment already active)  →  channel + CONSENT
 *   checked server-side  →  FREE SLOTS COMPUTED BY THE CODE  →  AI call, given
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
import { AGENT_TASK_TEXTS, type AgentErrorCode } from "@/lib/agents/messages";
import { finishRun, startGuardedRun } from "@/lib/agents/runner";
import type { AgentContact, AgentContext, Tables, TypedClient } from "@/lib/agents/types";
import { getAiProvider } from "@/lib/claude/client";
import type { AiChoice, AiFacts, AiProvider, AiScenario, AiUsage } from "@/lib/claude/provider";
import { ok, type Result } from "@/lib/utils/result";
import type { Database, Json } from "@/types/database";

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

function buildFacts(input: {
  contact: AgentContact;
  property: PropertyRow | null;
  agencyName: string;
  channel: MessageChannel;
}): AiFacts {
  return {
    agency_name: input.agencyName,
    // First name only: the minimum needed to write a personalised message.
    contact_first_name: input.contact.first_name,
    contact_stage: input.contact.stage,
    contact_sale_motivation: input.contact.sale_motivation,
    contact_sale_timeline: input.contact.sale_timeline,
    property_known: input.property !== null,
    property_type: input.property?.property_type ?? null,
    property_city: input.property?.city ?? null,
    property_sector: input.property?.sector ?? null,
    property_surface_m2: input.property?.surface_m2 ?? null,
    property_rooms: input.property?.rooms ?? null,
    message_channel: input.channel,
    appointment_duration_minutes: APPOINTMENT_DURATION_MINUTES,
  };
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

    const started = await startGuardedRun(client, context, {
      agent: LOUIS_AGENT,
      contactId,
      input: runInput,
      provider,
      now: options.now,
    });
    if (started.error) return { data: null, error: started.error };
    const { runId, contact, agency } = started.data;

    const now = options.now ?? new Date();

    /** Closes the run without any business write, optionally opening a task. */
    const abort = async (input: {
      code: AgentErrorCode;
      decision: LouisDecisionReason;
      task?: { type: keyof typeof AGENT_TASK_TEXTS; activityType: string };
      usage?: AiUsage;
    }): Promise<Result<LouisRunResult>> => {
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
      await finishRun(client, runId, {
        status: "failed",
        error: "appointments_read_failed",
        decision: "Lecture de l'agenda impossible : aucune action.",
      });
      return failFromDatabase<LouisRunResult>("runLouisAppointment.appointments", appointmentsQuery.error);
    }
    const activeAppointments = appointmentsQuery.data ?? [];

    // --- eligibility ----------------------------------------------------------
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
    const generation = await generateValidated(
      provider,
      {
        task: LOUIS_TASK,
        systemPrompt: LOUIS_SYSTEM_PROMPT,
        promptVersion: LOUIS_PROMPT_VERSION,
        facts: buildFacts({ contact, property, agencyName: agency.name, channel }),
        choices,
        untrusted: [
          { label: "contact_notes", content: contact.notes ?? "" },
          { label: "historique_recent", content: history.map((entry) => entry.summary).join("\n") },
        ],
        scenario: options.scenario,
      },
      createLouisAppointmentSchema(slots.map((slot) => slot.id)),
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
    });
  } catch (cause) {
    return failFromUnexpected<LouisRunResult>("runLouisAppointment", cause);
  }
}
