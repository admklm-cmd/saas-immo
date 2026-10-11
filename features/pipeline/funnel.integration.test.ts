import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { buildPipelineFunnel } from "./funnel";
import type { PipelineFunnel } from "./types";

/**
 * The conversion funnel against the LOCAL Supabase stack, with real sessions
 * (RLS applies). Two fictitious agencies with dossiers at every stage and lost
 * dossiers of known history:
 *   * every step equals the exact count of the dossiers that reached it at
 *     least, lost ones included through their recorded history;
 *   * a lost dossier without history is counted at « nouveau » and reported;
 *   * the steps never increase; the rates are the ratios of the counts;
 *   * agency A never sees B's dossiers or history, and back.
 */

let env: TestEnv;
let directorA: TypedClient;
let userB: TypedClient;

type Stage = "nouveau" | "qualifie" | "chaud" | "rdv_planifie" | "estimation_faite" | "mandat_signe" | "perdu";

async function insertContacts(agencyId: string, stages: Stage[]): Promise<string[]> {
  const { data, error } = await env.admin
    .from("contacts")
    .insert(
      stages.map((stage, index) => ({
        agency_id: agencyId,
        first_name: "Entonnoir",
        last_name: `Test ${index}`,
        source: "manual_entry" as const,
        // A trusted server task without session may create a contact already signed.
        stage,
      })),
    )
    .select("id, stage");
  if (error || !data) throw new Error(`insertContacts: ${error?.message ?? "no rows"}`);
  return data.map((row) => row.id);
}

async function insertHistory(
  agencyId: string,
  rows: Array<{ contactId: string; type: string; previous?: string; stage?: string }>,
): Promise<void> {
  const { error } = await env.admin.from("activities").insert(
    rows.map((row) => ({
      agency_id: agencyId,
      contact_id: row.contactId,
      type: row.type,
      summary: "Historique de test (simulation).",
      payload: row.previous || row.stage ? { previous_stage: row.previous, stage: row.stage } : {},
      actor_type: "ai_agent" as const,
      actor_agent: "hugo" as const,
      is_simulation: true,
    })),
  );
  if (error) throw new Error(`insertHistory: ${error.message}`);
}

async function funnelOf(client: TypedClient): Promise<PipelineFunnel> {
  const result = await buildPipelineFunnel(client);
  if (result.error) throw new Error(`funnel: ${result.error.code}`);
  return result.data;
}

const reached = (funnel: PipelineFunnel) => funnel.steps.map((step) => step.reached);

beforeAll(async () => {
  env = await setupTestEnv();
  directorA = env.users.directorA.client;
  userB = env.users.userB.client;

  // --- Agency A -------------------------------------------------------------------
  // The test setup already holds 2 « nouveau » contacts per agency.
  const a = await insertContacts(env.agencyA.agencyId, [
    "nouveau", "nouveau", "nouveau",
    "qualifie", "qualifie",
    "chaud", "chaud",
    "rdv_planifie",
    "estimation_faite",
    "mandat_signe",
    "perdu", "perdu", "perdu", "perdu",
  ]);
  const [lostAtChaud, lostAtRdv, lostAtEstimation] = [a[10]!, a[11]!, a[12]!];
  await insertHistory(env.agencyA.agencyId, [
    { contactId: lostAtChaud, type: "ai_qualification_done", previous: "nouveau", stage: "qualifie" },
    { contactId: lostAtChaud, type: "ai_qualification_done", previous: "qualifie", stage: "chaud" },
    { contactId: lostAtRdv, type: "appointment_confirmed" },
    { contactId: lostAtEstimation, type: "ai_follow_through_done", previous: "rdv_planifie", stage: "estimation_faite" },
    // a[13]: lost, no history at all.
  ]);

  // --- Agency B: a different shape, with lost dossiers of its own -----------------------
  const b = await insertContacts(env.agencyB.agencyId, ["qualifie", "chaud", "perdu", "perdu"]);
  await insertHistory(env.agencyB.agencyId, [
    { contactId: b[2]!, type: "ai_follow_through_done", previous: "rdv_planifie", stage: "estimation_faite" },
    { contactId: b[2]!, type: "appointment_confirmed" },
    // b[3]: lost, no history.
  ]);
}, 120_000);

afterAll(async () => {
  await env?.cleanup();
});

describe("buildPipelineFunnel (real sessions)", () => {
  it("counts the dossiers that reached at least each stage, lost ones through their history", async () => {
    const funnel = await funnelOf(directorA);
    // current: nouveau 5 (3 + 2 baseline), qualifie 2, chaud 2, rdv 1, estimation 1, mandat 1.
    // lost: chaud, rdv_planifie, estimation_faite, and one without history (nouveau).
    expect(reached(funnel)).toEqual([16, 10, 8, 5, 3, 1]);
    expect(funnel.steps.map((step) => step.current)).toEqual([5, 2, 2, 1, 1, 1]);
    expect(funnel.steps.map((step) => step.lostHere)).toEqual([1, 0, 1, 1, 1, 0]);
    expect(funnel.total).toBe(16);
    expect(funnel.lost).toEqual({ total: 4, untraced: 1 });
    expect(funnel.scope.key).toBe("all_dossiers");
  });

  it("never increases from one step to the next, and the rates are the ratios of the counts", async () => {
    const funnel = await funnelOf(directorA);
    for (let index = 1; index < funnel.steps.length; index += 1) {
      const step = funnel.steps[index]!;
      const previous = funnel.steps[index - 1]!;
      expect(step.reached).toBeLessThanOrEqual(previous.reached);
      expect(step.rateFromPrevious).toBeCloseTo(step.reached / previous.reached, 10);
      expect(step.rateFromStart).toBeCloseTo(step.reached / funnel.total, 10);
    }
    expect(funnel.steps[0]!.rateFromPrevious).toBeNull();
  });

  it("isolates the agencies: B's funnel is built from B's dossiers and B's history only", async () => {
    const funnelB = await funnelOf(userB);
    // current: nouveau 2 (baseline), qualifie 1, chaud 1; lost: estimation_faite (history) and one untraced.
    expect(reached(funnelB)).toEqual([6, 3, 2, 1, 1, 0]);
    expect(funnelB.lost).toEqual({ total: 2, untraced: 1 });
    expect(funnelB.steps[5]!.rateFromPrevious).toBe(0); // measured zero, not missing
    // A's story did not leak into B, nor B's into A.
    expect((await funnelOf(directorA)).lost.total).toBe(4);
    expect(funnelB.total).toBe(6);
  });

  it("refuses a request without session", async () => {
    const result = await buildPipelineFunnel(env.anon);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });
});
