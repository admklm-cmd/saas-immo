// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import type { PendingMessageView } from "../types";
import { PendingMessagesList } from "./PendingMessagesList";

const TEXTS = APP_TEXTS.validationQueue;

const validateMessage = vi.hoisted(() => vi.fn());
const refuseMessage = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/features/agents-ia/actions", () => ({
  validateMessage,
  refuseMessage,
  sendValidatedMessage: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  validateMessage.mockReset().mockResolvedValue({ data: {}, error: null });
  refresh.mockReset();
  refuseMessage.mockReset().mockResolvedValue({ data: {}, error: null });
  window.matchMedia = ((query: string) => ({ matches: true, media: query })) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, "", "/agents-ia/a-valider");
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

  const second: PendingMessageView = { ...draft, id: "message-2", contactName: "Patrick Leger", channel: "sms", channelLabel: "SMS" };
  const third: PendingMessageView = { ...draft, id: "message-3", contactName: "Marc Aubert", status: "approved", statusLabel: "Validé" };

  it("is a vertical tab list: one selected tab, controlling its letter; every letter stays in the page", () => {
    render(<PendingMessagesList messages={[draft, second, third]} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole("tablist").getAttribute("aria-orientation")).toBe("vertical");
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    // Without JavaScript each tab is a real link to the same page on that message.
    expect(tabs[1]!.getAttribute("href")).toBe("/agents-ia/a-valider?message=message-2");

    const panels = document.querySelectorAll("[role=tabpanel]");
    expect(panels).toHaveLength(3);
    expect(tabs[0]!.getAttribute("aria-controls")).toBe(panels[0]!.id);
    expect((panels[0] as HTMLElement).hidden).toBe(false);
    expect((panels[1] as HTMLElement).hidden).toBe(true);
    // Hidden, never removed: all messages are in the HTML.
    expect(screen.getAllByTestId("pending-message")).toHaveLength(3);
  });

  it("moves the selection with the keyboard and keeps the URL in step", () => {
    render(<PendingMessagesList messages={[draft, second, third]} />);
    const tabs = screen.getAllByRole("tab");

    tabs[0]!.focus();
    fireEvent.keyDown(tabs[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
    expect((document.getElementById(tabs[1]!.getAttribute("aria-controls")!) as HTMLElement).hidden).toBe(false);
    expect(window.location.search).toBe("?message=message-2");

    fireEvent.keyDown(tabs[1]!, { key: "End" });
    expect(tabs[2]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[2]!, { key: "Home" });
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
  });

  it("opens the message asked by the URL, and shows the letter first on a phone", () => {
    const { container } = render(<PendingMessagesList messages={[draft, second]} initialSelectedId="message-2" />);
    expect(screen.getAllByRole("tab")[1]!.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("[data-testid=validation-desk]")!.getAttribute("data-view")).toBe("message");
  });

  it("draws the selected email as a sheet and an SMS as a bubble", () => {
    render(<PendingMessagesList messages={[draft, second]} initialSelectedId="message-2" />);
    const letters = screen.getAllByTestId("message-letter");
    expect(letters.map((letter) => letter.getAttribute("data-channel"))).toEqual(["email", "sms"]);
  });

  it("keeps a refused message on the desk, stopped at « Vous », once the server confirmed it", async () => {
    const { rerender } = render(<PendingMessagesList messages={[draft, second]} />);

    fireEvent.click(screen.getAllByTestId("refuse-message")[0]!);
    await act(async () => {
      fireEvent.click(screen.getByTestId("rejection-confirm"));
    });
    // The server said yes: the rail of that message now stops at « Vous ».
    expect(screen.getAllByTestId("message-rail")[0]!.getAttribute("data-stage")).toBe("rejected");

    // The re-read queue no longer has it: its final state stays, with « Message suivant ».
    rerender(<PendingMessagesList messages={[second]} />);
    const resolved = screen.getByTestId("resolved-message");
    expect(resolved.getAttribute("data-outcome")).toBe("rejected");
    expect(resolved.querySelector("[data-testid=message-rail]")!.getAttribute("data-human")).toBe("stopped");
    expect(screen.getAllByTestId("pending-message")).toHaveLength(1);

    fireEvent.click(screen.getByTestId("next-message"));
    expect(screen.queryByTestId("resolved-message")).toBeNull();
    expect(screen.getAllByRole("tab")[0]!.getAttribute("aria-selected")).toBe("true");
  });

  it("does not move the rail when the server refuses the decision", async () => {
    validateMessage.mockResolvedValueOnce({ data: null, error: { code: "outbound_message_not_pending", message: "Déjà traité." } });
    render(<PendingMessagesList messages={[draft]} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("validate-message"));
    });
    expect(screen.getByTestId("message-rail").getAttribute("data-stage")).toBe("awaiting");
    expect(screen.getByTestId("message-action-error").textContent).toContain("Déjà traité.");
  });
});
