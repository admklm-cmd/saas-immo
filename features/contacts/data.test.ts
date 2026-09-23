import { describe, expect, it } from "vitest";

import { activityMeta, STAGE_CHANGE_ACTIVITY_TYPE } from "./data";

describe("activityMeta", () => {
  it("expose les étapes avant/après et le motif d'un changement d'étape humain", () => {
    expect(
      activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, {
        previous_stage: "mandat_signe",
        stage: "perdu",
        reason: "Le vendeur a retiré son bien.",
        mandate_confirmed: true,
      }),
    ).toEqual({
      type: STAGE_CHANGE_ACTIVITY_TYPE,
      previous_stage: "mandat_signe",
      stage: "perdu",
      reason: "Le vendeur a retiré son bien.",
    });
  });

  it("valeurs absentes ou non textuelles => null, jamais inventées", () => {
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, { stage: 3 })).toEqual({
      type: STAGE_CHANGE_ACTIVITY_TYPE,
      previous_stage: null,
      stage: null,
      reason: null,
    });
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, null).stage).toBeNull();
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, ["x"]).stage).toBeNull();
  });

  it("autres types : seul le type est exposé (comportement inchangé)", () => {
    expect(activityMeta("appointment_confirmed", { appointment_id: "x" })).toEqual({ type: "appointment_confirmed" });
  });
});
