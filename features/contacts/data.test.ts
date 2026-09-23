import { describe, expect, it } from "vitest";

import { activityMeta, messageReviewMeta, STAGE_CHANGE_ACTIVITY_TYPE } from "./data";

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

describe("messageReviewMeta — auteur et horodatage réellement enregistrés", () => {
  const DIRECTOR = "d0000000-0000-4000-8000-000000000001";
  const AGENT = "a0000000-0000-4000-8000-000000000002";
  const members = new Map([
    [DIRECTOR, { email: "direction@agence-test.example", role: "director" as const }],
    [AGENT, { email: "conseiller@agence-test.example", role: "agent" as const }],
  ]);
  const AT = "2026-09-23T09:15:00.123+00:00";

  it("expose la valeur brute de validated_at et l'auteur résolu parmi les membres", () => {
    expect(messageReviewMeta({ status: "sent_simulated", validated_by: AGENT, validated_at: AT }, members)).toEqual({
      review_outcome: "approved",
      validated_at: AT,
      validated_by_user_id: AGENT,
      validated_by_email: "conseiller@agence-test.example",
      validated_by_label: "conseiller@agence-test.example",
      validated_by_role: "agent",
      validated_by_role_label: "Conseiller",
    });
  });

  it("distingue un directeur et un refus", () => {
    expect(messageReviewMeta({ status: "rejected", validated_by: DIRECTOR, validated_at: AT }, members)).toEqual({
      review_outcome: "rejected",
      validated_at: AT,
      validated_by_user_id: DIRECTOR,
      validated_by_email: "direction@agence-test.example",
      validated_by_label: "direction@agence-test.example",
      validated_by_role: "director",
      validated_by_role_label: "Directeur",
    });
  });

  it("n'invente rien pour un message en attente", () => {
    expect(
      messageReviewMeta({ status: "pending_validation", validated_by: null, validated_at: null }, members),
    ).toEqual({
      review_outcome: null,
      validated_at: null,
      validated_by_user_id: null,
      validated_by_email: null,
      validated_by_label: null,
      validated_by_role: null,
      validated_by_role_label: null,
    });
  });

  it("auteur non résoluble (membre retiré ou lecture en échec) : libellé null, jamais un auteur supposé", () => {
    const removed = "e0000000-0000-4000-8000-000000000003";
    const meta = messageReviewMeta({ status: "approved", validated_by: removed, validated_at: AT }, members);
    expect(meta).toEqual({
      review_outcome: "approved",
      validated_at: AT,
      validated_by_user_id: removed,
      validated_by_email: null,
      validated_by_label: null,
      validated_by_role: null,
      validated_by_role_label: null,
    });
    // Lecture des membres en échec = carte vide : personne n'est nommé.
    expect(
      messageReviewMeta({ status: "approved", validated_by: AGENT, validated_at: AT }, new Map()).validated_by_email,
    ).toBeNull();
  });

  it("message envoyé sans validated_by ni validated_at : null exposé, rien déduit d'un autre événement", () => {
    expect(
      messageReviewMeta({ status: "sent_simulated", validated_by: null, validated_at: null }, members),
    ).toEqual({
      review_outcome: "approved",
      validated_at: null,
      validated_by_user_id: null,
      validated_by_email: null,
      validated_by_label: null,
      validated_by_role: null,
      validated_by_role_label: null,
    });
  });

  it("validated_by null mais validated_at présent (membre parti) : la date reste, l'auteur est null", () => {
    const meta = messageReviewMeta({ status: "sent_simulated", validated_by: null, validated_at: AT }, members);
    expect(meta.validated_at).toBe(AT);
    expect(meta.validated_by_user_id).toBeNull();
    expect(meta.validated_by_email).toBeNull();
    expect(meta.validated_by_label).toBeNull();
  });

  it("un compte sans email : libellé null, rôle conservé", () => {
    const noEmail = new Map([[AGENT, { email: null, role: "agent" as const }]]);
    const meta = messageReviewMeta({ status: "approved", validated_by: AGENT, validated_at: AT }, noEmail);
    expect(meta.validated_by_email).toBeNull();
    expect(meta.validated_by_label).toBeNull();
    expect(meta.validated_by_role).toBe("agent");
  });
});
