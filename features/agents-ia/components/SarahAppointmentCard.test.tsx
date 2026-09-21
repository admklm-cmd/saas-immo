// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

import type { ReportedAppointmentView } from "../types";
import { SarahAppointmentCard } from "./SarahAppointmentCard";

const TEXTS = APP_TEXTS.followThrough;
const followThroughAppointment = vi.hoisted(() => vi.fn());
const confirmAppointment = vi.hoisted(() => vi.fn());
const completeAppointment = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/features/agents-ia/louis-rendez-vous/actions", () => ({ confirmAppointment }));
vi.mock("@/features/agents-ia/sarah-suivi/actions", () => ({
  completeAppointment,
  followThroughAppointment,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./AgentRunReplay", () => ({
  AgentRunReplay: () => <div data-testid="replay-stub">Rejeu</div>,
}));

beforeEach(() => {
  followThroughAppointment.mockReset();
  confirmAppointment.mockReset();
  completeAppointment.mockReset();
  refresh.mockReset();
});

afterEach(() => cleanup());

function appointment(overrides: Partial<ReportedAppointmentView> = {}): ReportedAppointmentView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    contactId: "22222222-2222-4222-8222-222222222222",
    contactName: "Véronique Lambert",
    stage: "rdv_planifie",
    status: "done",
    statusLabel: "Réalisé",
    startsAt: "2026-09-05T07:00:00.000Z",
    reportNotes: "La vendeuse compare avec une autre agence.",
    reportRecordedAt: "2026-09-05T09:00:00.000Z",
    canBeConfirmed: false,
    canBeCompleted: false,
    canBeFollowedThrough: true,
    lastFollowThroughRunId: null,
    ...overrides,
  };
}

describe("SarahAppointmentCard", () => {
  it("lets a human confirm Louis's proposed appointment, then reveals the report form", async () => {
    confirmAppointment.mockResolvedValue({
      data: {
        appointmentId: "11111111-1111-4111-8111-111111111111",
        contactId: "22222222-2222-4222-8222-222222222222",
        status: "confirmed",
        statusLabel: "Confirmé",
        stage: "rdv_planifie",
        isSimulation: true,
        reportRecordedAt: null,
      },
      error: null,
    });
    render(
      <SarahAppointmentCard
        appointment={appointment({
          status: "proposed",
          statusLabel: "Proposé",
          reportNotes: null,
          reportRecordedAt: null,
          canBeConfirmed: true,
          canBeCompleted: false,
          canBeFollowedThrough: false,
        })}
      />,
    );

    expect(screen.queryByText("Sarah")).toBeNull();
    expect(screen.queryByTestId("run-sarah")).toBeNull();
    await act(async () => fireEvent.click(screen.getByTestId("confirm-appointment")));

    expect(confirmAppointment).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(screen.getByText("Confirmé")).toBeDefined();
    expect(screen.getByTestId("appointment-completion-form")).toBeDefined();
    expect(screen.getByTestId("appointment-workflow-success").textContent).toContain(TEXTS.confirmSuccess);
    expect(screen.queryByTestId("run-sarah")).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("requires the human report, completes the appointment, then reveals Sarah", async () => {
    completeAppointment.mockResolvedValue({
      data: {
        appointmentId: "11111111-1111-4111-8111-111111111111",
        contactId: "22222222-2222-4222-8222-222222222222",
        status: "done",
        statusLabel: "Réalisé",
        stage: "estimation_faite",
        isSimulation: true,
        reportRecordedAt: "2026-09-05T09:30:00.000Z",
      },
      error: null,
    });
    render(
      <SarahAppointmentCard
        appointment={appointment({
          status: "confirmed",
          statusLabel: "Confirmé",
          reportNotes: null,
          reportRecordedAt: null,
          canBeConfirmed: false,
          canBeCompleted: true,
          canBeFollowedThrough: false,
        })}
      />,
    );

    const submit = screen.getByTestId("complete-appointment") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.queryByText("Sarah")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: TEXTS.report }), {
      target: { value: "  Estimation présentée. La vendeuse souhaite réfléchir.  " },
    });
    expect(submit.disabled).toBe(false);
    await act(async () => fireEvent.click(submit));

    expect(completeAppointment).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      reportNotes: "Estimation présentée. La vendeuse souhaite réfléchir.",
    });
    expect(screen.getByText("Réalisé")).toBeDefined();
    expect(screen.getByText("Estimation présentée. La vendeuse souhaite réfléchir.")).toBeDefined();
    expect(screen.getByTestId("run-sarah")).toBeDefined();
    expect(screen.getByTestId("appointment-workflow-success").textContent).toContain(TEXTS.completeSuccess);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a human workflow error without advancing the appointment", async () => {
    confirmAppointment.mockResolvedValue({
      data: null,
      error: { code: "appointment_not_proposed", message: "Ce rendez-vous n'est plus proposé." },
    });
    render(
      <SarahAppointmentCard
        appointment={appointment({
          status: "proposed",
          statusLabel: "Proposé",
          reportNotes: null,
          reportRecordedAt: null,
          canBeConfirmed: true,
          canBeCompleted: false,
          canBeFollowedThrough: false,
        })}
      />,
    );

    await act(async () => fireEvent.click(screen.getByTestId("confirm-appointment")));

    expect(screen.getByTestId("appointment-workflow-error").textContent).toContain(
      "Ce rendez-vous n'est plus proposé.",
    );
    expect(screen.getByTestId("confirm-appointment")).toBeDefined();
    expect(screen.queryByTestId("appointment-completion-form")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the human report as plain text and offers Sarah only when it is present", () => {
    const hostile = '<b>Compte-rendu</b><script>alert("x")</script>';
    const { container } = render(
      <SarahAppointmentCard appointment={appointment({ reportNotes: hostile })} />,
    );

    expect(screen.getByText(hostile)).toBeDefined();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(TEXTS.reportUntrusted)).toBeDefined();
    expect(screen.getByTestId("run-sarah").textContent).toBe(TEXTS.run);
  });

  it("explains why Sarah cannot run when the report is missing", () => {
    render(
      <SarahAppointmentCard
        appointment={appointment({
          status: "done",
          statusLabel: "Réalisé",
          reportNotes: null,
          reportRecordedAt: null,
          canBeConfirmed: false,
          canBeCompleted: false,
          canBeFollowedThrough: false,
        })}
      />,
    );

    expect(screen.queryByTestId("run-sarah")).toBeNull();
    expect(screen.getByTestId("sarah-blocked-reason").textContent).toBe(TEXTS.blockedNoReport);
    expect(screen.getByText(TEXTS.reportMissing)).toBeDefined();
  });

  it("shows the server refusal and keeps the action available", async () => {
    followThroughAppointment.mockResolvedValue({
      data: null,
      error: { code: "ai_paused", message: AGENT_ERROR_MESSAGES.ai_paused },
    });
    render(<SarahAppointmentCard appointment={appointment()} />);

    await act(async () => fireEvent.click(screen.getByTestId("run-sarah")));

    expect(followThroughAppointment).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(screen.getByTestId("sarah-error").textContent).toContain(AGENT_ERROR_MESSAGES.ai_paused);
    expect(screen.getByTestId("run-sarah")).toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders Sarah's validated result and the measured replay", async () => {
    followThroughAppointment.mockResolvedValue({
      data: {
        runId: "33333333-3333-4333-8333-333333333333",
        appointmentId: "11111111-1111-4111-8111-111111111111",
        contactId: "22222222-2222-4222-8222-222222222222",
        previousStage: "rdv_planifie",
        stage: "estimation_faite",
        stageChanged: true,
        decision: "estimation_completed",
        decisionText: "L'estimation est enregistrée comme réalisée.",
        followThrough: {
          summary: "La vendeuse compare deux agences avant de décider.",
          seller_decision: "compare_autre_agence",
          objections: ["Prix de présentation"],
          missing_documents: ["Diagnostics"],
          next_steps: [{ title: "Rappeler sous dix jours", details: null }],
          estimation_presented: true,
          missing_fields: [],
          confidence: 0.92,
        },
        sellerDecisionLabel: "Compare avec une autre agence",
        tasks: [{ id: "44444444-4444-4444-8444-444444444444", type: "follow_up", created: true }],
        isSimulation: true,
        provider: "simulator",
        model: "deterministic-v1",
        usage: { inputTokens: 100, outputTokens: 50 },
        steps: [],
      },
      error: null,
    });
    render(<SarahAppointmentCard appointment={appointment()} />);

    await act(async () => fireEvent.click(screen.getByTestId("run-sarah")));

    expect(screen.getByTestId("sarah-result").textContent).toContain(TEXTS.successTitle);
    expect(screen.getByTestId("sarah-analysis").textContent).toContain("Compare avec une autre agence");
    expect(screen.getByTestId("sarah-analysis").textContent).toContain("Rappeler sous dix jours");
    expect(screen.getByTestId("sarah-replay")).toBeDefined();
    expect(screen.getByTestId("replay-stub")).toBeDefined();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
