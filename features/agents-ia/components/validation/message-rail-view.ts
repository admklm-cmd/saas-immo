import { APP_TEXTS } from "@/components/texts";
import { MESSAGE_STATUS_LABELS } from "@/features/contacts/types";

import type { PendingMessageView } from "../../types";
import { AGENT_GLYPHS } from "../agent-icons";
import type { GlyphName } from "../icons/glyphs";
import {
  messageRailModel,
  messageRailStage,
  type MessageOutcome,
  type MessageRailModel,
  type MessageRailStage,
} from "./message-rail";

const TEXTS = APP_TEXTS.validationQueue;

export type MessageRailView = {
  model: MessageRailModel;
  author: { name: string; glyph: GlyphName; kind: "agent" | "human" };
  /** Written status of « Vous » — the recorded status label of the message. */
  humanStatus: string;
  /** Written status of the send. */
  sendStatus: string;
};

const STATUS_OF_STAGE: Readonly<Record<MessageRailStage, PendingMessageView["status"]>> = {
  awaiting: "pending_validation",
  approved: "approved",
  rejected: "rejected",
  sent: "sent_simulated",
};

const SEND_STATUS: Readonly<Record<MessageRailModel["send"], string>> = {
  idle: TEXTS.railSendAfterValidation,
  waiting: TEXTS.railSendWaiting,
  blocked: TEXTS.railSendBlocked,
  done: TEXTS.railSendDone,
  never: TEXTS.railSendNever,
};

/**
 * Everything the rail of a message writes, from the message as the server
 * returned it (and the outcome it just confirmed, if any). Pure and tested.
 */
export function messageRailFor(message: PendingMessageView, outcome?: MessageOutcome | null): MessageRailView {
  const stage = messageRailStage(message.status, outcome);
  // What the server says about the send: `canBeSent` once validated (it also
  // checks the consent); the current consent of the channel before that. Right
  // after a validation the queue has not been re-read yet: the consent decides.
  const sendPossible = message.status === "approved" ? message.canBeSent : message.hasValidConsent;
  const model = messageRailModel(stage, sendPossible);
  const author = message.createdByAgent
    ? {
        name: TEXTS.preparedBy(message.createdByAgentLabel ?? message.createdByAgent),
        glyph: AGENT_GLYPHS[message.createdByAgent],
        kind: "agent" as const,
      }
    : { name: TEXTS.writtenByHuman, glyph: "human" as const, kind: "human" as const };

  return {
    model,
    author,
    // « Vous » validated a message that was then sent: its own node stays « Validé ».
    humanStatus:
      stage === "sent"
        ? MESSAGE_STATUS_LABELS.approved
        : outcome
          ? MESSAGE_STATUS_LABELS[STATUS_OF_STAGE[stage]]
          : message.statusLabel,
    sendStatus: SEND_STATUS[model.send],
  };
}
