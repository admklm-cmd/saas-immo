import { describe, expect, it } from "vitest";

import type { PipelineStage } from "@/lib/agents/types";

import {
  decideStage,
  HUGO_CONFIDENCE_THRESHOLD,
  mergeQualification,
  type ExistingQualification,
} from "./decision";
import type { HugoQualification } from "./schema";

/**
 * Stage rules and merge rules are decided by the code, never by the AI.
 * They are pure functions: these tests need no database and no provider.
 */

const ALL_KNOWN = {
  property_type: true,
  city: true,
  sale_motivation: true,
  sale_timeline: true,
} as const;

const NOTHING_EXISTS: ExistingQualification = {
  saleMotivation: null,
  saleTimeline: null,
  propertyType: null,
  propertyCity: null,
  propertySector: null,
};

const OUTPUT: HugoQualification = {
  property_type: "house",
  city: "Cassis",
  sector: "Cassis — Centre",
  sale_motivation: "succession",
  sale_timeline: "moins_de_3_mois",
  missing_fields: [],
  confidence: 0.9,
  summary: "Maison à Cassis. Motivation : Succession. Délai : Moins de 3 mois",
};

describe("decideStage — passage à « chaud » ou « qualifié »", () => {
  it("passe à « chaud » quand le projet est immédiat ou sous 3 mois", () => {
    for (const timeline of ["immediat", "moins_de_3_mois"] as const) {
      const decision = decideStage({ currentStage: "nouveau", known: ALL_KNOWN, timeline, confidence: 0.9 });
      expect(decision.stage, timeline).toBe("chaud");
      expect(decision.changed).toBe(true);
      expect(decision.reason).toBe("hot");
    }
  });

  it("passe à « qualifié » quand le délai est plus lointain", () => {
    for (const timeline of ["3_a_6_mois", "6_a_12_mois", "plus_de_12_mois", "non_defini"] as const) {
      const decision = decideStage({ currentStage: "nouveau", known: ALL_KNOWN, timeline, confidence: 0.9 });
      expect(decision.stage, timeline).toBe("qualifie");
      expect(decision.reason).toBe("qualified");
    }
  });

  it("fait avancer un contact déjà « qualifié » vers « chaud »", () => {
    const decision = decideStage({
      currentStage: "qualifie",
      known: ALL_KNOWN,
      timeline: "immediat",
      confidence: 0.9,
    });
    expect(decision.stage).toBe("chaud");
    expect(decision.changed).toBe(true);
  });
});

describe("decideStage — information manquante : rien n'est inventé", () => {
  it("laisse l'étape inchangée et liste les champs manquants", () => {
    const decision = decideStage({
      currentStage: "nouveau",
      known: { ...ALL_KNOWN, sale_motivation: false, sale_timeline: false },
      timeline: null,
      confidence: 0.95,
    });
    expect(decision.stage).toBe("nouveau");
    expect(decision.changed).toBe(false);
    expect(decision.reason).toBe("missing_information");
    expect(decision.missingFields).toEqual(["sale_motivation", "sale_timeline"]);
  });

  it("le secteur n'est pas un champ requis pour qualifier", () => {
    const decision = decideStage({
      currentStage: "nouveau",
      known: ALL_KNOWN,
      timeline: "6_a_12_mois",
      confidence: 0.9,
    });
    expect(decision.reason).toBe("qualified");
  });
});

describe("decideStage — confiance insuffisante", () => {
  it("laisse l'étape inchangée sous le seuil", () => {
    const decision = decideStage({
      currentStage: "nouveau",
      known: ALL_KNOWN,
      timeline: "immediat",
      confidence: HUGO_CONFIDENCE_THRESHOLD - 0.01,
    });
    expect(decision.changed).toBe(false);
    expect(decision.reason).toBe("low_confidence");
  });

  it("accepte pile au seuil", () => {
    const decision = decideStage({
      currentStage: "nouveau",
      known: ALL_KNOWN,
      timeline: "immediat",
      confidence: HUGO_CONFIDENCE_THRESHOLD,
    });
    expect(decision.changed).toBe(true);
  });
});

describe("decideStage — jamais en arrière, jamais au-delà de son périmètre", () => {
  it("ne touche pas aux étapes qui appartiennent aux humains", () => {
    const locked: PipelineStage[] = ["rdv_planifie", "estimation_faite", "mandat_signe", "perdu"];
    for (const stage of locked) {
      const decision = decideStage({ currentStage: stage, known: ALL_KNOWN, timeline: "immediat", confidence: 1 });
      expect(decision.stage, stage).toBe(stage);
      expect(decision.changed).toBe(false);
      expect(decision.reason).toBe("stage_locked");
    }
  });

  it("ne redescend pas un contact « chaud » vers « qualifié »", () => {
    const decision = decideStage({
      currentStage: "chaud",
      known: ALL_KNOWN,
      timeline: "6_a_12_mois",
      confidence: 1,
    });
    expect(decision.stage).toBe("chaud");
    expect(decision.changed).toBe(false);
  });

  it("ne change rien quand le contact est déjà à l'étape cible", () => {
    const decision = decideStage({
      currentStage: "qualifie",
      known: ALL_KNOWN,
      timeline: "6_a_12_mois",
      confidence: 1,
    });
    expect(decision.stage).toBe("qualifie");
    expect(decision.changed).toBe(false);
    expect(decision.reason).toBe("qualified");
  });
});

describe("mergeQualification — n'écrase jamais une valeur existante", () => {
  it("remplit uniquement les trous", () => {
    const merged = mergeQualification(NOTHING_EXISTS, OUTPUT);
    expect(merged.contactUpdates).toEqual({ sale_motivation: "Succession", sale_timeline: "Moins de 3 mois" });
    expect(merged.propertyUpdates).toEqual({ property_type: "house", city: "Cassis", sector: "Cassis — Centre" });
    expect(merged.missingFields).toEqual([]);
  });

  it("ne réécrit pas une valeur déjà saisie par un humain", () => {
    const merged = mergeQualification(
      {
        saleMotivation: "Succession : partage entre héritiers",
        saleTimeline: "Sous 3 mois",
        propertyType: "apartment",
        propertyCity: "La Ciotat",
        propertySector: "La Ciotat — Port",
      },
      OUTPUT,
    );
    expect(merged.contactUpdates).toEqual({});
    expect(merged.propertyUpdates).toEqual({});
    expect(merged.known).toEqual(ALL_KNOWN);
  });

  it("n'écrit jamais null par-dessus une valeur existante", () => {
    const merged = mergeQualification(
      {
        saleMotivation: "Départ à la retraite",
        saleTimeline: "12 mois",
        propertyType: "house",
        propertyCity: "Ceyreste",
        propertySector: null,
      },
      {
        ...OUTPUT,
        property_type: null,
        city: null,
        sector: null,
        sale_motivation: null,
        sale_timeline: null,
        missing_fields: ["property_type", "city", "sector", "sale_motivation", "sale_timeline"],
        confidence: 0.25,
      },
    );
    expect(merged.contactUpdates).toEqual({});
    expect(merged.propertyUpdates).toEqual({});
    // Everything the CRM already knew stays known; only the sector is missing.
    expect(merged.known).toEqual(ALL_KNOWN);
    expect(merged.missingFields).toEqual(["sector"]);
  });

  it("signale les champs restés inconnus après fusion", () => {
    const merged = mergeQualification(NOTHING_EXISTS, {
      ...OUTPUT,
      city: null,
      sector: null,
      sale_timeline: null,
      missing_fields: ["city", "sector", "sale_timeline"],
      confidence: 0.6,
    });
    expect(merged.missingFields).toEqual(["city", "sector", "sale_timeline"]);
    expect(merged.known.city).toBe(false);
    expect(merged.known.property_type).toBe(true);
  });
});
