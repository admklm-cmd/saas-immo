import { describe, expect, it } from "vitest";

import { HERO_TITLE, LANDING_TEXTS } from "./landing-texts";

/** Every string of the landing copy, flattened. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const ALL = strings(LANDING_TEXTS);

describe("landing copy", () => {
  it("claims no figure: no percentage, no price, no multiplier", () => {
    for (const text of ALL) {
      expect(text, text).not.toMatch(/\d\s?%|€|\bx\d|\d+\s?(clients?|agences?|mandats?)\b/i);
    }
  });

  it("invents no client, testimonial or result", () => {
    for (const text of ALL) {
      expect(text, text).not.toMatch(/témoignage|nos clients|ils nous font confiance|avis client|\bROI\b/i);
    }
  });

  it("labels the illustrations as a fictitious simulation", () => {
    expect(LANDING_TEXTS.journey.badge).toMatch(/fictif/i);
    expect(LANDING_TEXTS.journey.badge).toMatch(/simulation/i);
    expect(LANDING_TEXTS.hero.illustrationNote).toMatch(/aucune activité en direct/i);
    expect(LANDING_TEXTS.agents.carousel.sceneBadge).toBe(LANDING_TEXTS.journey.badge);
    expect(LANDING_TEXTS.problem.chart.label).toBe("Illustration — exemple fictif");
  });

  it("names the axes of the chart without any figure", () => {
    expect([LANDING_TEXTS.problem.chart.axisX, LANDING_TEXTS.problem.chart.axisY]).toEqual(["Temps", "Mandats"]);
    expect(strings(LANDING_TEXTS.problem.chart).join(" ")).not.toMatch(/\d/);
  });

  it("carries the tag of the hero and a title made of its lines", () => {
    expect(LANDING_TEXTS.hero.tag.toUpperCase()).toBe("5 AGENTS · CONTRÔLE HUMAIN");
    expect(HERO_TITLE).toBe(LANDING_TEXTS.hero.titleLines.join(" "));
  });
});
