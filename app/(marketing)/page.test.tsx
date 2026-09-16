// @vitest-environment jsdom
// Proves the component test chain (jsdom + React Testing Library) works.
// frontend-ux may update this test when the real home page is built.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import HomePage from "./page";

afterEach(() => {
  cleanup();
});

it("renders the home page heading", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1, name: "AiaA" })).toBeDefined();
});
