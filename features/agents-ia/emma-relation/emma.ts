/**
 * Emma — relation: server-side orchestration.
 *
 * Takes an authenticated Supabase client (RLS applies) so the same code is used
 * by the server action and by the integration tests. The server action
 * (`actions.ts`) only builds the client and delegates here.
 *
 * Sequence, in this exact order — every decision with a consequence is taken by
 * the CODE, before or after the AI call, never by the AI:
 *
 *   session + agency (server-side)  →  guard rails (kill switch, daily volume,
 *   HUMAN TAKEOVER, contact ownership)  →  eligibility (stage — signed mandate
 *   or lost file —, no draft already waiting, no follow-up already prepared
 *   today, a VALID CONSENT and usable contact details — a refusal is journaled
 *   as a `blocked` run, not an error)  →  run opened in `ai_agent_runs`  →
 *   eligibility re-checked (race)  →  channel + CURRENT CONSENT
 *   checked server-side  →  idempotency key computed  →  AI call (prospect text
 *   isolated as untrusted data)  →  zod validation (limited retry)  →  draft
 *   written in `pending_validation`, flagged simulation  →  CRM history  →  run
 *   closed.
 *
 * What Emma deliberately does NOT do:
 *   * she never sends anything — nothing in the product can send anything, and
 *     the draft waits for a human of the agency (first contact rule);
 *   * she never picks the channel, the recipient or the moment: the code does,
 *     and refuses outright when the consent of the channel is not `granted`;
 *   * she never changes a pipeline stage, and never writes a figure in euros.
 *
 * Anti double draft, twice over: the code refuses when a follow-up is already
 * waiting for validation, and the idempotency key (one per contact and per Paris
 * day) makes the DATABASE refuse a second insert if two runs race.
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
import type { AiProvider, AiScenario, AiUsage } from "@/lib/claude/provider";
import { ok, type Result } from "@/lib/utils/result";
import type { Database, Json } from "@/types/database";

import { buildEmmaPromptContext } from "../prompt-context";

import {
  CHANNELS_WITH_SUBJECT,
  checkFollowUpEligibility,
  chooseChannel,
  composeMessageBody,
  duplicateFollowUpCode,
  EMMA_DECISION_TEXTS,
  EMMA_STEP_LABELS,
  emmaRefusalDecision,
  followUpIdempotencyKey,
  type EmmaDecisionReason,
  type MessageChannel,
} from "./decision";
import { EMMA_PROMPT_VERSION, EMMA_SYSTEM_PROMPT } from "./prompt";
import { emmaFollowUpSchema, type EmmaFollowUp } from "./schema";

export const EMMA_AGENT = "emma" as const;
export const EMMA_TASK = "emma_follow_up" as const;

/** How many recent history entries are given to the agent as context. */
const HISTORY_LIMIT = 5;

type ConsentChannel = Database["public"]["Enums"]["consent_channel"];
type ConsentStatus = Database["public"]["Enums"]["consent_status"];

type PropertyRow = Pick<
  Tables["properties"]["Row"],
  "id" | "property_type" | "city" | "sector" | "surface_m2" | "rooms"
>;

export type EmmaRunResult = {
  /** Contract with the UI (see docs/workflows.md). */
  messageId: string;
  messageSubject: string | null;
  messageBody: string;
  messageStatus: Database["public"]["Enums"]["outbound_message_status"];
  channel: MessageChannel;
  isSimulation: boolean;
  provider: string;

  runId: string;
  contactId: string;
  model: string;
  idempotencyKey: string;
  angle: EmmaFollowUp["angle"];
  reason: string;
  confidence: number;
  /** Contact stage, unchanged: Emma never moves anybody in the pipeline. */
  stage: Database["public"]["Enums"]["pipeline_stage"];
  decision: EmmaDecisionReason;
  decisionText: string;
  usage: AiUsage;
  /** Steps really measured during this run, in order. */
  steps: readonly RecordedRunStep[];
};

export type RunEmmaOptions = {
  /** Injected provider (tests). Defaults to the one selected by AI_PROVIDER. */
  provider?: AiProvider;
  /** Simulator-only scenario, to exercise the guard rails. */
  scenario?: AiScenario;
  now?: Date;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OutboundStatus = Database["public"]["Enums"]["outbound_message_status"];

/** Status of today's follow-up (by idempotency key), or `null` if none / unreadable. */
async function readFollowUpStatusByKey(
  client: TypedClient,
  context: AgentContext,
  idempotencyKey: string,
): Promise<OutboundStatus | null> {
  const { data, error } = await client
    .from("outbound_messages")
    .select("status")
    .eq("agency_id", context.agencyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) {
    console.error(`[agents] readFollowUpStatusByKey failed (${error.code ?? "?"}): ${error.message}`);
    return null;
  }
  return data?.status ?? null;
}

/**
 * Emma's eligibility, decided before the run is opened (see runner.ts): stage,
 * a draft already waiting, a follow-up already prepared today. A refusal is
 * journaled as a `blocked` run.
 */
async function checkEmmaPrecheck(
  client: TypedClient,
  context: AgentContext,
  contact: AgentContact,
  now: Date,
): Promise<Result<RunRefusal | null>> {
  const pendingQuery = await client
    .from("outbound_messages")
    .select("id")
    .eq("agency_id", context.agencyId)
    .eq("contact_id", contact.id)
    .eq("created_by_agent", EMMA_AGENT)
    .eq("status", "pending_validation")
    .limit(1);
  if (pendingQuery.error) {
    return failFromDatabase<RunRefusal | null>("runEmmaFollowUp.precheck.pending", pendingQuery.error);
  }

  const todayQuery = await client
    .from("outbound_messages")
    .select("status")
    .eq("agency_id", context.agencyId)
    .eq("idempotency_key", followUpIdempotencyKey(contact.id, now))
    .maybeSingle();
  if (todayQuery.error) {
    return failFromDatabase<RunRefusal | null>("runEmmaFollowUp.precheck.today", todayQuery.error);
  }

  const hasPendingFollowUp = (pendingQuery.data ?? []).length > 0;
  const hasFollowUpPreparedToday =
    todayQuery.data !== null && todayQuery.data.status !== "pending_validation";

  const eligibility = checkFollowUpEligibility({
    stage: contact.stage,
    hasPendingFollowUp,
    hasFollowUpPreparedToday,
  });
  if (!eligibility.eligible) {
    const decision = emmaRefusalDecision(eligibility.code);
    return ok({
      code: eligibility.code,
      decision: EMMA_DECISION_TEXTS[decision],
      detail: {
        decision,
        contact_stage: contact.stage,
        pending_follow_up: hasPendingFollowUp,
        prepared_today: hasFollowUpPreparedToday,
        message_created: false,
      },
    });
  }

  // CURRENT consent of the channel, checked server-side before anything else
  // happens. No valid consent (or no usable contact details) is the rule doing
  // its job: journaled `blocked`, and a task is opened for a conseiller.
  const consentsQuery = await client
    .from("current_consents")
    .select("channel, status")
    .eq("agency_id", context.agencyId)
    .eq("contact_id", contact.id);
  if (consentsQuery.error) {
    return failFromDatabase<RunRefusal | null>("runEmmaFollowUp.precheck.consents", consentsQuery.error);
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
  if (channelChoice.channel !== null) return ok(null);

  const consentMissing = channelChoice.code === "consent_not_granted";
  const decision: EmmaDecisionReason = consentMissing ? "consent_missing" : "channel_missing";
  const taskType = consentMissing ? "follow_up_consent_missing" : "follow_up_channel_missing";
  return ok({
    code: consentMissing ? "consent_not_granted" : "follow_up_no_reachable_channel",
    decision: EMMA_DECISION_TEXTS[decision],
    detail: {
      decision,
      contact_stage: contact.stage,
      consent_checked: true,
      task_type: taskType,
      message_created: false,
    },
    afterBlock: async () => {
      const task = await openHumanTask(client, context, {
        contactId: contact.id,
        type: taskType,
        title: AGENT_TASK_TEXTS[taskType].title,
        details: AGENT_TASK_TEXTS[taskType].details,
        agent: EMMA_AGENT,
        assignedUserId: contact.assigned_user_id,
      });
      if (task.error) console.error(`[agents] Emma afterBlock task failed (${task.error.code})`);
    },
  });
}

export async function runEmmaFollowUp(
  client: TypedClient,
  contactId: string,
  options: RunEmmaOptions = {},
): Promise<Result<EmmaRunResult>> {
  try {
    if (!UUID_PATTERN.test(contactId)) {
      // Same generic answer as "belongs to another agency": no information leak.
      return failWith<EmmaRunResult>("contact_not_found");
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
      task: EMMA_TASK,
      prompt_version: EMMA_PROMPT_VERSION,
      contact_id: contactId,
    };

    const now = options.now ?? new Date();

    const started = await startGuardedRun(client, context, {
      agent: EMMA_AGENT,
      contactId,
      input: runInput,
      provider,
      now: options.now,
      // Eligibility is decided BEFORE the run opens, so a refusal is journaled
      // as `blocked` (a rule doing its job), never as an error.
      precheck: (subject) => checkEmmaPrecheck(client, context, subject, now),
    });
    if (started.error) return { data: null, error: started.error };
    const { runId, contact, agency, steps } = started.data;

    /** Closes the run without any business write, optionally opening a task. */
    const abort = async (input: {
      code: AgentErrorCode;
      decision: EmmaDecisionReason;
      task?: { type: keyof typeof AGENT_TASK_TEXTS; activityType: string };
      usage?: AiUsage;
    }): Promise<Result<EmmaRunResult>> => {
      // The user must see why Emma stopped, and that nothing was drafted.
      await steps.step({
        phase: "decision",
        label: EMMA_DECISION_TEXTS[input.decision],
        status: "failed",
        detail: {
          decision: input.decision,
          error_code: input.code,
          task_type: input.task?.type ?? null,
          message_created: false,
        },
      });
      if (input.task) {
        await openHumanTask(client, context, {
          contactId: contact.id,
          type: input.task.type,
          title: AGENT_TASK_TEXTS[input.task.type].title,
          details: AGENT_TASK_TEXTS[input.task.type].details,
          agent: EMMA_AGENT,
          assignedUserId: contact.assigned_user_id,
        });
        await logAgentActivity(client, context, {
          contactId: contact.id,
          type: input.task.activityType,
          summary: `Emma — relance : ${EMMA_DECISION_TEXTS[input.decision]}`,
          payload: { agent: EMMA_AGENT, run_id: runId, error_code: input.code },
          agent: EMMA_AGENT,
          isSimulation: provider.isSimulation,
        });
      }
      await finishRun(client, runId, {
        status: "failed",
        error: input.code,
        decision: EMMA_DECISION_TEXTS[input.decision],
        usage: input.usage,
      });
      return failWith<EmmaRunResult>(input.code);
    };

    // --- inputs: property, existing messages, appointments -------------------
    const propertyQuery = await client
      .from("properties")
      .select("id, property_type, city, sector, surface_m2, rooms")
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
      return failFromDatabase<EmmaRunResult>("runEmmaFollowUp.property", propertyQuery.error);
    }
    const property: PropertyRow | null = propertyQuery.data;

    const messagesQuery = await client
      .from("outbound_messages")
      .select("id, status, created_by_agent, sent_at, created_at")
      .eq("agency_id", context.agencyId)
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (messagesQuery.error) {
      await steps.step({
        phase: "context_loaded",
        label: "Lecture des messages impossible : aucune action.",
        status: "failed",
        detail: { error_code: "messages_read_failed" },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: "messages_read_failed",
        decision: "Lecture des messages impossible : aucune action.",
      });
      return failFromDatabase<EmmaRunResult>("runEmmaFollowUp.messages", messagesQuery.error);
    }
    const messages = messagesQuery.data ?? [];

    const hasPendingFollowUp = messages.some(
      (message) => message.status === "pending_validation" && message.created_by_agent === EMMA_AGENT,
    );
    const lastSentAt = messages
      .map((message) => message.sent_at)
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1);
    const daysSinceLastMessage =
      lastSentAt === undefined
        ? null
        : Math.max(0, Math.floor((now.getTime() - Date.parse(lastSentAt)) / 86_400_000));

    const appointmentsQuery = await client
      .from("appointments")
      .select("id, status")
      .eq("agency_id", context.agencyId)
      .eq("contact_id", contact.id)
      .in("status", ["proposed", "confirmed"]);
    const hasPendingAppointment = (appointmentsQuery.data ?? []).length > 0;

    await steps.step({
      phase: "context_loaded",
      label: AGENT_STEP_LABELS.context_loaded,
      detail: {
        contact_stage: contact.stage,
        property_known: property !== null,
        messages_known: messages.length,
        pending_follow_up: hasPendingFollowUp,
        days_since_last_message: daysSinceLastMessage,
        active_appointments: hasPendingAppointment,
      },
    });

    // --- eligibility ----------------------------------------------------------
    const eligibility = checkFollowUpEligibility({
      stage: contact.stage,
      hasPendingFollowUp,
    });
    if (!eligibility.eligible) {
      // Only reachable if the state changed since the precheck (concurrent
      // run or edit): the run is already open, so it can only end `failed`.
      return abort({ code: eligibility.code, decision: emmaRefusalDecision(eligibility.code) });
    }

    // --- channel and CURRENT consent, checked server-side ---------------------
    // Already checked by the precheck (refusal journaled `blocked`). Re-read
    // here because the channel used for the draft must come from THIS read:
    // a consent withdrawn in between ends the run (`failed`, race only).
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
      return failFromDatabase<EmmaRunResult>("runEmmaFollowUp.consents", consentsQuery.error);
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
            task: { type: "follow_up_consent_missing", activityType: "ai_consent_missing" },
          })
        : abort({
            code: "follow_up_no_reachable_channel",
            decision: "channel_missing",
            task: { type: "follow_up_channel_missing", activityType: "ai_contact_details_missing" },
          });
    }
    const channel: MessageChannel = channelChoice.channel;
    const idempotencyKey = followUpIdempotencyKey(contact.id, now);

    // Everything with a consequence is decided BEFORE the model is called.
    await steps.step({
      phase: "decision",
      label: EMMA_STEP_LABELS.rules_applied,
      detail: {
        stage: contact.stage,
        channel,
        consent_checked: true,
        consent_status: consents[channel] ?? null,
        // Flags only: the key contains the contact id, which is not displayable
        // business data but is still an identifier — only its presence is logged.
        idempotency_key_set: idempotencyKey.length > 0,
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

    const { facts, untrusted } = buildEmmaPromptContext({
      agencyName: agency.name,
      contactFirstName: contact.first_name,
      contactStage: contact.stage,
      contactSource: contact.source,
      saleMotivation: contact.sale_motivation,
      saleTimeline: contact.sale_timeline,
      property: {
        known: property !== null,
        type: property?.property_type ?? null,
        city: property?.city ?? null,
        sector: property?.sector ?? null,
        surfaceM2: property?.surface_m2 ?? null,
        rooms: property?.rooms ?? null,
      },
      channel,
      daysSinceLastMessage,
      hasPendingAppointment,
      contactText: {
        notes: contact.notes,
        historySummaries: history.map((entry) => entry.summary),
      },
    });

    await steps.step({
      phase: "prompt_built",
      label: AGENT_STEP_LABELS.prompt_built,
      detail: {
        prompt_version: EMMA_PROMPT_VERSION,
        // Counts only: the prospect's text itself never enters the journal.
        untrusted_blocks: untrusted.length,
        untrusted_chars: untrusted.reduce((total, block) => total + block.content.length, 0),
        channel,
        scenario: options.scenario ?? null,
      },
    });

    const generation = await generateValidated(
      provider,
      {
        task: EMMA_TASK,
        systemPrompt: EMMA_SYSTEM_PROMPT,
        promptVersion: EMMA_PROMPT_VERSION,
        facts,
        untrusted,
        scenario: options.scenario,
      },
      emmaFollowUpSchema,
      { steps },
    );

    if (!generation.ok) {
      // Safe fallback: no draft at all, a human takes over.
      const task = await openHumanTask(client, context, {
        contactId: contact.id,
        type: "ai_response_invalid",
        title: AGENT_TASK_TEXTS.ai_response_invalid.title,
        details: AGENT_TASK_TEXTS.ai_response_invalid.details,
        agent: EMMA_AGENT,
        assignedUserId: contact.assigned_user_id,
      });
      await logAgentActivity(client, context, {
        contactId: contact.id,
        type: "ai_response_invalid",
        summary:
          "Emma : réponse IA invalide, aucun brouillon préparé. Une tâche a été créée pour un conseiller.",
        payload: { agent: EMMA_AGENT, run_id: runId, error_code: generation.error.code },
        agent: EMMA_AGENT,
        isSimulation: provider.isSimulation,
      });
      await steps.step({
        phase: "persisted",
        label: AGENT_STEP_LABELS.no_write,
        status: "failed",
        detail: {
          error_code: generation.error.code,
          task_type: task.data?.type ?? null,
          message_created: false,
        },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: generation.error.code,
        decision: EMMA_DECISION_TEXTS.invalid_output,
        usage: generation.usage,
        output: task.data ? { task_id: task.data.id, task_type: task.data.type } : null,
      });
      return { data: null, error: generation.error };
    }

    const draft = generation.output;

    // --- writes ---------------------------------------------------------------
    // The subject is kept only for a channel that has one, and the unsubscribe
    // notice is appended by the code: neither depends on what the model wrote.
    const subject = (CHANNELS_WITH_SUBJECT as readonly string[]).includes(channel)
      ? draft.message_subject
      : null;
    const body = composeMessageBody(draft.message_body, null);

    const messageInsert = await client
      .from("outbound_messages")
      .insert({
        agency_id: context.agencyId,
        contact_id: contact.id,
        channel,
        subject,
        body,
        // Nothing leaves the product: a human of the agency validates first.
        status: "pending_validation",
        is_simulation: true,
        created_by_agent: EMMA_AGENT,
        idempotency_key: idempotencyKey,
      })
      .select("id, status")
      .single();

    if (messageInsert.error) {
      // 23505 = the same follow-up already exists for this contact today: the
      // database refused the double draft. Nothing was written twice. Which
      // message applies depends on what became of the existing one.
      const isDuplicate = databaseErrorCode(messageInsert.error) === "duplicate";
      const code: AgentErrorCode = isDuplicate
        ? duplicateFollowUpCode(await readFollowUpStatusByKey(client, context, idempotencyKey))
        : databaseErrorCode(messageInsert.error);
      const duplicateDecision =
        code === "follow_up_already_drafted"
          ? EMMA_DECISION_TEXTS.already_drafted
          : EMMA_DECISION_TEXTS.already_prepared_today;
      await steps.step({
        phase: "persisted",
        label: isDuplicate
          ? "Double relance refusée par la base : aucun second brouillon."
          : "Écriture du brouillon refusée par la base : aucune action.",
        status: "failed",
        detail: { error_code: code, message_created: false },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: code,
        decision: isDuplicate
          ? duplicateDecision
          : "Écriture du brouillon refusée par la base : aucune action.",
        usage: generation.usage,
      });
      console.error(
        `[agents] runEmmaFollowUp.message failed (${messageInsert.error.code ?? "?"}): ${messageInsert.error.message}`,
      );
      return failWith<EmmaRunResult>(code);
    }
    const message = messageInsert.data;

    await logAgentActivity(client, context, {
      contactId: contact.id,
      type: "message_drafted",
      summary: `Emma — relance : brouillon préparé (${channel}). ${EMMA_DECISION_TEXTS.drafted}`,
      payload: {
        agent: EMMA_AGENT,
        run_id: runId,
        prompt_version: EMMA_PROMPT_VERSION,
        message_id: message.id,
        channel,
        angle: draft.angle,
        confidence: draft.confidence,
        consent_checked: true,
      },
      agent: EMMA_AGENT,
      isSimulation: provider.isSimulation,
    });

    await steps.step({
      phase: "persisted",
      label: EMMA_STEP_LABELS.drafted,
      detail: {
        message_id: message.id,
        message_status: message.status,
        channel,
        angle: draft.angle,
        is_simulation: true,
        // The pipeline stage is deliberately untouched.
        stage_changed: false,
      },
    });

    await finishRun(client, runId, {
      status: "succeeded",
      output: {
        message_id: message.id,
        message_status: message.status,
        channel,
        angle: draft.angle,
        reason: draft.reason,
        confidence: draft.confidence,
        stage: contact.stage,
      } as Json,
      decision: EMMA_DECISION_TEXTS.drafted,
      usage: generation.usage,
    });

    return ok({
      messageId: message.id,
      messageSubject: subject,
      messageBody: body,
      messageStatus: message.status,
      channel,
      isSimulation: provider.isSimulation,
      provider: provider.name,

      runId,
      contactId: contact.id,
      model: provider.model,
      idempotencyKey,
      angle: draft.angle,
      reason: draft.reason,
      confidence: draft.confidence,
      stage: contact.stage,
      decision: "drafted",
      decisionText: EMMA_DECISION_TEXTS.drafted,
      usage: generation.usage,
      steps: steps.steps,
    });
  } catch (cause) {
    return failFromUnexpected<EmmaRunResult>("runEmmaFollowUp", cause);
  }
}
