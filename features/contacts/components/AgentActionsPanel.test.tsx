// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

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

  it("shows the server refusal in French and changes nothing else", async () => {
    prepareFollowUp.mockResolvedValue({
      data: null,
      error: { code: "consent_not_granted", message: "Aucun consentement valide." },
    });

    render(<AgentActionsPanel contactId={CONTACT_ID} />);

    await act(async () => fireEvent.click(screen.getByText(TEXTS.runEmma)));

    const error = screen.getByTestId("agent-error");
    expect(error.textContent).toContain("Aucun consentement valide.");
    expect(screen.queryByTestId("agent-result")).toBeNull();
  });
});
