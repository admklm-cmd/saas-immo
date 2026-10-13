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
    // Two years of an independent agency: 520 to 620 seller contacts.
    expect(a.contacts.length).toBeGreaterThanOrEqual(520);
    expect(a.contacts.length).toBeLessThanOrEqual(620);
    expect(b.contacts.length).toBeLessThanOrEqual(25);
    expect(a.contacts.length).toBeGreaterThan(b.contacts.length * 10);
  });

  it("spreads agency A over every stage with a believable two years (a recent open pipeline, 35 to 50 mandates, most dossiers closed)", () => {
    const byStage = new Map<string, number>();
    for (const contact of a.contacts) byStage.set(contact.stage!, (byStage.get(contact.stage!) ?? 0) + 1);
    expect(Object.fromEntries(byStage)).toEqual({
      nouveau: 12,
      qualifie: 13,
      chaud: 9,
      rdv_planifie: 6,
      estimation_faite: 6,
      mandat_signe: 42,
      perdu: 459,
    });
    // Mandates: a stock built over the year (not a round figure), not the end of a queue.
    expect(byStage.get("mandat_signe")!).toBeGreaterThanOrEqual(35);
    expect(byStage.get("mandat_signe")!).toBeLessThanOrEqual(50);
    // The pipeline still in progress is small next to what is closed.
    const open = ["nouveau", "qualifie", "chaud", "rdv_planifie", "estimation_faite"].reduce((sum, stage) => sum + (byStage.get(stage) ?? 0), 0);
    expect(open).toBeLessThan(a.contacts.length * 0.2);
    expect(byStage.get("perdu")!).toBeGreaterThan(a.contacts.length * 0.5);
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
    expect(funnel.steps.map((step) => step.reached)).toEqual([547, 349, 211, 128, 77, 42]);
    for (let index = 1; index < funnel.steps.length; index += 1) {
      expect(funnel.steps[index]!.reached).toBeLessThan(funnel.steps[index - 1]!.reached);
    }
    // Every step rate is a believable conversion, none is 0 or 100 %.
    for (const step of funnel.steps.slice(1)) {
      expect(step.rateFromPrevious!).toBeGreaterThan(0.3);
      expect(step.rateFromPrevious!).toBeLessThan(0.9);
    }
    expect(funnel.lost.total).toBe(459);
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

  it("always gives the same funnel numbers (547 / 349 / 211 / 128 / 77 / 42), whatever the weekday", () => {
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
    expect(computeFunnel({ at: now.toISOString(), currentByStage, lost }).steps.map((step) => step.reached)).toEqual([547, 349, 211, 128, 77, 42]);
  });

  it("builds (the plan is feasible whatever the weekday) with the same stages", () => {
    expect(a.contacts).toHaveLength(FIXTURE_EXPECTED_COUNTS.a.contacts);
    expect(b.contacts).toHaveLength(FIXTURE_EXPECTED_COUNTS.b.contacts);
    const nouveau = a.contacts.filter((contact) => contact.stage === "nouveau").length;
    expect(nouveau).toBe(12);
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

  it("makes arrivals irregular: busy weekdays, quiet weekends, spikes, quiet days (read over the last four months)", () => {
    const perDay = new Map<string, number>();
    for (const contact of a.contacts) {
      const key = parisDayKey(new Date(contact.created_at!));
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    const days: number[] = [];
    let weekend = 0;
    let weekendDays = 0;
    let weekdays = 0;
    let weekdayDays = 0;
    for (let back = 119; back >= 0; back -= 1) {
      const day = new Date(now.getTime() - back * 86_400_000);
      const key = parisDayKey(day);
      const count = perDay.get(key) ?? 0;
      days.push(count);
      const dow = new Date(`${key}T12:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) {
        weekend += count;
        weekendDays += 1;
      } else {
        weekdays += count;
        weekdayDays += 1;
      }
    }
    const total = days.reduce((sum, value) => sum + value, 0);
    expect(total).toBeGreaterThanOrEqual(80);
    expect(total).toBeLessThanOrEqual(190);
    expect(weekdays / weekdayDays).toBeGreaterThan(1.6 * (weekend / weekendDays));
    expect(Math.max(...days)).toBeGreaterThanOrEqual(4);
    expect(days.filter((count) => count === 0).length).toBeGreaterThanOrEqual(15);
    expect(days.filter((count) => count > 0).length).toBeGreaterThanOrEqual(50);
    // Not a flat or round-number series.
    expect(new Set(days).size).toBeGreaterThanOrEqual(5);
  });

  it("covers two years, beyond 730 days back, with the contacts of the hand-written core kept", () => {
    const oldest = Math.min(...a.contacts.map((contact) => Date.parse(contact.created_at!)));
    expect((now.getTime() - oldest) / 86_400_000).toBeGreaterThan(735);
    expect(a.contacts.filter((contact) => now.getTime() - Date.parse(contact.created_at!) > 330 * 86_400_000).length).toBeGreaterThan(0);
    // Agency B also has dossiers dated over the year, and one signed mandate.
    expect(b.contacts.length).toBeGreaterThanOrEqual(10);
    expect(b.contacts.filter((contact) => contact.stage === "mandat_signe").length).toBeGreaterThanOrEqual(1);
  });

  it("splits the history in two years: a slightly less active previous year, all closed, with its own mandates", () => {
    const DAY = 86_400_000;
    const ageOf = (iso: string) => (now.getTime() - Date.parse(iso)) / DAY;
    const OPEN = ["nouveau", "qualifie", "chaud", "rdv_planifie", "estimation_faite"];
    const current = a.contacts.filter((contact) => ageOf(contact.created_at!) <= 365);
    const previous = a.contacts.filter((contact) => ageOf(contact.created_at!) > 365 && ageOf(contact.created_at!) <= 730);
    expect(current.length).toBeGreaterThan(previous.length);
    expect(previous.length).toBeGreaterThan(current.length * 0.75);
    expect(previous.length).toBeLessThan(current.length * 0.97);
    // Every dossier older than a year is closed.
    for (const contact of a.contacts.filter((candidate) => ageOf(candidate.created_at!) > 365)) {
      expect(OPEN, contact.id).not.toContain(contact.stage);
    }
    // Mandates by year of signature.
    const signedAges = a.activities.filter((activity) => activity.type === "mandate_signed").map((activity) => ageOf(activity.occurred_at!));
    const signedCurrent = signedAges.filter((age) => age <= 365).length;
    const signedPrevious = signedAges.filter((age) => age > 365 && age <= 730).length;
    expect(signedCurrent).toBeGreaterThanOrEqual(20);
    expect(signedCurrent).toBeLessThanOrEqual(30);
    expect(signedPrevious).toBeGreaterThanOrEqual(15);
    expect(signedPrevious).toBeLessThanOrEqual(22);
    expect(signedPrevious).toBeLessThan(signedCurrent);
    // Open stages are those of the current pipeline only.
    const openTotals = Object.fromEntries(OPEN.map((stage) => [stage, a.contacts.filter((contact) => contact.stage === stage).length]));
    expect(openTotals).toEqual({ nouveau: 12, qualifie: 13, chaud: 9, rdv_planifie: 6, estimation_faite: 6 });
  });

  it("gives agency B closed dossiers over the previous year (one mandate) so the isolation of the annual comparison is tested", () => {
    const ageOf = (iso: string) => (now.getTime() - Date.parse(iso)) / 86_400_000;
    const previous = b.contacts.filter((contact) => ageOf(contact.created_at!) > 365);
    expect(previous.length).toBeGreaterThanOrEqual(3);
    expect(previous.every((contact) => ["perdu", "mandat_signe"].includes(contact.stage!))).toBe(true);
    expect(previous.filter((contact) => contact.stage === "mandat_signe").length).toBeLessThanOrEqual(1);
  });

  it("dates every signed mandate by a human, after the dossier was created and after the agents' steps", () => {
    const createdById = new Map(a.contacts.map((contact) => [contact.id!, Date.parse(contact.created_at!)]));
    const signed = a.contacts.filter((contact) => contact.stage === "mandat_signe");
    for (const contact of signed) {
      const mandate = a.activities.find((activity) => activity.contact_id === contact.id && activity.type === "mandate_signed")!;
      const signedAt = Date.parse(mandate.occurred_at!);
      expect(mandate.actor_type).toBe("user");
      expect(mandate.actor_agent ?? null).toBeNull();
      expect(signedAt).toBeGreaterThan(createdById.get(contact.id!)!);
      for (const activity of a.activities.filter((candidate) => candidate.contact_id === contact.id && candidate.type !== "mandate_signed")) {
        if (activity.type === "consent_withdrawn") continue;
        expect(Date.parse(activity.occurred_at!), `${activity.type} après le mandat`).toBeLessThanOrEqual(signedAt);
      }
    }
  });

  it("keeps the last update of each dossier consistent with its story", () => {
    const lastActivity = new Map<string, number>();
    for (const activity of a.activities) {
      lastActivity.set(activity.contact_id!, Math.max(lastActivity.get(activity.contact_id!) ?? 0, Date.parse(activity.occurred_at!)));
    }
    for (const contact of a.contacts) {
      expect(Date.parse(contact.updated_at!), contact.id).toBeGreaterThanOrEqual(Date.parse(contact.created_at!));
      expect(Date.parse(contact.updated_at!), contact.id).toBeLessThanOrEqual(now.getTime());
    }
    // A lost dossier is dated (its loss date is its last update): never before its last recorded step.
    const historical = a.contacts.slice(FIXTURE_EXPECTED_COUNTS.a.core);
    for (const contact of historical.filter((candidate) => candidate.stage === "perdu")) {
      const last = lastActivity.get(contact.id!);
      if (last !== undefined) expect(Date.parse(contact.updated_at!)).toBeGreaterThanOrEqual(last - 60_000);
    }
  });

  it("puts an open follow-up task on most open dossiers, never on a closed one", () => {
    const stageOf = new Map(a.contacts.map((contact) => [contact.id!, contact.stage!]));
    const historical = a.contacts.slice(FIXTURE_EXPECTED_COUNTS.a.core);
    const historicalTasks = a.tasks.filter((task) => historical.some((contact) => contact.id === task.contact_id));
    expect(historicalTasks.length).toBeGreaterThan(10);
    const open = historical.filter((contact) => ["nouveau", "qualifie", "chaud", "estimation_faite"].includes(contact.stage!));
    expect(historicalTasks.length / open.length).toBeGreaterThan(0.5);
    expect(historicalTasks.length / open.length).toBeLessThan(0.95);
    for (const task of historicalTasks) {
      expect(task.status).toBe("open");
      expect(["mandat_signe", "perdu"]).not.toContain(stageOf.get(task.contact_id!));
    }
    for (const task of a.tasks) expect(task.created_at).toBeTruthy();
    expect(b.tasks.length).toBe(1);
  });

  it("gives the requests a plausible, non-uniform origin and the advisors a plausible share", () => {
    const bySource = new Map<string, number>();
    for (const contact of a.contacts) bySource.set(contact.source!, (bySource.get(contact.source!) ?? 0) + 1);
    const counts = [...bySource.values()].sort((first, second) => second - first);
    expect(bySource.size).toBeGreaterThanOrEqual(7);
    expect(counts[0]!).toBeGreaterThan(counts[counts.length - 1]! * 5);
    expect(bySource.get("estimation_form")!).toBe(counts[0]);
    const byAdvisor = new Map<string | null, number>();
    for (const contact of a.contacts) byAdvisor.set(contact.assigned_user_id ?? null, (byAdvisor.get(contact.assigned_user_id ?? null) ?? 0) + 1);
    const advisors = [...byAdvisor.entries()].filter(([id]) => id !== null).map(([, count]) => count);
    expect(advisors.length).toBe(3);
    for (const count of advisors) expect(count).toBeGreaterThan(a.contacts.length * 0.15);
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

describe("seasonality of the year (fixed load date)", () => {
  const fixed = new Date("2026-10-11T10:30:00Z");
  const { a } = buildFixtures(fixed);
  const perMonth = new Map<string, number>();
  for (const contact of a.contacts) {
    const key = contact.created_at!.slice(0, 7);
    perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
  }

  it("is quiet in August and busy in spring", () => {
    const spring = ["2026-03", "2026-04", "2026-05"].map((key) => perMonth.get(key) ?? 0);
    const springAverage = spring.reduce((sum, value) => sum + value, 0) / spring.length;
    expect(perMonth.get("2026-08")!).toBeLessThan(springAverage * 0.8);
  });

  it("is quiet in August of the previous year too, and busy in its spring", () => {
    const spring = ["2025-03", "2025-04", "2025-05"].map((key) => perMonth.get(key) ?? 0);
    const springAverage = spring.reduce((sum, value) => sum + value, 0) / spring.length;
    expect(perMonth.get("2025-08")!).toBeLessThan(springAverage * 0.6);
    // The previous year is a little quieter than the current one over the same months.
    const sum = (keys: string[]) => keys.reduce((total, key) => total + (perMonth.get(key) ?? 0), 0);
    const months = ["03", "04", "05", "06", "07", "09"];
    expect(sum(months.map((month) => `2025-${month}`))).toBeLessThan(sum(months.map((month) => `2026-${month}`)));
  });

  it("signs mandates across the previous year too (at least eight different months)", () => {
    const months = new Set(
      a.activities
        .filter((activity) => activity.type === "mandate_signed")
        .filter((activity) => (fixed.getTime() - Date.parse(activity.occurred_at!)) / 86_400_000 > 365)
        .map((activity) => activity.occurred_at!.slice(0, 7)),
    );
    expect(months.size).toBeGreaterThanOrEqual(8);
  });

  it("signs mandates across the year (at least nine different months out of twelve)", () => {
    const months = new Set(
      a.activities.filter((activity) => activity.type === "mandate_signed").map((activity) => activity.occurred_at!.slice(0, 7)),
    );
    expect(months.size).toBeGreaterThanOrEqual(9);
  });
});

describe.each(LOAD_DATES.map((date) => [date.toISOString(), date] as const))(
  "Emma's follow-ups and Louis's proposals in the history, loaded on %s",
  (_label, now) => {
    const { a, b } = buildFixtures(now);
    const DAY = 86_400_000;
    const stageOf = new Map(a.contacts.map((contact) => [contact.id!, contact.stage!]));
    const emma = a.activities.filter((activity) => activity.actor_agent === "emma");
    const louis = a.activities.filter((activity) => activity.actor_agent === "louis" && activity.type === "appointment_proposed");
    const humanDecisions = a.activities.filter((activity) =>
      ["message_approved", "message_rejected", "message_edited", "message_sent_simulated"].includes(activity.type),
    );
    const channelOf = (activity: { payload?: unknown }) => (activity.payload as { channel: string }).channel;
    const at = (activity: { occurred_at?: string }) => Date.parse(activity.occurred_at!);
    // Only activities of the history cohort (the hand-written contacts keep their own rows).
    const historical = new Set(a.contacts.slice(FIXTURE_EXPECTED_COUNTS.a.core).map((contact) => contact.id!));
    const generated = (activity: { contact_id?: string | null }) => historical.has(activity.contact_id!);

    it("writes both agents' work as simulated journal entries authored by the agent, and nothing for agency B", () => {
      const drafts = emma.filter((activity) => activity.type === "message_drafted" && generated(activity));
      expect(drafts.length).toBeGreaterThan(100);
      expect(louis.filter(generated).length).toBeGreaterThan(40);
      for (const activity of [...drafts, ...louis.filter(generated)]) {
        expect(activity.actor_type).toBe("ai_agent");
        expect(activity.is_simulation).toBe(true);
        expect(activity.actor_user_id ?? null).toBeNull();
      }
      for (const activity of humanDecisions.filter(generated)) {
        expect(activity.actor_type).toBe("user");
        expect(activity.actor_user_id).toBeTruthy();
        expect(activity.is_simulation).toBe(true);
      }
      expect(b.activities.some((activity) => ["message_drafted", "appointment_proposed"].includes(activity.type))).toBe(false);
    });

    // The chain of one contact, in time order: draft, then edit?, approval and simulated send, or refusal.
    const chains = (() => {
      const rows = [...emma.filter((activity) => activity.type === "message_drafted"), ...humanDecisions]
        .filter(generated)
        .sort((first, second) => at(first) - at(second));
      const byContact = new Map<string, typeof rows>();
      for (const row of rows) byContact.set(row.contact_id!, [...(byContact.get(row.contact_id!) ?? []), row]);
      const result: (typeof rows)[] = [];
      for (const list of byContact.values()) {
        for (const row of list) {
          if (row.type === "message_drafted") result.push([row]);
          else result[result.length - 1]!.push(row);
        }
      }
      return result;
    })();

    it("never writes a row that would feed a queue: no outbound message, and every draft ends decided by a human", () => {
      expect(a.outboundMessages.every((message) => !historical.has(message.contact_id))).toBe(true);
      expect(chains.length).toBeGreaterThan(100);
      const shapes = new Set(chains.map((chain) => chain.map((row) => row.type).join(">")));
      expect([...shapes].sort()).toEqual([
        "message_drafted>message_approved>message_sent_simulated",
        "message_drafted>message_edited>message_approved>message_sent_simulated",
        "message_drafted>message_rejected",
      ]);
      // The three human decisions are all present, in a believable mix.
      const count = (shape: string) => chains.filter((chain) => chain.map((row) => row.type).join(">") === shape).length;
      expect(count("message_drafted>message_rejected")).toBeGreaterThan(chains.length * 0.08);
      expect(count("message_drafted>message_edited>message_approved>message_sent_simulated")).toBeGreaterThan(chains.length * 0.1);
      expect(count("message_drafted>message_approved>message_sent_simulated")).toBeGreaterThan(chains.length * 0.4);
    });

    it("keeps Emma within her rules: never on a signed dossier, one a day, valid consent until the end of the chain", () => {
      const consents = a.consents.filter((consent) => generated(consent));
      const lastDraftByContact = new Map<string, number>();
      for (const chain of chains) {
        const draft = chain[0]!;
        const contactId = draft.contact_id!;
        expect(stageOf.get(contactId), "dossier signé").not.toBe("mandat_signe");
        const previous = lastDraftByContact.get(contactId);
        if (previous !== undefined) expect(at(draft) - previous).toBeGreaterThanOrEqual(3.9 * DAY);
        lastDraftByContact.set(contactId, at(draft));

        const channel = channelOf(draft);
        for (const step of chain) expect(channelOf(step)).toBe(channel);
        const mine = consents.filter((consent) => consent.contact_id === contactId && consent.channel === channel);
        const granted = mine.find((consent) => consent.status === "granted");
        expect(granted, `consentement ${channel}`).toBeDefined();
        expect(Date.parse(granted!.recorded_at!)).toBeLessThan(at(draft));
        const withdrawn = mine.find((consent) => consent.status === "withdrawn");
        if (withdrawn) {
          for (const step of chain) expect(at(step), `${step.type} après retrait`).toBeLessThan(Date.parse(withdrawn.recorded_at!));
        }
      }
    });

    it("orders every human decision after its draft, and nothing after the dossier was lost", () => {
      const lostAt = new Map(a.contacts.filter((contact) => contact.stage === "perdu").map((contact) => [contact.id!, Date.parse(contact.updated_at!)]));
      for (const chain of chains) {
        for (let index = 1; index < chain.length; index += 1) expect(at(chain[index]!)).toBeGreaterThan(at(chain[index - 1]!));
        const lost = lostAt.get(chain[0]!.contact_id!);
        if (lost !== undefined) expect(at(chain[chain.length - 1]!)).toBeLessThanOrEqual(lost + 60_000);
      }
    });

    it("ties each Louis proposal to the dossier's own appointment, before its human confirmation", () => {
      const appointments = new Map(a.appointments.map((appointment) => [appointment.id!, appointment]));
      const confirmations = new Map(
        a.activities.filter((activity) => activity.type === "appointment_confirmed").map((activity) => [activity.contact_id!, at(activity)]),
      );
      const seen = new Set<string>();
      for (const proposal of louis.filter(generated)) {
        const payload = proposal.payload as { appointment_id: string; starts_at: string };
        const appointment = appointments.get(payload.appointment_id);
        expect(appointment, proposal.id).toBeDefined();
        expect(appointment!.contact_id).toBe(proposal.contact_id);
        expect(payload.starts_at).toBe(appointment!.starts_at);
        expect(at(proposal)).toBeLessThan(confirmations.get(proposal.contact_id!)!);
        expect(seen.has(payload.appointment_id)).toBe(false);
        seen.add(payload.appointment_id);
      }
    });

    it("gives Emma and Louis traces over the last 30 days, three months and a year", () => {
      for (const days of [30, 90, 365]) {
        const since = now.getTime() - days * DAY;
        expect(emma.filter((activity) => at(activity) >= since).length, `Emma ${days} j`).toBeGreaterThan(0);
        expect(louis.filter((activity) => at(activity) >= since).length, `Louis ${days} j`).toBeGreaterThan(0);
      }
    });
  },
);
