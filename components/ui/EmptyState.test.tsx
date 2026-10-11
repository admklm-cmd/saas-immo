// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("wraps the accented word in the text itself: name and text content stay the title", () => {
    render(<EmptyState title="Aucun contact pour l’instant" titleAccent="contact" />);
    const title = screen.getByTestId("empty-state-title");
    expect(title.textContent).toBe("Aucun contact pour l’instant");
    const accent = title.querySelector("[data-accent]");
    expect(accent?.textContent).toBe("contact");
    expect(accent?.className).toBe("title-accent");
    // No hidden copy, no aria-hidden part, no emphasis element.
    expect(title.querySelector(".sr-only, [aria-hidden], em, i")).toBeNull();
  });

  it("sets every empty-state title in Bricolage 600 at the section size, accented or not", () => {
    render(<EmptyState title="Aucune tâche en retard" />);
    const title = screen.getByTestId("empty-state-title");
    for (const name of ["font-display", "text-section", "font-semibold", "text-ink"]) {
      expect(title.className).toContain(name);
    }
    expect(title.querySelector("[data-accent]")).toBeNull();
  });

  it("renders the title plain when the word is missing, partial or the title is not a string", () => {
    const { rerender } = render(<EmptyState title="Aucune tâche ouverte" titleAccent="ouvert" />);
    expect(screen.getByTestId("empty-state-title").querySelector("[data-accent]")).toBeNull();
    rerender(<EmptyState title={<span>Aucune tâche ouverte</span>} titleAccent="ouverte" />);
    expect(screen.getByTestId("empty-state-title").querySelector("[data-accent]")).toBeNull();
  });
});
