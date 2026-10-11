import { describe, expect, it } from "vitest";

import { AGENCY_TIME_ZONE } from "@/lib/agents/time";

import {
  computeFreeSlots,
  easterSunday,
  formatSlotLabel,
  frenchPublicHolidays,
  isWorkingDay,
  MAX_PROPOSED_SLOTS,
  parisInstant,
  type BusyInterval,
} from "./slots";

/**
 * The slots are computed by the CODE, never by the AI. This suite is the proof
 * that what the AI is offered is always legal and free: Monday to Friday, no
 * French public holiday, inside the working windows, in Europe/Paris, with no
 * overlap with an existing appointment.
 */

const PARIS_PARTS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: AGENCY_TIME_ZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function paris(iso: string): { date: string; hour: number; minute: number; weekday: string } {
  const parts = PARIS_PARTS.formatToParts(new Date(iso));
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

/** Monday 14 September 2026, 10:00 Paris (08:00 UTC, summer time). */
const MONDAY = new Date("2026-09-14T08:00:00.000Z");

describe("jours fériés français", () => {
  it("calcule le dimanche de Pâques", () => {
    expect(easterSunday(2024)).toEqual({ month: 2, day: 31 }); // 31 mars 2024
    expect(easterSunday(2025)).toEqual({ month: 3, day: 20 }); // 20 avril 2025
    expect(easterSunday(2026)).toEqual({ month: 3, day: 5 }); // 5 avril 2026
    expect(easterSunday(2027)).toEqual({ month: 2, day: 28 }); // 28 mars 2027
  });

  it("liste les 11 jours fériés, fixes et mobiles", () => {
    const holidays = frenchPublicHolidays(2026);
    expect(holidays.size).toBe(11);
    // Fixes
    for (const key of ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"]) {
      expect(holidays.has(key), key).toBe(true);
    }
    // Mobiles 2026 : Pâques le 5 avril.
    expect(holidays.has("04-06")).toBe(true); // lundi de Pâques
    expect(holidays.has("05-14")).toBe(true); // Ascension
    expect(holidays.has("05-25")).toBe(true); // lundi de Pentecôte
  });

  it("reconnaît les jours ouvrés", () => {
    expect(isWorkingDay(2026, 8, 14)).toBe(true); // lundi 14 septembre
    expect(isWorkingDay(2026, 8, 19)).toBe(false); // samedi
    expect(isWorkingDay(2026, 8, 20)).toBe(false); // dimanche
    expect(isWorkingDay(2026, 10, 11)).toBe(false); // 11 novembre, férié
    expect(isWorkingDay(2026, 4, 1)).toBe(false); // 1er mai, férié
  });
});

describe("computeFreeSlots — règles de base", () => {
  it("ne propose que des créneaux ouvrés, aux heures ouvrées, à l'heure de Paris", () => {
    const slots = computeFreeSlots({ now: MONDAY, options: { maxSlots: 40, horizonDays: 21 } });

    expect(slots.length).toBe(40);
    for (const slot of slots) {
      const start = paris(slot.startsAt);
      expect([10, 11, 12, 14, 15, 16, 17]).toContain(start.hour);
      expect(start.minute).toBe(0);
      expect(start.weekday).not.toMatch(/^(sam|dim)/);
      // 60 minutes exactly.
      expect(Date.parse(slot.endsAt) - Date.parse(slot.startsAt)).toBe(3_600_000);
    }
  });

  it("numérote les créneaux et les rend dans l'ordre chronologique", () => {
    const slots = computeFreeSlots({ now: MONDAY });
    expect(slots).toHaveLength(MAX_PROPOSED_SLOTS);
    expect(slots.map((slot) => slot.id)).toEqual(["creneau-1", "creneau-2", "creneau-3", "creneau-4", "creneau-5"]);
    const starts = slots.map((slot) => Date.parse(slot.startsAt));
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("respecte le délai de prévenance : rien avant 24 heures", () => {
    const slots = computeFreeSlots({ now: MONDAY });
    const first = paris(slots[0]!.startsAt);
    // Lundi 10:00 + 24 h => le premier créneau est mardi 10:00.
    expect(first.date).toBe("2026-09-15");
    expect(first.hour).toBe(10);
    expect(Date.parse(slots[0]!.startsAt) - MONDAY.getTime()).toBeGreaterThanOrEqual(24 * 3_600_000);
  });

  it("saute le week-end", () => {
    // Vendredi 18 septembre 2026, 14:00 Paris.
    const friday = new Date("2026-09-18T12:00:00.000Z");
    const slots = computeFreeSlots({ now: friday });
    expect(paris(slots[0]!.startsAt).date).toBe("2026-09-21"); // lundi
    expect(slots.every((slot) => !/^(sam|dim)/.test(paris(slot.startsAt).weekday))).toBe(true);
  });

  it("saute un jour férié", () => {
    // Mardi 10 novembre 2026, 10:00 Paris ; le 11 novembre est férié.
    const beforeArmistice = new Date("2026-11-10T09:00:00.000Z");
    const slots = computeFreeSlots({ now: beforeArmistice, options: { maxSlots: 20 } });
    expect(slots.every((slot) => paris(slot.startsAt).date !== "2026-11-11")).toBe(true);
    expect(paris(slots[0]!.startsAt).date).toBe("2026-11-12");
  });

  it("reste juste au passage à l'heure d'hiver", () => {
    // Le changement d'heure a lieu le dimanche 25 octobre 2026.
    const beforeChange = new Date("2026-10-23T08:00:00.000Z");
    const slots = computeFreeSlots({ now: beforeChange });
    const first = slots[0]!;
    expect(paris(first.startsAt).date).toBe("2026-10-26"); // lundi
    expect(paris(first.startsAt).hour).toBe(10);
    // Heure d'hiver : 10:00 Paris = 09:00 UTC.
    expect(first.startsAt).toBe("2026-10-26T09:00:00.000Z");
  });
});

describe("computeFreeSlots — aucun chevauchement", () => {
  it("exclut un créneau déjà pris", () => {
    const busy: BusyInterval[] = [
      {
        startsAt: parisInstant(2026, 8, 15, 10 * 60).toISOString(),
        endsAt: parisInstant(2026, 8, 15, 11 * 60).toISOString(),
      },
    ];
    const slots = computeFreeSlots({ now: MONDAY, busy });
    const first = paris(slots[0]!.startsAt);
    expect(first.date).toBe("2026-09-15");
    expect(first.hour).toBe(11);
  });

  it("exclut un créneau partiellement chevauché", () => {
    const busy: BusyInterval[] = [
      {
        // 10:30 – 11:30 : mord sur 10:00–11:00 et sur 11:00–12:00.
        startsAt: parisInstant(2026, 8, 15, 10 * 60 + 30).toISOString(),
        endsAt: parisInstant(2026, 8, 15, 11 * 60 + 30).toISOString(),
      },
    ];
    const slots = computeFreeSlots({ now: MONDAY, busy });
    const first = paris(slots[0]!.startsAt);
    expect(first.hour).toBe(12);
  });

  it("accepte un rendez-vous qui se termine pile au début du créneau", () => {
    const busy: BusyInterval[] = [
      {
        startsAt: parisInstant(2026, 8, 15, 9 * 60).toISOString(),
        endsAt: parisInstant(2026, 8, 15, 10 * 60).toISOString(),
      },
    ];
    const slots = computeFreeSlots({ now: MONDAY, busy });
    expect(paris(slots[0]!.startsAt).hour).toBe(10);
  });

  it("passe au jour suivant quand la journée est pleine", () => {
    const busy: BusyInterval[] = [
      {
        startsAt: parisInstant(2026, 8, 15, 8 * 60).toISOString(),
        endsAt: parisInstant(2026, 8, 15, 20 * 60).toISOString(),
      },
    ];
    const slots = computeFreeSlots({ now: MONDAY, busy });
    expect(paris(slots[0]!.startsAt).date).toBe("2026-09-16");
  });

  it("renvoie une liste vide quand tout l'horizon est occupé", () => {
    const busy: BusyInterval[] = [
      {
        startsAt: parisInstant(2026, 8, 14, 0).toISOString(),
        endsAt: parisInstant(2026, 9, 14, 0).toISOString(),
      },
    ];
    expect(computeFreeSlots({ now: MONDAY, busy })).toEqual([]);
  });

  it("ignore un intervalle incohérent au lieu de planter", () => {
    const busy: BusyInterval[] = [
      { startsAt: "pas une date", endsAt: "non plus" },
      { startsAt: parisInstant(2026, 8, 15, 11 * 60).toISOString(), endsAt: parisInstant(2026, 8, 15, 10 * 60).toISOString() },
    ];
    const slots = computeFreeSlots({ now: MONDAY, busy });
    expect(slots.length).toBe(MAX_PROPOSED_SLOTS);
    expect(paris(slots[0]!.startsAt).hour).toBe(10);
  });
});

describe("formatSlotLabel", () => {
  it("écrit le créneau en français, à l'heure de Paris", () => {
    const label = formatSlotLabel("2026-09-15T08:00:00.000Z", "2026-09-15T09:00:00.000Z");
    expect(label).toContain("mardi");
    expect(label).toContain("15 septembre 2026");
    expect(label).toContain("10:00");
    expect(label).toContain("11:00");
    expect(label).toContain("heure de Paris");
  });
});
