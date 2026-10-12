import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { buildPipelineBoard } from "./board";
import type { PipelineBoard } from "./types";

/**
 * The bounded pipeline board against the LOCAL Supabase stack, real sessions.
 * A year of history means hundreds of closed dossiers: each column must carry
 * its EXACT total with a capped list of cards, never a total deduced from the
 * length of a cut list.
 */

const LOST = 130;
const SIGNED = 40;
const HOT = 7;

let env: TestEnv;
let directorA: TypedClient;
let userB: TypedClient;
let baseline: PipelineBoard;

async function insert(agencyId: string, stage: string, count: number, label: string): Promise<void> {
  const { error } = await env.admin.from("contacts").insert(
    Array.from({ length: count }, (_, index) => ({
      agency_id: agencyId,
      first_name: label,
      last_name: `N${String(index).padStart(3, "0")}`,
      source: "manual_entry" as const,
      stage: stage as "perdu",
      created_at: new Date(Date.now() - (index + 10) * 3_600_000).toISOString(),
      // The higher the index, the more recently touched: the most recent must come first.
      updated_at: new Date(Date.now() - (count - index + 1) * 60_000).toISOString(),
    })),
  );
  if (error) throw new Error(`insert ${stage}: ${error.message}`);
}

function column(board: PipelineBoard, stage: string) {
  const found = board.columns.find((candidate) => candidate.stage === stage);
  if (!found) throw new Error(`no column ${stage}`);
  return found;
}

beforeAll(async () => {
  env = await setupTestEnv();
  directorA = env.users.directorA.client;
  userB = env.users.userB.client;
  const board = await buildPipelineBoard(directorA);
  baseline = board.data!;
  await insert(env.agencyA.agencyId, "perdu", LOST, "Perdu");
  await insert(env.agencyA.agencyId, "mandat_signe", SIGNED, "Signé");
  await insert(env.agencyA.agencyId, "chaud", HOT, "Chaud");
  await insert(env.agencyB.agencyId, "perdu", 3, "BPerdu");
}, 120_000);

afterAll(async () => {
  await env?.cleanup();
});

describe("buildPipelineBoard (real session)", () => {
  it("has one column per stage, in order, perdu last", async () => {
    const { data } = await buildPipelineBoard(directorA);
    expect(data!.columns.map((entry) => entry.stage)).toEqual([
      "nouveau",
      "qualifie",
      "chaud",
      "rdv_planifie",
      "estimation_faite",
      "mandat_signe",
      "perdu",
    ]);
  });

  it("gives the exact total of each closed column but at most 12 cards by default", async () => {
    const { data } = await buildPipelineBoard(directorA);
    const lost = column(data!, "perdu");
    const signed = column(data!, "mandat_signe");
    expect(lost.total).toBe(column(baseline, "perdu").total + LOST);
    expect(signed.total).toBe(column(baseline, "mandat_signe").total + SIGNED);
    expect(lost.items).toHaveLength(12);
    expect(signed.items).toHaveLength(12);
    expect(lost.limit).toBe(12);
    expect(lost.hasMore).toBe(true);
    expect(lost.order).toBe("updated_desc");
    // The grand total is the sum of the exact totals.
    expect(data!.totalContacts).toBe(data!.columns.reduce((sum, entry) => sum + entry.total, 0));
  });

  it("lists the most recently touched closed dossiers first", async () => {
    const { data } = await buildPipelineBoard(directorA);
    const names = column(data!, "perdu").items.map((item) => item.lastName);
    expect(names.slice(0, 3)).toEqual(["N129", "N128", "N127"]);
  });

  it("honours closedLimit (1 to 100) and reports hasMore only when something is cut", async () => {
    const one = column((await buildPipelineBoard(directorA, { closedLimit: 1 })).data!, "mandat_signe");
    expect(one.items).toHaveLength(1);
    expect(one.hasMore).toBe(true);
    const all = column((await buildPipelineBoard(directorA, { closedLimit: 100 })).data!, "mandat_signe");
    expect(all.items).toHaveLength(Math.min(100, column(baseline, "mandat_signe").total + SIGNED));
    expect(all.hasMore).toBe(all.total > all.items.length);
    const lost = column((await buildPipelineBoard(directorA, { closedLimit: 100 })).data!, "perdu");
    expect(lost.items).toHaveLength(100);
    expect(lost.hasMore).toBe(true);
  });

  it("shows every open dossier (not cut) with its own card", async () => {
    const { data } = await buildPipelineBoard(directorA);
    const hot = column(data!, "chaud");
    expect(hot.total).toBe(column(baseline, "chaud").total + HOT);
    expect(hot.items).toHaveLength(hot.total);
    expect(hot.hasMore).toBe(false);
    expect(hot.order).toBe("created_desc");
    expect(hot.items.every((item) => item.stage === "chaud")).toBe(true);
  });

  it("refuses a closedLimit outside 1..100 or of the wrong type, before any read", async () => {
    for (const bad of [0, 101, -3, 2.5, "12", null, Number.NaN]) {
      const result = await buildPipelineBoard(directorA, { closedLimit: bad as number });
      expect(result.data, String(bad)).toBeNull();
      expect(result.error?.code).toBe("stage_invalid_input");
    }
    const unknownKey = await buildPipelineBoard(directorA, { limit: 5 } as never);
    expect(unknownKey.data).toBeNull();
  });

  it("isolates the agencies", async () => {
    const forB = (await buildPipelineBoard(userB)).data!;
    expect(column(forB, "perdu").total).toBe(3);
    expect(forB.columns.flatMap((entry) => entry.items).some((item) => item.firstName === "Perdu")).toBe(false);
    const forA = (await buildPipelineBoard(directorA)).data!;
    expect(forA.columns.flatMap((entry) => entry.items).some((item) => item.firstName === "BPerdu")).toBe(false);
  });

  it("refuses a request without session", async () => {
    const result = await buildPipelineBoard(env.anon);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });
});
