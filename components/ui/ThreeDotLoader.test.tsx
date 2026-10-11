// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThreeDotLoader } from "./ThreeDotLoader";

afterEach(() => {
  cleanup();
});

describe("ThreeDotLoader", () => {
  it("draws three dots, hidden from assistive technologies", () => {
    render(<ThreeDotLoader size="sm" />);
    const loader = screen.getByTestId("three-dot-loader");
    expect(loader.getAttribute("aria-hidden")).toBe("true");
    expect(loader.classList.contains("dot-loader")).toBe(true);
    expect(loader.children).toHaveLength(3);
  });

  it("exposes the compact and the area sizes", () => {
    const { rerender } = render(<ThreeDotLoader size="sm" />);
    expect(screen.getByTestId("three-dot-loader").dataset.size).toBe("sm");
    rerender(<ThreeDotLoader size="md" />);
    expect(screen.getByTestId("three-dot-loader").dataset.size).toBe("md");
  });

  it("announces the caller's label once, as a status", () => {
    render(<ThreeDotLoader label="Simulation en cours…" />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Simulation en cours…");
  });

  it("adds no live region when the caller already says it (inside a button)", () => {
    render(<ThreeDotLoader size="sm" />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
