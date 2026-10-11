// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Disclosure } from "./Disclosure";

afterEach(() => cleanup());

describe("Disclosure", () => {
  it("is a native <details>, closed by default, its label in the <summary>", () => {
    render(
      <Disclosure summary="Voir le détail" testId="d">
        <p>Contenu</p>
      </Disclosure>,
    );
    const details = screen.getByTestId("d");
    expect(details.tagName).toBe("DETAILS");
    expect(details.hasAttribute("open")).toBe(false);
    expect(details.querySelector("summary")?.textContent).toBe("Voir le détail");
  });

  it("keeps the inline toggle at text-sm by default", () => {
    render(
      <Disclosure summary="Libellé" testId="d">
        <p>Contenu</p>
      </Disclosure>,
    );
    const summary = screen.getByTestId("d").querySelector("summary");
    expect(summary?.classList.contains("text-sm")).toBe(true);
    expect(summary?.classList.contains("text-xs")).toBe(false);
  });

  it("offers an xs inline toggle for a hint line: smaller text, chevron and gap", () => {
    render(
      <Disclosure summary="Rappel" size="xs" testId="d">
        <p>Contenu</p>
      </Disclosure>,
    );
    const summary = screen.getByTestId("d").querySelector("summary");
    expect(summary?.classList.contains("text-xs")).toBe(true);
    expect(summary?.classList.contains("text-sm")).toBe(false);
    expect(summary?.classList.contains("gap-2")).toBe(true);
    expect(summary?.querySelector("[aria-hidden=true]")?.classList.contains("size-4")).toBe(true);
  });

  it("ignores the size on a card: the card toggle keeps its own scale", () => {
    render(
      <Disclosure summary="Section" variant="card" size="xs" testId="d">
        <p>Contenu</p>
      </Disclosure>,
    );
    const summary = screen.getByTestId("d").querySelector("summary");
    expect(summary?.classList.contains("text-xs")).toBe(false);
    expect(summary?.classList.contains("gap-3")).toBe(true);
    expect(summary?.querySelector("[aria-hidden=true]")?.classList.contains("size-7")).toBe(true);
  });
});
