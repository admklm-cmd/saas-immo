// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Overline } from "./Overline";

afterEach(() => {
  cleanup();
});

describe("Overline", () => {
  it("is a paragraph in mono capitals, with the cobalt dash as a pseudo-element only", () => {
    render(<Overline>Agents IA</Overline>);
    const overline = screen.getByTestId("overline");
    expect(overline.tagName).toBe("P");
    // Stored in normal case: the capitals come from CSS.
    expect(overline.textContent).toBe("Agents IA");
    expect(overline.className).toContain("label-mono");
    for (const name of ["before:w-3", "before:h-0.5", "before:bg-accent", "gap-2.5", "inline-flex"]) {
      expect(overline.className).toContain(name);
    }
    expect(overline.children).toHaveLength(0);
  });

  it("can be a span and takes layout classes", () => {
    render(<Overline as="span" className="mb-3">Pilotage</Overline>);
    const overline = screen.getByTestId("overline");
    expect(overline.tagName).toBe("SPAN");
    expect(overline.className).toContain("mb-3");
  });
});
