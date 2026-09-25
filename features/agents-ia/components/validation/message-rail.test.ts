import { describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import type { PendingMessageView } from "../../types";
import { messageRailModel, messageRailStage } from "./message-rail";
import { messageRailFor } from "./message-rail-view";
import { initialSelection, nextSelection, queueKeyTarget } from "./queue-selection";

const TEXTS = APP_TEXTS.validationQueue;

function message(overrides: Partial<PendingMessageView> = {}): PendingMessageView {
  return {
    id: "m1",
    contactId: "c1",
    contactName: "Sophie Marchand",
    channel: "email",
    channelLabel: "Email",
    subject: "Objet",
    body: "Bonjour.\n\nPour ne plus recevoir nos messages, répondez STOP.",
    status: "pending_validation",
    statusLabel: "À valider",
    createdByAgent: "emma",
    createdByAgentLabel: "Emma",
    isSimulation: true,
    consentStatus: "granted",
    hasValidConsent: true,
    isFirstContact: true,
    canBeSent: false,
    createdAt: "2026-09-17T08:00:00.000Z",
    ...overrides,
  };
}

describe("message rail — reflects the recorded status only", () => {
  it("maps every status to its stage, and an outcome only once the server confirmed it", () => {
    expect(messageRailStage("pending_validation")).toBe("awaiting");
    expect(messageRailStage("approved")).toBe("approved");
    expect(messageRailStage("rejected")).toBe("rejected");
    expect(messageRailStage("sent_simulated")).toBe("sent");
    expect(messageRailStage("pending_validation", "validated")).toBe("approved");
    expect(messageRailStage("approved", "sent")).toBe("sent");
    expect(messageRailStage("pending_validation", null)).toBe("awaiting");
  });

  it("stops the letter in front of « Vous » while a human decision is awaited", () => {
    expect(messageRailModel("awaiting", true)).toEqual({
      stage: "awaiting",
      human: "waiting",
      send: "idle",
      sendCut: false,
      token: "atHuman",
    });
  });

  it("lets the letter past « Vous » once validated, and waits for an explicit send", () => {
    const model = messageRailModel("approved", true);
    expect(model.human).toBe("done");
    expect(model.send).toBe("waiting");
    expect(model.token).toBe("atSend");
  });

  it("cuts the line to the send when the server would refuse it (no valid consent)", () => {
    expect(messageRailModel("awaiting", false)).toMatchObject({ send: "blocked", sendCut: true });
    expect(messageRailModel("approved", false)).toMatchObject({ send: "blocked", sendCut: true });
  });

  it("stops a refused message at « Vous » for good, and ends a sent one at the send", () => {
    expect(messageRailModel("rejected", true)).toMatchObject({ human: "stopped", send: "never", token: "returned" });
    expect(messageRailModel("sent", true)).toMatchObject({ human: "done", send: "done", token: "sent", sendCut: false });
  });

  it("writes who prepared the message and the real status under each node", () => {
    const pending = messageRailFor(message());
    expect(pending.author).toMatchObject({ name: TEXTS.preparedBy("Emma"), glyph: "emma", kind: "agent" });
    expect(pending.humanStatus).toBe("À valider");
    expect(pending.sendStatus).toBe(TEXTS.railSendAfterValidation);

    const approved = messageRailFor(message({ status: "approved", statusLabel: "Validé", canBeSent: true }));
    expect(approved.humanStatus).toBe("Validé");
    expect(approved.sendStatus).toBe(TEXTS.railSendWaiting);

    const approvedWithoutConsent = messageRailFor(
      message({ status: "approved", statusLabel: "Validé", canBeSent: false, hasValidConsent: false }),
    );
    expect(approvedWithoutConsent.sendStatus).toBe(TEXTS.railSendBlocked);

    expect(messageRailFor(message(), "rejected").humanStatus).toBe("Refusé");
    expect(messageRailFor(message(), "rejected").sendStatus).toBe(TEXTS.railSendNever);
    expect(messageRailFor(message({ status: "approved" }), "sent").humanStatus).toBe("Validé");
    expect(messageRailFor(message({ status: "approved" }), "sent").sendStatus).toBe(TEXTS.railSendDone);
  });

  it("draws a human author as a person, never as an agent", () => {
    const view = messageRailFor(message({ createdByAgent: null, createdByAgentLabel: null }));
    expect(view.author).toEqual({ name: TEXTS.writtenByHuman, glyph: "human", kind: "human" });
  });
});

describe("queue selection", () => {
  const queue = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("opens the requested message, else selects the first and shows the queue", () => {
    expect(initialSelection(queue, "b")).toEqual({ selectedId: "b", view: "message" });
    expect(initialSelection(queue, "unknown")).toEqual({ selectedId: "a", view: "list" });
    expect(initialSelection(queue, null)).toEqual({ selectedId: "a", view: "list" });
    expect(initialSelection([], "a")).toEqual({ selectedId: null, view: "list" });
  });

  it("moves through the list with the arrows, Début and Fin (wrapping)", () => {
    expect(queueKeyTarget("ArrowDown", 0, 3)).toBe(1);
    expect(queueKeyTarget("ArrowDown", 2, 3)).toBe(0);
    expect(queueKeyTarget("ArrowUp", 0, 3)).toBe(2);
    expect(queueKeyTarget("Home", 2, 3)).toBe(0);
    expect(queueKeyTarget("End", 0, 3)).toBe(2);
    expect(queueKeyTarget("Enter", 0, 3)).toBeNull();
    expect(queueKeyTarget("ArrowDown", 0, 0)).toBeNull();
  });

  it("offers the message that followed the one just handled", () => {
    expect(nextSelection([{ id: "a" }, { id: "c" }], ["b", "c"])).toBe("c");
    expect(nextSelection([{ id: "a" }], ["b"])).toBe("a");
    expect(nextSelection([], ["b"])).toBeNull();
  });
});
