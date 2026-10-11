import { describe, expect, it, vi } from "vitest";

import { databaseErrorCode, failFromDatabase } from "./errors";
import { AGENT_ERROR_MESSAGES } from "./messages";

/**
 * The schema raises stable English codes; the UI must always receive a clear
 * French sentence and never a raw Postgres message.
 */

describe("databaseErrorCode", () => {
  it("traduit les exceptions des garde-fous du schéma", () => {
    const cases = {
      ai_paused: "ai_paused",
      ai_daily_run_limit_reached: "ai_daily_run_limit_reached",
      consent_not_granted: "consent_not_granted",
      first_contact_requires_human_validation: "first_contact_requires_human_validation",
      automatic_follow_up_not_allowed: "automatic_follow_up_not_allowed",
      only_director_can_resume_ai: "only_director_can_resume_ai",
      forbidden: "forbidden",
    } as const;

    for (const [message, expected] of Object.entries(cases)) {
      expect(databaseErrorCode({ message, code: "P0001" }), message).toBe(expected);
    }
  });

  it("traduit les violations RLS et les doublons", () => {
    expect(
      databaseErrorCode({
        message: 'new row violates row-level security policy for table "contacts"',
        code: "42501",
      }),
    ).toBe("forbidden");
    expect(databaseErrorCode({ message: "duplicate key value violates unique constraint", code: "23505" })).toBe(
      "duplicate",
    );
  });

  it("traduit une double réservation refusée par la contrainte d'exclusion", () => {
    expect(
      databaseErrorCode({
        message: 'conflicting key value violates exclusion constraint "appointments_no_overlap"',
        code: "23P01",
      }),
    ).toBe("appointment_slot_taken");
    expect(AGENT_ERROR_MESSAGES.appointment_slot_taken).toContain("créneau");
  });

  it("retombe sur une erreur générique pour tout le reste", () => {
    expect(databaseErrorCode({ message: "connection reset by peer", code: "08006" })).toBe("unexpected_error");
    expect(databaseErrorCode({})).toBe("unexpected_error");
  });
});

describe("failFromDatabase", () => {
  it("renvoie un message français et loge le détail technique côté serveur", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = failFromDatabase("test", { message: "ai_paused", code: "P0001" });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("ai_paused");
    expect(result.error?.message).toBe(AGENT_ERROR_MESSAGES.ai_paused);
    expect(result.error?.message).toContain("coupe-circuit");
    expect(logged).toHaveBeenCalledOnce();
  });

  it("n'expose jamais le message technique au client", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = failFromDatabase("test", {
      message: 'permission denied for table "contacts" (agency 00000000-0000-0000-0000-000000000000)',
      code: "42501",
    });
    expect(result.error?.message).toBe(AGENT_ERROR_MESSAGES.forbidden);
    expect(result.error?.message).not.toContain("00000000");
    expect(result.error?.message).not.toContain("permission denied");
  });
});
