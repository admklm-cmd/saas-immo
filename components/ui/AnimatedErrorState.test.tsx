// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnimatedErrorState } from "./AnimatedErrorState";

afterEach(() => {
  cleanup();
});

describe("AnimatedErrorState", () => {
  it("is announced as an alert, with a written title and message (never colour alone)", () => {
    render(<AnimatedErrorState title="L'action n'a pas abouti">Réseau indisponible.</AnimatedErrorState>);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("L'action n'a pas abouti");
    expect(alert.textContent).toContain("Réseau indisponible.");
  });

  it("shows red dots that shake once, decorative only", () => {
    render(<AnimatedErrorState title="Erreur">Oups.</AnimatedErrorState>);
    const dots = screen.getByTestId("error-dots");
    expect(dots.classList.contains("error-dots")).toBe(true);
    expect(dots.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("offers « Réessayer » only when the caller says the operation can be relaunched", () => {
    const { rerender } = render(<AnimatedErrorState title="Erreur">Oups.</AnimatedErrorState>);
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();

    const onRetry = vi.fn();
    rerender(
      <AnimatedErrorState title="Erreur" onRetry={onRetry} testId="x-error">
        Oups.
      </AnimatedErrorState>,
    );
    const retry = screen.getByRole("button", { name: "Réessayer" });
    expect(retry.dataset.testid).toBe("x-error-retry");
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
