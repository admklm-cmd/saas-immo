// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import type { EmmaFollowUpCandidateView } from "../types";
import { EmmaFollowUpCard } from "./EmmaFollowUpCard";

const prepareFollowUp = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/features/agents-ia/emma-relation/actions", () => ({ prepareFollowUp }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./AgentRunReplay", () => ({ AgentRunReplay: () => <div data-testid="replay-stub">Rejeu</div> }));

function candidateOf(overrides: Partial<EmmaFollowUpCandidateView> = {}): EmmaFollowUpCandidateView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    contactName: "Camille Fournier",
    email: "camille@example.test",
    phone: null,
    stage: "qualifie",
    humanTakeover: false,
    channel: "email",
    hasPendingEmmaDraft: false,
    canPrepare: true,
    blockedReason: null,
    updatedAt: "2026-09-18T08:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  prepareFollowUp.mockReset();
  refresh.mockReset();
});

afterEach(() => cleanup());

describe("EmmaFollowUpCard", () => {
  it("lets the server decide eligibility and shows the retained channel", () => {
    render(<EmmaFollowUpCard candidate={candidateOf()} />);

    expect(screen.getByTestId("run-emma").textContent).toBe(APP_TEXTS.emmaFollowUps.run);
    expect((screen.getByTestId("run-emma") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(APP_TEXTS.emmaFollowUps.runHint)).toBeDefined();
    expect(screen.getByText(APP_TEXTS.emmaFollowUps.emailAvailable)).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
  });

  it("disables the action and explains a human takeover", () => {
    render(
      <EmmaFollowUpCard
        candidate={candidateOf({ humanTakeover: true, canPrepare: false, blockedReason: "human_takeover" })}
      />,
    );

    const button = screen.getByTestId("run-emma") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const reason = screen.getByTestId("emma-blocked-reason");
    expect(reason.textContent).toContain(APP_TEXTS.emmaFollowUps.humanTakeover);
    expect(button.getAttribute("aria-describedby")).toBe(reason.id);
  });

  it("disables the action and links to the validation queue when a draft is already pending", () => {
    render(
      <EmmaFollowUpCard
        candidate={candidateOf({
          hasPendingEmmaDraft: true,
          canPrepare: false,
          blockedReason: "pending_draft",
        })}
      />,
    );

    const button = screen.getByTestId("run-emma") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const reason = screen.getByTestId("emma-blocked-reason");
    expect(reason.textContent).toContain(APP_TEXTS.emmaFollowUps.pendingDraft);
    expect(screen.getByRole("link", { name: APP_TEXTS.emmaFollowUps.openQueue }).getAttribute("href")).toBe(
      "/agents-ia/a-valider",
    );
  });

  it("disables the action and explains a missing consent or channel", () => {
    render(
      <EmmaFollowUpCard
        candidate={candidateOf({
          channel: null,
          canPrepare: false,
          blockedReason: "consent_or_channel_missing",
        })}
      />,
    );

    const button = screen.getByTestId("run-emma") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByTestId("emma-blocked-reason").textContent).toContain(
      APP_TEXTS.emmaFollowUps.consentOrChannelMissing,
    );
  });

  it("shows the server refusal without claiming a draft exists", async () => {
    prepareFollowUp.mockResolvedValue({
      data: null,
      error: { code: "consent_not_granted", message: "Aucun consentement valide." },
    });
    render(<EmmaFollowUpCard candidate={candidateOf()} />);

    await act(async () => fireEvent.click(screen.getByTestId("run-emma")));

    expect(prepareFollowUp).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(screen.getByTestId("emma-error").textContent).toContain("Aucun consentement valide.");
    expect(screen.queryByTestId("emma-draft")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the validated draft, validation link and measured replay", async () => {
    prepareFollowUp.mockResolvedValue({
      data: {
        messageId: "22222222-2222-4222-8222-222222222222",
        messageSubject: "Votre projet à La Ciotat",
        messageBody: "Bonjour Camille, souhaitons-nous faire un point ?",
        messageStatus: "pending_validation",
        channel: "email",
        isSimulation: true,
        provider: "simulator",
        runId: "33333333-3333-4333-8333-333333333333",
        contactId: "11111111-1111-4111-8111-111111111111",
        model: "deterministic-v1",
        idempotencyKey: "emma-key",
        angle: "helpful_check_in",
        reason: "Le projet reste actif.",
        confidence: 0.9,
        stage: "qualifie",
        decision: "drafted",
        decisionText: "Brouillon préparé.",
        usage: { inputTokens: 120, outputTokens: 60 },
        steps: [],
      },
      error: null,
    });
    render(<EmmaFollowUpCard candidate={candidateOf()} />);

    await act(async () => fireEvent.click(screen.getByTestId("run-emma")));

    expect(screen.getByTestId("emma-result").textContent).toContain(APP_TEXTS.emmaFollowUps.nothingSent);
    expect(screen.getByTestId("emma-draft").textContent).toContain("Votre projet à La Ciotat");
    expect(screen.getByRole("link", { name: APP_TEXTS.emmaFollowUps.openQueue }).getAttribute("href")).toBe(
      "/agents-ia/a-valider",
    );
    expect(screen.getByTestId("replay-stub")).toBeDefined();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
