/**
 * Léa — acquisition: server-side orchestration.
 *
 * Takes an authenticated Supabase client (RLS applies) so the same code is used
 * by the server action and by the integration tests. The server action
 * (`actions.ts`) only builds the client and delegates here.
 *
 * Sequence, in this exact order — every decision with a consequence is taken by
 * the CODE, never by the AI:
 *
 *   session + agency (server-side)  →  the lead must belong to the agency and
 *   still be `pending`  →  guard rails (kill switch, daily volume) and run
 *   opened in `ai_agent_runs`  →  existing contacts read for deduplication  →
 *   AI call, lead text isolated as untrusted DATA  →  zod validation (limited
 *   retry)  →  MERGE (the lead's structured payload always wins)  →
 *   DEDUPLICATION BY THE CODE, exact match on normalised email and phone  →
 *   contact created, or lead attached to the existing record, or nothing at all
 *   →  CRM history  →  run closed.
 *
 * What Léa deliberately does NOT do:
 *   * she never decides that two people are the same person (see `dedupe.ts`);
 *   * she never records a consent — a lead is NOT a consent, so a contact she
 *     creates comes with a task asking a human to collect one before any
 *     contact attempt;
 *   * she never sends anything and never moves anybody in the pipeline.
 *
 * Note on `ai_agent_runs.contact_id`: Léa runs BEFORE a contact exists, so her
 * run is journaled without one (the column is nullable, and the database
 * refuses to let it change afterwards). The contact she creates is named in the
 * run output, in the step detail and in the CRM history.
 */

import { generateValidated } from "@/lib/agents/ai-task";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected, failWith } from "@/lib/agents/errors";
import { logAgentActivity, openHumanTask, type HumanTaskResult } from "@/lib/agents/journal";
import {
  AGENT_STEP_LABELS,
  AGENT_TASK_TEXTS,
  listLeadFieldLabels,
  type AgentErrorCode,
  type LeadField,
} from "@/lib/agents/messages";
import { finishRun, startGuardedContactlessRun } from "@/lib/agents/runner";
import type { RecordedRunStep } from "@/lib/agents/steps";
import type { AgentContext, Tables, TypedClient } from "@/lib/agents/types";
import { getAiProvider } from "@/lib/claude/client";
import type { AiFacts, AiProvider, AiScenario, AiUsage } from "@/lib/claude/provider";
import { ok, type Result } from "@/lib/utils/result";
import type { Json } from "@/types/database";

import {
  decideLeadOutcome,
  LEA_DECISION_TEXTS,
  LEA_STEP_LABELS,
  mergeIdentity,
  type LeadIdentity,
  type LeadPayloadIdentity,
  type LeaOutcome,
} from "./decision";
import { describeMatch, findDuplicate, type DuplicateMatch, type ExistingContact } from "./dedupe";
import { LEA_PROMPT_VERSION, LEA_SYSTEM_PROMPT } from "./prompt";
import { leaAcquisitionSchema, type LeaAcquisition } from "./schema";

export const LEA_AGENT = "lea" as const;
export const LEA_TASK = "lea_acquisition" as const;

/**
 * How many existing contacts are scanned for an exact duplicate. An independent
 * agency has hundreds of contacts, not millions; the bound exists so that a
 * pathological dataset cannot turn one run into a full table scan of unbounded
 * size. Beyond it, the run refuses to conclude "no duplicate" — see below.
 */
export const LEAD_DEDUPE_SCAN_LIMIT = 5000;

type LeadRow = Pick<
  Tables["inbound_leads"]["Row"],
  "id" | "agency_id" | "source" | "raw_text" | "payload" | "status" | "contact_id"
>;

export type LeaRunResult = {
  runId: string;
  leadId: string;
  outcome: LeaOutcome;
  decisionText: string;
  /** The contact created by this run, if any. */
  contactId: string | null;
  /** The existing contact the lead was attached to, if a duplicate was found. */
  duplicateContactId: string | null;
  /** What matched exactly, e.g. ["email", "phone"]. Empty when no duplicate. */
  duplicateMatchedOn: DuplicateMatch["matchedOn"];
  leadStatus: Tables["inbound_leads"]["Row"]["status"];
  /** Validated AI output (identity extraction only). */
  extraction: LeaAcquisition;
  /** Identity after the merge, as the code really used it. */
  identity: LeadIdentity;
  missingFields: LeadField[];
  task: HumanTaskResult | null;
  isSimulation: boolean;
  provider: string;
  model: string;
  usage: AiUsage;
  /** Steps really measured during this run, in order. */
  steps: readonly RecordedRunStep[];
};

export type RunLeaOptions = {
  /** Injected provider (tests). Defaults to the one selected by AI_PROVIDER. */
  provider?: AiProvider;
  /** Simulator-only scenario, to exercise the guard rails. */
  scenario?: AiScenario;
  now?: Date;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The lead's structured payload, when it is an object. Never trusted blindly. */
function payloadIdentity(payload: Json): LeadPayloadIdentity {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as LeadPayloadIdentity)
    : {};
}

function buildFacts(lead: LeadRow, payload: LeadPayloadIdentity): AiFacts {
  return {
    lead_source: lead.source,
    lead_raw_text_chars: (lead.raw_text ?? "").length,
    // Presence flags only: the payload values themselves are given to the code,
    // not to the model — the model's job is to read the free text.
    payload_has_first_name: typeof payload.first_name === "string",
    payload_has_last_name: typeof payload.last_name === "string",
    payload_has_email: typeof payload.email === "string",
    payload_has_phone: typeof payload.phone === "string",
  };
}

export async function runLeaAcquisition(
  client: TypedClient,
  leadId: string,
  options: RunLeaOptions = {},
): Promise<Result<LeaRunResult>> {
  try {
    if (!UUID_PATTERN.test(leadId)) {
      // Same generic answer as "belongs to another agency": no information leak.
      return failWith<LeaRunResult>("lead_not_found");
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

    // --- the lead must belong to the agency and still be pending -------------
    // Read before the run is opened, exactly like Hugo reads his contact: a
    // precondition that cannot lead to any write is not worth a journal entry.
    const leadQuery = await client
      .from("inbound_leads")
      .select("id, agency_id, source, raw_text, payload, status, contact_id")
      .eq("agency_id", context.agencyId)
      .eq("id", leadId)
      .maybeSingle();

    if (leadQuery.error) return failFromDatabase<LeaRunResult>("runLeaAcquisition.lead", leadQuery.error);
    if (!leadQuery.data) return failWith<LeaRunResult>("lead_not_found");
    const lead: LeadRow = leadQuery.data;
    if (lead.status !== "pending") return failWith<LeaRunResult>("lead_already_processed");

    // Journalled input: metadata only. The lead's free text is personal data
    // and is never copied into the AI journal.
    const runInput: Json = {
      task: LEA_TASK,
      prompt_version: LEA_PROMPT_VERSION,
      lead_id: lead.id,
      lead_source: lead.source,
    };

    const started = await startGuardedContactlessRun(client, context, {
      agent: LEA_AGENT,
      input: runInput,
      provider,
      now: options.now,
    });
    if (started.error) return { data: null, error: started.error };
    const { runId, steps } = started.data;

    /** Opens a task that is not attached to a contact, without piling up copies. */
    const openLeadTask = async (input: {
      type: keyof typeof AGENT_TASK_TEXTS;
      details: string;
    }): Promise<HumanTaskResult | null> => {
      // The unique index on open tasks only covers rows with a contact, so the
      // reuse is done here: one open "lead à compléter" task per agency is
      // enough, whatever the number of thin leads.
      const existing = await client
        .from("tasks")
        .select("id")
        .eq("agency_id", context.agencyId)
        .is("contact_id", null)
        .eq("type", input.type)
        .eq("status", "open")
        .limit(1)
        .maybeSingle();
      if (!existing.error && existing.data) {
        return { id: existing.data.id, type: input.type, created: false };
      }
      const created = await openHumanTask(client, context, {
        contactId: null,
        type: input.type,
        title: AGENT_TASK_TEXTS[input.type].title,
        details: input.details,
        agent: LEA_AGENT,
      });
      return created.data;
    };

    /** Closes the run without any business write. */
    const abort = async (input: {
      code: AgentErrorCode;
      decision: string;
      stepLabel: string;
      detail: Record<string, Json>;
      usage?: AiUsage;
    }): Promise<Result<LeaRunResult>> => {
      await steps.step({
        phase: "persisted",
        label: input.stepLabel,
        status: "failed",
        detail: { ...input.detail, error_code: input.code, contact_created: false },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: input.code,
        decision: input.decision,
        usage: input.usage,
      });
      return failWith<LeaRunResult>(input.code);
    };

    // --- inputs: the agency's existing contacts, for the exact match ---------
    const contactsQuery = await client
      .from("contacts")
      .select("id, first_name, last_name, email, phone")
      .eq("agency_id", context.agencyId)
      .order("created_at", { ascending: true })
      .limit(LEAD_DEDUPE_SCAN_LIMIT + 1);

    if (contactsQuery.error) {
      await steps.step({
        phase: "context_loaded",
        label: "Lecture des fiches existantes impossible : aucune action.",
        status: "failed",
        detail: { error_code: "contacts_read_failed" },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: "contacts_read_failed",
        decision: "Lecture des fiches existantes impossible : aucune action, aucun dédoublonnage possible.",
      });
      return failFromDatabase<LeaRunResult>("runLeaAcquisition.contacts", contactsQuery.error);
    }
    const existingContacts: ExistingContact[] = contactsQuery.data ?? [];

    // Refusing to conclude is safer than concluding on a truncated list: a
    // missed duplicate creates a second record for a real person.
    if (existingContacts.length > LEAD_DEDUPE_SCAN_LIMIT) {
      return abort({
        code: "unexpected_error",
        decision:
          "Trop de fiches à comparer pour garantir un dédoublonnage exact : aucune fiche créée.",
        stepLabel: "Dédoublonnage impossible à garantir : aucune fiche créée.",
        detail: { scanned_contacts: existingContacts.length, scan_limit: LEAD_DEDUPE_SCAN_LIMIT },
      });
    }

    const payload = payloadIdentity(lead.payload);

    await steps.step({
      phase: "context_loaded",
      label: LEA_STEP_LABELS.lead_loaded,
      detail: {
        lead_source: lead.source,
        // Counts and flags only: never the lead's text nor anybody's identity.
        raw_text_chars: (lead.raw_text ?? "").length,
        payload_identity_fields: (["first_name", "last_name", "email", "phone"] as const).filter(
          (field) => typeof payload[field] === "string",
        ).length,
        existing_contacts: existingContacts.length,
      },
    });

    // --- AI call: the lead's free text is untrusted DATA ---------------------
    const untrusted = [{ label: "lead_texte_brut", content: lead.raw_text ?? "" }];

    await steps.step({
      phase: "prompt_built",
      label: AGENT_STEP_LABELS.prompt_built,
      detail: {
        prompt_version: LEA_PROMPT_VERSION,
        untrusted_blocks: untrusted.length,
        untrusted_chars: untrusted.reduce((total, block) => total + block.content.length, 0),
        scenario: options.scenario ?? null,
      },
    });

    const generation = await generateValidated(
      provider,
      {
        task: LEA_TASK,
        systemPrompt: LEA_SYSTEM_PROMPT,
        promptVersion: LEA_PROMPT_VERSION,
        facts: buildFacts(lead, payload),
        untrusted,
        scenario: options.scenario,
      },
      leaAcquisitionSchema,
      { steps },
    );

    if (!generation.ok) {
      // Safe fallback: no contact, no lead update, a human takes over.
      const task = await openLeadTask({
        type: "ai_response_invalid",
        details: AGENT_TASK_TEXTS.ai_response_invalid.details,
      });
      await logAgentActivity(client, context, {
        contactId: null,
        type: "ai_response_invalid",
        summary:
          "Léa : réponse IA invalide sur un lead entrant, aucune fiche créée. Une tâche a été créée pour un conseiller.",
        payload: { agent: LEA_AGENT, run_id: runId, lead_id: lead.id, error_code: generation.error.code },
        agent: LEA_AGENT,
        isSimulation: provider.isSimulation,
      });
      await steps.step({
        phase: "persisted",
        label: AGENT_STEP_LABELS.no_write,
        status: "failed",
        detail: {
          error_code: generation.error.code,
          task_type: task?.type ?? null,
          contact_created: false,
          lead_updated: false,
        },
      });
      await finishRun(client, runId, {
        status: "failed",
        error: generation.error.code,
        decision: "Repli sûr : aucune fiche créée, tâche créée pour un humain.",
        usage: generation.usage,
        output: task ? { task_id: task.id, task_type: task.type } : null,
      });
      return { data: null, error: generation.error };
    }

    const extraction = generation.output;

    // --- merge + DEDUPLICATION, both by the code -----------------------------
    const identity = mergeIdentity(payload, extraction);
    const duplicate = findDuplicate({ email: identity.email, phone: identity.phone }, existingContacts);
    const decision = decideLeadOutcome({ identity, duplicate });

    await steps.step({
      phase: "decision",
      label: LEA_STEP_LABELS.dedupe_exact,
      detail: {
        outcome: decision.outcome,
        // Flags and counts only: no email, no phone number, no name.
        matched_on: duplicate?.matchedOn ?? [],
        compared_contacts: existingContacts.length,
        has_email: identity.email !== null,
        has_phone: identity.phone !== null,
        missing_fields: identity.missingFields,
        from_payload: identity.fromPayload,
        confidence: extraction.confidence,
      },
    });

    // --- writes ---------------------------------------------------------------
    let createdContactId: string | null = null;
    let task: HumanTaskResult | null = null;

    if (decision.outcome === "incomplete") {
      task = await openLeadTask({
        type: "lead_incomplete",
        details: AGENT_TASK_TEXTS.lead_incomplete.details.replace(
          "{fields}",
          listLeadFieldLabels(identity.missingFields),
        ),
      });
      await logAgentActivity(client, context, {
        contactId: null,
        type: "ai_information_missing",
        summary: `Léa — acquisition : ${LEA_DECISION_TEXTS.incomplete}`,
        payload: {
          agent: LEA_AGENT,
          run_id: runId,
          lead_id: lead.id,
          missing_fields: identity.missingFields,
        },
        agent: LEA_AGENT,
        isSimulation: provider.isSimulation,
      });
      await steps.step({
        phase: "persisted",
        label: "Aucune fiche créée : le lead reste à traiter, une tâche a été ouverte.",
        detail: {
          outcome: decision.outcome,
          contact_created: false,
          lead_status: lead.status,
          task_type: task?.type ?? null,
          missing_fields: identity.missingFields,
        },
      });
      await finishRun(client, runId, {
        status: "succeeded",
        output: {
          outcome: decision.outcome,
          lead_status: lead.status,
          missing_fields: identity.missingFields,
          confidence: extraction.confidence,
          task_type: task?.type ?? null,
        } as Json,
        decision: LEA_DECISION_TEXTS.incomplete,
        usage: generation.usage,
      });

      return ok({
        runId,
        leadId: lead.id,
        outcome: decision.outcome,
        decisionText: LEA_DECISION_TEXTS.incomplete,
        contactId: null,
        duplicateContactId: null,
        duplicateMatchedOn: [],
        leadStatus: lead.status,
        extraction,
        identity,
        missingFields: identity.missingFields,
        task,
        isSimulation: provider.isSimulation,
        provider: provider.name,
        model: provider.model,
        usage: generation.usage,
        steps: steps.steps,
      });
    }

    if (decision.outcome === "contact_created") {
      const contactInsert = await client
        .from("contacts")
        .insert({
          agency_id: context.agencyId,
          first_name: identity.firstName,
          last_name: identity.lastName,
          email: identity.email,
          phone: identity.phone,
          source: lead.source,
          // Always the entry stage: Léa never qualifies anybody (that is Hugo).
          stage: "nouveau",
          // The prospect's own words are kept as UNTRUSTED data, exactly as they
          // were written, so the next agents work from the real message.
          notes: lead.raw_text,
          assigned_user_id: context.userId,
        })
        .select("id")
        .single();

      if (contactInsert.error) {
        return abort({
          code: "unexpected_error",
          decision: "Création de la fiche refusée par la base : aucune action.",
          stepLabel: "Création de la fiche refusée par la base : aucune action.",
          detail: { outcome: decision.outcome, lead_updated: false },
          usage: generation.usage,
        });
      }
      createdContactId = contactInsert.data.id;
    }

    const attachedContactId = createdContactId ?? decision.duplicate?.contactId ?? null;

    // Attach the lead to the contact and close it. If this write fails after a
    // contact was created, nothing is lost and nothing is duplicated: the lead
    // stays `pending`, and a second run finds the contact Léa just created as an
    // EXACT duplicate and attaches the lead to it.
    const leadUpdate = await client
      .from("inbound_leads")
      .update({
        status: decision.leadStatus,
        contact_id: attachedContactId,
        processed_run_id: runId,
      })
      .eq("agency_id", context.agencyId)
      .eq("id", lead.id)
      .select("status")
      .single();

    if (leadUpdate.error) {
      return abort({
        code: "unexpected_error",
        decision: "Mise à jour du lead refusée par la base.",
        stepLabel: "Mise à jour du lead refusée par la base.",
        detail: {
          outcome: decision.outcome,
          contact_id_written: attachedContactId !== null,
          lead_updated: false,
        },
        usage: generation.usage,
      });
    }

    // --- task + CRM history ---------------------------------------------------
    if (decision.outcome === "duplicate_found" && decision.duplicate) {
      const created = await openHumanTask(client, context, {
        contactId: decision.duplicate.contactId,
        type: "lead_duplicate",
        title: AGENT_TASK_TEXTS.lead_duplicate.title,
        details: AGENT_TASK_TEXTS.lead_duplicate.details.replace(
          "{match}",
          describeMatch(decision.duplicate),
        ),
        agent: LEA_AGENT,
      });
      task = created.data;
      await logAgentActivity(client, context, {
        contactId: decision.duplicate.contactId,
        type: "lead_duplicate_detected",
        summary: `Léa — acquisition : ${LEA_DECISION_TEXTS.duplicate_found}`,
        payload: {
          agent: LEA_AGENT,
          run_id: runId,
          lead_id: lead.id,
          matched_on: decision.duplicate.matchedOn,
        },
        agent: LEA_AGENT,
        isSimulation: provider.isSimulation,
      });
    } else if (createdContactId) {
      // A lead is NOT a consent: nothing may be sent to this person until one
      // is recorded. The task says so explicitly.
      const created = await openHumanTask(client, context, {
        contactId: createdContactId,
        type: "collect_consent",
        title: AGENT_TASK_TEXTS.collect_consent.title,
        details: AGENT_TASK_TEXTS.collect_consent.details,
        agent: LEA_AGENT,
        assignedUserId: context.userId,
      });
      task = created.data;
      await logAgentActivity(client, context, {
        contactId: createdContactId,
        type: "contact_created_from_lead",
        summary: `Léa — acquisition : ${LEA_DECISION_TEXTS.contact_created}`,
        payload: {
          agent: LEA_AGENT,
          run_id: runId,
          lead_id: lead.id,
          lead_source: lead.source,
          missing_fields: identity.missingFields,
          from_payload: identity.fromPayload,
          confidence: extraction.confidence,
        },
        agent: LEA_AGENT,
        isSimulation: provider.isSimulation,
      });
    }

    const decisionText = LEA_DECISION_TEXTS[decision.outcome];

    await steps.step({
      phase: "persisted",
      label: LEA_STEP_LABELS.lead_updated,
      detail: {
        outcome: decision.outcome,
        contact_created: createdContactId !== null,
        lead_status: leadUpdate.data.status,
        task_type: task?.type ?? null,
        task_created: task?.created ?? false,
        consent_recorded: false,
      },
    });

    await finishRun(client, runId, {
      status: "succeeded",
      output: {
        outcome: decision.outcome,
        lead_status: leadUpdate.data.status,
        contact_id: createdContactId,
        duplicate_contact_id: decision.duplicate?.contactId ?? null,
        matched_on: decision.duplicate?.matchedOn ?? [],
        missing_fields: identity.missingFields,
        confidence: extraction.confidence,
        task_type: task?.type ?? null,
      } as Json,
      decision: decisionText,
      usage: generation.usage,
    });

    return ok({
      runId,
      leadId: lead.id,
      outcome: decision.outcome,
      decisionText,
      contactId: createdContactId,
      duplicateContactId: decision.duplicate?.contactId ?? null,
      duplicateMatchedOn: decision.duplicate?.matchedOn ?? [],
      leadStatus: leadUpdate.data.status,
      extraction,
      identity,
      missingFields: identity.missingFields,
      task,
      isSimulation: provider.isSimulation,
      provider: provider.name,
      model: provider.model,
      usage: generation.usage,
      steps: steps.steps,
    });
  } catch (cause) {
    return failFromUnexpected<LeaRunResult>("runLeaAcquisition", cause);
  }
}
