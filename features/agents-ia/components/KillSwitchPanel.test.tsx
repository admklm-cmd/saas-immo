// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

import { KillSwitchPanel } from "./KillSwitchPanel";

const TEXTS = APP_TEXTS.killSwitch;

const setAgencyAiPaused = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/features/agents-ia/actions", () => ({ setAgencyAiPaused }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  setAgencyAiPaused.mockReset();
  refresh.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("KillSwitchPanel", () => {
  it("asks for a confirmation before suspending the agents", async () => {
    setAgencyAiPaused.mockResolvedValue({ data: { agencyId: "a", aiPaused: true }, error: null });
    render(<KillSwitchPanel paused={false} canResume />);

    fireEvent.click(screen.getByTestId("kill-switch-toggle"));
    expect(screen.getByText(TEXTS.confirmPauseTitle)).toBeDefined();
    // Nothing has been sent to the server yet.
    expect(setAgencyAiPaused).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: TEXTS.confirm }));
    });

    expect(setAgencyAiPaused).toHaveBeenCalledWith(true);
    expect(screen.getByText(TEXTS.pausedSuccess)).toBeDefined();
    expect(refresh).toHaveBeenCalled();
  });

  it("lets the user step back from the confirmation", () => {
    render(<KillSwitchPanel paused={false} canResume />);

    fireEvent.click(screen.getByTestId("kill-switch-toggle"));
    fireEvent.click(screen.getByRole("button", { name: TEXTS.cancel }));

    expect(screen.queryByText(TEXTS.confirmPauseTitle)).toBeNull();
    expect(setAgencyAiPaused).not.toHaveBeenCalled();
  });

  it("shows the active kill switch without ambiguity", () => {
    render(<KillSwitchPanel paused canResume />);

    expect(screen.getByText(TEXTS.paused)).toBeDefined();
    expect(screen.getByText(TEXTS.descriptionPaused)).toBeDefined();
    expect(screen.getByTestId("kill-switch-toggle").textContent).toContain(TEXTS.resume);
  });

  it("explains why a non-director cannot resume, and disables the button", () => {
    render(<KillSwitchPanel paused canResume={false} />);

    const button = screen.getByTestId("kill-switch-toggle");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(AGENT_ERROR_MESSAGES.only_director_can_resume_ai)).toBeDefined();
  });

  it("displays the server's own refusal message, unchanged", async () => {
    setAgencyAiPaused.mockResolvedValue({
      data: null,
      error: { code: "only_director_can_resume_ai", message: AGENT_ERROR_MESSAGES.only_director_can_resume_ai },
    });
    render(<KillSwitchPanel paused canResume />);

    fireEvent.click(screen.getByTestId("kill-switch-toggle"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: TEXTS.confirm }));
    });

    const error = screen.getByTestId("kill-switch-error");
    expect(error.textContent).toContain(AGENT_ERROR_MESSAGES.only_director_can_resume_ai);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("never leaves the user without an answer when the action throws", async () => {
    setAgencyAiPaused.mockRejectedValue(new Error("network"));
    render(<KillSwitchPanel paused={false} canResume />);

    fireEvent.click(screen.getByTestId("kill-switch-toggle"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: TEXTS.confirm }));
    });

    expect(screen.getByTestId("kill-switch-error").textContent).toContain(APP_TEXTS.states.unexpected);
  });
});
