/**
 * Human validation of what the agents prepared — the other half of Emma and
 * Louis, and the place where the product's hardest rule is actually applied:
 *
 *   **Premier contact : toujours validé par un humain de l'agence.**
 *
 * Nothing here is done by an AI agent. These are the actions a MEMBER takes on
 * a draft, and they are deliberately kept in three separate steps so that
 * approving and sending are never the same click:
 *
 *   `pending_validation` → `approved` → `sent_simulated`
 *                        ↘ `rejected`
 *
 * Defence in depth, as everywhere else in this codebase:
 *   * the code checks the transition, the ownership and the current consent;
 *   * the database checks them again in `private.guard_outbound_message`, which
 *     re-reads the consent AT SEND TIME, refuses an unvalidated first contact,
 *     stamps `validated_by` with the caller and freezes a sent message.
 *
 * "Envoyé" means `sent_simulated`: **no provider is wired**, nothing leaves the
 * product, and the database itself refuses a send that is not a simulation
 * (`outbound_messages_sent_is_simulation`). The UI must say so, every time.
 */

import { databaseErrorCode, failFromDatabase, failFromUnexpected, failWith } from "@/lib/agents/errors";
import { resolveAgentContext } from "@/lib/agents/context";
import { type AgentErrorCode } from "@/lib/agents/messages";
import type { AgentContext, TypedClient } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";

import {
  draftEditSchema,
  MESSAGE_REJECTION_REASON_LABELS,
  messageRejectionSchema,
  type DraftEditInput,
  type MessageRejection,
  type MessageRejectionInput,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MessageDecisionResult = {
  messageId: string;
  contactId: string;
  status: "approved" | "rejected" | "sent_simulated";
  /** French label of the new status, ready to display. */
  statusLabel: string;
  /** Always true: nothing real can be sent from this prototype. */
  isSimulation: boolean;
  /** Set only for a (simulated) send. Canonical ISO-8601 UTC. */
  sentAt: string | null;
  /**
   * Why the draft was refused. Set only for a refusal, `null` otherwise.
   * The motive comes from a closed list; the note is an optional free comment
   * written by a member of the agency (never by an agent, never by a prospect).
   */
  rejection: { reason: MessageRejection["reason"]; reasonLabel: string; note: string | null } | null;
};

const STATUS_LABELS = {
  approved: "Validé",
  rejected: "Refusé",
  sent_simulated: "Envoyé (simulation)",
} as const;

/** Label of the state an edited draft always returns to. */
const PENDING_STATUS_LABEL = "À valider";

type MessageRow = {
  id: string;
  contact_id: string;
  channel: "email" | "sms" | "whatsapp" | "phone";
  status: "pending_validation" | "approved" | "rejected" | "sent_simulated";
  is_simulation: boolean;
  created_by_agent: "lea" | "hugo" | "emma" | "louis" | "sarah" | null;
};

/** Reads the draft, scoped to the caller's agency. Generic answer otherwise. */
async function loadMessage(
  client: TypedClient,
  context: AgentContext,
  messageId: string,
): Promise<Result<MessageRow>> {
  const { data, error } = await client
    .from("outbound_messages")
    .select("id, contact_id, channel, status, is_simulation, created_by_agent")
    .eq("agency_id", context.agencyId)
    .eq("id", messageId)
    .maybeSingle();

  if (error) return failFromDatabase<MessageRow>("loadMessage", error);
  // Same answer whether it does not exist or belongs to another agency.
  if (!data) return failWith<MessageRow>("outbound_message_not_found");
  return ok(data as MessageRow);
}

/**
 * A member of the agency validates a draft. The message is NOT sent by this:
 * it becomes `approved` and waits for an explicit send.
 *
 * `validated_by` is not trusted from here — the database stamps it with the
 * caller and refuses any other value (`validated_by_must_be_caller`).
 */
export async function approveOutboundMessage(
  client: TypedClient,
  messageId: string,
): Promise<Result<MessageDecisionResult>> {
  return decide(client, messageId, "approved", null);
}

/**
 * A member of the agency refuses a draft. Nothing is sent, ever.
 *
 * The motive is REQUIRED and comes from a closed list (`MESSAGE_REJECTION_REASONS`):
 * an agency that discards what an AI wrote must be able to say why, and that is
 * the raw material for tuning the agents later. A motive outside the list — or a
 * note longer than `MESSAGE_REJECTION_NOTE_MAX_LENGTH` — is refused with
 * `invalid_reason`, and the draft stays exactly where it was.
 */
export async function rejectOutboundMessage(
  client: TypedClient,
  messageId: string,
  rejection: MessageRejectionInput,
): Promise<Result<MessageDecisionResult>> {
  const parsed = messageRejectionSchema.safeParse(rejection);
  if (!parsed.success) return failWith<MessageDecisionResult>("invalid_reason");
  return decide(client, messageId, "rejected", parsed.data);
}

async function decide(
  client: TypedClient,
  messageId: string,
  status: "approved" | "rejected",
  rejection: MessageRejection | null,
): Promise<Result<MessageDecisionResult>> {
  try {
    if (!UUID_PATTERN.test(messageId)) {
      return failWith<MessageDecisionResult>("outbound_message_not_found");
    }
    // A refusal without a motive never reaches the database, whatever the
    // caller: the motive is part of the decision, not a decoration on it.
    if (status === "rejected" && rejection === null) {
      return failWith<MessageDecisionResult>("invalid_reason");
    }

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const loaded = await loadMessage(client, context, messageId);
    if (loaded.error) return { data: null, error: loaded.error };
    const message = loaded.data;

    // Only a draft can be decided on. An already approved, refused or sent
    // message is not re-decided silently.
    if (message.status !== "pending_validation") {
      return failWith<MessageDecisionResult>("outbound_message_not_pending");
    }

    const { data, error } = await client
      .from("outbound_messages")
      .update({
        status,
        validated_by: context.userId,
        rejection_reason: rejection?.reason ?? null,
        rejection_reason_label: rejection ? MESSAGE_REJECTION_REASON_LABELS[rejection.reason] : null,
        rejection_note: rejection?.note ?? null,
      })
      .eq("agency_id", context.agencyId)
      .eq("id", messageId)
      // Optimistic lock: if somebody decided in between, no row is updated.
      .eq("status", "pending_validation")
      .select("id, contact_id, status, is_simulation, sent_at")
      .maybeSingle();

    if (error) return failFromDatabase<MessageDecisionResult>("decideOutboundMessage", error);
    if (!data) return failWith<MessageDecisionResult>("outbound_message_not_pending");

    const reasonLabel = rejection ? MESSAGE_REJECTION_REASON_LABELS[rejection.reason] : null;

    return ok({
      messageId: data.id,
      contactId: data.contact_id,
      status,
      statusLabel: STATUS_LABELS[status],
      isSimulation: data.is_simulation,
      sentAt: null,
      rejection:
        rejection && reasonLabel
          ? { reason: rejection.reason, reasonLabel, note: rejection.note }
          : null,
    });
  } catch (cause) {
    return failFromUnexpected<MessageDecisionResult>("decideOutboundMessage", cause);
  }
}

/**
 * Sends an approved message — **in simulation**. No provider is wired: this
 * only moves the row to `sent_simulated` and writes the CRM history.
 *
 * The database has the last word: it re-reads the current consent of the
 * channel at this exact moment (`consent_not_granted` if it was withdrawn since
 * the draft was written) and refuses an unvalidated first contact. A consent
 * that was valid yesterday is not a permission today.
 */
export async function sendApprovedMessage(
  client: TypedClient,
  messageId: string,
): Promise<Result<MessageDecisionResult>> {
  try {
    if (!UUID_PATTERN.test(messageId)) {
      return failWith<MessageDecisionResult>("outbound_message_not_found");
    }

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const loaded = await loadMessage(client, context, messageId);
    if (loaded.error) return { data: null, error: loaded.error };
    const message = loaded.data;

    // A draft is never sent directly: a human approves first, explicitly.
    if (message.status !== "approved") {
      return failWith<MessageDecisionResult>(
        message.status === "sent_simulated"
          ? "outbound_message_not_pending"
          : "outbound_message_not_approved",
      );
    }

    const { data, error } = await client
      .from("outbound_messages")
      .update({ status: "sent_simulated" })
      .eq("agency_id", context.agencyId)
      .eq("id", messageId)
      .eq("status", "approved")
      .select("id, contact_id, status, is_simulation, sent_at")
      .maybeSingle();

    if (error) {
      // The database refused: almost always a consent withdrawn between the
      // approval and the send. That is the rule working, not a bug.
      const code: AgentErrorCode = databaseErrorCode(error);
      console.error(`[agents] sendApprovedMessage refused (${error.code ?? "?"}): ${error.message}`);
      return failWith<MessageDecisionResult>(code);
    }
    if (!data) return failWith<MessageDecisionResult>("outbound_message_not_approved");

    return ok({
      messageId: data.id,
      contactId: data.contact_id,
      status: "sent_simulated",
      statusLabel: STATUS_LABELS.sent_simulated,
      isSimulation: data.is_simulation,
      sentAt: data.sent_at ? new Date(Date.parse(data.sent_at)).toISOString() : null,
      rejection: null,
    });
  } catch (cause) {
    return failFromUnexpected<MessageDecisionResult>("sendApprovedMessage", cause);
  }
}

export type DraftEditResult = {
  messageId: string;
  contactId: string;
  /** Always `pending_validation`: an edited draft is validated again. */
  status: "pending_validation";
  statusLabel: string;
  subject: string | null;
  body: string;
  /** True when the edit cancelled a validation that had already been given. */
  revalidationRequired: boolean;
};

/**
 * A member of the agency rewrites a draft before it is validated.
 *
 * Why this exists: an agency must be able to correct a sentence written by an
 * AI without throwing the whole draft away — and the correction must be as
 * traceable as a refusal.
 *
 * Two rules are held here, and again by the database:
 *   * only the SUBJECT and the BODY can change. Not the channel, not the
 *     contact, not the status: correcting a sentence must never become
 *     "sending something else to somebody else";
 *   * an edited draft ALWAYS goes back to `pending_validation`. Editing an
 *     approved message cancels its approval — the database refuses any other
 *     outcome (`outbound_message_edit_requires_revalidation`), and the trigger
 *     clears `validated_by` / `validated_at` itself.
 *
 * A refused or already sent message cannot be edited at all.
 */
export async function updateDraftContent(
  client: TypedClient,
  messageId: string,
  input: DraftEditInput,
): Promise<Result<DraftEditResult>> {
  try {
    if (!UUID_PATTERN.test(messageId)) {
      return failWith<DraftEditResult>("outbound_message_not_found");
    }

    // The text comes from a browser: bounded, trimmed and stripped of control
    // characters before anything else (CLAUDE.md — every client input is
    // validated by a schema first).
    const parsed = draftEditSchema.safeParse(input);
    if (!parsed.success) return failWith<DraftEditResult>("outbound_message_invalid_content");

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const loaded = await loadMessage(client, context, messageId);
    if (loaded.error) return { data: null, error: loaded.error };
    const message = loaded.data;

    // Rejected and sent messages are final: there is nothing left to correct.
    if (message.status !== "pending_validation" && message.status !== "approved") {
      return failWith<DraftEditResult>("outbound_message_not_pending");
    }

    const { data, error } = await client
      .from("outbound_messages")
      .update({
        subject: parsed.data.subject,
        body: parsed.data.body,
        // An edited draft is never "already validated".
        status: "pending_validation",
      })
      .eq("agency_id", context.agencyId)
      .eq("id", messageId)
      // Optimistic lock: if somebody decided in between, no row is updated.
      .eq("status", message.status)
      .select("id, contact_id, subject, body, is_simulation")
      .maybeSingle();

    if (error) {
      const code: AgentErrorCode = databaseErrorCode(error);
      console.error(`[agents] updateDraftContent refused (${error.code ?? "?"}): ${error.message}`);
      return failWith<DraftEditResult>(code);
    }
    if (!data) return failWith<DraftEditResult>("outbound_message_not_pending");

    const revalidationRequired = message.status === "approved";

    return ok({
      messageId: data.id,
      contactId: data.contact_id,
      status: "pending_validation",
      statusLabel: PENDING_STATUS_LABEL,
      subject: data.subject,
      body: data.body,
      revalidationRequired,
    });
  } catch (cause) {
    return failFromUnexpected<DraftEditResult>("updateDraftContent", cause);
  }
}

// -----------------------------------------------------------------------------
// Coupe-circuit
// -----------------------------------------------------------------------------

export type AiPausedResult = { agencyId: string; aiPaused: boolean };

/**
 * The agency's kill switch: suspends every AI agent in one click.
 *
 * Goes through the `set_ai_paused` RPC, which holds the rule the product needs:
 * **any member may pause, only a director may resume.** The RPC also writes the
 * `activities` entry itself, so the decision is traceable and cannot be faked.
 */
export async function setAiPaused(
  client: TypedClient,
  paused: boolean,
): Promise<Result<AiPausedResult>> {
  try {
    if (typeof paused !== "boolean") return failWith<AiPausedResult>("forbidden");

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const { data, error } = await client.rpc("set_ai_paused", {
      target_agency: context.agencyId,
      paused,
    });

    if (error) {
      const code: AgentErrorCode = databaseErrorCode(error);
      console.error(`[agents] setAiPaused refused (${error.code ?? "?"}): ${error.message}`);
      return failWith<AiPausedResult>(code);
    }

    return ok({ agencyId: context.agencyId, aiPaused: data ?? paused });
  } catch (cause) {
    return failFromUnexpected<AiPausedResult>("setAiPaused", cause);
  }
}
