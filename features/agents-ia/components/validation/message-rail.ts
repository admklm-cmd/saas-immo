import type { PendingMessageView } from "../../types";

/**
 * Where a message stands on its short rail « Préparé par … → Vous → Envoi
 * (simulation) » — docs/design-system.md §3.1.1. Pure and tested: the rail
 * only ever draws a state the server returned.
 */
export type MessageRailStage = "awaiting" | "approved" | "rejected" | "sent";

/** What a member just did, as confirmed by the server's answer. */
export type MessageOutcome = "validated" | "rejected" | "sent";

export type MessageRailModel = {
  stage: MessageRailStage;
  /** The human checkpoint « Vous ». */
  human: "waiting" | "done" | "stopped";
  /** The (simulated) send at the end of the rail. */
  send: "idle" | "waiting" | "blocked" | "done" | "never";
  /** The line from « Vous » to the send is cut, with a stop mark in front of the send. */
  sendCut: boolean;
  /** Where the letter token stands on the line. */
  token: "atHuman" | "atSend" | "sent" | "returned";
};

const STAGE_OF_STATUS: Readonly<Record<PendingMessageView["status"], MessageRailStage>> = {
  pending_validation: "awaiting",
  approved: "approved",
  rejected: "rejected",
  sent_simulated: "sent",
};

const STAGE_OF_OUTCOME: Readonly<Record<MessageOutcome, MessageRailStage>> = {
  validated: "approved",
  rejected: "rejected",
  sent: "sent",
};

/**
 * Stage of a message: its recorded status, or — between the server's answer
 * to a decision and the re-read of the queue — the outcome that answer
 * confirmed. Never an optimistic guess: `outcome` is only set on success.
 */
export function messageRailStage(
  status: PendingMessageView["status"],
  outcome?: MessageOutcome | null,
): MessageRailStage {
  return outcome ? STAGE_OF_OUTCOME[outcome] : STAGE_OF_STATUS[status];
}

/**
 * The rail of one message.
 *
 * `sendPossible` is what the server says about the send: `canBeSent` for a
 * validated message, the current consent of the channel before that. Without
 * it the line to the send is cut — the server would refuse, and the rail says
 * so before anyone clicks.
 */
export function messageRailModel(stage: MessageRailStage, sendPossible: boolean): MessageRailModel {
  switch (stage) {
    case "awaiting":
      return {
        stage,
        human: "waiting",
        send: sendPossible ? "idle" : "blocked",
        sendCut: !sendPossible,
        token: "atHuman",
      };
    case "approved":
      return {
        stage,
        human: "done",
        send: sendPossible ? "waiting" : "blocked",
        sendCut: !sendPossible,
        token: "atSend",
      };
    case "rejected":
      return { stage, human: "stopped", send: "never", sendCut: true, token: "returned" };
    case "sent":
      return { stage, human: "done", send: "done", sendCut: false, token: "sent" };
  }
}
