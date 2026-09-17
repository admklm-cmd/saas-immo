import { describe, expect, it } from "vitest";

import { AGENCY_TIME_ZONE, parisDayKey, parisDayStart, parisWindowStart } from "./time";

/**
 * Pure tests (no database) of the time windows every AI figure is counted in.
 *
 * These boundaries are not cosmetic: `parisDayStart` is the unit the daily AI
 * volume limit is counted in (and the same instant `private.guard_ai_agent_run`
 * computes in SQL), and `parisWindowStart` is the "7 derniers jours" the Agents
 * IA screen displays. An hour of drift on 1 January or on a DST night would
 * make the screen show a number that is not the number the limit applies to.
 *
 * The expected instants below are written in UTC on purpose: Paris is UTC+1 in
 * winter (CET) and UTC+2 in summer (CEST), so a wrong implementation — one
 * subtracting `n * 24 h` from an instant, or working in UTC — fails here.
 */

describe("AGENCY_TIME_ZONE", () => {
  it("est le fuseau légal de l'agence, jamais celui du serveur", () => {
    expect(AGENCY_TIME_ZONE).toBe("Europe/Paris");
  });
});

describe("parisDayStart", () => {
  it("prend minuit à Paris, pas minuit UTC (heure d'hiver, CET = UTC+1)", () => {
    // 3 janvier 2026, 10:00 UTC = 11:00 à Paris. Le jour parisien a commencé
    // le 2 janvier à 23:00 UTC.
    const start = parisDayStart(new Date("2026-01-03T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-01-02T23:00:00.000Z");
  });

  it("prend minuit à Paris en heure d'été (CEST = UTC+2)", () => {
    const start = parisDayStart(new Date("2026-07-15T08:00:00Z"));
    expect(start.toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("range une exécution de 23h30 UTC dans le jour parisien SUIVANT", () => {
    // 17 septembre 23:30 UTC = 18 septembre 01:30 à Paris : cette exécution
    // compte pour le 18, pas pour le 17.
    const now = new Date("2026-09-17T23:30:00Z");
    const start = parisDayStart(now);
    expect(start.toISOString()).toBe("2026-09-17T22:00:00.000Z");
    expect(now.getTime()).toBeGreaterThanOrEqual(start.getTime());
  });

  it("gère la nuit où l'on passe à l'heure d'été (29 mars 2026, jour de 23 h)", () => {
    // Pendant la journée du 29 : le jour a commencé à 23:00 UTC le 28 (CET).
    expect(parisDayStart(new Date("2026-03-29T12:00:00Z")).toISOString()).toBe(
      "2026-03-28T23:00:00.000Z",
    );
    // Le lendemain, Paris est passé à CEST : minuit vaut 22:00 UTC.
    expect(parisDayStart(new Date("2026-03-30T00:30:00Z")).toISOString()).toBe(
      "2026-03-29T22:00:00.000Z",
    );
  });

  it("gère la nuit où l'on revient à l'heure d'hiver (25 octobre 2026, jour de 25 h)", () => {
    expect(parisDayStart(new Date("2026-10-25T12:00:00Z")).toISOString()).toBe(
      "2026-10-24T22:00:00.000Z",
    );
    expect(parisDayStart(new Date("2026-10-26T01:30:00Z")).toISOString()).toBe(
      "2026-10-25T23:00:00.000Z",
    );
  });
});

describe("parisWindowStart", () => {
  it("sur 1 jour, c'est exactement le début du jour parisien en cours", () => {
    const now = new Date("2026-09-17T21:30:00Z");
    expect(parisWindowStart(1, now).getTime()).toBe(parisDayStart(now).getTime());
  });

  it("sur 7 jours, remonte à minuit du sixième jour précédent (aujourd'hui inclus)", () => {
    // 17 septembre 2026 à Paris ; la fenêtre s'ouvre le 11 septembre à 00:00
    // CEST, soit le 10 septembre à 22:00 UTC.
    const start = parisWindowStart(7, new Date("2026-09-17T21:30:00Z"));
    expect(start.toISOString()).toBe("2026-09-10T22:00:00.000Z");
  });

  it("franchit le changement d'heure sans décalage d'une heure", () => {
    // Fenêtre du 24 au 30 mars 2026 : elle commence en CET (UTC+1) et se
    // termine en CEST (UTC+2). Une soustraction de 6 x 24 h donnerait
    // 2026-03-24T00:00Z, soit 01:00 à Paris — une heure de données perdue.
    const start = parisWindowStart(7, new Date("2026-03-30T00:30:00Z"));
    expect(start.toISOString()).toBe("2026-03-23T23:00:00.000Z");
  });

  it("franchit le retour à l'heure d'hiver sans décalage d'une heure", () => {
    const start = parisWindowStart(7, new Date("2026-10-26T01:30:00Z"));
    expect(start.toISOString()).toBe("2026-10-19T22:00:00.000Z");
  });

  it("franchit un début de mois et un début d'année", () => {
    expect(parisWindowStart(7, new Date("2026-03-01T10:00:00Z")).toISOString()).toBe(
      "2026-02-22T23:00:00.000Z",
    );
    expect(parisWindowStart(7, new Date("2026-01-03T10:00:00Z")).toISOString()).toBe(
      "2025-12-27T23:00:00.000Z",
    );
  });

  it("est toujours antérieure ou égale au début du jour en cours", () => {
    const now = new Date("2026-06-11T04:00:00Z");
    for (const days of [1, 2, 7, 30, 365]) {
      expect(parisWindowStart(days, now).getTime()).toBeLessThanOrEqual(
        parisDayStart(now).getTime(),
      );
    }
  });

  it("refuse une fenêtre qui n'a pas de sens plutôt que d'inventer une borne", () => {
    const now = new Date("2026-06-11T04:00:00Z");
    for (const days of [0, -1, 1.5, Number.NaN]) {
      expect(() => parisWindowStart(days, now)).toThrow(RangeError);
    }
  });
});

describe("parisDayKey", () => {
  it("nomme le jour parisien, pas le jour UTC", () => {
    expect(parisDayKey(new Date("2026-09-17T23:30:00Z"))).toBe("2026-09-18");
    expect(parisDayKey(new Date("2026-01-01T00:30:00Z"))).toBe("2026-01-01");
    expect(parisDayKey(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });
});
