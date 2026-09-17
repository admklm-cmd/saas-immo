/**
 * Consent and channel rules shared by every agent that prepares a message.
 *
 * They live in `lib/agents/` and not in one agent's folder because they are the
 * SAME rule for Louis (proposition de rendez-vous) and for Emma (relance), and
 * because they are the legal core of the product: no draft, no send, without a
 * valid consent for the exact channel used (CLAUDE.md, socle légal).
 *
 * Two properties matter here:
 *   * the decision is taken BY THE CODE, from structured CRM values only — the
 *     prospect's free text has no influence on it whatsoever;
 *   * "granted" is read from the CURRENT consent of the channel (the most recent
 *     row of the append-only register, exposed by the `current_consents` view),
 *     so a withdrawal always wins over an older grant.
 *
 * The database re-checks the consent at (simulated) send time
 * (`private.guard_outbound_message`): the code refuses early and clearly, the
 * database refuses last and unconditionally.
 */

import type { Database } from "@/types/database";

type ConsentChannel = Database["public"]["Enums"]["consent_channel"];
type ConsentStatus = Database["public"]["Enums"]["consent_status"];

/** Channels a message can actually be drafted for (`phone` is not a message). */
export type MessageChannel = Exclude<ConsentChannel, "phone">;

/** Preference order: the least intrusive channel first. */
export const CHANNEL_PREFERENCE: readonly MessageChannel[] = ["email", "sms", "whatsapp"];

/** French labels of the channels, for tasks, history entries and the UI. */
export const CHANNEL_LABELS: Readonly<Record<MessageChannel, string>> = {
  email: "email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export type ChannelInput = {
  hasEmail: boolean;
  hasPhone: boolean;
  /** Current consent per channel (most recent row per channel), if any. */
  consents: Partial<Record<ConsentChannel, ConsentStatus>>;
};

export type ChannelRefusal = "appointment_no_reachable_channel" | "consent_not_granted";

export type ChannelResult = { channel: MessageChannel } | { channel: null; code: ChannelRefusal };

/**
 * Picks the channel of a draft. Refuses — with a distinct reason — when the
 * contact has no usable address at all, and when an address exists but no valid
 * consent covers it. A `withdrawn` consent is not a consent.
 */
export function chooseChannel(input: ChannelInput): ChannelResult {
  const reachable = CHANNEL_PREFERENCE.filter((channel) =>
    channel === "email" ? input.hasEmail : input.hasPhone,
  );

  if (reachable.length === 0) {
    return { channel: null, code: "appointment_no_reachable_channel" };
  }

  const granted = reachable.find((channel) => input.consents[channel] === "granted");
  if (!granted) {
    return { channel: null, code: "consent_not_granted" };
  }
  return { channel: granted };
}

/**
 * Opt-out notice required in every message sent to a private individual.
 * Added by the code, always, so that it cannot depend on what the model felt
 * like writing.
 */
export const UNSUBSCRIBE_NOTICE = "Pour ne plus recevoir de messages de notre part, répondez STOP.";

/** Detects an opt-out keyword already present in the body (avoids duplicates). */
const STOP_PATTERN = /\bSTOP\b/;

export function composeMessageBody(body: string, signature?: string | null): string {
  const parts = [body.trim()];
  if (signature && signature.trim().length > 0) parts.push(signature.trim());
  if (!STOP_PATTERN.test(body)) parts.push(UNSUBSCRIBE_NOTICE);
  return parts.join("\n\n");
}
