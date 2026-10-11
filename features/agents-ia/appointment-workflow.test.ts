import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_REPORT_MAX_LENGTH,
  appointmentCompletionSchema,
} from "./types";

describe("appointmentCompletionSchema", () => {
  it("nettoie et valide un compte-rendu humain", () => {
    expect(
      appointmentCompletionSchema.parse({ reportNotes: "  Visite\u0000 réalisée.  " }),
    ).toEqual({ reportNotes: "Visite  réalisée." });
  });

  it("refuse un texte vide, trop long ou un champ inattendu", () => {
    expect(appointmentCompletionSchema.safeParse({ reportNotes: "   " }).success).toBe(false);
    expect(
      appointmentCompletionSchema.safeParse({
        reportNotes: "x".repeat(APPOINTMENT_REPORT_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      appointmentCompletionSchema.safeParse({ reportNotes: "Réalisé.", status: "done" }).success,
    ).toBe(false);
  });
});
