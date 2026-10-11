import { describe, expect, it } from "vitest";

import { APP_TEXTS, RUN_OUTCOME_LABELS } from "@/components/texts";
import type { TimelineEntry } from "@/features/contacts/types";

import { buildDossierJourney, JOURNEY_STAGES, type JourneyStage } from "./dossier-journey";

const STATUS = APP_TEXTS.dossierJourney.status;

let sequence = 0;
function entry(overrides: Partial<TimelineEntry> & Pick<TimelineEntry, "kind">): TimelineEntry {
  sequence += 1;
  return {
    id: `entry-${sequence}`,
    occurredAt: `2026-09-20T08:${String(sequence).padStart(2, "0")}:00.000Z`,
    title: "Entrée",
    description: null,
    isSimulation: true,
    actor: { type: "ai_agent", agent: null, userId: null },
    status: null,
    meta: {},
    ...overrides,
  } as TimelineEntry;
}

function stage(stages: JourneyStage[], key: JourneyStage["key"]): JourneyStage {
  const found = stages.find((item) => item.key === key);
  if (!found) throw new Error(`missing stage ${key}`);
  return found;
}

describe("buildDossierJourney", () => {
  it("always returns the ten stages, in the order of the seller's journey", () => {
    expect(buildDossierJourney([]).map((item) => item.key)).toEqual([...JOURNEY_STAGES]);
  });

  it("invents nothing for an empty history: only the dossier itself is recorded", () => {
    const stages = buildDossierJourney([]);
    expect(stage(stages, "prospect").state).toBe("done");
    for (const item of stages.slice(1)) {
      expect(item.state).toBe("pending");
      expect(item.statusLabel).toBe(STATUS.pending);
      expect(item.runId).toBeNull();
      expect(item.at).toBeNull();
    }
  });

  it("maps a recorded run to its real outcome and keeps the run to replay", () => {
    const hugo = entry({
      kind: "ai_run",
      actor: { type: "ai_agent", agent: "hugo", userId: null },
      status: "blocked",
      title: "Hugo — Coupe-circuit actif",
    });
    const stages = buildDossierJourney([hugo]);
    const hugoStage = stage(stages, "hugo");
    expect(hugoStage.state).toBe("blocked");
    expect(hugoStage.statusLabel).toBe(RUN_OUTCOME_LABELS.blocked);
    expect(hugoStage.detail).toBe("Coupe-circuit actif");
    expect(hugoStage.runId).toBe(hugo.id);
  });

  it("distinguishes a technical error from a guard-rail block", () => {
    const failed = entry({ kind: "ai_run", actor: { type: "ai_agent", agent: "louis", userId: null }, status: "failed" });
    expect(stage(buildDossierJourney([failed]), "louis").state).toBe("failed");
  });

  it("shows the first message waiting for a human as a human checkpoint", () => {
    const message = entry({ kind: "message", meta: {} });
    const review = stage(buildDossierJourney([message]), "first_review");
    expect(review.state).toBe("human");
    expect(review.statusLabel).toBe(STATUS.reviewPending);
  });

  it("marks a skipped stage as untraced when a later one was recorded", () => {
    const louis = entry({ kind: "ai_run", actor: { type: "ai_agent", agent: "louis", userId: null }, status: "succeeded" });
    const stages = buildDossierJourney([louis]);
    expect(stage(stages, "hugo").state).toBe("untraced");
    expect(stage(stages, "hugo").statusLabel).toBe(STATUS.untraced);
    expect(stage(stages, "sarah").state).toBe("pending");
  });

  it("never shows a mandate unless the latest stage change is a human one to « mandat signé »", () => {
    const byAgent = entry({
      kind: "activity",
      actor: { type: "ai_agent", agent: "sarah", userId: null },
      meta: { type: "contact_stage_changed", stage: "mandat_signe" },
    });
    expect(stage(buildDossierJourney([byAgent]), "mandate").state).toBe("pending");

    const byHuman = entry({
      kind: "activity",
      actor: { type: "user", agent: null, userId: "user-1" },
      meta: { type: "contact_stage_changed", stage: "mandat_signe" },
    });
    const mandate = stage(buildDossierJourney([byHuman]), "mandate");
    expect(mandate.state).toBe("done");
    expect(mandate.statusLabel).toBe(STATUS.mandateDone);
  });
});
