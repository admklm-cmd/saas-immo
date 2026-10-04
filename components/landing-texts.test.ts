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
/** Every string except the ROI section, the only one allowed to carry figures (docs/design-system.md §2.11.8.8 L4-B). */
const { roi: ROI, ...WITHOUT_ROI } = LANDING_TEXTS;
const ALL_BUT_ROI = strings(WITHOUT_ROI);

describe("landing copy", () => {
  it("claims no figure outside the ROI section: no percentage, no price, no multiplier", () => {
    for (const text of ALL_BUT_ROI) {
      expect(text, text).not.toMatch(/\d\s?%|€|\bx\d|\d+\s?(clients?|agences?|mandats?)\b/i);
    }
  });

  it("invents no client, testimonial or result; « ROI » only in its own section", () => {
    for (const text of ALL) {
      expect(text, text).not.toMatch(/témoignage|nos clients|ils nous font confiance|avis client/i);
    }
    for (const text of ALL_BUT_ROI) expect(text, text).not.toMatch(/\bROI\b/);
  });

  it("block A: badge, note, guard sentence, three blocks of the five agents and you (§2.11.8.8 L4-A)", () => {
    const journey = LANDING_TEXTS.journey;
    expect(journey.note).toBe("Illustration en boucle, exemple fictif. Aucun prospect réel, aucun envoi.");
    expect(journey.guard.map((segment) => segment.text).join("")).toBe("Les agents préparent. Vous validez le premier message et confirmez le mandat.");
    expect(journey.guard.filter((segment) => "strong" in segment && segment.strong).map((segment) => segment.text)).toEqual(["validez", "confirmez"]);
    expect(journey.cursor).toBe("Vous");
    expect(journey.pills).toEqual({ agents: "Agents", you: "Vous" });
    expect(journey.blocks.map((block) => [block.name, block.members, block.nature, block.glyph, block.tone])).toEqual([
      ["Acquisition", "Léa · Hugo · Emma", "agents", "leads", "orange"],
      ["Validation humaine", "Vous · Conseiller", "human", "humanValidation", "violet"],
      ["Suivi", "Louis · Sarah", "agents", "pipeline", "green"],
    ]);
    type Line = { label: string; by: string };
    type Group = { agent?: string; label?: string; lines: readonly Line[] };
    const blocks: readonly { nature: string; groups: readonly Group[] }[] = journey.blocks;
    expect(blocks.map((block) => block.groups.map((group) => group.agent ?? group.label))).toEqual([
      ["Léa", "Hugo", "Emma"],
      ["Premier message", "Mandat"],
      ["Louis", "Sarah"],
    ]);
    // Only the advisor checks the human block; Sarah flags the mandate, never declares it.
    const lines = blocks.flatMap((block) => block.groups.flatMap((group) => group.lines.map((line) => ({ ...line, nature: block.nature }))));
    for (const line of lines) {
      if (line.nature === "agents") expect(line.by, line.label).not.toBe("you");
      else expect(line.by, line.label).toBe("you");
      expect(line.label.length, line.label).toBeLessThanOrEqual(20);
    }
    expect(lines.filter((line) => line.by === "agent")).toHaveLength(12);
    expect(lines.filter((line) => line.by === "you").map((line) => line.label)).toEqual(["Message relu", "Message validé", "Mandat confirmé"]);
    expect(lines.filter((line) => line.by === "missing").map((line) => line.label)).toEqual(["Motivation"]);
    expect(lines.find((line) => line.label === "Mandat signalé")?.by).toBe("agent");
    expect(journey.srSummary).toEqual([
      "Acquisition, par Léa, Hugo et Emma : source vérifiée, doublon écarté, fiche créée ; bien et secteur, délai du projet, motivation manquante, à demander ; consentement vérifié, message préparé.",
      "Validation humaine, par vous : premier message relu puis validé ; mandat confirmé.",
      "Suivi, par Louis et Sarah : créneau proposé, dossier préparé ; compte-rendu lu, actions créées, mandat signalé.",
    ]);
    expect(journey.dots.item).toBe("Bloc {n} sur 3 : {nom}");
    expect("cards" in journey).toBe(false);
    expect("states" in journey).toBe(false);
    expect("prospect" in journey).toBe(false);
  });

  it("ROI (§2.11.8.8 L4-B): exact notes and disclaimer, never a promise, every value tagged", () => {
    expect(ROI.kicker).toBe("ROI");
    expect(ROI.disclaimer).toBe(
      "Chiffres indicatifs, issus d'études publiques (souvent américaines ou anciennes) et d'hypothèses modifiables. Ils ne constituent pas une promesse de résultat.",
    );
    expect(ROI.widgets.speed.note).toBe(
      "Études américaines tous secteurs : MIT/InsideSales 2007 ; Harvard Business Review 2011. Non spécifiques à l'immobilier français.",
    );
    expect(ROI.widgets.time.note).toBe(
      "Temps administratif : étude La Boîte Immo, 629 professionnels, 2017. Part automatisable, nombre de négociateurs et coût horaire : hypothèses.",
    );
    expect(ROI.widgets.mandates.note).toBe(
      "Prix médian : données DVF La Ciotat 2025. Honoraires : moyenne FNAIM 2016 (4 % HT). Volumes et taux de transformation : hypothèses à ajuster à votre agence.",
    );
    expect(ROI.widgets.followup.note).toBe(
      "Étude Velocify (éditeur, États-Unis, environ 3,5 millions de leads). En France, les appels ne sont permis qu'avec consentement, du lundi au vendredi (10h-13h, 14h-20h) et 4 fois par mois maximum.",
    );
    for (const text of strings(ROI)) expect(text, text).not.toMatch(/garanti|vous gagnerez/i);

    // Every displayed value carries its provenance: main values, secondary, funnel steps, sliders, fixed hypotheses, landmarks.
    const KINDS = ["source", "hypothesis", "estimate"];
    const { speed, mandates, time, followup } = ROI.widgets;
    const values: readonly { kind: string }[] = [
      speed.value,
      speed.secondary.value,
      mandates.value,
      ...mandates.funnel,
      mandates.sliders.requests,
      mandates.sliders.lateShare,
      mandates.sliders.lateShare.benchmark,
      ...mandates.fixed,
      time.value,
      time.sliders.negotiators,
      time.sliders.hours,
      time.sliders.hours.benchmark,
      ...time.fixed,
      followup.value,
    ];
    expect(values).toHaveLength(22);
    for (const value of values) expect(KINDS, JSON.stringify(value)).toContain(value.kind);
    expect(speed.value).toMatchObject({ kind: "source", us: true });
    expect(followup.value).toMatchObject({ kind: "source", us: true });
    expect(mandates.sliders.lateShare.benchmark).toMatchObject({ kind: "source", us: true });
    expect(time.value.kind).toBe("estimate");
    expect(mandates.value.kind).toBe("estimate");
    expect(mandates.fixed.map((entry) => entry.kind)).toEqual(["hypothesis", "hypothesis", "source", "source"]);
    expect(time.fixed.map((entry) => entry.kind)).toEqual(["hypothesis", "hypothesis", "hypothesis"]);
    // The hours slider is an adjustable value (hypothesis); only its published landmark is sourced.
    expect(time.sliders.hours.kind).toBe("hypothesis");
    expect(time.sliders.hours.benchmark).toEqual({ text: "étude : 4 à 6 h", kind: "source" });
  });

  it("block B: five tiles, fictitious label, true figures of tile 5 only (§2.11.8.4)", () => {
    const solution = LANDING_TEXTS.solution;
    expect(solution.fictive).toBe("Exemple fictif");
    expect(solution.rail.map((step) => `${step.label} · ${step.owner}`)).toEqual([
      "Demande reçue · Léa",
      "Qualification · Hugo",
      "Relance préparée · Emma",
      "Validation humaine · Conseiller",
      "Rendez-vous · Louis",
      "Suivi · Sarah",
      "Mandat · Conseiller",
    ]);
    expect(Object.values(solution.tiles).map((tile) => tile.title)).toEqual([
      "Un seul chemin",
      "Un dossier qui avance",
      "Cinq agents, un conseiller",
      "Le compte-rendu, exploité",
      "Des garde-fous réels",
    ]);
    // The two figures are rules of the prototype (CLAUDE.md), not statistics.
    expect(solution.tiles.guards.figures.map((figure) => `${figure.value} ${figure.caption}`)).toEqual([
      "0 envoi réel dans ce prototype",
      "2 validations humaines obligatoires",
    ]);
    expect(solution.tiles.team.agents.map((agent) => agent.name)).toEqual(["Léa", "Hugo", "Emma", "Louis", "Sarah"]);
    expect("railNote" in solution).toBe(false);
  });

  it("block C: seven steps, two human, carousel labels, no percentage in the copy (§2.11.8.5)", () => {
    const final = LANDING_TEXTS.final;
    expect(final.steps.map((step) => `${step.title} · ${step.owner}`)).toEqual([
      "Demande reçue · Léa",
      "Qualification · Hugo",
      "Relance préparée · Emma",
      "Validation humaine · Vous",
      "Rendez-vous · Louis",
      "Suivi · Sarah",
      "Mandat · Vous",
    ]);
    expect(final.steps.filter((step) => step.human).map((step) => step.key)).toEqual(["review", "mandate"]);
    expect(final.carousel).toEqual({
      label: "Les sept étapes d'un dossier",
      previous: "Étape précédente",
      next: "Étape suivante",
      stepPrefix: "Étape n°",
      human: "Humaine",
      position: "Étape {n} sur 7",
      badge: LANDING_TEXTS.journey.badge,
    });
    for (const step of final.steps) {
      expect(step.pending, step.key).toMatch(/…$/);
      expect(step.done.length, step.key).toBeGreaterThan(0);
    }
    expect(JSON.stringify(final)).not.toMatch(/%/);
  });

  it("control: the six facts unchanged, split 3 + 3 between the two tiles (§2.11.8.7 L3-D)", () => {
    const control = LANDING_TEXTS.control;
    expect(control.facts.map((fact) => fact.title)).toEqual([
      "Premier contact",
      "Mandat signé",
      "Consentement",
      "Coupe-circuit",
      "Refus ou reprise en main",
      "Information manquante",
    ]);
    expect(control.facts.map((fact) => fact.tile)).toEqual(["team", "team", "timeline", "team", "timeline", "timeline"]);
    expect(control.tiles.team.title).toBe("Un conseiller, cinq agents");
    expect(control.tiles.team.agents.map((agent) => `${agent.name} · ${agent.role}`)).toEqual([
      "Léa · Acquisition",
      "Hugo · Qualification",
      "Emma · Relation",
      "Louis · Rendez-vous",
      "Sarah · Suivi",
    ]);
    expect(control.tiles.timeline.title).toBe("Le dossier attend votre décision");
    expect(control.tiles.timeline.days).toEqual(["J0", "J2", "J4", "J6", "J8", "J10"]);
    expect(control.tiles.timeline.states).toHaveLength(9);
    expect(control.tiles.timeline.visualLabel).toMatch(/simulation/);
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
  roi: LANDING_TEXTS.roi,
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
      roi: [["Ce que vos délais coûtent,", "et ce que l'agence", "peut regagner."], "regagner"],
      final: [["Déposez une demande fictive.", "Retrouvez-la", "dans l'espace agence."], "fictive"],
    });
  });

  it("keeps the prototype note of the final call, with the paragraph of block C (§2.11.8.5)", () => {
    expect(LANDING_TEXTS.final.note).toBe("Prototype de démonstration. Aucune donnée réelle, aucun envoi réel.");
    expect(LANDING_TEXTS.final.body).toBe("Sept étapes, de la demande au mandat. Deux restent toujours humaines.");
    expect("titleSecondFrom" in LANDING_TEXTS.hero).toBe(false);
    expect("titleEmphasis" in LANDING_TEXTS.problem).toBe(false);
  });
});
