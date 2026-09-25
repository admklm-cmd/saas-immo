// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current, useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));

const { AppNav } = await import("./AppNav");
const { isNavItemActive, NAV_GROUPS, NAV_ITEMS } = await import("./nav-items");

const NAV = APP_TEXTS.nav;

afterEach(() => cleanup());

/** Every route of the menu before the grouping (Lot 2A): none may be lost. */
const ROUTES = [
  "/dashboard",
  "/contacts",
  "/pipeline",
  "/taches",
  "/rendez-vous",
  "/agents-ia",
  "/agents-ia/leads-entrants",
  "/agents-ia/a-valider",
  "/agents-ia/relances",
  "/agents-ia/suivi-rendez-vous",
  "/parametres",
];

describe("navigation groupée", () => {
  it("garde tous les liens, dans trois groupes : Pilotage, Agents IA, Paramètres", () => {
    expect([...NAV_ITEMS.map((item) => item.href)].sort()).toEqual([...ROUTES].sort());
    expect(NAV_GROUPS.map((group) => group.items.map((item) => item.href))).toEqual([
      ["/dashboard", "/contacts", "/pipeline", "/taches", "/rendez-vous"],
      ["/agents-ia", "/agents-ia/leads-entrants", "/agents-ia/a-valider", "/agents-ia/relances", "/agents-ia/suivi-rendez-vous"],
      ["/parametres"],
    ]);

    render(<AppNav />);
    const nav = screen.getByRole("navigation", { name: NAV.primaryLabel });
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(ROUTES);
    expect(within(nav).getByRole("list", { name: NAV.groupPilotage })).toBeDefined();
    expect(within(nav).getByRole("list", { name: NAV.groupAgents })).toBeDefined();
    expect(within(nav).getByRole("link", { name: NAV.agentsOverview }).getAttribute("href")).toBe("/agents-ia");
  });

  it("chaque entrée a une icône de la famille maison, décorative", () => {
    const { container } = render(<AppNav />);
    const links = container.querySelectorAll("a");
    for (const link of Array.from(links)) {
      const svg = link.querySelector("svg");
      expect(svg?.getAttribute("data-glyph"), link.textContent ?? "").toBeTruthy();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    }
  });

  it.each([
    ["/dashboard", "/dashboard"],
    ["/contacts/0f0f", "/contacts"],
    ["/agents-ia", "/agents-ia"],
    ["/agents-ia/executions/42", "/agents-ia"],
    ["/agents-ia/a-valider", "/agents-ia/a-valider"],
    ["/parametres", "/parametres"],
  ])("sur %s, une seule entrée courante (%s), marquée aria-current et par le repère cobalt", (path, expected) => {
    pathname.current = path;
    render(<AppNav />);

    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.getAttribute("href"))).toEqual([expected]);
    expect(current[0]?.querySelector(".bg-accent")?.className).toContain("opacity-100");
    // The « you are here » mark exists on every entry but is only visible on the current one.
    const others = screen.getAllByRole("link").filter((link) => link !== current[0]);
    for (const link of others) expect(link.querySelector(".bg-accent")?.className).toContain("opacity-0");
  });

  it("ne confond pas un préfixe avec une route voisine", () => {
    expect(isNavItemActive("/agents-ia/relances", "/agents-ia")).toBe(false);
    expect(isNavItemActive("/contactsx", "/contacts")).toBe(false);
    expect(isNavItemActive("/rendez-vous", "/agents-ia/suivi-rendez-vous")).toBe(false);
  });

  it("la version compacte garde les mêmes liens, avec des cibles tactiles plus grandes", () => {
    pathname.current = "/pipeline";
    render(<AppNav variant="sheet" />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(ROUTES);
    for (const link of links) expect(link.className).toContain("min-h-12");
  });
});

describe("menu compact (MobileNav)", () => {
  it("ouvert : la page derrière est inerte et ne défile pas ; Échap referme et rend le focus", async () => {
    const { MobileNav } = await import("./MobileNav");
    const { act, fireEvent } = await import("@testing-library/react");
    pathname.current = "/taches";
    const content = document.createElement("main");
    content.id = "content";
    document.body.append(content);

    const { container } = render(<MobileNav email="agent@example.test" />);
    const details = container.querySelector("details")!;
    const summary = screen.getByTestId("mobile-nav-toggle");

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    expect(content.inert).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");

    // Tab on the last focusable element loops back to « Fermer ».
    const signOut = screen.getByRole("button", { name: NAV.signOut });
    signOut.focus();
    fireEvent.keyDown(signOut, { key: "Tab" });
    expect(document.activeElement).toBe(summary);

    fireEvent.keyDown(summary, { key: "Escape" });
    await act(async () => {
      details.dispatchEvent(new Event("toggle"));
    });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    expect(content.inert).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
    content.remove();
  });
});
