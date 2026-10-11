// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import SignUpPage from "./page";

const TEXTS = APP_TEXTS.signUp;

afterEach(() => cleanup());

describe("Écran Inscription", () => {
  it("explique honnêtement l'absence d'inscription en libre-service, sans badge « à venir »", () => {
    render(<SignUpPage />);

    expect(screen.getByRole("heading", { level: 1, name: TEXTS.title })).toBeDefined();
    const page = screen.getByTestId("sign-up");
    expect(page.textContent).toContain(TEXTS.lead);
    expect(page.textContent).toContain(TEXTS.securityNote);
    expect(page.textContent).not.toMatch(/bientôt|à venir|prochainement/i);
  });

  it("ne propose aucun formulaire ni adresse inventée : seulement la connexion et l'accueil", () => {
    const { container } = render(<SignUpPage />);

    expect(container.querySelector("form, input, textarea, select")).toBeNull();
    expect(container.textContent).not.toMatch(/@/);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/connexion", "/"]);
    expect(screen.getByRole("link", { name: TEXTS.signIn }).getAttribute("href")).toBe("/connexion");
    expect(screen.getByRole("link", { name: TEXTS.backHome }).getAttribute("href")).toBe("/");
  });
});
