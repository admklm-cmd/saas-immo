import { afterEach, describe, expect, it, vi } from "vitest";

import type { TypedClient } from "@/lib/agents/types";

import { buildPipelineFunnel, computeFunnel, furthestStageFromActivities } from "./funnel";
import { PIPELINE_FUNNEL_STAGES, type PipelineFunnelStage } from "./types";

/**
 * The conversion funnel, without a database. Exactness against real rows and
 * isolation between agencies: `funnel.integration.test.ts`.
 */

const AGENCY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AT = "2026-10-11T10:30:00.000Z";

afterEach(() => {
  vi.restoreAllMocks();
});

function current(overrides: Partial<Record<PipelineFunnelStage, number>> = {}): Record<PipelineFunnelStage, number> {
  return { nouveau: 0, qualifie: 0, chaud: 0, rdv_planifie: 0, estimation_faite: 0, mandat_signe: 0, ...overrides };
}

describe("computeFunnel", () => {
  it("counts the dossiers that reached AT LEAST each stage, decreasing by construction", () => {
    const funnel = computeFunnel({
      at: AT,
      currentByStage: current({ nouveau: 17, qualifie: 22, chaud: 12, rdv_planifie: 8, estimation_faite: 6, mandat_signe: 5 }),
      lost: [],
    });
    expect(funnel.steps.map((step) => step.reached)).toEqual([70, 53, 31, 19, 11, 5]);
    expect(funnel.total).toBe(70);
    expect(funnel.scope).toEqual({ key: "all_dossiers", at: AT });
    for (let index = 1; index < funnel.steps.length; index += 1) {
      expect(funnel.steps[index]!.reached).toBeLessThanOrEqual(funnel.steps[index - 1]!.reached);
    }
    expect(funnel.steps.map((step) => step.stage)).toEqual([...PIPELINE_FUNNEL_STAGES]);
  });

  it("adds the lost dossiers to every stage they had reached, and reports them apart", () => {
    const funnel = computeFunnel({
      at: AT,
      currentByStage: current({ nouveau: 4, qualifie: 3, mandat_signe: 1 }),
      lost: [
        { furthest: "nouveau", traced: false },
        { furthest: "qualifie", traced: true },
        { furthest: "chaud", traced: true },
        { furthest: "estimation_faite", traced: true },
      ],
    });
    // nouveau: 4+3+1 + 4 lost = 12; qualifie: 3+1 + 3 lost; chaud: 1 + 2; rdv: 1 + 1; estimation: 1 + 1; mandat: 1.
    expect(funnel.steps.map((step) => step.reached)).toEqual([12, 7, 3, 2, 2, 1]);
    expect(funnel.steps.map((step) => step.lostHere)).toEqual([1, 1, 1, 0, 1, 0]);
    expect(funnel.steps.map((step) => step.current)).toEqual([4, 3, 0, 0, 0, 1]);
    expect(funnel.lost).toEqual({ total: 4, untraced: 1 });
    expect(funnel.total).toBe(12);
  });

  it("gives the rate from the previous step and from the start, unrounded", () => {
    const funnel = computeFunnel({
      at: AT,
      currentByStage: current({ nouveau: 1, qualifie: 1, chaud: 1 }),
      lost: [],
    });
    expect(funnel.steps[0]!.rateFromPrevious).toBeNull();
    expect(funnel.steps[1]!.rateFromPrevious).toBeCloseTo(2 / 3, 10);
    expect(funnel.steps[2]!.rateFromPrevious).toBeCloseTo(1 / 2, 10);
    expect(funnel.steps[2]!.rateFromStart).toBeCloseTo(1 / 3, 10);
    // 0 / 1: a measured 0 rate, not a missing one.
    expect(funnel.steps[3]!.rateFromPrevious).toBe(0);
  });

  it("has no rate (null, not NaN, not 0) when the previous step is empty", () => {
    const funnel = computeFunnel({ at: AT, currentByStage: current(), lost: [] });
    expect(funnel.total).toBe(0);
    for (const step of funnel.steps) {
      expect(step.reached).toBe(0);
      expect(step.rateFromPrevious).toBeNull();
      expect(step.rateFromStart).toBeNull();
    }
    expect(funnel.lost).toEqual({ total: 0, untraced: 0 });
  });
});

describe("furthestStageFromActivities", () => {
  it("is nouveau and untraced when the history says nothing", () => {
    expect(furthestStageFromActivities([])).toEqual({ stage: "nouveau", traced: false });
  });

  it("takes the furthest stage named in the stage moves, on either side", () => {
    expect(
      furthestStageFromActivities([
        { type: "ai_qualification_done", payload: { previous_stage: "nouveau", stage: "qualifie" } },
        { type: "ai_qualification_done", payload: { previous_stage: "qualifie", stage: "chaud" } },
      ]),
    ).toEqual({ stage: "chaud", traced: true });
    // A human closing a dossier: the stage it was at is the `previous_stage`.
    expect(
      furthestStageFromActivities([
        { type: "contact_stage_changed", payload: { previous_stage: "estimation_faite", stage: "perdu" } },
      ]),
    ).toEqual({ stage: "estimation_faite", traced: true });
    expect(
      furthestStageFromActivities([
        { type: "ai_follow_through_done", payload: { previous_stage: "rdv_planifie", stage: "estimation_faite" } },
      ]).stage,
    ).toBe("estimation_faite");
  });

  it("reads a confirmed appointment as having reached rdv_planifie", () => {
    expect(furthestStageFromActivities([{ type: "appointment_confirmed", payload: {} }])).toEqual({
      stage: "rdv_planifie",
      traced: true,
    });
  });

  it("ignores other activity types, even if their payload names a stage", () => {
    expect(
      furthestStageFromActivities([{ type: "note_added", payload: { previous_stage: "nouveau", stage: "mandat_signe" } }]),
    ).toEqual({ stage: "nouveau", traced: false });
  });

  it("is not fooled by malformed or hostile payloads", () => {
    const hostile = [
      { type: "ai_qualification_done", payload: null },
      { type: "ai_qualification_done", payload: "mandat_signe" },
      { type: "ai_qualification_done", payload: ["mandat_signe"] },
      { type: "ai_qualification_done", payload: { stage: 5, previous_stage: { toString: "chaud" } } },
      { type: "ai_qualification_done", payload: { stage: "mandat_signe; drop table contacts", previous_stage: "perdu" } },
      { type: "ai_qualification_done", payload: { stage: "__proto__" } },
    ];
    expect(furthestStageFromActivities(hostile)).toEqual({ stage: "nouveau", traced: false });
  });
});

// -----------------------------------------------------------------------------
// The read, with a stub client
// -----------------------------------------------------------------------------

type Answer = { data?: unknown; count?: number | null; error?: { message: string } | null };

function makeClient(config: {
  user?: { id: string } | null;
  counts?: Partial<Record<PipelineFunnelStage, Answer>>;
  lost?: Answer;
  activities?: (contactIds: string[]) => Answer;
}): { client: TypedClient; chunks: string[][] } {
  const chunks: string[][] = [];
  const builder = (table: string) => {
    const filters: Array<[string, string, unknown]> = [];
    let head = false;
    const self: Record<string, unknown> = {};
    self.select = (_columns: string, options?: { head?: boolean }) => {
      head = options?.head === true;
      return self;
    };
    for (const method of ["order", "range"]) self[method] = () => self;
    for (const method of ["eq", "in"]) {
      self[method] = (column: string, value: unknown) => {
        filters.push([method, column, value]);
        return self;
      };
    }
    self.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      let answer: Answer;
      if (table === "contacts" && head) {
        const stage = filters.find(([, column]) => column === "stage")![2] as PipelineFunnelStage;
        answer = config.counts?.[stage] ?? { data: null, count: 0 };
      } else if (table === "contacts") {
        answer = config.lost ?? { data: [] };
      } else {
        const ids = filters.find(([method, column]) => method === "in" && column === "contact_id")![2] as string[];
        chunks.push(ids);
        answer = config.activities?.(ids) ?? { data: [] };
      }
      return Promise.resolve({ data: answer.data ?? null, count: answer.count ?? null, error: answer.error ?? null }).then(
        onFulfilled,
        onRejected,
      );
    };
    return self;
  };
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: config.user === undefined ? { id: "user-1" } : config.user },
        error: config.user === null ? { message: "no session" } : null,
      }),
    },
    from: (table: string) => {
      if (table === "memberships") {
        const self: Record<string, unknown> = {};
        for (const method of ["select", "eq", "order", "limit"]) self[method] = () => self;
        self.maybeSingle = () => Promise.resolve({ data: { agency_id: AGENCY_ID, role: "agent" }, error: null });
        return self;
      }
      return builder(table);
    },
  } as unknown as TypedClient;
  return { client, chunks };
}

describe("buildPipelineFunnel", () => {
  const NOW = new Date(AT);

  it("combines the exact counts with the history of the lost dossiers", async () => {
    const { client } = makeClient({
      counts: { nouveau: { count: 3 }, qualifie: { count: 2 }, mandat_signe: { count: 1 } },
      lost: { data: [{ id: "l1" }, { id: "l2" }, { id: "l3" }] },
      activities: () => ({
        data: [
          { contact_id: "l1", type: "ai_qualification_done", payload: { previous_stage: "nouveau", stage: "qualifie" } },
          { contact_id: "l1", type: "ai_qualification_done", payload: { previous_stage: "qualifie", stage: "chaud" } },
          { contact_id: "l2", type: "appointment_confirmed", payload: {} },
          { contact_id: null, type: "appointment_confirmed", payload: {} },
        ],
      }),
    });
    const result = await buildPipelineFunnel(client, NOW);
    expect(result.error).toBeNull();
    const funnel = result.data!;
    // l1 → chaud, l2 → rdv_planifie, l3 → untraced (nouveau).
    expect(funnel.steps.map((step) => step.reached)).toEqual([9, 5, 3, 2, 1, 1]);
    expect(funnel.lost).toEqual({ total: 3, untraced: 1 });
    expect(funnel.scope).toEqual({ key: "all_dossiers", at: AT });
  });

  it("reads the history of the lost dossiers by chunks of 100", async () => {
    const lost = Array.from({ length: 250 }, (_, index) => ({ id: `lost-${index}` }));
    const { client, chunks } = makeClient({ lost: { data: lost } });
    const result = await buildPipelineFunnel(client, NOW);
    expect(result.error).toBeNull();
    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
    expect(result.data!.lost.total).toBe(250);
    expect(result.data!.steps[0]!.reached).toBe(250);
  });

  it("is an error (no partial funnel) when a count fails, without any technical detail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeClient({ counts: { chaud: { count: null, error: { message: 'relation "secret_internal_table"' } } } });
    const result = await buildPipelineFunnel(client, NOW);
    expect(result.data).toBeNull();
    expect(JSON.stringify(result)).not.toContain("secret_internal_table");
  });

  it("is an error when the exact count is missing from the response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeClient({ counts: { nouveau: { count: null } } });
    expect((await buildPipelineFunnel(client, NOW)).data).toBeNull();
  });

  it("is an error when the history of the lost dossiers cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeClient({
      lost: { data: [{ id: "l1" }] },
      activities: () => ({ data: null, error: { message: "boom" } }),
    });
    expect((await buildPipelineFunnel(client, NOW)).data).toBeNull();
  });

  it("refuses an invalid session", async () => {
    const { client } = makeClient({ user: null });
    const result = await buildPipelineFunnel(client, NOW);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });
});
