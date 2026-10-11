// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { PendingDots } from "./PendingDots";

afterEach(() => {
  cleanup();
});

describe("PendingDots", () => {
  it("says « En attente de validation » by default", () => {
    render(<PendingDots />);
    expect(screen.getByText(APP_TEXTS.states.pendingValidation)).toBeTruthy();
    expect(APP_TEXTS.states.pendingValidation).toBe("En attente de validation");
  });

  it("is a passive wait, never a busy state or a live region", () => {
    const { container } = render(<PendingDots />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector("[aria-busy]")).toBeNull();
    const dots = screen.getByTestId("pending-dots");
    expect(dots.getAttribute("aria-hidden")).toBe("true");
    expect(dots.classList.contains("pending-dots")).toBe(true);
    expect(dots.children).toHaveLength(3);
  });

  it("renders the dots alone when the neighbouring text already says it", () => {
    const { container } = render(<PendingDots label={null} />);
    expect(container.textContent).toBe("");
  });
});
