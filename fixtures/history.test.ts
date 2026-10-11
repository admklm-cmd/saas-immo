import { describe, expect, it } from "vitest";

import { computeFunnel, furthestStageFromActivities } from "@/features/pipeline/funnel";
import { PIPELINE_FUNNEL_STAGES, type PipelineFunnelStage } from "@/features/pipeline/types";
import { parisDayKey } from "@/lib/agents/time";

import { buildFixtures, FIXTURE_EXPECTED_COUNTS } from "./dataset";
import { FIXTURE_PHONE_PATTERN } from "./fixture-ids";
import { createRng, HISTORY_PLAN_A, HISTORY_PLAN_B } from "./history";

/**
 * The historical cohort of the fictitious agencies. These tests protect what
 * the dashboard curve and the funnel rely on: a reproducible, plausible and
 * internally consistent history, whatever day the fixtures are loaded.
 */

const NOW = new Date("2026-10-11T10:30:00Z");

/** Fourteen consecutive days plus both clock changes and mid-winter. */
const LOAD_DATES = [
  ...Array.from({ length: 14 }, (_, index) => new Date(Date.UTC(2026, 9, 1 + index, 6 + index, 17))),
  new Date("2026-03-29T08:00:00Z"),
  new Date("2026-10-25T08:00:00Z"),
  new Date("2027-01-15T22:45:00Z"),
  new Date("2026-10-11T00:20:00Z"),
];

describe("createRng", () => {
  it("is reproducible from its seed and different across seeds", () => {
    const sequence = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 8 }, () => rng.next());
    };
    expect(sequence(42)).toEqual(sequence(42));
    expect(sequence(42)).not.toEqual(sequence(43));
    expect(sequence(42).every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("historical cohort", () => {
  const { a, b } = buildFixtures(NOW);

  it("is deterministic: the same date produces exactly the same rows", () => {
    expect(JSON.stringify(buildFixtures(NOW))).toBe(JSON.stringify(buildFixtures(new Date(NOW.getTime()))));
  });

  it("has the volumes the dashboard needs", () => {
    expect(a.contacts).toHaveLength(FIXTURE_EXPECTED_COUNTS.a.contacts);
    expect(b.contacts).toHaveLength(FIXTURE_EXPECTED_COUNTS.b.contacts);
    expect(a.contacts.length).toBeGreaterThanOrEqual(70);
    expect(a.contacts.length).toBeLessThanOrEqual(90);
    expect(b.contacts.length).toBeLessThanOrEqual(15);
    expect(a.contacts.length).toBeGreaterThan(b.contacts.length * 5);
  });

  it("spreads agency A over every stage with a believable funnel (many early, few signed, some lost)", () => {
    const byStage = new Map<string, number>();
    for (const contact of a.contacts) byStage.set(contact.stage!, (byStage.get(contact.stage!) ?? 0) + 1);
    expect(Object.fromEntries(byStage)).toEqual({
      nouveau: 17,
      qualifie: 22,
      chaud: 12,
      rdv_planifie: 8,
      estimation_faite: 6,
      mandat_signe: 5,
      perdu: 14,
    });
    // Strictly more early dossiers than late ones, and no round figure.
    expect(byStage.get("qualifie")!).toBeGreaterThan(byStage.get("chaud")!);
    expect(byStage.get("chaud")!).toBeGreaterThan(byStage.get("rdv_planifie")!);
    expect(byStage.get("rdv_planifie")!).toBeGreaterThan(byStage.get("estimation_faite")!);
    expect(byStage.get("estimation_faite")!).toBeGreaterThan(byStage.get("mandat_signe")!);
  });

  it("derives a decreasing funnel from the recorded history (same rules as the dashboard read)", () => {
    const historyByContact = new Map<string, { type: string; payload: unknown }[]>();
    for (const activity of a.activities) {
      const list = historyByContact.get(activity.contact_id!) ?? [];
      list.push({ type: activity.type, payload: activity.payload });
      historyByContact.set(activity.contact_id!, list);
    }
    const currentByStage = Object.fromEntries(PIPELINE_FUNNEL_STAGES.map((stage) => [stage, 0])) as Record<
      PipelineFunnelStage,
      number
    >;
    const lost: { furthest: PipelineFunnelStage; traced: boolean }[] = [];
    for (const contact of a.contacts) {
      if (contact.stage === "perdu") {
        const { stage, traced } = furthestStageFromActivities(historyByContact.get(contact.id!) ?? []);
        lost.push({ furthest: stage, traced });
      } else {
        currentByStage[contact.stage as PipelineFunnelStage] += 1;
      }
    }
    const funnel = computeFunnel({ at: NOW.toISOString(), currentByStage, lost });
    expect(funnel.steps.map((step) => step.reached)).toEqual([84, 63, 36, 22, 12, 5]);
    for (let index = 1; index < funnel.steps.length; index += 1) {
      expect(funnel.steps[index]!.reached).toBeLessThan(funnel.steps[index - 1]!.reached);
    }
    // Every step rate is a believable conversion, none is 0 or 100 %.
    for (const step of funnel.steps.slice(1)) {
      expect(step.rateFromPrevious!).toBeGreaterThan(0.3);
      expect(step.rateFromPrevious!).toBeLessThan(0.9);
    }
    expect(funnel.lost.total).toBe(14);
  });

  it("is 100 % fictitious: .test e-mails, Arcep phones, simulated history, unique identifiers", () => {
    for (const dataset of [a, b]) {
      for (const contact of dataset.contacts) {
        if (contact.email) expect(contact.email.endsWith("@example.test"), contact.email).toBe(true);
        if (contact.phone) expect(FIXTURE_PHONE_PATTERN.test(contact.phone), contact.phone).toBe(true);
      }
      expect(dataset.activities.every((activity) => activity.is_simulation === true)).toBe(true);
      expect(dataset.appointments.every((appointment) => appointment.is_simulation === true)).toBe(true);
      for (const table of [
        dataset.contacts,
        dataset.properties,
        dataset.consents,
        dataset.activities,
        dataset.appointments,
        dataset.inboundLeads,
      ]) {
        const ids = table.map((row) => row.id!);
        expect(new Set(ids).size).toBe(ids.length);
      }
      const emails = dataset.contacts.map((contact) => contact.email).filter(Boolean);
      expect(new Set(emails).size).toBe(emails.length);
    }
    expect(a.properties.every((property) => String(property.address ?? "").includes("(fictive)") || !property.address)).toBe(true);
  });

  it("never forges what is reserved to a human, and never writes an AI run", () => {
    const types = new Set([...a.activities, ...b.activities].map((activity) => activity.type));
    expect(types.has("contact_stage_changed")).toBe(false);
    expect(types.has("stage_changed")).toBe(false);
    // A signed mandate is a human decision.
    for (const contact of a.contacts.filter((candidate) => candidate.stage === "mandat_signe")) {
      const mandate = a.activities.filter((activity) => activity.contact_id === contact.id && activity.type === "mandate_signed");
      expect(mandate.length, `mandat sans trace humaine : ${contact.id}`).toBeGreaterThanOrEqual(1);
      expect(mandate.every((activity) => activity.actor_type === "user" && activity.actor_user_id)).toBe(true);
    }
    // Run timestamps are stamped by the database: only the 4 + 1 hand-written runs.
    expect(a.aiAgentRuns).toHaveLength(4);
    expect(b.aiAgentRuns).toHaveLength(1);
  });

  it("every agent move carries the payload the application writes", () => {
    const moves = a.activities.filter((activity) => ["ai_qualification_done", "ai_follow_through_done"].includes(activity.type));
    expect(moves.length).toBeGreaterThan(60);
    for (const move of moves) {
      const payload = move.payload as Record<string, unknown>;
      expect(payload.previous_stage).toBeTypeOf("string");
      expect(payload.stage).toBeTypeOf("string");
      expect(move.actor_type).toBe("ai_agent");
      expect(move.actor_agent).toBe(move.type === "ai_qualification_done" ? "hugo" : "sarah");
    }
  });

  it("separates the agencies: agency B stays small and shares no identifier with A", () => {
    const idsA = new Set([...a.contacts, ...a.activities, ...a.inboundLeads, ...a.appointments].map((row) => row.id));
    for (const row of [...b.contacts, ...b.activities, ...b.inboundLeads, ...b.appointments]) {
      expect(idsA.has(row.id)).toBe(false);
    }
    expect(b.appointments).toHaveLength(1);
    expect(HISTORY_PLAN_B.withAppointments).toBe(false);
    expect(HISTORY_PLAN_A.withAppointments).toBe(true);
  });
});

describe.each(LOAD_DATES.map((date) => [date.toISOString(), date] as const))("historical cohort loaded on %s", (_label, now) => {
  const { a, b } = buildFixtures(now);
  const ceiling = now.getTime() + 5 * 60_000;

  it("keeps every contact's identity whichever day the fixtures are loaded (only dates and stage move)", () => {
    const other = buildFixtures(new Date(now.getTime() + 3 * 86_400_000 + 5 * 3_600_000)).a;
    const identity = (contact: { id?: string; first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null; source?: string }) =>
      JSON.stringify([contact.id, contact.first_name, contact.last_name, contact.email, contact.phone, contact.source]);
    expect(other.contacts.map(identity)).toEqual(a.contacts.map(identity));
    expect(other.properties.map((property) => [property.id, property.address, property.city, property.surface_m2])).toEqual(
      a.properties.map((property) => [property.id, property.address, property.city, property.surface_m2]),
    );
  });

  it("always gives the same funnel numbers (84 / 63 / 36 / 22 / 12 / 5), whatever the weekday", () => {
    const stageOf = new Map(a.contacts.map((contact) => [contact.id!, contact.stage!]));
    const history = new Map<string, { type: string; payload: unknown }[]>();
    for (const activity of a.activities) {
      const list = history.get(activity.contact_id!) ?? [];
      list.push({ type: activity.type, payload: activity.payload });
      history.set(activity.contact_id!, list);
    }
    const currentByStage = Object.fromEntries(PIPELINE_FUNNEL_STAGES.map((stage) => [stage, 0])) as Record<PipelineFunnelStage, number>;
    const lost: { furthest: PipelineFunnelStage; traced: boolean }[] = [];
    for (const [id, stage] of stageOf) {
      if (stage === "perdu") {
        const { stage: furthest, traced } = furthestStageFromActivities(history.get(id) ?? []);
        lost.push({ furthest, traced });
      } else {
        currentByStage[stage as PipelineFunnelStage] += 1;
      }
    }
    expect(computeFunnel({ at: now.toISOString(), currentByStage, lost }).steps.map((step) => step.reached)).toEqual([84, 63, 36, 22, 12, 5]);
  });

  it("builds (the plan is feasible whatever the weekday) with the same stages", () => {
    expect(a.contacts).toHaveLength(FIXTURE_EXPECTED_COUNTS.a.contacts);
    expect(b.contacts).toHaveLength(FIXTURE_EXPECTED_COUNTS.b.contacts);
    const nouveau = a.contacts.filter((contact) => contact.stage === "nouveau").length;
    expect(nouveau).toBe(17);
  });

  it("never dates anything in the future (except upcoming appointments)", () => {
    for (const dataset of [a, b]) {
      for (const contact of dataset.contacts) expect(Date.parse(contact.created_at!), contact.id).toBeLessThanOrEqual(now.getTime());
      for (const activity of dataset.activities) expect(Date.parse(activity.occurred_at!), activity.type).toBeLessThanOrEqual(ceiling);
      for (const lead of dataset.inboundLeads) expect(Date.parse(lead.created_at!), lead.id).toBeLessThanOrEqual(now.getTime());
      for (const consent of dataset.consents) expect(Date.parse(consent.recorded_at!), consent.id).toBeLessThanOrEqual(ceiling);
      for (const appointment of dataset.appointments) {
        if (appointment.status === "done" || appointment.status === "cancelled") {
          expect(Date.parse(appointment.starts_at), appointment.id).toBeLessThan(now.getTime());
        }
      }
    }
  });

  it("orders each dossier's story: created, then qualified, then later moves", () => {
    const createdById = new Map(a.contacts.map((contact) => [contact.id!, Date.parse(contact.created_at!)]));
    for (const activity of a.activities) {
      if (!activity.type.startsWith("ai_qualification") && activity.type !== "ai_follow_through_done") continue;
      expect(Date.parse(activity.occurred_at!), activity.id).toBeGreaterThanOrEqual(createdById.get(activity.contact_id!)!);
    }
    for (const contact of a.contacts.filter((candidate) => candidate.stage !== "nouveau" && candidate.stage !== "perdu")) {
      const first = a.activities.filter(
        (activity) =>
          activity.contact_id === contact.id &&
          activity.type === "ai_qualification_done" &&
          (activity.payload as { previous_stage?: string }).previous_stage === "nouveau",
      );
      expect(first.length, `dossier avancé sans qualification : ${contact.id}`).toBe(1);
    }
  });

  it("makes arrivals irregular: busy weekdays, quiet weekends, a few spikes, almost every day of the month non-trivial", () => {
    const perDay = new Map<string, number>();
    for (const contact of a.contacts) {
      const key = parisDayKey(new Date(contact.created_at!));
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    const last30: number[] = [];
    let weekend = 0;
    let weekendDays = 0;
    let weekdays = 0;
    let weekdayDays = 0;
    for (let back = 29; back >= 0; back -= 1) {
      const day = new Date(now.getTime() - back * 86_400_000);
      const key = parisDayKey(day);
      const count = perDay.get(key) ?? 0;
      last30.push(count);
      const dow = new Date(`${key}T12:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) {
        weekend += count;
        weekendDays += 1;
      } else {
        weekdays += count;
        weekdayDays += 1;
      }
    }
    const total = last30.reduce((sum, value) => sum + value, 0);
    expect(total).toBeGreaterThanOrEqual(30);
    expect(total).toBeLessThanOrEqual(70);
    expect(weekdays / weekdayDays).toBeGreaterThan(1.6 * (weekend / weekendDays));
    expect(Math.max(...last30)).toBeGreaterThanOrEqual(4);
    expect(last30.filter((count) => count === 0).length).toBeGreaterThanOrEqual(3);
    expect(last30.filter((count) => count > 0).length).toBeGreaterThanOrEqual(18);
    // Not a flat or round-number series.
    expect(new Set(last30).size).toBeGreaterThanOrEqual(5);
  });

  it("keeps the consent register coherent (grant evidence, withdrawal after grant)", () => {
    const consents = [...a.consents, ...b.consents];
    for (const consent of consents.filter((candidate) => candidate.status === "granted")) {
      expect(consent.presented_text).toBeTruthy();
      expect(consent.text_version).toBeTruthy();
    }
    const grantedAt = new Map<string, number>();
    for (const consent of consents.filter((candidate) => candidate.status === "granted")) {
      const key = `${consent.contact_id}:${consent.channel}`;
      grantedAt.set(key, Math.min(grantedAt.get(key) ?? Infinity, Date.parse(consent.recorded_at!)));
    }
    for (const consent of consents.filter((candidate) => candidate.status === "withdrawn")) {
      const granted = grantedAt.get(`${consent.contact_id}:${consent.channel}`);
      if (granted !== undefined) expect(Date.parse(consent.recorded_at!)).toBeGreaterThanOrEqual(granted);
    }
  });
});
