// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

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
    // The hint is said once, by the « Prêts » group of the sieve, not per row.
    expect(screen.queryByText(APP_TEXTS.emmaFollowUps.runHint)).toBeNull();
    expect(screen.getByText(APP_TEXTS.emmaFollowUps.emailAvailable, { exact: false })).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
    // Every gate is open, and says so in words.
    expect(screen.getAllByText(new RegExp(APP_TEXTS.emmaFollowUps.gatePassed)).length).toBe(3);
  });

  it.each([
    ["human_takeover", { humanTakeover: true }, APP_TEXTS.emmaFollowUps.humanTakeover, "takeover"],
    ["pending_draft", { hasPendingEmmaDraft: true }, APP_TEXTS.emmaFollowUps.pendingDraft, "pendingDraft"],
    ["consent_or_channel_missing", { channel: null }, APP_TEXTS.emmaFollowUps.consentOrChannelMissing, "consent"],
  ] as const)("a file stopped for %s offers no launch and stops at the right gate", (reason, fields, text, gate) => {
    const { container } = render(
      <EmmaFollowUpCard candidate={candidateOf({ ...fields, canPrepare: false, blockedReason: reason })} />,
    );

    expect(screen.queryByTestId("run-emma")).toBeNull();
    expect(screen.getByTestId("emma-blocked-reason").textContent).toContain(text);
    // The flow stops at the first closed gate, with the stop mark.
    const stop = container.querySelector("[data-stop]");
    expect(stop?.getAttribute("data-gate")).toBe(gate);
    expect(stop?.querySelector("[data-stop-mark]")).not.toBeNull();
    expect(container.querySelectorAll("[data-stop]")).toHaveLength(1);
  });

  it("puts the cobalt ring on the human checkpoint only when a draft really waits there", () => {
    const { container, rerender } = render(<EmmaFollowUpCard candidate={candidateOf()} />);
    const end = () => container.querySelector("[data-gate=\"end\"] [data-kind=\"human\"]");
    expect(end()?.getAttribute("data-state")).toBe("idle");

    rerender(
      <EmmaFollowUpCard
        candidate={candidateOf({ hasPendingEmmaDraft: true, canPrepare: false, blockedReason: "pending_draft" })}
      />,
    );
    expect(end()?.getAttribute("data-state")).toBe("active");
  });

  it("shows a guard-rail refusal as information, never as an error, without claiming a draft exists", async () => {
    prepareFollowUp.mockResolvedValue({
      data: null,
      error: { code: "consent_not_granted", message: AGENT_ERROR_MESSAGES.consent_not_granted },
    });
    render(<EmmaFollowUpCard candidate={candidateOf()} />);

    await act(async () => fireEvent.click(screen.getByTestId("run-emma")));

    expect(prepareFollowUp).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    const notice = screen.getByTestId("emma-blocked");
    expect(notice.textContent).toContain(APP_TEXTS.guardRail.title);
    expect(notice.textContent).toContain(AGENT_ERROR_MESSAGES.consent_not_granted);
    expect(notice.getAttribute("role")).toBe("status");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByTestId("emma-error")).toBeNull();
    expect(screen.queryByTestId("emma-draft")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a technical failure as an error", async () => {
    prepareFollowUp.mockResolvedValue({
      data: null,
      error: { code: "ai_response_invalid", message: AGENT_ERROR_MESSAGES.ai_response_invalid },
    });
    render(<EmmaFollowUpCard candidate={candidateOf()} />);

    await act(async () => fireEvent.click(screen.getByTestId("run-emma")));

    const error = screen.getByTestId("emma-error");
    expect(error.getAttribute("role")).toBe("alert");
    expect(error.textContent).toContain(APP_TEXTS.emmaFollowUps.errorActionTitle);
    expect(error.textContent).toContain(AGENT_ERROR_MESSAGES.ai_response_invalid);
    expect(screen.queryByTestId("emma-blocked")).toBeNull();
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
    // A direct link to the draft itself, in the validation queue.
    expect(screen.getByRole("link", { name: APP_TEXTS.emmaFollowUps.openQueue }).getAttribute("href")).toBe(
      "/agents-ia/a-valider?message=22222222-2222-4222-8222-222222222222",
    );
    expect(screen.getByTestId("emma-draft").textContent).toContain("Bonjour Camille");
    expect(screen.getByTestId("replay-stub")).toBeDefined();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
