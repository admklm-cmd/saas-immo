/**
 * AI agents domain — shapes exposed to the UI.
 *
 * Everything here is already French-labelled and already in a canonical format
 * (ISO-8601 UTC instants), so a Server Component can render it directly and no
 * business logic has to live in a component.
 */

import { z } from "zod";

import { AGENT_ORDER, type AgentRunStatus } from "@/lib/agents/messages";
import type {
  AgentRunPhase,
  AgentRunStepStatus,
} from "@/lib/agents/steps";
import type { AiAgentName, Enums } from "@/lib/agents/types";
import type { Json } from "@/types/database";

export type { AgentRunPhase, AgentRunStepStatus, AgentRunStatus };

/**
 * One step of an AI run, as it was really measured and recorded.
 *
 * `durationMs` comes from the database, which recomputes it from `startedAt`
 * and `finishedAt`: the UI must animate the replay with these values and must
 * never invent a progress bar of its own (CLAUDE.md — nothing simulated may be
 * passed off as real, and nothing real may be dressed up).
 */
export type AgentRunStepView = {
  id: string;
  runId: string;
  /** Position in the run, 0-based, unique and continuous within a run. */
  index: number;
  phase: AgentRunPhase;
  /** French label of the phase, e.g. "Garde-fous". */
  phaseLabel: string;
  /** French sentence describing what happened, displayable as-is. */
  label: string;
  status: AgentRunStepStatus;
  /** French label of the status, e.g. "Bloqué". */
  statusLabel: string;
  /** Displayable summary (counts, codes, flags). Never the prospect's text. */
  detail: Record<string, Json>;
  /** Canonical ISO-8601 UTC. */
  startedAt: string;
  finishedAt: string;
  /** Measured by the server, recomputed by the database. */
  durationMs: number;
};

/** Head of an AI run, enough to title the replay. */
export type AgentRunSummary = {
  id: string;
  agent: AiAgentName;
  /** Product first name: "Léa", "Hugo", "Emma", "Louis", "Sarah". */
  agentLabel: string;
  status: Enums["ai_agent_run_status"];
  /** French label of the outcome: "En cours", "Réussie", "Échec", "Bloquée". */
  statusLabel: string;
  /**
   * Contact the run worked on. **`null` for every run of Léa**: she processes a
   * raw inbound lead, before any contact record exists. The UI must display
   * that case explicitly (e.g. "lead entrant"), never as a missing value.
   */
  contactId: string | null;
  /**
   * "Prénom Nom" of that contact, so the journal names a person instead of
   * offering a link to click.
   *
   * **`null` exactly when there is no contact to name** — every run of Léa, and
   * the (theoretical) case of a contact the caller may not read. It is never an
   * empty string and never a dash: the UI decides what to say for the "no
   * contact" case, it is not decided here. A contact whose record holds no
   * readable name at all is "Contact sans nom", like everywhere else.
   */
  contactName: string | null;
  decision: string | null;
  error: string | null;
  provider: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  isSimulation: boolean;
  startedAt: string;
  finishedAt: string | null;
};

/** What `getRunSteps` returns: the run head plus its measured steps. */
export type AgentRunReplay = {
  run: AgentRunSummary;
  steps: AgentRunStepView[];
  /** Sum of the measured step durations, in milliseconds. */
  totalDurationMs: number;
};

/**
 * One raw inbound lead, as Léa's inbox shows it.
 *
 * `rawText` is the prospect's own words: it is UNTRUSTED DATA. The UI displays
 * it as text and never as markup, and no agent ever treats it as an instruction.
 */
export type InboundLeadView = {
  id: string;
  source: Enums["contact_source"];
  status: Enums["inbound_lead_status"];
  /** French label of the status, e.g. "À traiter". */
  statusLabel: string;
  /** Raw message received with the lead, or `null`. */
  rawText: string | null;
  /** Identity fields present in the structured payload, already French-labelled. */
  payloadFields: string[];
  /**
   * « Claire M. » (first name + initial of the last name), « Claire » without a
   * last name, `null` without a first name — never invented. Plain text from
   * the payload (controls and invisible characters removed, bounded length):
   * display it as text, never as markup.
   */
  displayName: string | null;
  /** Commune of the property when the payload has one, else `null`. Plain text. */
  city: string | null;
  /**
   * Record of the processed lead — the contact Léa created (`processed`) or the
   * existing one it was attached to (`duplicate`) — so the UI can link to it and
   * tell homonyms apart. `null` for a pending or rejected lead.
   */
  contactId: string | null;
  /** Run of Léa that processed it, for the "agent au travail" replay. */
  processedRunId: string | null;
  /** True when Léa can still be launched on it. */
  canBeProcessed: boolean;
  /** Canonical ISO-8601 UTC. */
  createdAt: string;
};

/**
 * One draft waiting for a human of the agency — the « à valider » queue.
 *
 * **Nothing has been sent.** The product rule this screen exists for: a first
 * contact is always validated by a human (CLAUDE.md). `canBeSent` reflects what
 * the SERVER will accept; it is a convenience for the UI, never the check
 * itself — the code and the database both re-verify the consent at send time.
 */
export type PendingMessageView = {
  id: string;
  contactId: string;
  /** "Prénom Nom" of the contact, or "Contact sans nom". */
  contactName: string;
  channel: Enums["consent_channel"];
  /** French label of the channel, e.g. "Email". */
  channelLabel: string;
  subject: string | null;
  body: string;
  status: Enums["outbound_message_status"];
  /** French label of the status, e.g. "À valider". */
  statusLabel: string;
  /** Which agent drafted it, or `null` when a human wrote it. */
  createdByAgent: AiAgentName | null;
  /** Product first name of that agent, e.g. "Emma". */
  createdByAgentLabel: string | null;
  /** Always true in the prototype: nothing real can be sent. */
  isSimulation: boolean;
  /** Current consent of the channel at read time (`null` when never recorded). */
  consentStatus: Enums["consent_status"] | null;
  /** True when the current consent of the channel is `granted`. */
  hasValidConsent: boolean;
  /** True when this would be the first message ever sent to this contact. */
  isFirstContact: boolean;
  /** True when the server would accept an (simulated) send right now. */
  canBeSent: boolean;
  /** Canonical ISO-8601 UTC. */
  createdAt: string;
};

/** One CRM file shown in Emma's manual follow-up workspace. */
export type EmmaFollowUpCandidateView = {
  id: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  stage: Enums["pipeline_stage"];
  humanTakeover: boolean;
  /** Channel selected by deterministic code from current consents, never by Emma. */
  channel: Enums["consent_channel"] | null;
  hasPendingEmmaDraft: boolean;
  /** Display convenience only. The server action rechecks every condition. */
  canPrepare: boolean;
  blockedReason: "human_takeover" | "pending_draft" | "consent_or_channel_missing" | null;
  updatedAt: string;
};

// -----------------------------------------------------------------------------
// Écran « Agents IA » — activité réellement enregistrée
// -----------------------------------------------------------------------------

/**
 * A time window the figures are counted in, named so the screen can say it.
 *
 * "3 exécutions" is a number without a meaning; "3 exécutions aujourd'hui" is a
 * fact. The UI must always display `label` next to the figures of a window.
 */
export type AgentActivityWindow = {
  key: "today" | "last7Days";
  /** French name, e.g. "aujourd'hui" or "sur 7 jours". */
  label: string;
  /** Instant the window opens at (midnight Europe/Paris), ISO-8601 UTC. */
  startsAt: string;
  /** Number of Paris calendar days covered, today included. */
  days: number;
};

/** Exact per-outcome counts of runs. Counted in SQL, never sampled. */
export type AgentRunCounts = {
  total: number;
  succeeded: number;
  failed: number;
  blocked: number;
  running: number;
};

/** Tokens consumed, for the cost follow-up per agency. */
export type AgentTokenCounts = { input: number; output: number };

/** What one agent did during one window. */
export type AgentActivity = {
  runs: AgentRunCounts;
  tokens: AgentTokenCounts;
};

/** One failed or blocked execution, as the "erreurs" panel lists it. */
export type AgentRunError = {
  runId: string;
  /** Stable machine code journaled by the agent, e.g. "ai_paused". */
  code: string | null;
  /** French sentence journaled with the outcome, displayable as-is. */
  decision: string | null;
  /**
   * `failed` = a real technical error (unreadable data, invalid AI output,
   * database refusal, or a rule only discovered after the run opened — see
   * docs/workflows.md). `blocked` = a guard rail or an eligibility rule refused
   * the attempt before any work: the product did its job, not an error. The UI
   * must never present a `blocked` entry as an error.
   */
  status: "failed" | "blocked";
  /** French label of the outcome: "Échec" or "Bloquée". */
  statusLabel: string;
  /** Canonical ISO-8601 UTC. */
  at: string;
};

/**
 * One agent as the "Agents IA" screen shows it: who it is, what it may do, and
 * what it really did.
 *
 * Every figure is an EXACT count from `ai_agent_runs` over a named window
 * (CLAUDE.md: statistics computed from the data actually recorded, never
 * invented). There is no sample and no truncation behind these numbers.
 */
export type AgentOverview = {
  agent: AiAgentName;
  /** Product first name: "Léa", "Hugo", "Emma", "Louis", "Sarah". */
  label: string;
  /** One sentence, including what the agent does NOT decide. */
  mission: string;
  /** False when the agency kill switch is on: the agent cannot run at all. */
  isActive: boolean;
  /** Current Paris calendar day. */
  today: AgentActivity;
  /** Current Paris day plus the six days before it. */
  last7Days: AgentActivity;
  /**
   * Runs of the current Paris day that count against `dailyRunLimit` — that is,
   * every outcome except `blocked` (a refused attempt consumes no quota). This
   * is exactly what `private.guard_ai_agent_run` counts.
   */
  runsTodayAgainstLimit: number;
  /**
   * Most recent execution, whatever its outcome and whatever its age — read
   * with a dedicated query per agent, so it is never missing because of a
   * pagination bound.
   */
  lastRun: AgentRunSummary | null;
  /** "Jamais exécuté" when `lastRun` is null, otherwise the outcome label. */
  lastRunLabel: string;
  /** The few most recent failures or blocks, most recent first. May be empty. */
  lastErrors: AgentRunError[];
};

/**
 * Head of the "Agents IA" screen: the agency's AI settings and its agents.
 *
 * All-or-nothing on purpose: if any figure could not be read, the whole read
 * fails with `{ data: null, error }`. A count that could not be made is NEVER
 * returned as `0` — the screen must show the error, not a reassuring zero.
 */
export type AgentsDashboard = {
  agencyId: string;
  agencyName: string;
  /** Kill switch. When true, no agent can run, and every attempt is journaled. */
  aiPaused: boolean;
  /** Daily execution limit of the agency (Europe/Paris day), 0 to 10 000. */
  dailyRunLimit: number;
  /**
   * Executions of the current Paris day that count against `dailyRunLimit`,
   * all agents together. Exact count, directly comparable to `dailyRunLimit`.
   */
  runsToday: number;
  /** Attempts of the current Paris day INCLUDING the ones that were refused. */
  runsTodayTotal: number;
  /** The two windows the figures are counted in, with their French names. */
  windows: { today: AgentActivityWindow; last7Days: AgentActivityWindow };
  /** True when the caller may resume the agents (directors only). */
  canResume: boolean;
  /** Drafts waiting for a human, all agents together. Exact count. */
  pendingValidationCount: number;
  agents: AgentOverview[];
};

/**
 * The kill switch, and nothing else — the emergency control on its own.
 *
 * Deliberately separate from `AgentsDashboard`: suspending every AI agent of
 * the agency in one click is a SAFETY device, so it must not disappear from the
 * screen because a statistic could not be counted. `AgentsDashboard` stays
 * all-or-nothing (that is the right behaviour for figures); this one carries no
 * figure at all, so there is nothing in it that can fail halfway.
 */
export type AiPausedState = {
  agencyId: string;
  agencyName: string;
  /** Kill switch. When true, no agent can run, and every attempt is journaled. */
  aiPaused: boolean;
  /** True when the caller may resume the agents (directors only). */
  canResume: boolean;
};

// -----------------------------------------------------------------------------
// Historique des exécutions — filtres et pagination
// -----------------------------------------------------------------------------

/** How many runs one page of the history holds by default. */
export const AGENT_RUNS_DEFAULT_LIMIT = 25;

/** Hard server-side ceiling: the UI can never ask for an unbounded page. */
export const AGENT_RUNS_MAX_LIMIT = 100;

/** Hard server-side ceiling on paging, so a crafted offset cannot scan forever. */
export const AGENT_RUNS_MAX_OFFSET = 5_000;

/**
 * Filters of the execution history, as they arrive from the browser.
 *
 * A server action / a Server Component receives whatever the client sends, so
 * every field is validated here before any query (CLAUDE.md). Unknown keys are
 * rejected rather than ignored: a filter the server silently drops would show
 * the user a list that does not match what the screen says it is showing.
 */
export const agentRunFiltersSchema = z
  .object({
    /** One agent, or every agent when omitted. */
    agent: z.enum(AGENT_ORDER).optional(),
    /** One outcome, or every outcome when omitted. */
    status: z.enum(["running", "succeeded", "failed", "blocked"]).optional(),
    limit: z.int().min(1).max(AGENT_RUNS_MAX_LIMIT).default(AGENT_RUNS_DEFAULT_LIMIT),
    offset: z.int().min(0).max(AGENT_RUNS_MAX_OFFSET).default(0),
  })
  .strict();

export type AgentRunFiltersInput = z.input<typeof agentRunFiltersSchema>;
export type AgentRunFilters = z.output<typeof agentRunFiltersSchema>;

/** One page of the execution history, newest first. */
export type AgentRunsPage = {
  runs: AgentRunSummary[];
  /** Exact number of runs matching the filters, all pages together. */
  total: number;
  limit: number;
  offset: number;
  /** True when another page exists after this one. */
  hasMore: boolean;
  /** The filters the server really applied, after validation and defaults. */
  appliedFilters: AgentRunFilters;
};

// -----------------------------------------------------------------------------
// Refus d'un brouillon — le motif est obligatoire
// -----------------------------------------------------------------------------

/**
 * Why a member of the agency refused a draft.
 *
 * A CLOSED list, deliberately, rather than free text:
 *   * the agency can compare its refusals ("Emma est trop insistante") and act
 *     on the agents' settings, which a pile of sentences would not allow;
 *   * a refusal often has to be justified afterwards, and a chosen motive is
 *     unambiguous evidence where a hurried sentence is not;
 *   * no free text means nothing personal, and nothing written by a prospect,
 *     ends up copied into the CRM journal by accident;
 *   * one click keeps the validation queue fast — a queue that is slow to
 *     process is a queue that gets bypassed.
 *
 * An optional short note covers what the list cannot say. It is written by a
 * member of the agency, never by an agent and never by a prospect.
 */
export const MESSAGE_REJECTION_REASONS = [
  "incorrect_information",
  "inappropriate_tone",
  "bad_timing",
  "consent_doubt",
  "handled_by_human",
  "already_contacted",
  "other",
] as const;

export type MessageRejectionReason = (typeof MESSAGE_REJECTION_REASONS)[number];

/** French labels of the motives, centralised like every other UI text. */
export const MESSAGE_REJECTION_REASON_LABELS: Readonly<Record<MessageRejectionReason, string>> = {
  incorrect_information: "Information inexacte ou absente du dossier",
  inappropriate_tone: "Ton ou formulation inadaptés",
  bad_timing: "Mauvais moment pour ce contact",
  consent_doubt: "Consentement insuffisant ou douteux",
  handled_by_human: "Dossier repris en main par un conseiller",
  already_contacted: "Contact déjà relancé récemment",
  other: "Autre motif",
};

/** Maximum length of the optional note, so the CRM journal stays readable. */
export const MESSAGE_REJECTION_NOTE_MAX_LENGTH = 300;

/**
 * Validation of a refusal. The motive is required; the note is optional,
 * trimmed, bounded, and stripped of control characters (it is stored in the
 * append-only CRM journal and displayed as text).
 */
export const messageRejectionSchema = z
  .object({
    reason: z.enum(MESSAGE_REJECTION_REASONS),
    note: z
      .string()
      .nullish()
      .transform((value) => {
        if (typeof value !== "string") return null;
        // Control characters (a paste from a PDF or a mail client can carry
        // them) would break the display of the append-only CRM journal. They
        // are written as escapes, deliberately: a literal control character in
        // the source would be invisible to the next reader.
        const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
        return cleaned.length === 0 ? null : cleaned;
      })
      .refine((value) => value === null || value.length <= MESSAGE_REJECTION_NOTE_MAX_LENGTH, {
        message: "Note trop longue.",
      }),
  })
  .strict();

export type MessageRejectionInput = z.input<typeof messageRejectionSchema>;
export type MessageRejection = z.output<typeof messageRejectionSchema>;

// -----------------------------------------------------------------------------
// Réécriture d'un brouillon par un humain, avant validation
// -----------------------------------------------------------------------------

/** Same bounds as the database columns (`outbound_messages`). */
export const DRAFT_SUBJECT_MAX_LENGTH = 300;
export const DRAFT_BODY_MAX_LENGTH = 5_000;

/**
 * Control characters are stripped, the text is trimmed, and an empty subject
 * becomes `null` (the column is nullable, an empty string is not a subject).
 */
function cleanDraftText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim();
}

/**
 * What a member of the agency may rewrite in a draft: the subject and the body.
 *
 * Deliberately NOT the channel, the contact or the status: changing those would
 * turn "correcting a sentence" into "sending something else to somebody else".
 * The server re-reads the draft, and the database refuses an edit that would
 * skip a new validation (`outbound_message_edit_requires_revalidation`).
 */
export const draftEditSchema = z
  .object({
    subject: z
      .unknown()
      .transform(cleanDraftText)
      .transform((value) => (value.length === 0 ? null : value))
      .refine((value) => value === null || value.length <= DRAFT_SUBJECT_MAX_LENGTH, {
        message: "Objet trop long.",
      }),
    body: z
      .unknown()
      .transform(cleanDraftText)
      .refine((value) => value.length >= 1 && value.length <= DRAFT_BODY_MAX_LENGTH, {
        message: "Message vide ou trop long.",
      }),
  })
  .strict();

export type DraftEditInput = z.input<typeof draftEditSchema>;
export type DraftEdit = z.output<typeof draftEditSchema>;

/** One appointment in the human bridge from Louis's proposal to Sarah. */
export type ReportedAppointmentView = {
  id: string;
  contactId: string;
  /** "Prénom Nom" of the contact, or "Contact sans nom". */
  contactName: string;
  stage: Enums["pipeline_stage"];
  status: Enums["appointment_status"];
  /** French lifecycle label, ready to display. */
  statusLabel: string;
  /** Canonical ISO-8601 UTC. */
  startsAt: string;
  /** Report written by a human of the agency. Never written by an AI agent. */
  reportNotes: string | null;
  reportRecordedAt: string | null;
  /** Exact server-side precondition for `confirmAppointment(id)`. */
  canBeConfirmed: boolean;
  /** Exact server-side precondition for `completeAppointment(id, input)`. */
  canBeCompleted: boolean;
  /** True when Sarah can be launched on it (done + report written). */
  canBeFollowedThrough: boolean;
  /** Most recent run of Sarah on this contact, if any. */
  lastFollowThroughRunId: string | null;
};

// -----------------------------------------------------------------------------
// Passage humain entre Louis et Sarah
// -----------------------------------------------------------------------------

export const APPOINTMENT_REPORT_MAX_LENGTH = 5_000;

/**
 * The only browser input needed to close a confirmed appointment.
 *
 * The report is written by a member, never by Sarah. Control characters are
 * removed so the append-only CRM history and the later prompt stay readable.
 */
export const appointmentCompletionSchema = z
  .object({
    reportNotes: z
      .unknown()
      .transform((value) =>
        typeof value === "string"
          ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim()
          : "",
      )
      .refine(
        (value) => value.length >= 1 && value.length <= APPOINTMENT_REPORT_MAX_LENGTH,
        { message: "Compte-rendu vide ou trop long." },
      ),
  })
  .strict();

export type AppointmentCompletionInput = z.input<typeof appointmentCompletionSchema>;
export type AppointmentCompletion = z.output<typeof appointmentCompletionSchema>;

export const APPOINTMENT_STATUS_LABELS = {
  proposed: "Proposé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  done: "Réalisé",
} as const;

export type HumanAppointmentResult = {
  appointmentId: string;
  contactId: string;
  status: "confirmed" | "done";
  statusLabel: (typeof APPOINTMENT_STATUS_LABELS)["confirmed" | "done"];
  /** The contact stage after the atomic database transition. */
  stage: Enums["pipeline_stage"];
  /** True in this prototype. No real calendar provider is connected. */
  isSimulation: boolean;
  /** Present only after completion; canonical ISO-8601 UTC. */
  reportRecordedAt: string | null;
};
