import { describe, expect, it } from "vitest";

import {
  changeContactStageSchema,
  PIPELINE_STAGES,
  STAGE_CHANGE_ERROR_CODES,
  STAGE_CHANGE_ERROR_MESSAGES,
  stageChangeErrorCode,
} from "./types";

const CONTACT_ID = "7c0e8a1e-2f4b-4b8e-9a51-3d2f1c0b9e77";

describe("changeContactStageSchema", () => {
  it("accepte un changement simple sans motif", () => {
    const parsed = changeContactStageSchema.parse({ contactId: CONTACT_ID, stage: "chaud", mandateConfirmed: false });
    expect(parsed).toEqual({ contactId: CONTACT_ID, stage: "chaud", mandateConfirmed: false, reason: null });
  });

  it("accepte toutes les étapes du pipeline, perdu compris", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(changeContactStageSchema.safeParse({ contactId: CONTACT_ID, stage, mandateConfirmed: true }).success).toBe(
        true,
      );
    }
  });

  it("nettoie le motif : espaces retirés, vide => null", () => {
    expect(
      changeContactStageSchema.parse({ contactId: CONTACT_ID, stage: "perdu", mandateConfirmed: true, reason: "  Vendeur a renoncé  " })
        .reason,
    ).toBe("Vendeur a renoncé");
    expect(
      changeContactStageSchema.parse({ contactId: CONTACT_ID, stage: "perdu", mandateConfirmed: true, reason: "   " }).reason,
    ).toBeNull();
    expect(
      changeContactStageSchema.parse({ contactId: CONTACT_ID, stage: "perdu", mandateConfirmed: true, reason: null }).reason,
    ).toBeNull();
  });

  it("accepte les sauts de ligne dans le motif", () => {
    const result = changeContactStageSchema.safeParse({
      contactId: CONTACT_ID,
      stage: "perdu",
      mandateConfirmed: true,
      reason: "Mandat annulé.\nLe vendeur retire son bien.",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["trop court", "ok"],
    ["trop long", "x".repeat(501)],
    ["caractère de contrôle ESC", "Motif \u001b[31m rouge"],
    ["caractère DEL", "Motif\u007f"],
    ["NUL", "Motif\u0000 caché"],
  ])("refuse un motif %s", (_label, reason) => {
    expect(
      changeContactStageSchema.safeParse({ contactId: CONTACT_ID, stage: "perdu", mandateConfirmed: true, reason }).success,
    ).toBe(false);
  });

  it("accepte un motif de 3 et de 500 caractères (bornes)", () => {
    for (const reason of ["abc", "x".repeat(500)]) {
      expect(
        changeContactStageSchema.safeParse({ contactId: CONTACT_ID, stage: "perdu", mandateConfirmed: true, reason }).success,
      ).toBe(true);
    }
  });

  it.each([
    ["identifiant invalide", { contactId: "not-a-uuid", stage: "chaud", mandateConfirmed: false }],
    ["étape inconnue", { contactId: CONTACT_ID, stage: "signe", mandateConfirmed: false }],
    ["confirmation en texte", { contactId: CONTACT_ID, stage: "mandat_signe", mandateConfirmed: "true" }],
    ["confirmation absente", { contactId: CONTACT_ID, stage: "mandat_signe" }],
    ["champ en trop (agence choisie par le client)", {
      contactId: CONTACT_ID,
      stage: "chaud",
      mandateConfirmed: false,
      agencyId: CONTACT_ID,
    }],
    ["motif non textuel", { contactId: CONTACT_ID, stage: "perdu", mandateConfirmed: true, reason: 42 }],
    ["entrée non objet", "mandat_signe"],
  ])("refuse : %s", (_label, input) => {
    expect(changeContactStageSchema.safeParse(input).success).toBe(false);
  });
});

describe("stageChangeErrorCode", () => {
  it.each([
    ["stage_mandate_confirmation_required", "stage_mandate_confirmation_required"],
    ["stage_mandate_exit_director_only", "stage_mandate_exit_director_only"],
    ["stage_mandate_exit_confirmation_required", "stage_mandate_exit_confirmation_required"],
    ["stage_reason_required", "stage_reason_required"],
    ["stage_reason_invalid", "stage_reason_invalid"],
    ["stage_unchanged", "stage_unchanged"],
    ["contact_not_found", "contact_not_found"],
    ["stage_mandate_change_requires_rpc", "stage_mandate_change_requires_rpc"],
    ["activity_type_reserved", "forbidden"],
    ["forbidden", "forbidden"],
  ] as const)("traduit %s", (message, expected) => {
    expect(stageChangeErrorCode({ message, code: "P0001" })).toBe(expected);
  });

  it("reconnaît un message enveloppé sans confondre les codes proches", () => {
    expect(stageChangeErrorCode({ message: 'error: stage_mandate_exit_confirmation_required at line 3' })).toBe(
      "stage_mandate_exit_confirmation_required",
    );
  });

  it("privilège insuffisant (fonction révoquée) => forbidden", () => {
    expect(stageChangeErrorCode({ message: "permission denied for function change_contact_stage", code: "42501" })).toBe(
      "forbidden",
    );
  });

  it("erreur inconnue => unexpected_error, jamais le message brut", () => {
    expect(stageChangeErrorCode({ message: "connection reset", code: "08006" })).toBe("unexpected_error");
  });

  it("chaque code a un message français non vide", () => {
    for (const code of STAGE_CHANGE_ERROR_CODES) {
      expect(STAGE_CHANGE_ERROR_MESSAGES[code].length).toBeGreaterThan(10);
    }
  });
});
