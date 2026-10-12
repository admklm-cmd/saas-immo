import { describe, expect, it } from "vitest";

import {
  buildAgentActivity,
  buildOrigins,
  buildSeriesPoints,
  computeFlow,
  computeWithoutNextAction,
  countSignedIn,
  createdIn,
  firstHandlingDelay,
  latestInstant,
  median,
  rate,
  signedMandates,
  type PilotageActivityRow,
} from "./pilotage-compute";
import { resolvePilotagePeriod } from "./pilotage-periods";

const NOW = new Date("2026-10-12T10:30:00Z");
const PERIOD = resolvePilotagePeriod("30d", NOW);

function activity(partial: Partial<PilotageActivityRow> & { contactId: string | null; type: string }): PilotageActivityRow {
  return {
    actorType: "user",
    actorAgent: null,
    occurredAt: "2026-10-01T10:00:00.000Z",
    stage: null,
    previousStage: null,
    reason: null,
    ...partial,
  };
}

const HUMAN_SIGNATURE = (contactId: string, occurredAt: string) =>
  activity({ contactId, type: "contact_stage_changed", stage: "mandat_signe", previousStage: "estimation_faite", occurredAt });

describe("median", () => {
  it("is null for no value, the middle one for an odd count, the mean of the two middle ones otherwise", () => {
    expect(median([])).toBeNull();
    expect(median([7])).toBe(7);
    expect(median([9, 1, 5])).toBe(5);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("does not mutate its input and ignores non-finite values", () => {
    const input = [3, Number.NaN, 1, Number.POSITIVE_INFINITY, 2];
    expect(median(input)).toBe(2);
    expect(input).toEqual([3, Number.NaN, 1, Number.POSITIVE_INFINITY, 2]);
    expect(median([Number.NaN])).toBeNull();
  });

  it("is not pulled by one extreme value (that is why it is a median)", () => {
    expect(median([10, 12, 15, 20, 100_000])).toBe(15);
  });
});

describe("rate", () => {
  it("keeps numerator and denominator, unrounded", () => {
    expect(rate(3, 41)).toEqual({ numerator: 3, denominator: 41, rate: 3 / 41 });
  });

  it("is null — not 0 — without a denominator", () => {
    expect(rate(0, 0)).toEqual({ numerator: 0, denominator: 0, rate: null });
    expect(rate(5, 0).rate).toBeNull();
  });

  it("is a real 0 when there are requests and no mandate, and can exceed 1", () => {
    expect(rate(0, 12).rate).toBe(0);
    expect(rate(3, 2).rate).toBe(1.5);
  });
});

describe("signedMandates (a human act only)", () => {
  it("counts a stage change to « mandat_signe » by a user and the demo `mandate_signed` entry", () => {
    const signed = signedMandates([
      HUMAN_SIGNATURE("a", "2026-10-02T10:00:00Z"),
      activity({ contactId: "b", type: "mandate_signed", occurredAt: "2026-10-03T10:00:00Z" }),
    ]);
    expect([...signed.keys()].sort()).toEqual(["a", "b"]);
    expect(signed.get("a")).toBe(Date.parse("2026-10-02T10:00:00Z"));
  });

  it("ignores an AI agent or the system pretending to sign (malicious or buggy writer)", () => {
    const signed = signedMandates([
      activity({ contactId: "a", type: "mandate_signed", actorType: "ai_agent", actorAgent: "sarah" }),
      activity({ contactId: "b", type: "contact_stage_changed", stage: "mandat_signe", previousStage: "chaud", actorType: "ai_agent", actorAgent: "hugo" }),
      activity({ contactId: "c", type: "mandate_signed", actorType: "system" }),
    ]);
    expect(signed.size).toBe(0);
  });

  it("ignores other stage changes, a re-entry from the same stage, an invalid date and a missing dossier", () => {
    const signed = signedMandates([
      activity({ contactId: "a", type: "contact_stage_changed", stage: "perdu", previousStage: "chaud" }),
      activity({ contactId: "b", type: "contact_stage_changed", stage: "mandat_signe", previousStage: "mandat_signe" }),
      activity({ contactId: "c", type: "mandate_signed", occurredAt: "pas une date" }),
      activity({ contactId: null, type: "mandate_signed" }),
      activity({ contactId: "d", type: "note_added", stage: "mandat_signe" }),
    ]);
    expect(signed.size).toBe(0);
  });

  it("counts a dossier once, at its first signature", () => {
    const signed = signedMandates([
      HUMAN_SIGNATURE("a", "2026-10-05T10:00:00Z"),
      activity({ contactId: "a", type: "mandate_signed", occurredAt: "2026-10-02T10:00:00Z" }),
      HUMAN_SIGNATURE("a", "2026-10-09T10:00:00Z"),
    ]);
    expect(signed.size).toBe(1);
    expect(signed.get("a")).toBe(Date.parse("2026-10-02T10:00:00Z"));
  });

  it("does not count a mandate a director undid, unless it is signed again (then from the new date)", () => {
    const exit = (contactId: string, occurredAt: string) =>
      activity({ contactId, type: "contact_stage_changed", stage: "chaud", previousStage: "mandat_signe", occurredAt });
    const signed = signedMandates([
      HUMAN_SIGNATURE("undone", "2026-10-02T10:00:00Z"),
      exit("undone", "2026-10-04T10:00:00Z"),
      HUMAN_SIGNATURE("again", "2026-10-02T10:00:00Z"),
      exit("again", "2026-10-03T10:00:00Z"),
      HUMAN_SIGNATURE("again", "2026-10-08T10:00:00Z"),
    ]);
    expect(signed.has("undone")).toBe(false);
    expect(signed.get("again")).toBe(Date.parse("2026-10-08T10:00:00Z"));
  });

  it("does not depend on the order of the rows", () => {
    const rows = [
      activity({ contactId: "a", type: "contact_stage_changed", stage: "chaud", previousStage: "mandat_signe", occurredAt: "2026-10-04T10:00:00Z" }),
      HUMAN_SIGNATURE("a", "2026-10-02T10:00:00Z"),
    ];
    expect(signedMandates(rows).size).toBe(signedMandates([...rows].reverse()).size);
    expect(signedMandates(rows).has("a")).toBe(false);
  });

  it("counts the signatures of each period with half-open boundaries", () => {
    const signed = signedMandates([
      HUMAN_SIGNATURE("in", "2026-10-05T10:00:00Z"),
      HUMAN_SIGNATURE("start", PERIOD.current.startsAt),
      HUMAN_SIGNATURE("end", PERIOD.current.endsAt),
      HUMAN_SIGNATURE("previous", "2026-09-01T10:00:00Z"),
      HUMAN_SIGNATURE("before", "2026-07-01T10:00:00Z"),
    ]);
    expect(countSignedIn(signed, PERIOD.current)).toBe(2); // in + start; the read instant is excluded
    expect(countSignedIn(signed, PERIOD.previous)).toBe(1);
  });
});

describe("series and requests", () => {
  const buckets = PERIOD.currentBuckets;

  it("has every bucket, with real zeros", () => {
    const points = buildSeriesPoints(buckets, [], []);
    expect(points).toHaveLength(30);
    expect(points.every((point) => point.received === 0 && point.signed === 0)).toBe(true);
    expect(points[0]).toMatchObject({ bucketStart: buckets[0]!.bucketStart, partial: false });
    expect(points.at(-1)!.partial).toBe(true);
  });

  it("puts received and signed instants in their Paris day, ignoring those outside or invalid", () => {
    const points = buildSeriesPoints(
      buckets,
      ["2026-10-09T21:59:00Z", "2026-10-09T22:00:00Z", "2026-10-09T23:30:00Z", "2020-01-01T00:00:00Z", "n/a", MONDAY_END()],
      ["2026-10-12T08:00:00Z", "1999-01-01T00:00:00Z"],
    );
    const byDay = new Map(points.map((point) => [point.bucketStart, point]));
    expect(byDay.get("2026-10-09")!.received).toBe(1); // 23:59 Paris
    expect(byDay.get("2026-10-10")!.received).toBe(2); // 00:00 and 01:30 Paris
    expect(byDay.get("2026-10-12")!.signed).toBe(1);
    expect(points.reduce((sum, point) => sum + point.received, 0)).toBe(3);
    expect(points.reduce((sum, point) => sum + point.signed, 0)).toBe(1);
  });

  it("the sum of the points is the number of requests of the period", () => {
    const created = [
      { id: "1", createdAt: "2026-09-20T09:00:00Z" },
      { id: "2", createdAt: "2026-10-05T09:00:00Z" },
      { id: "3", createdAt: "2026-08-20T09:00:00Z" }, // previous period
      { id: "4", createdAt: "2026-06-01T09:00:00Z" }, // before
    ];
    const current = createdIn(created, PERIOD.current);
    const points = buildSeriesPoints(PERIOD.currentBuckets, created.map((c) => c.createdAt), []);
    expect(current).toHaveLength(2);
    expect(points.reduce((sum, point) => sum + point.received, 0)).toBe(current.length);
    expect(createdIn(created, PERIOD.previous).map((c) => c.id)).toEqual(["3"]);
  });

  function MONDAY_END(): string {
    return NOW.toISOString(); // the read instant itself is outside the period
  }
});

describe("origins", () => {
  it("counts by source, most frequent first, ties by name, previous counts alongside", () => {
    const origins = buildOrigins(
      ["estimation_form", "estimation_form", "referral", "inbound_call", "estimation_form", "inbound_call"],
      ["estimation_form", "referral", "referral", "partner_api"],
    );
    expect(origins).toEqual([
      { source: "estimation_form", count: 3, previousCount: 1 },
      { source: "inbound_call", count: 2, previousCount: 0 },
      { source: "referral", count: 1, previousCount: 2 },
      { source: "partner_api", count: 0, previousCount: 1 },
    ]);
  });

  it("is empty, not invented, with no request at all", () => {
    expect(buildOrigins([], [])).toEqual([]);
  });
});

describe("first handling delay", () => {
  const contacts = [
    { id: "a", createdAt: "2026-10-01T10:00:00Z" },
    { id: "b", createdAt: "2026-10-02T10:00:00Z" },
    { id: "c", createdAt: "2026-10-03T10:00:00Z" },
  ];

  it("takes the first agent or user activity that is not the creation of the file", () => {
    const delay = firstHandlingDelay(contacts, [
      activity({ contactId: "a", type: "contact_created_from_lead", actorType: "ai_agent", actorAgent: "lea", occurredAt: "2026-10-01T10:01:00Z" }),
      activity({ contactId: "a", type: "ai_qualification_done", actorType: "ai_agent", actorAgent: "hugo", occurredAt: "2026-10-01T11:30:00Z" }),
      activity({ contactId: "a", type: "appointment_confirmed", occurredAt: "2026-10-04T09:00:00Z" }),
      activity({ contactId: "b", type: "appointment_confirmed", occurredAt: "2026-10-02T12:00:00Z" }),
    ]);
    // a: 90 min (Hugo, not Léa's creation entry), b: 120 min, c: nobody yet.
    expect(delay).toEqual({ medianMinutes: 105, measured: 2, unhandled: 1, created: 3 });
  });

  it("ignores system entries, an entry before the creation, another dossier's and an invalid date", () => {
    const delay = firstHandlingDelay(contacts, [
      activity({ contactId: "a", type: "consent_withdrawn", actorType: "system", occurredAt: "2026-10-01T10:05:00Z" }),
      activity({ contactId: "a", type: "ai_qualification_done", actorType: "ai_agent", actorAgent: "hugo", occurredAt: "2026-10-01T09:00:00Z" }),
      activity({ contactId: "zzz", type: "appointment_confirmed", occurredAt: "2026-10-01T10:10:00Z" }),
      activity({ contactId: "b", type: "appointment_confirmed", occurredAt: "pas une date" }),
      activity({ contactId: null, type: "appointment_confirmed" }),
    ]);
    expect(delay).toEqual({ medianMinutes: null, measured: 0, unhandled: 3, created: 3 });
  });

  it("is not measurable (null, not 0) when no dossier was created", () => {
    expect(firstHandlingDelay([], [])).toEqual({ medianMinutes: null, measured: 0, unhandled: 0, created: 0 });
  });

  it("can be a real 0 minutes when the first handling is at the very second of the creation", () => {
    const delay = firstHandlingDelay([contacts[0]!], [activity({ contactId: "a", type: "appointment_confirmed", occurredAt: "2026-10-01T10:00:00Z" })]);
    expect(delay.medianMinutes).toBe(0);
  });
});

describe("cohort flow", () => {
  const move = (contactId: string, previous: string, stage: string) =>
    activity({ contactId, type: "ai_qualification_done", actorType: "ai_agent", actorAgent: "hugo", previousStage: previous, stage });

  it("counts, for each stage, the dossiers that reached it at least; lost ones through their history", () => {
    const flow = computeFlow(
      [
        { id: "new", stage: "nouveau" },
        { id: "hot", stage: "chaud" },
        { id: "signed", stage: "mandat_signe" },
        { id: "lostHot", stage: "perdu" },
        { id: "lostNoHistory", stage: "perdu" },
      ],
      [move("lostHot", "nouveau", "qualifie"), move("lostHot", "qualifie", "chaud"), move("elsewhere", "nouveau", "chaud")],
    );
    expect(flow.entrants).toBe(5);
    expect(flow.steps.map((step) => [step.stage, step.reached])).toEqual([
      ["nouveau", 5],
      ["qualifie", 3], // hot, signed, lostHot
      ["chaud", 3],
      ["rdv_planifie", 1], // signed
      ["estimation_faite", 1],
      ["mandat_signe", 1],
    ]);
    expect(flow.signed).toBe(1);
    expect(flow.inProgress).toBe(2); // new + hot
    expect(flow.lost.total).toBe(2);
    expect(flow.lost.byFurthestStage).toMatchObject({ nouveau: 1, chaud: 1 });
    expect(flow.lost.untraced).toBe(1);
  });

  it("never increases from one step to the next", () => {
    const flow = computeFlow(
      Array.from({ length: 40 }, (_, index) => ({
        id: `c${index}`,
        stage: (["nouveau", "qualifie", "chaud", "rdv_planifie", "estimation_faite", "mandat_signe", "perdu"] as const)[index % 7]!,
      })),
      [],
    );
    for (let index = 1; index < flow.steps.length; index += 1) {
      expect(flow.steps[index]!.reached).toBeLessThanOrEqual(flow.steps[index - 1]!.reached);
    }
    expect(flow.steps[0]!.reached).toBe(40);
  });

  it("is empty and zero for an empty cohort", () => {
    const flow = computeFlow([], []);
    expect(flow.entrants).toBe(0);
    expect(flow.steps.every((step) => step.reached === 0)).toBe(true);
    expect(flow.inProgress).toBe(0);
  });

  it("reports that no loss reason exists unless a member typed one when moving the dossier to « Perdu »", () => {
    const none = computeFlow([{ id: "a", stage: "perdu" }], [move("a", "nouveau", "qualifie")]);
    expect(none.lost.reasons).toEqual({ available: false, recorded: 0 });

    const withReason = computeFlow(
      [
        { id: "a", stage: "perdu" },
        { id: "b", stage: "perdu" },
        { id: "c", stage: "perdu" },
      ],
      [
        activity({ contactId: "a", type: "contact_stage_changed", stage: "perdu", previousStage: "chaud", reason: "A choisi une autre agence." }),
        activity({ contactId: "b", type: "contact_stage_changed", stage: "perdu", previousStage: "chaud", reason: "   " }),
        // A reason written by an agent is not a member's motive.
        activity({ contactId: "c", type: "contact_stage_changed", stage: "perdu", previousStage: "chaud", reason: "Injection", actorType: "ai_agent" }),
      ],
    );
    expect(withReason.lost.reasons).toEqual({ available: true, recorded: 1 });
  });
});

describe("dossiers without a next action", () => {
  const open = [
    { id: "task", firstName: "Anne", lastName: "Task", stage: "qualifie" as const, updatedAt: "2026-10-01T10:00:00Z" },
    { id: "appt", firstName: "Bob", lastName: "Appt", stage: "rdv_planifie" as const, updatedAt: "2026-10-02T10:00:00Z" },
    { id: "draft", firstName: "Cléo", lastName: "Draft", stage: "chaud" as const, updatedAt: "2026-10-03T10:00:00Z" },
    { id: "alone2", firstName: "Dan", lastName: "Alone", stage: "nouveau" as const, updatedAt: "2026-10-05T10:00:00Z" },
    { id: "alone1", firstName: null, lastName: null, stage: "estimation_faite" as const, updatedAt: "2026-08-05T10:00:00Z" },
  ];
  const input = {
    openContacts: open,
    contactsWithOpenTask: new Set(["task"]),
    contactsWithUpcomingAppointment: new Set(["appt"]),
    contactsWithPendingDraft: new Set(["draft"]),
    noNameLabel: "Contact sans nom",
  };

  it("counts the open dossiers with none of the three, the longest alone first", () => {
    const result = computeWithoutNextAction(input);
    expect(result.count).toBe(2);
    expect(result.openTotal).toBe(5);
    expect(result.sample.map((item) => item.contactId)).toEqual(["alone1", "alone2"]);
    expect(result.sample[0]!.contactName).toBe("Contact sans nom");
    expect(result.sample[1]!.contactName).toBe("Dan Alone");
  });

  it("is a real 0 when every dossier has a next action, and bounds the sample to five", () => {
    expect(
      computeWithoutNextAction({ ...input, contactsWithOpenTask: new Set(open.map((contact) => contact.id)) }).count,
    ).toBe(0);
    const many = Array.from({ length: 12 }, (_, index) => ({
      id: `x${index}`,
      firstName: "X",
      lastName: String(index),
      stage: "nouveau" as const,
      updatedAt: `2026-09-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    const result = computeWithoutNextAction({ ...input, openContacts: many });
    expect(result.count).toBe(12);
    expect(result.sample).toHaveLength(5);
    expect(result.sample[0]!.contactId).toBe("x0");
  });
});

describe("agent activity", () => {
  const range = PERIOD.current;
  const runRow = (agent: string, counts: [number | string, number | string, number | string, number | string, number | string]) => ({
    agent_name: agent as "lea",
    window_total: counts[0],
    window_succeeded: counts[1],
    window_failed: counts[2],
    window_blocked: counts[3],
    window_running: counts[4],
  });

  it("returns the five agents in order, with real zeros for those with no run", () => {
    const result = buildAgentActivity({ runRows: [], activities: [], range, lastActivityAt: {} });
    expect(result.map((entry) => entry.agent)).toEqual(["lea", "hugo", "emma", "louis", "sarah"]);
    expect(result.every((entry) => entry.runs.total === 0 && entry.recordedActions === 0 && entry.lastActivityAt === null)).toBe(true);
  });

  it("reads the counters of the SQL aggregate (bigint may come back as a string) and keeps agents apart", () => {
    const result = buildAgentActivity({
      runRows: [runRow("hugo", ["12", "9", 1, "2", 0]), runRow("emma", [3, 3, 0, 0, 0])],
      activities: [],
      range,
      lastActivityAt: { hugo: "2026-10-11T08:00:00.000Z" },
    });
    expect(result[1]!.runs).toEqual({ total: 12, succeeded: 9, failed: 1, blocked: 2, running: 0 });
    expect(result[2]!.runs.total).toBe(3);
    expect(result[0]!.runs.total).toBe(0);
    expect(result[1]!.lastActivityAt).toBe("2026-10-11T08:00:00.000Z");
  });

  it("counts the history entries authored by each agent in the period — and by agents only", () => {
    const entry = (actorAgent: string | null, actorType: string, occurredAt: string) =>
      activity({ contactId: "x", type: "ai_qualification_done", actorType, actorAgent, occurredAt });
    const result = buildAgentActivity({
      runRows: [],
      activities: [
        entry("hugo", "ai_agent", "2026-10-05T10:00:00Z"),
        entry("hugo", "ai_agent", "2026-10-06T10:00:00Z"),
        entry("hugo", "ai_agent", "2026-06-06T10:00:00Z"), // out of the period
        entry("sarah", "ai_agent", "2026-10-07T10:00:00Z"),
        entry("hugo", "user", "2026-10-07T10:00:00Z"), // a user is not an agent
        entry(null, "ai_agent", "2026-10-07T10:00:00Z"),
      ],
      range,
      lastActivityAt: {},
    });
    expect(result[1]!.recordedActions).toBe(2);
    expect(result[4]!.recordedActions).toBe(1);
    expect(result.reduce((sum, agent) => sum + agent.recordedActions, 0)).toBe(3);
  });

  it("latestInstant picks the later of two instants and tolerates missing or invalid ones", () => {
    expect(latestInstant("2026-10-01T10:00:00Z", "2026-10-02T10:00:00Z")).toBe("2026-10-02T10:00:00.000Z");
    expect(latestInstant(null, "2026-10-02T10:00:00Z")).toBe("2026-10-02T10:00:00.000Z");
    expect(latestInstant(undefined, null)).toBeNull();
    expect(latestInstant("n/a", "2026-10-02T10:00:00Z")).toBe("2026-10-02T10:00:00.000Z");
  });
});
