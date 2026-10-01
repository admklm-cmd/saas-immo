import { describe, expect, it } from "vitest";

import { HERO_TITLE, LANDING_TEXTS } from "./landing-texts";
import { countAccent, MAX_ANIMATED_LINES } from "./ui/editorial-title";

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

  it("names four causes and six events, and sets the observation in the subtle ink", () => {
    const problem = LANDING_TEXTS.problem;
    expect(problem.titleSubtleBefore).toBe(2);
    expect(problem.symptoms.map((symptom) => symptom.title)).toEqual([
      "Relances manuelles",
      "Dossiers dispersés",
      "Doublons entre conseillers",
      "Suivi saturé",
    ]);
    expect(Object.values(problem.chart.events)).toEqual(["Relance", "Dossier", "Document", "Doublon", "Suivi", "Validation"]);
    expect(problem.chart.capacity).toBe("Capacité absorbée par l'administratif");
  });

  it("carries the tag of the hero and a title made of its lines", () => {
    expect(LANDING_TEXTS.hero.tag.toUpperCase()).toBe("5 AGENTS · CONTRÔLE HUMAIN");
    expect(HERO_TITLE).toBe(LANDING_TEXTS.hero.titleLines.join(" "));
  });
});

/** The seven editorial titles of the landing (docs/design-system.md §2.2.9). */
const EDITORIAL = {
  hero: LANDING_TEXTS.hero,
  problem: LANDING_TEXTS.problem,
  solution: LANDING_TEXTS.solution,
  agents: LANDING_TEXTS.agents,
  control: LANDING_TEXTS.control,
  result: LANDING_TEXTS.result,
  final: LANDING_TEXTS.final,
};

describe("landing editorial titles", () => {
  it.each(Object.entries(EDITORIAL))("%s: title = its author lines, at most four", (_key, texts) => {
    expect(texts.title).toBe(texts.titleLines.join(" "));
    expect(texts.titleLines.length).toBeGreaterThan(0);
    expect(texts.titleLines.length).toBeLessThanOrEqual(MAX_ANIMATED_LINES);
  });

  it.each(Object.entries(EDITORIAL))("%s: exactly one accented whole word, never a figure", (_key, texts) => {
    expect(countAccent(texts.titleLines, texts.titleAccent)).toBe(1);
    expect(texts.titleAccent).not.toMatch(/\s|\d/);
    expect(texts.title).not.toMatch(/\d/);
    for (const forbidden of ["Simulation", "Léa", "Hugo", "Emma", "Louis", "Sarah"]) {
      expect(texts.titleAccent).not.toBe(forbidden);
    }
  });

  it("keeps the exact titles and accents validated by the user", () => {
    expect(Object.fromEntries(Object.entries(EDITORIAL).map(([key, texts]) => [key, [texts.titleLines, texts.titleAccent]]))).toEqual({
      hero: [["Chaque demande", "vendeur avance.", "Votre agence", "garde la main."], "main"],
      problem: [["Ce n'est pas la prospection", "qui freine vos mandats.", "C'est l'administratif."], "administratif"],
      solution: [["Chaque dossier suit", "le même chemin,", "de la demande au mandat."], "chemin"],
      agents: [["Chaque agent sait", "où son travail commence.", "Et où il s'arrête."], "s'arrête"],
      control: [["L'IA prépare.", "Votre équipe décide."], "décide"],
      result: [["Vous ouvrez l'espace agence.", "Vous savez par quoi", "commencer."], "commencer"],
      final: [["Déposez une demande fictive.", "Retrouvez-la", "dans l'espace agence."], "fictive"],
    });
  });

  it("keeps the prototype note of the final call and drops its redundant body", () => {
    expect(LANDING_TEXTS.final.note).toBe("Prototype de démonstration. Aucune donnée réelle, aucun envoi réel.");
    expect("body" in LANDING_TEXTS.final).toBe(false);
    expect("titleSecondFrom" in LANDING_TEXTS.hero).toBe(false);
    expect("titleEmphasis" in LANDING_TEXTS.problem).toBe(false);
  });
});
