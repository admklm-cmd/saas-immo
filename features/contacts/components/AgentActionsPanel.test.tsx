// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

import { AgentActionsPanel } from "./AgentActionsPanel";

const TEXTS = APP_TEXTS.agents;
const qualifyContact = vi.hoisted(() => vi.fn());
const proposeAppointment = vi.hoisted(() => vi.fn());
const prepareFollowUp = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/features/agents-ia/hugo-qualification/actions", () => ({ qualifyContact }));
vi.mock("@/features/agents-ia/louis-rendez-vous/actions", () => ({ proposeAppointment }));
vi.mock("@/features/agents-ia/emma-relation/actions", () => ({ prepareFollowUp }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/agents-ia/components/AgentRunReplay", () => ({
  AgentRunReplay: () => <div data-testid="replay-stub">Rejeu</div>,
}));

const CONTACT_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  qualifyContact.mockReset();
  proposeAppointment.mockReset();
  prepareFollowUp.mockReset();
  refresh.mockReset();
});

afterEach(() => cleanup());

describe("AgentActionsPanel — Emma", () => {
  it("shows the prepared draft, the pending-validation notice and the measured replay", async () => {
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
        contactId: CONTACT_ID,
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

    render(<AgentActionsPanel contactId={CONTACT_ID} />);

    await act(async () => fireEvent.click(screen.getByText(TEXTS.runEmma)));

    expect(prepareFollowUp).toHaveBeenCalledWith(CONTACT_ID);
    const result = screen.getByTestId("agent-result");
    expect(result.textContent).toContain("Brouillon préparé.");
    expect(result.textContent).toContain(TEXTS.pendingValidation);
    expect(screen.getByTestId("replay-stub")).toBeDefined();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a missing consent as a guard-rail block, not an error, and changes nothing else", async () => {
    prepareFollowUp.mockResolvedValue({
      data: null,
      error: { code: "consent_not_granted", message: AGENT_ERROR_MESSAGES.consent_not_granted },
    });

    render(<AgentActionsPanel contactId={CONTACT_ID} />);

    await act(async () => fireEvent.click(screen.getByText(TEXTS.runEmma)));

    const notice = screen.getByTestId("agent-blocked");
    expect(notice.textContent).toContain(AGENT_ERROR_MESSAGES.consent_not_granted);
    expect(screen.queryByTestId("agent-error")).toBeNull();
    expect(screen.queryByTestId("agent-result")).toBeNull();
  });

  // Every refusal Emma can answer before any work: shown as a guard rail, with
  // the server's own reason — the right one, not a vague « non éligible ».
  it.each([
    "follow_up_mandate_signed",
    "follow_up_contact_lost",
    "follow_up_already_drafted",
    "follow_up_already_prepared_today",
    "consent_not_granted",
    "follow_up_no_reachable_channel",
    "human_takeover",
    "ai_paused",
    "ai_daily_run_limit_reached",
  ] as const)("shows the refusal %s as blocked by a guard rail, with its exact reason", async (code) => {
    prepareFollowUp.mockResolvedValue({ data: null, error: { code, message: AGENT_ERROR_MESSAGES[code] } });

    render(<AgentActionsPanel contactId={CONTACT_ID} />);
    await act(async () => fireEvent.click(screen.getByText(TEXTS.runEmma)));

    const notice = screen.getByTestId("agent-blocked");
    expect(notice.textContent).toContain(APP_TEXTS.guardRail.title);
    expect(notice.textContent).toContain(AGENT_ERROR_MESSAGES[code]);
    // Informative, never alarming: no role="alert", no error styling.
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.className).not.toContain("bg-inverse");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(TEXTS.errorTitle)).toBeNull();
  });

  it("after a signed mandate, reads the mandate reason — not the generic one", async () => {
    prepareFollowUp.mockResolvedValue({
      data: null,
      error: { code: "follow_up_mandate_signed", message: AGENT_ERROR_MESSAGES.follow_up_mandate_signed },
    });

    render(<AgentActionsPanel contactId={CONTACT_ID} />);
    await act(async () => fireEvent.click(screen.getByText(TEXTS.runEmma)));

    const notice = screen.getByTestId("agent-blocked");
    expect(notice.textContent).toMatch(/mandat/i);
    expect(notice.textContent).not.toContain(AGENT_ERROR_MESSAGES.follow_up_stage_not_eligible);
  });

  it("shows a technical failure as an error (role alert), never as a guard rail", async () => {
    prepareFollowUp.mockResolvedValue({
      data: null,
      error: { code: "ai_response_invalid", message: AGENT_ERROR_MESSAGES.ai_response_invalid },
    });

    render(<AgentActionsPanel contactId={CONTACT_ID} />);
    await act(async () => fireEvent.click(screen.getByText(TEXTS.runEmma)));

    const error = screen.getByTestId("agent-error");
    expect(error.getAttribute("role")).toBe("alert");
    expect(error.textContent).toContain(TEXTS.errorTitle);
    expect(error.textContent).toContain(AGENT_ERROR_MESSAGES.ai_response_invalid);
    expect(screen.queryByTestId("agent-blocked")).toBeNull();
  });

  it("treats a thrown action as a technical error with no technical detail", async () => {
    prepareFollowUp.mockRejectedValue(new Error("boom"));

    render(<AgentActionsPanel contactId={CONTACT_ID} />);
    await act(async () => fireEvent.click(screen.getByText(TEXTS.runEmma)));

    const error = screen.getByTestId("agent-error");
    expect(error.textContent).toContain(APP_TEXTS.states.unexpected);
    expect(error.textContent).not.toContain("boom");
  });
});

describe("AgentActionsPanel — Louis", () => {
  it("shows a slot refusal returned as data as a guard rail, not an error", async () => {
    proposeAppointment.mockResolvedValue({
      data: { runId: "r", steps: [], blocked: { reason: "Aucun créneau ne peut être proposé." } },
      error: null,
    });

    render(<AgentActionsPanel contactId={CONTACT_ID} />);
    await act(async () => fireEvent.click(screen.getByText(TEXTS.runLouis)));

    expect(screen.getByTestId("agent-blocked").textContent).toContain("Aucun créneau ne peut être proposé.");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
