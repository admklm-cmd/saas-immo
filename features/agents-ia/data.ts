/**
 * AI agents domain — read implementations.
 *
 * These functions take an authenticated Supabase client so the same code is
 * used by the server queries (`queries.ts`, session cookies) and by the
 * integration tests. They never throw: every failure comes back as
 * `{ data: null, error }` with a French message.
 *
 * The session and the agency are always re-resolved server-side, and RLS is the
 * last line: a run belonging to another agency answers exactly like an unknown
 * run ("Exécution d'agent introuvable."), so an error message never reveals
 * that somebody else's execution exists.
 */

import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected, failWith } from "@/lib/agents/errors";
import {
  AGENT_ACTIVITY_WINDOW_DAYS,
  AGENT_LABELS,
  AGENT_ORDER,
  AGENT_RUN_STATUS_LABELS,
} from "@/lib/agents/messages";
import {
  AGENT_RUN_PHASE_LABELS,
  AGENT_RUN_STEP_STATUS_LABELS,
  type AgentRunPhase,
  type AgentRunStepStatus,
} from "@/lib/agents/steps";
import { parisDayStart, parisWindowStart } from "@/lib/agents/time";
import type { AgentContext, AiAgentName, TypedClient } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";
import type { Database, Json } from "@/types/database";

import {
  AGENT_LAST_ERRORS_LIMIT,
  buildAgentOverviews,
  describeWindow,
  parseAgentActivityRows,
  requireExactCount,
  runsAgainstLimit,
  totalTodayRunCounts,
  type AgentActivityRow,
} from "./activity";
import {
  agentRunFiltersSchema,
  type AgentRunError,
  type AgentRunFiltersInput,
  type AgentRunReplay,
  type AgentRunsPage,
  type AgentRunStepView,
  type AgentRunSummary,
  type AgentsDashboard,
  type AiPausedState,
  type EmmaFollowUpCandidateView,
  type InboundLeadView,
  type PendingMessageView,
  type ReportedAppointmentView,
  APPOINTMENT_STATUS_LABELS,
} from "./types";
import { EMMA_ELIGIBLE_STAGES, chooseChannel } from "./emma-relation/decision";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The contact is embedded through `ai_agent_runs_contact_fkey`, whose foreign
 * key is `(agency_id, contact_id)`: the join can only ever reach a contact of
 * the SAME agency, and the RLS of the caller applies to the embedded row as
 * well. There is no path here by which a name from another agency could appear.
 */
const RUN_COLUMNS =
  "id, agent, status, contact_id, decision, error, provider, model, input_tokens, output_tokens, is_simulation, started_at, finished_at, contacts!ai_agent_runs_contact_fkey(first_name, last_name)";

const STEP_COLUMNS =
  "id, run_id, step_index, phase, label, status, detail, started_at, finished_at, duration_ms";

/** PostgREST spells UTC as "+00:00"; the UI must get one stable format. */
function isoUtc(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

/** What every screen shows for a contact whose record holds no name at all. */
const CONTACT_WITHOUT_NAME = "Contact sans nom";

/** "Prénom Nom", or `null` when neither part holds anything readable. */
function joinContactName(
  contact: { first_name: string | null; last_name: string | null } | null | undefined,
): string | null {
  const name = [contact?.first_name, contact?.last_name]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
  return name.length > 0 ? name : null;
}

type ContactNameRow = { first_name: string | null; last_name: string | null };

type RunRow = {
  id: string;
  agent: AiAgentName;
  status: Database["public"]["Enums"]["ai_agent_run_status"];
  contact_id: string | null;
  decision: string | null;
  error: string | null;
  provider: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  is_simulation: boolean;
  started_at: string;
  finished_at: string | null;
  contacts?: ContactNameRow | null;
};

/**
 * Name of the contact a run worked on, or `null` when there is nobody to name.
 *
 * `null` is a real answer here, not a missing value:
 *   * every run of Léa has `contact_id = null` — she works before any contact
 *     record exists, and the UI states that case in its own words;
 *   * if the embedded row is absent (a contact the caller may not read), we say
 *     nothing rather than invent a label.
 * A contact that exists but carries no readable name falls back to the same
 * "Contact sans nom" used by the other screens.
 */
function runContactName(row: RunRow): string | null {
  if (row.contact_id === null) return null;
  if (row.contacts === null || row.contacts === undefined) return null;
  return joinContactName(row.contacts) ?? CONTACT_WITHOUT_NAME;
}

function toRunSummary(row: RunRow): AgentRunSummary {
  return {
    id: row.id,
    agent: row.agent,
    agentLabel: AGENT_LABELS[row.agent],
    status: row.status,
    statusLabel: AGENT_RUN_STATUS_LABELS[row.status],
    // `null` for every run of Léa: she works before any contact exists.
    contactId: row.contact_id,
    contactName: runContactName(row),
    decision: row.decision,
    error: row.error,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    isSimulation: row.is_simulation,
    startedAt: isoUtc(row.started_at),
    finishedAt: row.finished_at ? isoUtc(row.finished_at) : null,
  };
}

function toDetail(value: Json | null): Record<string, Json> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {};
}

/**
 * The measured steps of one AI run, in order, for the "agent au travail"
 * replay. Returns the run head too, so the UI never has to guess which agent
 * it is replaying.
 */
export async function findRunSteps(client: TypedClient, runId: string): Promise<Result<AgentRunReplay>> {
  try {
    if (!UUID_PATTERN.test(runId)) {
      // Same generic answer as "belongs to another agency": no information leak.
      return failWith<AgentRunReplay>("ai_run_not_found");
    }

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const runQuery = await client
      .from("ai_agent_runs")
      .select(RUN_COLUMNS)
      .eq("agency_id", context.agencyId)
      .eq("id", runId)
      .maybeSingle();

    if (runQuery.error) return failFromDatabase<AgentRunReplay>("findRunSteps.run", runQuery.error);
    if (!runQuery.data) return failWith<AgentRunReplay>("ai_run_not_found");
    const runRow = runQuery.data;

    const stepsQuery = await client
      .from("ai_agent_run_steps")
      .select(STEP_COLUMNS)
      .eq("agency_id", context.agencyId)
      .eq("run_id", runId)
      .order("step_index", { ascending: true });

    if (stepsQuery.error) return failFromDatabase<AgentRunReplay>("findRunSteps.steps", stepsQuery.error);

    const steps: AgentRunStepView[] = (stepsQuery.data ?? []).map((row) => {
      const phase = row.phase as AgentRunPhase;
      const status = row.status as AgentRunStepStatus;
      return {
        id: row.id,
        runId: row.run_id,
        index: row.step_index,
        phase,
        phaseLabel: AGENT_RUN_PHASE_LABELS[phase],
        label: row.label,
        status,
        statusLabel: AGENT_RUN_STEP_STATUS_LABELS[status],
        detail: toDetail(row.detail),
        startedAt: isoUtc(row.started_at),
        finishedAt: isoUtc(row.finished_at),
        durationMs: row.duration_ms,
      };
    });

    return ok({
      run: toRunSummary(runRow),
      steps,
      totalDurationMs: steps.reduce((total, step) => total + step.durationMs, 0),
    });
  } catch (cause) {
    return failFromUnexpected<AgentRunReplay>("findRunSteps", cause);
  }
}

// -----------------------------------------------------------------------------
// Léa — inbox of raw inbound leads
// -----------------------------------------------------------------------------

/** French labels of the lead statuses. Centralised, like every other UI text. */
export const INBOUND_LEAD_STATUS_LABELS: Readonly<
  Record<Database["public"]["Enums"]["inbound_lead_status"], string>
> = {
  pending: "À traiter",
  processed: "Fiche créée",
  duplicate: "Doublon",
  rejected: "Écarté",
};

/** How many leads the inbox shows at once. */
export const INBOUND_LEADS_PAGE_SIZE = 50;

const LEAD_IDENTITY_FIELDS = [
  ["first_name", "prénom"],
  ["last_name", "nom"],
  ["email", "adresse email"],
  ["phone", "téléphone"],
] as const;

function payloadFieldLabels(payload: Json): string[] {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return [];
  const record = payload as Record<string, Json>;
  return LEAD_IDENTITY_FIELDS.filter(([key]) => typeof record[key] === "string").map(
    ([, label]) => label,
  );
}

/** Longest first name kept in a display name (the rest is cut with « … »). */
export const LEAD_FIRST_NAME_MAX = 40;
/** Longest commune kept for display. */
export const LEAD_CITY_MAX = 60;

// C0/C1 controls, DEL, soft hyphen, zero-width, line/paragraph separators and
// every bidirectional control (U+061C ALM, U+200E/F, U+202A-E, U+2066-9: the
// set of BIDI_CONTROL_PATTERN): none of them is ever meaningful in a name, and
// some can disguise text on screen. Written as escapes on purpose: invisible
// characters must never appear literally in the source.
const INVISIBLE_OR_CONTROL = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;

/**
 * Plain-text, single-line, bounded version of an untrusted payload value, or
 * `null` when nothing displayable is left. Never throws, never invents.
 */
export function cleanLeadText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(INVISIBLE_OR_CONTROL, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return null;
  const chars = Array.from(cleaned);
  return chars.length <= max ? cleaned : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

function payloadRecord(payload: Json): Record<string, Json> | null {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, Json>)
    : null;
}

/**
 * « Claire M. »: first name + initial of the last name, from the structured
 * payload only (minimisation — never the full last name, the e-mail nor the
 * phone). « Claire » when the last name is absent; `null` when the first name
 * is absent, never a guess from the free text.
 */
export function leadDisplayName(payload: Json): string | null {
  const record = payloadRecord(payload);
  if (!record) return null;
  const firstName = cleanLeadText(record.first_name, LEAD_FIRST_NAME_MAX);
  if (!firstName) return null;
  const lastName = cleanLeadText(record.last_name, LEAD_FIRST_NAME_MAX);
  const initial = lastName ? Array.from(lastName).find((char) => /\p{L}/u.test(char)) : undefined;
  return initial ? `${firstName} ${initial.toLocaleUpperCase("fr-FR")}.` : firstName;
}

/**
 * Record a lead leads to: the contact Léa created (`processed`) or the
 * existing one she attached it to (`duplicate`). `null` for any other status —
 * a pending or rejected lead has no record, whatever the column holds.
 */
export function inboundLeadContactId(
  status: Database["public"]["Enums"]["inbound_lead_status"],
  contactId: string | null,
): string | null {
  return status === "processed" || status === "duplicate" ? contactId : null;
}

/** Commune of the property when the payload carries one, else `null`. */
export function leadCity(payload: Json): string | null {
  const record = payloadRecord(payload);
  return record ? cleanLeadText(record.city, LEAD_CITY_MAX) : null;
}

/**
 * Léa's inbox: the agency's inbound leads, most recent first.
 *
 * A lead is raw material, NOT a consent: nothing may be sent to these people
 * until a consent is recorded and checked at send time by the database.
 */
export async function listInboundLeads(client: TypedClient): Promise<Result<InboundLeadView[]>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const { data, error } = await client
      .from("inbound_leads")
      .select("id, source, status, raw_text, payload, contact_id, processed_run_id, created_at")
      .eq("agency_id", context.agencyId)
      .order("created_at", { ascending: false })
      .limit(INBOUND_LEADS_PAGE_SIZE);

    if (error) return failFromDatabase<InboundLeadView[]>("listInboundLeads", error);

    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        source: row.source,
        status: row.status,
        statusLabel: INBOUND_LEAD_STATUS_LABELS[row.status],
        rawText: row.raw_text,
        payloadFields: payloadFieldLabels(row.payload),
        displayName: leadDisplayName(row.payload),
        city: leadCity(row.payload),
        // Only a processed lead points to a record (created, or the duplicate
        // it was attached to): the UI links to it to tell homonyms apart.
        contactId: inboundLeadContactId(row.status, row.contact_id),
        processedRunId: row.processed_run_id,
        canBeProcessed: row.status === "pending",
        createdAt: isoUtc(row.created_at),
      })),
    );
  } catch (cause) {
    return failFromUnexpected<InboundLeadView[]>("listInboundLeads", cause);
  }
}

// -----------------------------------------------------------------------------
// Sarah — estimation appointments and their reports
// -----------------------------------------------------------------------------

/** How many appointments the Louis → human → Sarah screen shows at once. */
export const REPORTED_APPOINTMENTS_PAGE_SIZE = 50;

/**
 * Contact stages at which a `proposed` appointment may be confirmed by a human.
 * Same set as the database guard of `appointments` (`proposed -> confirmed`);
 * shared with the dashboard so its « à confirmer » count matches this screen.
 */
export const APPOINTMENT_CONFIRMABLE_STAGES = ["qualifie", "chaud", "rdv_planifie"] as const;

/**
 * Active and completed estimation appointments of the agency, most recent
 * first. `proposed` and `confirmed` expose the human actions needed before a
 * `done` appointment becomes Sarah's input.
 *
 * `canBeFollowedThrough` is the exact condition Sarah checks server-side, so the
 * UI can grey out a button instead of inviting a refusal — but the refusal is
 * still enforced server-side, whatever the UI shows.
 */
export async function listAppointmentsToFollowThrough(
  client: TypedClient,
): Promise<Result<ReportedAppointmentView[]>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const { data, error } = await client
      .from("appointments")
      .select(
        "id, contact_id, status, starts_at, report_notes, report_recorded_at, contacts!appointments_contact_fkey(first_name, last_name, stage)",
      )
      .eq("agency_id", context.agencyId)
      .in("status", ["proposed", "confirmed", "done"])
      .order("starts_at", { ascending: false })
      .limit(REPORTED_APPOINTMENTS_PAGE_SIZE);

    if (error) return failFromDatabase<ReportedAppointmentView[]>("listAppointmentsToFollowThrough", error);

    const rows = data ?? [];
    const contactIds = [...new Set(rows.map((row) => row.contact_id))];

    // Last run of Sarah per contact, so the UI can link to the replay.
    const lastRuns = new Map<string, string>();
    if (contactIds.length > 0) {
      const runsQuery = await client
        .from("ai_agent_runs")
        .select("id, contact_id, started_at")
        .eq("agency_id", context.agencyId)
        .eq("agent", "sarah")
        .in("contact_id", contactIds)
        .order("started_at", { ascending: false });
      for (const run of runsQuery.data ?? []) {
        if (run.contact_id && !lastRuns.has(run.contact_id)) lastRuns.set(run.contact_id, run.id);
      }
    }

    return ok(
      rows.map((row) => {
        const contact = row.contacts;
        const name = [contact?.first_name, contact?.last_name]
          .map((part) => (part ?? "").trim())
          .filter((part) => part.length > 0)
          .join(" ");
        const canBeConfirmed =
          row.status === "proposed" &&
          contact !== null &&
          contact !== undefined &&
          (APPOINTMENT_CONFIRMABLE_STAGES as readonly string[]).includes(contact.stage);
        return {
          id: row.id,
          contactId: row.contact_id,
          contactName: name.length > 0 ? name : "Contact sans nom",
          stage: contact?.stage ?? "nouveau",
          status: row.status,
          statusLabel: APPOINTMENT_STATUS_LABELS[row.status],
          startsAt: isoUtc(row.starts_at),
          reportNotes: row.report_notes,
          reportRecordedAt: row.report_recorded_at ? isoUtc(row.report_recorded_at) : null,
          canBeConfirmed,
          canBeCompleted: row.status === "confirmed",
          canBeFollowedThrough: row.status === "done" && row.report_notes !== null,
          lastFollowThroughRunId: lastRuns.get(row.contact_id) ?? null,
        };
      }),
    );
  } catch (cause) {
    return failFromUnexpected<ReportedAppointmentView[]>("listAppointmentsToFollowThrough", cause);
  }
}

// -----------------------------------------------------------------------------
// File d'attente « à valider » — la validation humaine du premier contact
// -----------------------------------------------------------------------------

/** French labels of the message statuses. Centralised, like every other text. */
export const MESSAGE_STATUS_LABELS: Readonly<
  Record<Database["public"]["Enums"]["outbound_message_status"], string>
> = {
  pending_validation: "À valider",
  approved: "Validé",
  rejected: "Refusé",
  sent_simulated: "Envoyé (simulation)",
};

export const CONSENT_CHANNEL_LABELS: Readonly<
  Record<Database["public"]["Enums"]["consent_channel"], string>
> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  phone: "Téléphone",
};

/** How many drafts the validation queue shows at once. */
export const PENDING_MESSAGES_PAGE_SIZE = 50;

/**
 * Statuses that still need a human decision. Exported so the dashboard counts
 * exactly the rows this queue lists.
 */
export const AWAITING_HUMAN = ["pending_validation", "approved"] as const;

function contactName(contact: { first_name: string | null; last_name: string | null } | null): string {
  return joinContactName(contact) ?? CONTACT_WITHOUT_NAME;
}

/**
 * The drafts waiting for a member of the agency, oldest first.
 *
 * This is the screen the product rule "premier contact toujours validé par un
 * humain" lives on. Everything here is a DRAFT: nothing has left the product,
 * and nothing can, since no sending provider is wired.
 *
 * `hasValidConsent` and `canBeSent` are read from the CURRENT consent of each
 * channel. They tell the UI what to grey out — they are never the check itself:
 * the server re-reads the consent when the send is asked for, and the database
 * re-reads it again in `guard_outbound_message`.
 */
export async function listMessagesToValidate(
  client: TypedClient,
): Promise<Result<PendingMessageView[]>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const { data, error } = await client
      .from("outbound_messages")
      .select(
        "id, contact_id, channel, subject, body, status, is_simulation, created_by_agent, created_at, contacts!outbound_messages_contact_fkey(first_name, last_name)",
      )
      .eq("agency_id", context.agencyId)
      .in("status", AWAITING_HUMAN)
      .order("created_at", { ascending: true })
      .limit(PENDING_MESSAGES_PAGE_SIZE);

    if (error) return failFromDatabase<PendingMessageView[]>("listMessagesToValidate", error);

    const rows = data ?? [];
    const contactIds = [...new Set(rows.map((row) => row.contact_id))];
    if (contactIds.length === 0) return ok([]);

    // Current consent per (contact, channel), from the append-only register.
    const consentsQuery = await client
      .from("current_consents")
      .select("contact_id, channel, status")
      .eq("agency_id", context.agencyId)
      .in("contact_id", contactIds);
    const consents = new Map<string, Database["public"]["Enums"]["consent_status"]>();
    for (const row of consentsQuery.data ?? []) {
      if (row.contact_id && row.channel && row.status) {
        consents.set(`${row.contact_id}:${row.channel}`, row.status);
      }
    }

    // Contacts that have already received something: for them, the "first
    // contact" rule no longer applies.
    const alreadySentQuery = await client
      .from("outbound_messages")
      .select("contact_id")
      .eq("agency_id", context.agencyId)
      .eq("status", "sent_simulated")
      .in("contact_id", contactIds);
    const alreadyContacted = new Set((alreadySentQuery.data ?? []).map((row) => row.contact_id));

    return ok(
      rows.map((row) => {
        const consentStatus = consents.get(`${row.contact_id}:${row.channel}`) ?? null;
        const hasValidConsent = consentStatus === "granted";
        return {
          id: row.id,
          contactId: row.contact_id,
          contactName: contactName(row.contacts),
          channel: row.channel,
          channelLabel: CONSENT_CHANNEL_LABELS[row.channel],
          subject: row.subject,
          body: row.body,
          status: row.status,
          statusLabel: MESSAGE_STATUS_LABELS[row.status],
          createdByAgent: row.created_by_agent,
          createdByAgentLabel: row.created_by_agent ? AGENT_LABELS[row.created_by_agent] : null,
          isSimulation: row.is_simulation,
          consentStatus,
          hasValidConsent,
          isFirstContact: !alreadyContacted.has(row.contact_id),
          // A draft must be human-approved first, and the consent must hold.
          canBeSent: row.status === "approved" && hasValidConsent,
          createdAt: isoUtc(row.created_at),
        };
      }),
    );
  } catch (cause) {
    return failFromUnexpected<PendingMessageView[]>("listMessagesToValidate", cause);
  }
}


/**
 * Emma's manual workspace. It deliberately does not claim a relance is "due":
 * no cadence policy exists yet. The action remains authoritative and rechecks
 * every value at click time.
 */
export async function listEmmaFollowUpCandidates(
  client: TypedClient,
): Promise<Result<EmmaFollowUpCandidateView[]>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const contactsQuery = await client
      .from("contacts")
      .select("id, first_name, last_name, email, phone, stage, human_takeover, updated_at")
      .eq("agency_id", context.agencyId)
      .in("stage", [...EMMA_ELIGIBLE_STAGES])
      .order("updated_at", { ascending: true })
      .limit(100);
    if (contactsQuery.error) {
      return failFromDatabase<EmmaFollowUpCandidateView[]>(
        "listEmmaFollowUpCandidates.contacts",
        contactsQuery.error,
      );
    }

    const contacts = contactsQuery.data ?? [];
    if (contacts.length === 0) return ok([]);
    const contactIds = contacts.map((contact) => contact.id);

    const [consentsQuery, draftsQuery] = await Promise.all([
      client
        .from("current_consents")
        .select("contact_id, channel, status")
        .eq("agency_id", context.agencyId)
        .in("contact_id", contactIds),
      client
        .from("outbound_messages")
        .select("contact_id")
        .eq("agency_id", context.agencyId)
        .eq("created_by_agent", "emma")
        .eq("status", "pending_validation")
        .in("contact_id", contactIds),
    ]);
    if (consentsQuery.error) {
      return failFromDatabase<EmmaFollowUpCandidateView[]>(
        "listEmmaFollowUpCandidates.consents",
        consentsQuery.error,
      );
    }
    if (draftsQuery.error) {
      return failFromDatabase<EmmaFollowUpCandidateView[]>(
        "listEmmaFollowUpCandidates.drafts",
        draftsQuery.error,
      );
    }

    const consentsByContact = new Map<
      string,
      Partial<
        Record<
          Database["public"]["Enums"]["consent_channel"],
          Database["public"]["Enums"]["consent_status"]
        >
      >
    >();
    for (const consent of consentsQuery.data ?? []) {
      if (!consent.contact_id || !consent.channel || !consent.status) continue;
      const current = consentsByContact.get(consent.contact_id) ?? {};
      current[consent.channel] = consent.status;
      consentsByContact.set(consent.contact_id, current);
    }
    const contactsWithDraft = new Set((draftsQuery.data ?? []).map((draft) => draft.contact_id));

    return ok(
      contacts.map((contact) => {
        const channelChoice = chooseChannel({
          hasEmail: Boolean(contact.email),
          hasPhone: Boolean(contact.phone),
          consents: consentsByContact.get(contact.id) ?? {},
        });
        const hasPendingEmmaDraft = contactsWithDraft.has(contact.id);
        const blockedReason = contact.human_takeover
          ? ("human_takeover" as const)
          : hasPendingEmmaDraft
            ? ("pending_draft" as const)
            : channelChoice.channel === null
              ? ("consent_or_channel_missing" as const)
              : null;
        return {
          id: contact.id,
          contactName: joinContactName(contact) ?? CONTACT_WITHOUT_NAME,
          email: contact.email,
          phone: contact.phone,
          stage: contact.stage,
          humanTakeover: contact.human_takeover,
          channel: channelChoice.channel,
          hasPendingEmmaDraft,
          canPrepare: blockedReason === null,
          blockedReason,
          updatedAt: isoUtc(contact.updated_at),
        };
      }),
    );
  } catch (cause) {
    return failFromUnexpected<EmmaFollowUpCandidateView[]>("listEmmaFollowUpCandidates", cause);
  }
}

// -----------------------------------------------------------------------------
// Écran « Agents IA » — réglages, coupe-circuit et activité réelle
// -----------------------------------------------------------------------------

/**
 * Most recent execution of ONE agent, whatever its age.
 *
 * A dedicated query per agent, on purpose: deriving this from a page of the
 * journal would display "Jamais exécuté" for an agent that simply has not run
 * as recently as the others — a false statement about what the product did.
 */
async function findLastRun(
  client: TypedClient,
  agencyId: string,
  agent: AiAgentName,
): Promise<Result<AgentRunSummary | null>> {
  const { data, error } = await client
    .from("ai_agent_runs")
    .select(RUN_COLUMNS)
    .eq("agency_id", agencyId)
    .eq("agent", agent)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return failFromDatabase<AgentRunSummary | null>("findLastRun", error);
  return ok(data ? toRunSummary(data) : null);
}

/** The few most recent failures or blocks of ONE agent, most recent first. */
async function findLastErrors(
  client: TypedClient,
  agencyId: string,
  agent: AiAgentName,
): Promise<Result<AgentRunError[]>> {
  const { data, error } = await client
    .from("ai_agent_runs")
    .select("id, status, error, decision, started_at")
    .eq("agency_id", agencyId)
    .eq("agent", agent)
    .in("status", ["failed", "blocked"])
    .order("started_at", { ascending: false })
    .limit(AGENT_LAST_ERRORS_LIMIT);

  if (error) return failFromDatabase<AgentRunError[]>("findLastErrors", error);

  return ok(
    (data ?? []).flatMap((row) =>
      // The query only asks for these two; anything else is dropped rather
      // than mislabelled.
      row.status === "failed" || row.status === "blocked"
        ? [
            {
              runId: row.id,
              code: row.error,
              decision: row.decision,
              status: row.status,
              statusLabel: AGENT_RUN_STATUS_LABELS[row.status],
              at: isoUtc(row.started_at),
            },
          ]
        : [],
    ),
  );
}

/**
 * The kill switch alone: is the agency suspended, and may the caller resume it.
 *
 * Deliberately minimal — ONE row of `agencies`, no aggregate, no count, no
 * per-agent query. Suspending every AI agent in one click is the agency's
 * emergency control (CLAUDE.md, « coupe-circuit »), so it must stay reachable
 * even when the statistics of the screen cannot be computed:
 * `getAgentsDashboard` is all-or-nothing on purpose, and if the screen only had
 * that read, a failing count would take the emergency control away with it.
 *
 * Same guarantees as every other read here: session and agency re-resolved
 * server-side, RLS applies, `{ data, error }` returned, never an exception. An
 * agency the caller is not a member of answers `forbidden` — exactly like an
 * unknown one.
 */
export async function findAiPausedState(client: TypedClient): Promise<Result<AiPausedState>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const { data, error } = await client
      .from("agencies")
      .select("id, name, ai_paused")
      .eq("id", context.agencyId)
      .maybeSingle();

    if (error) return failFromDatabase<AiPausedState>("findAiPausedState", error);
    if (!data) return failWith<AiPausedState>("forbidden");

    return ok({
      agencyId: data.id,
      agencyName: data.name,
      aiPaused: data.ai_paused,
      // Any member may pause; only a director may resume. The rule itself is
      // enforced by `public.set_ai_paused`: this flag only greys out a button.
      canResume: context.role === "director",
    });
  } catch (cause) {
    return failFromUnexpected<AiPausedState>("findAiPausedState", cause);
  }
}

/**
 * The five agents of the product, with what they really did.
 *
 * Every figure is an EXACT count, aggregated in SQL over a named window
 * (`public.agent_activity_summary`), not a sample of the most recent rows:
 * CLAUDE.md requires the statistics to be computed from the data actually
 * recorded, and `runsToday` is displayed next to a daily limit that can be set
 * to 10 000 — under-counting it would tell an agency it still has quota when it
 * has none.
 *
 * All-or-nothing: if any of these reads fails, the whole function returns
 * `{ data: null, error }`. A count that could not be made is never returned as
 * a zero.
 */
export async function getAgentsDashboard(client: TypedClient): Promise<Result<AgentsDashboard>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const now = new Date();
    const dayStart = parisDayStart(now);
    const windowStart = parisWindowStart(AGENT_ACTIVITY_WINDOW_DAYS, now);

    const agencyQuery = await client
      .from("agencies")
      .select("id, name, ai_paused, ai_daily_run_limit")
      .eq("id", context.agencyId)
      .maybeSingle();

    if (agencyQuery.error) {
      return failFromDatabase<AgentsDashboard>("getAgentsDashboard.agency", agencyQuery.error);
    }
    if (!agencyQuery.data) return failWith<AgentsDashboard>("forbidden");
    const agency = agencyQuery.data;

    // One round trip, one exact aggregate per agent and per window. RLS on
    // `ai_agent_runs` applies to the caller inside the function, and the agency
    // is filtered explicitly as well.
    const activityQuery = await client.rpc("agent_activity_summary", {
      target_agency: context.agencyId,
      day_start: dayStart.toISOString(),
      window_start: windowStart.toISOString(),
    });

    if (activityQuery.error) {
      return failFromDatabase<AgentsDashboard>("getAgentsDashboard.activity", activityQuery.error);
    }
    // No error but an unexpected payload: the figures are UNKNOWN, not zero.
    const parsedActivity = parseAgentActivityRows(activityQuery.data);
    if (parsedActivity.error) return { data: null, error: parsedActivity.error };
    const activity: AgentActivityRow[] = parsedActivity.data;

    const pendingCount = requireExactCount(
      "getAgentsDashboard.pending",
      await client
        .from("outbound_messages")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", context.agencyId)
        .eq("status", "pending_validation"),
    );
    if (pendingCount.error) return { data: null, error: pendingCount.error };

    const perAgent = await Promise.all(
      AGENT_ORDER.map(async (agent) => ({
        agent,
        lastRun: await findLastRun(client, context.agencyId, agent),
        lastErrors: await findLastErrors(client, context.agencyId, agent),
      })),
    );

    const lastRuns = new Map<AiAgentName, AgentRunSummary | null>();
    const lastErrors = new Map<AiAgentName, AgentRunError[]>();
    for (const entry of perAgent) {
      if (entry.lastRun.error) return { data: null, error: entry.lastRun.error };
      if (entry.lastErrors.error) return { data: null, error: entry.lastErrors.error };
      lastRuns.set(entry.agent, entry.lastRun.data);
      lastErrors.set(entry.agent, entry.lastErrors.data);
    }

    const agents = buildAgentOverviews({
      aiPaused: agency.ai_paused,
      activity,
      lastRuns,
      lastErrors,
    });

    // Counted over EVERY row returned by the aggregate, not over the five known
    // agents: the database guard counts every run of the agency against the
    // daily limit, so the figure displayed next to that limit must too.
    const todayTotals = totalTodayRunCounts(activity);

    return ok({
      agencyId: agency.id,
      agencyName: agency.name,
      aiPaused: agency.ai_paused,
      dailyRunLimit: agency.ai_daily_run_limit,
      // Same definition as `private.guard_ai_agent_run`: everything except the
      // refused attempts, over the current Paris day. Exact SQL counts, summed.
      runsToday: runsAgainstLimit(todayTotals),
      runsTodayTotal: todayTotals.total,
      windows: {
        today: describeWindow("today", dayStart),
        last7Days: describeWindow("last7Days", windowStart),
      },
      // Any member may pause; only a director may resume (enforced by the RPC).
      canResume: context.role === "director",
      pendingValidationCount: pendingCount.data,
      agents,
    });
  } catch (cause) {
    return failFromUnexpected<AgentsDashboard>("getAgentsDashboard", cause);
  }
}

// -----------------------------------------------------------------------------
// Historique des exécutions — le journal complet, filtré et paginé
// -----------------------------------------------------------------------------

/**
 * One page of the agency's AI run journal, most recent first.
 *
 * Filters (agent, outcome) and paging are validated and bounded server-side:
 * the UI cannot ask for an unbounded page, and an unexpected filter is refused
 * (`invalid_filters`) rather than silently dropped — a list that does not match
 * the filters the screen displays is a false statement too.
 *
 * `total` is an exact count of the rows matching the filters, so "25 sur 1 248"
 * is a true sentence. `runs[].contactId` is `null` for every run of Léa.
 */
export async function listAgentRuns(
  client: TypedClient,
  filters: AgentRunFiltersInput = {},
): Promise<Result<AgentRunsPage>> {
  try {
    const parsed = agentRunFiltersSchema.safeParse(filters ?? {});
    if (!parsed.success) return failWith<AgentRunsPage>("invalid_filters");
    const applied = parsed.data;

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    // Two queries on purpose. An exact `count` asked for on the page itself
    // makes PostgREST answer 416 as soon as the offset is past the end, which
    // would turn "you asked for page 9 of 3" into a technical error; and a
    // `head: true` count is the only reading that is exact whatever the page
    // size. `total` is therefore counted on its own, over the same filters.
    let countQuery = client
      .from("ai_agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", context.agencyId);
    if (applied.agent) countQuery = countQuery.eq("agent", applied.agent);
    if (applied.status) countQuery = countQuery.eq("status", applied.status);

    const total = requireExactCount("listAgentRuns.count", await countQuery);
    if (total.error) return { data: null, error: total.error };

    let pageQuery = client
      .from("ai_agent_runs")
      .select(RUN_COLUMNS)
      .eq("agency_id", context.agencyId);
    if (applied.agent) pageQuery = pageQuery.eq("agent", applied.agent);
    if (applied.status) pageQuery = pageQuery.eq("status", applied.status);

    const { data, error } = await pageQuery
      // `id` breaks ties so two runs started in the same millisecond keep a
      // stable order between two pages (no duplicate, no hole).
      .order("started_at", { ascending: false })
      .order("id", { ascending: false })
      .range(applied.offset, applied.offset + applied.limit - 1);

    if (error) return failFromDatabase<AgentRunsPage>("listAgentRuns", error);

    const runs = (data ?? []).map(toRunSummary);

    return ok({
      runs,
      total: total.data,
      limit: applied.limit,
      offset: applied.offset,
      hasMore: applied.offset + runs.length < total.data,
      appliedFilters: applied,
    });
  } catch (cause) {
    return failFromUnexpected<AgentRunsPage>("listAgentRuns", cause);
  }
}
