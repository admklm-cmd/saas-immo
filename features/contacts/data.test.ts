import { describe, expect, it } from "vitest";

import { activityMeta, STAGE_CHANGE_ACTIVITY_TYPE } from "./data";

describe("activityMeta", () => {
  it("expose les étapes avant/après, le motif et le rôle d'un changement d'étape humain", () => {
    expect(
      activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, {
        previous_stage: "mandat_signe",
        stage: "perdu",
        reason: "Le vendeur a retiré son bien.",
        mandate_confirmed: true,
        actor_role: "director",
      }),
    ).toEqual({
      type: STAGE_CHANGE_ACTIVITY_TYPE,
      previous_stage: "mandat_signe",
      stage: "perdu",
      reason: "Le vendeur a retiré son bien.",
      actor_role: "director",
    });
  });

  it("expose le rôle « agent » et refuse tout rôle inconnu ou non textuel", () => {
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, { actor_role: "agent" }).actor_role).toBe("agent");
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, { actor_role: "admin" }).actor_role).toBeNull();
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, { actor_role: "Director" }).actor_role).toBeNull();
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, { actor_role: 1 }).actor_role).toBeNull();
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, {}).actor_role).toBeNull();
  });

  it("valeurs absentes ou non textuelles => null, jamais inventées", () => {
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, { stage: 3 })).toEqual({
      type: STAGE_CHANGE_ACTIVITY_TYPE,
      previous_stage: null,
      stage: null,
      reason: null,
      actor_role: null,
    });
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, null).stage).toBeNull();
    expect(activityMeta(STAGE_CHANGE_ACTIVITY_TYPE, ["x"]).stage).toBeNull();
  });

  it("autres types : seul le type est exposé (comportement inchangé)", () => {
    expect(activityMeta("appointment_confirmed", { appointment_id: "x" })).toEqual({ type: "appointment_confirmed" });
  });
});
