// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import HomePage from "./page";

afterEach(() => {
  cleanup();
});

it("presents the complete agent journey and its safeguards", () => {
  render(<HomePage />);
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "De la demande vendeur au mandat, sans lâcher le contrôle.",
    }),
  ).toBeDefined();

  for (const name of ["Léa", "Hugo", "Emma", "Louis", "Sarah"]) {
    expect(screen.getByText(name)).toBeDefined();
  }

  expect(screen.getByText("100 %")).toBeDefined();
  expect(screen.getByText("Simulation")).toBeDefined();
  expect(screen.getByText("Validation humaine avant le premier envoi")).toBeDefined();
});

it("offers both public estimation and agency access", () => {
  render(<HomePage />);

  const estimationLinks = screen.getAllByRole("link", { name: "Estimer mon bien" });
  const signInLinks = screen.getAllByRole("link", { name: "Espace agence" });

  expect(estimationLinks.every((link) => link.getAttribute("href") === "/estimation")).toBe(true);
  expect(signInLinks.every((link) => link.getAttribute("href") === "/connexion")).toBe(true);
});
