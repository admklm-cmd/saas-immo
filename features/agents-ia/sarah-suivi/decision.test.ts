import { describe, expect, it } from "vitest";

import type { PipelineStage } from "@/lib/agents/types";
import { SELLER_DECISIONS } from "@/lib/claude/schemas";

import {
  decideFollowThroughStage,
  isStageAllowedForSarah,
  planFollowThroughTasks,
  SARAH_ALLOWED_TARGET_STAGES,
  SARAH_CONFIDENCE_THRESHOLD,
  SARAH_MOVABLE_STAGES,
} from "./decision";
import type { SarahFollowThrough } from "./schema";

/**
 * The product rule under test: **Sarah can never reach `mandat_signe`.** The
 * schema already makes it unexpressible; this file proves the code side — the
 * stage comes from a whitelist, and nothing an AI returns can widen it.
 */

const ALL_STAGES: readonly PipelineStage[] = [
  "nouveau",
  "qualifie",
  "chaud",
  "rdv_planifie",
  "estimation_faite",
  "mandat_signe",
  "perdu",
];

const OUTPUT: SarahFollowThrough = {
  summary: "Rendez-vous réalisé, le vendeur hésite encore.",
  seller_decision: "hesite",
  objections: ["Le prix reste à arbitrer."],
  missing_documents: ["Documents de copropriété"],
  next_steps: [{ title: "Rappeler le vendeur", details: "Sous 10 jours." }],
  estimation_presented: true,
  missing_fields: [],
  confidence: 0.8,
};

describe("liste blanche des étapes de Sarah", () => {
  it("ne contient que « estimation_faite »", () => {
    expect(SARAH_ALLOWED_TARGET_STAGES).toEqual(["estimation_faite"]);
  });

  it("n'autorise ni « mandat_signe » ni « perdu »", () => {
    expect(isStageAllowedForSarah("mandat_signe")).toBe(false);
    expect(isStageAllowedForSarah("perdu")).toBe(false);
    for (const stage of ALL_STAGES) {
      expect(isStageAllowedForSarah(stage), stage).toBe(stage === "estimation_faite");
    }
  });
});

describe("decideFollowThroughStage — mandat signé inatteignable", () => {
  it("ne fait jamais passer un contact à une étape hors de la liste blanche", () => {
    for (const stage of ALL_STAGES) {
      for (const confidence of [0, 0.25, 0.49, 0.5, 0.75, 1]) {
        const decision = decideFollowThroughStage({ currentStage: stage, confidence });
        if (decision.changed) {
          // La seule étape que Sarah peut écrire : « estimation faite ».
          expect(decision.stage, `${stage}/${confidence}`).toBe("estimation_faite");
          expect(isStageAllowedForSarah(decision.stage)).toBe(true);
        } else {
          // Sinon, l'étape est rendue telle quelle : rien n'est écrit.
          expect(decision.stage, `${stage}/${confidence}`).toBe(stage);
        }
      }
    }
  });

  it("ne bouge jamais un contact déjà à « mandat_signe » ou « perdu »", () => {
    for (const stage of ["mandat_signe", "perdu", "estimation_faite", "nouveau"] as const) {
      const decision = decideFollowThroughStage({ currentStage: stage, confidence: 1 });
      expect(decision.changed, stage).toBe(false);
      expect(decision.stage).toBe(stage);
      expect(decision.reason).toBe("stage_locked");
    }
  });

  it("fait avancer un dossier en cours jusqu'à « estimation faite »", () => {
    for (const stage of SARAH_MOVABLE_STAGES) {
      const decision = decideFollowThroughStage({ currentStage: stage, confidence: 0.9 });
      expect(decision.changed, stage).toBe(true);
      expect(decision.stage).toBe("estimation_faite");
      expect(decision.reason).toBe("followed_through");
    }
  });

  it("ne bouge rien quand la confiance est insuffisante", () => {
    const decision = decideFollowThroughStage({
      currentStage: "rdv_planifie",
      confidence: SARAH_CONFIDENCE_THRESHOLD - 0.01,
    });
    expect(decision.changed).toBe(false);
    expect(decision.reason).toBe("low_confidence");
    expect(decision.stage).toBe("rdv_planifie");
  });

  it("la position du vendeur n'entre pas dans la décision d'étape", () => {
    // Un « refus » ne ferme pas le dossier et un « mandat envisagé » ne signe
    // rien : seules l'étape courante et la confiance comptent. La fonction ne
    // reçoit d'ailleurs même pas la classification.
    const reference = decideFollowThroughStage({ currentStage: "rdv_planifie", confidence: 0.9 });
    for (const decision of SELLER_DECISIONS) {
      const output: SarahFollowThrough = { ...OUTPUT, seller_decision: decision };
      const again = decideFollowThroughStage({
        currentStage: "rdv_planifie",
        confidence: output.confidence + 0.1,
      });
      expect(again.stage, decision).toBe(reference.stage);
    }
  });
});

describe("planFollowThroughTasks", () => {
  it("transforme les actions proposées en lignes lisibles pour un humain", () => {
    const plan = planFollowThroughTasks(OUTPUT);
    expect(plan.nextSteps).toEqual(["Rappeler le vendeur — Sous 10 jours."]);
    expect(plan.missingDocuments).toEqual(["Documents de copropriété"]);
  });

  it("supporte une action sans détail", () => {
    const plan = planFollowThroughTasks({
      ...OUTPUT,
      next_steps: [{ title: "Relancer par email", details: null }],
    });
    expect(plan.nextSteps).toEqual(["Relancer par email"]);
  });

  it("ne propose rien quand le compte-rendu ne dit rien", () => {
    const plan = planFollowThroughTasks({
      ...OUTPUT,
      next_steps: [],
      missing_documents: [],
    });
    expect(plan.nextSteps).toEqual([]);
    expect(plan.missingDocuments).toEqual([]);
  });
});
