// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import type { PendingMessageView } from "../types";
import { PendingMessagesList } from "./PendingMessagesList";

const TEXTS = APP_TEXTS.validationQueue;

const validateMessage = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/features/agents-ia/actions", () => ({
  validateMessage,
  refuseMessage: vi.fn(),
  sendValidatedMessage: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  validateMessage.mockReset().mockResolvedValue({ data: {}, error: null });
  refresh.mockReset();
});

afterEach(() => {
  cleanup();
});

const draft: PendingMessageView = {
  id: "message-1",
  contactId: "contact-1",
  contactName: "Sophie Marchand",
  channel: "email",
  channelLabel: "Email",
  subject: null,
  body: "Bonjour Sophie.",
  status: "pending_validation",
  statusLabel: "À valider",
  createdByAgent: "emma",
  createdByAgentLabel: "Emma",
  isSimulation: true,
  consentStatus: "granted",
  hasValidConsent: true,
  isFirstContact: false,
  canBeSent: false,
  createdAt: "2026-09-17T08:00:00.000Z",
};

describe("PendingMessagesList", () => {
  it("suggests what to do when the queue is empty", () => {
    render(<PendingMessagesList messages={[]} />);

    expect(screen.getByText(TEXTS.emptyTitle)).toBeDefined();
    expect(screen.getByRole("link", { name: TEXTS.emptyAction }).getAttribute("href")).toBe(
      "/contacts",
    );
  });

  it("keeps the confirmation on screen and re-reads the queue after a decision", async () => {
    render(<PendingMessagesList messages={[draft]} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("validate-message"));
    });

    expect(screen.getByTestId("decision-summary").textContent).toContain(TEXTS.successValidated);
    expect(refresh).toHaveBeenCalled();
  });

  it("renders one card per draft", () => {
    render(<PendingMessagesList messages={[draft, { ...draft, id: "message-2" }]} />);
    expect(screen.getAllByTestId("pending-message")).toHaveLength(2);
  });
});
