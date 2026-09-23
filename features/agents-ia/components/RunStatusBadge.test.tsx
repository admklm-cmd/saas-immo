// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RUN_OUTCOME_LABELS } from "@/components/texts";

import { RunStatusBadge } from "./RunStatusBadge";

afterEach(() => cleanup());

describe("RunStatusBadge", () => {
  it("names a guard-rail block explicitly and never styles it as an error", () => {
    const { container } = render(<RunStatusBadge status="blocked" />);
    expect(screen.getByText(RUN_OUTCOME_LABELS.blocked).textContent).toBe("Bloquée par un garde-fou");
    expect(container.firstElementChild?.className).not.toContain("bg-inverse");
  });

  it("names a technical error as such, with the strongest emphasis", () => {
    const { container } = render(<RunStatusBadge status="failed" />);
    expect(screen.getByText("Erreur technique")).toBeDefined();
    expect(container.firstElementChild?.className).toContain("bg-inverse");
  });

  it("exposes the raw status for tests and tooling", () => {
    render(<RunStatusBadge status="succeeded" />);
    expect(screen.getByTestId("run-status").getAttribute("data-status")).toBe("succeeded");
  });
});
