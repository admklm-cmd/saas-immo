"use server";

/**
 * Server actions of the "Agents IA" module — the HUMAN side of the agents.
 *
 * These are the actions a member of the agency takes: validate or refuse a
 * draft an agent prepared, send it (in simulation), and flip the kill switch.
 * No AI is called here.
 *
 * Each one only builds the request-scoped Supabase client (session cookies, RLS
 * applies) and delegates to `validation.ts`, which re-checks the session, the
 * agency, the transition and the consent server-side. The database checks them
 * all over again.
 */

import { failWith } from "@/lib/agents/errors";
import { parseUuid } from "@/lib/agents/input";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import {
  approveOutboundMessage,
  rejectOutboundMessage,
  sendApprovedMessage,
  setAiPaused,
  updateDraftContent,
  type AiPausedResult,
  type DraftEditResult,
  type MessageDecisionResult,
} from "./validation";
import type { DraftEditInput, MessageRejectionInput } from "./types";

/** Validates a draft. It is NOT sent by this: it becomes « Validé » and waits. */
export async function validateMessage(messageId: string): Promise<Result<MessageDecisionResult>> {
  const id = parseUuid(messageId);
  if (id === null) return failWith<MessageDecisionResult>("outbound_message_not_found");

  const client = await createClient();
  return approveOutboundMessage(client, id);
}

/**
 * Refuses a draft. It will never be sent.
 *
 * A motive is REQUIRED (`MESSAGE_REJECTION_REASONS`, closed list) and an
 * optional short note may be added. Both are journaled in the append-only CRM
 * history: an agency must be able to say why it discarded what an AI wrote, and
 * those motives are what will let the agents be corrected later.
 */
export async function refuseMessage(
  messageId: string,
  rejection: MessageRejectionInput,
): Promise<Result<MessageDecisionResult>> {
  const id = parseUuid(messageId);
  if (id === null) return failWith<MessageDecisionResult>("outbound_message_not_found");

  const client = await createClient();
  // The motive itself is validated by zod inside `rejectOutboundMessage`.
  return rejectOutboundMessage(client, id, rejection);
}

/**
 * Rewrites the subject and the body of a draft, before it goes out.
 *
 * Correcting an AI sentence must not become a way to bypass the human
 * validation: an edited draft always returns to « À valider », even if it had
 * already been approved (the database refuses anything else). Only the text
 * changes — never the channel, never the contact.
 */
export async function editDraft(
  messageId: string,
  draft: DraftEditInput,
): Promise<Result<DraftEditResult>> {
  const id = parseUuid(messageId);
  if (id === null) return failWith<DraftEditResult>("outbound_message_not_found");

  const client = await createClient();
  // The text itself is validated by zod inside `updateDraftContent`.
  return updateDraftContent(client, id, draft);
}

/**
 * Sends a validated message — **in simulation only**. No provider is wired;
 * the database refuses any send that is not flagged as a simulation, and
 * re-reads the consent of the channel at this exact moment.
 */
export async function sendValidatedMessage(
  messageId: string,
): Promise<Result<MessageDecisionResult>> {
  const id = parseUuid(messageId);
  if (id === null) return failWith<MessageDecisionResult>("outbound_message_not_found");

  const client = await createClient();
  return sendApprovedMessage(client, id);
}

/**
 * Kill switch of the agency. Any member may pause; **only a director may
 * resume** (enforced by the database function, not by the UI).
 */
export async function setAgencyAiPaused(paused: boolean): Promise<Result<AiPausedResult>> {
  // A server action is a public endpoint: never trust the declared type.
  if (typeof paused !== "boolean") return failWith<AiPausedResult>("forbidden");

  const client = await createClient();
  return setAiPaused(client, paused);
}
