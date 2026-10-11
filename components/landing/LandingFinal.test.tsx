// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { APP_TEXTS } from "@/components/texts";

import { LandingFinal } from "./LandingFinal";

const TEXTS = LANDING_TEXTS.final;

afterEach(() => {
  cleanup();
});

describe("LandingFinal — block C (§2.11.8.5)", () => {
  it("orders title → paragraph → actions → note → arrows → track", () => {
    const { container } = render(<LandingFinal />);
    const panel = screen.getByTestId("final-panel");
    const sequence = [
      container.querySelector("#final-title")!,
      screen.getByTestId("final-body"),
      screen.getByRole("link", { name: LANDING_TEXTS.actions.estimation }),
      screen.getByText(TEXTS.note),
      screen.getByRole("button", { name: TEXTS.carousel.previous }),
      screen.getByTestId("process-track"),
    ];
    for (let index = 1; index < sequence.length; index += 1) {
      const before = sequence[index - 1]!;
      const after = sequence[index]!;
      expect(panel.contains(after)).toBe(true);
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING, `${index}`).toBeTruthy();
    }
    expect(screen.getByTestId("final-body").textContent).toBe(TEXTS.body);
  });

  it("centres a white title with no effect", () => {
    const { container } = render(<LandingFinal />);
    const title = container.querySelector("#final-title")!;
    expect(title.getAttribute("data-title-color")).toBe("inverse");
    expect(title.getAttribute("data-title-align")).toBe("center");
    expect(title.hasAttribute("data-accent-effect")).toBe(false);
    expect(title.hasAttribute("data-accent-replayable")).toBe(false);
    expect(title.querySelectorAll("canvas, [data-accent-frame], [data-accent-mark]")).toHaveLength(0);
  });

  it("keeps the two actions of the hero, in their light variants, and the prototype note last", () => {
    render(<LandingFinal />);
    const estimation = screen.getByRole("link", { name: LANDING_TEXTS.actions.estimation });
    const signIn = screen.getByRole("link", { name: LANDING_TEXTS.actions.signIn });
    expect(estimation.getAttribute("href")).toBe("/estimation");
    expect(signIn.getAttribute("href")).toBe("/connexion");
    expect(estimation.className).toContain("bg-ink-inverse");
    expect(signIn.className).toContain("border-white/24");
    expect(screen.getByTestId("final-actions").lastElementChild?.textContent).toBe(TEXTS.note);
  });

  it("starts on step 1 of 7: previous arrow aria-disabled, 14 %, no announcement on load", () => {
    render(<LandingFinal />);
    const carousel = screen.getByRole("region", { name: TEXTS.carousel.label });
    expect(carousel.getAttribute("aria-roledescription")).toBe("carrousel");
    expect(screen.getByRole("button", { name: TEXTS.carousel.previous }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: TEXTS.carousel.next }).hasAttribute("aria-disabled")).toBe(false);
    expect(screen.getByTestId("process-percent").textContent).toBe("14 %");
    expect(screen.getByTestId("process-live").textContent).toBe("");
    const cards = screen.getAllByTestId("process-card");
    expect(cards).toHaveLength(7);
    expect(cards[0]!.getAttribute("aria-label")).toBe("Étape 1 sur 7 : Demande reçue · Léa");
    expect(cards[0]!.hasAttribute("data-active")).toBe(true);
    expect(cards.slice(1).every((card) => card.getAttribute("aria-hidden") === "true")).toBe(true);
    // Simulation badge, dark surface, with its label.
    expect(within(carousel).getByText(APP_TEXTS.states.simulation).closest("span[title]")?.className).toContain("bg-ink-inverse");
    expect(carousel.textContent).toContain(TEXTS.carousel.badge);
  });

  it("moves with the arrows, the keyboard and a click on a neighbour, and announces each change", () => {
    render(<LandingFinal />);
    const next = screen.getByRole("button", { name: TEXTS.carousel.next });
    act(() => fireEvent.click(next));
    expect(screen.getByTestId("process-carousel").getAttribute("data-active-step")).toBe("1");
    expect(screen.getByTestId("process-percent").textContent).toBe("29 %");
    expect(screen.getByTestId("process-live").textContent).toBe(`Étape 2 sur 7 : Qualification · Hugo. ${TEXTS.steps[1].body}`);

    const track = screen.getByTestId("process-track");
    act(() => fireEvent.keyDown(track, { key: "End" }));
    expect(screen.getByTestId("process-percent").textContent).toBe("100 %");
    expect(screen.getByRole("button", { name: TEXTS.carousel.next }).getAttribute("aria-disabled")).toBe("true");
    act(() => fireEvent.click(screen.getByRole("button", { name: TEXTS.carousel.next })));
    expect(screen.getByTestId("process-carousel").getAttribute("data-active-step")).toBe("6");

    act(() => fireEvent.keyDown(track, { key: "Home" }));
    expect(screen.getByTestId("process-carousel").getAttribute("data-active-step")).toBe("0");
    act(() => fireEvent.keyDown(track, { key: "ArrowRight" }));
    expect(screen.getByTestId("process-carousel").getAttribute("data-active-step")).toBe("1");

    act(() => fireEvent.click(screen.getAllByTestId("process-card")[3]!));
    expect(screen.getByTestId("process-carousel").getAttribute("data-active-step")).toBe("3");
    expect(screen.getByTestId("process-live").textContent).toContain("Étape 4 sur 7 : Validation humaine · Vous");
    expect(screen.getAllByTestId("process-card")[3]!.textContent).toContain("Étape n°4 · Humaine");
  });

  it("shows every drawing at its final state without motion, the « Vous » cursor on its button", () => {
    render(<LandingFinal />);
    const visuals = screen.getAllByTestId("process-visual");
    expect(visuals.map((visual) => visual.getAttribute("data-visual-state"))).toEqual(Array(7).fill("done"));
    expect(visuals.every((visual) => !visual.hasAttribute("data-run"))).toBe(true);
    expect(visuals.every((visual) => visual.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(screen.getByTestId("process-cursor")).toBeTruthy();
  });
});
