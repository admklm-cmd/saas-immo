// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/taches",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }));

const { MobileNav } = await import("./MobileNav");

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  document.documentElement.style.overflow = "";
});

/** Renders the sheet next to a page content (`#content`) and an outside control. */
function renderNav() {
  const content = document.createElement("main");
  content.id = "content";
  document.body.append(content);
  render(
    <>
      <button type="button">Ailleurs</button>
      <MobileNav email="agent@example.test" />
    </>,
  );
  const details = document.querySelector("details")!;
  const summary = screen.getByTestId("mobile-nav-toggle");
  return { details, summary, content };
}

/** Opens the native <details> and lets React see its toggle event. */
async function open(details: HTMLDetailsElement) {
  await act(async () => {
    details.open = true;
    fireEvent(details, new Event("toggle"));
  });
}

describe("MobileNav — Échap", () => {
  it("ferme la feuille et rend le focus au bouton, même si le focus est sorti du menu", async () => {
    const { details, summary, content } = renderNav();
    await open(details);
    expect(content.inert).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");

    // The focus is outside the menu: the listener is on the document.
    screen.getByRole("button", { name: "Ailleurs" }).focus();
    expect(details.contains(document.activeElement)).toBe(false);

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent(details, new Event("toggle"));
    });

    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    expect(content.inert).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("n'écoute plus le document une fois la feuille fermée", async () => {
    const { details } = renderNav();
    await open(details);
    await act(async () => {
      details.open = false;
      fireEvent(details, new Event("toggle"));
    });

    const outside = screen.getByRole("button", { name: "Ailleurs" });
    outside.focus();
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    // Closed sheet: Escape is left to the page (not prevented, focus untouched).
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(outside);
  });

  it("ramène dans le menu une tabulation partie de l'extérieur", async () => {
    const { details, summary } = renderNav();
    await open(details);
    screen.getByRole("button", { name: "Ailleurs" }).focus();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Tab" });
    });
    expect(document.activeElement).toBe(summary);
  });
});
