import { describe, expect, it } from "vitest";

import type { AiProvider } from "@/lib/claude/provider";
import { ok } from "@/lib/utils/result";

import {
  ELIGIBILITY_BLOCKING_CODES,
  runStatusForRefusal,
  startGuardedRun,
  type RunRefusal,
} from "./runner";
import type { AgentContext, TypedClient } from "./types";

/**
 * Classification of refusals: a rule doing its job (`blocked`) is not an error
 * (`failed`). The « Erreurs » figures of the dashboard and of « Agents IA » are
 * computed from `failed` runs only, so a refused eligibility must never be
 * journaled as `failed`.
 */

const AGENCY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONTACT_ID = "11111111-1111-4111-8111-111111111111";
const context: AgentContext = { userId: "22222222-2222-4222-8222-222222222222", agencyId: AGENCY_ID, role: "agent" };

const provider = { name: "simulator", model: "simulator-v1", isSimulation: true } as unknown as AiProvider;

type Insert = { table: string; row: Record<string, unknown> };
type Update = { table: string; values: Record<string, unknown> };

/** Chainable stub: every query resolves to the configured result of its table. */
function stubClient(options: { humanTakeover?: boolean; aiPaused?: boolean } = {}) {
  const inserts: Insert[] = [];
  const updates: Update[] = [];
  const results: Record<string, unknown> = {
    contacts: {
      data: {
        id: CONTACT_ID,
        agency_id: AGENCY_ID,
        stage: "mandat_signe",
        human_takeover: options.humanTakeover ?? false,
        assigned_user_id: null,
      },
      error: null,
    },
    agencies: {
      data: { id: AGENCY_ID, name: "Agence test", ai_paused: options.aiPaused ?? false, ai_daily_run_limit: 100 },
      error: null,
    },
    ai_agent_runs: { data: null, error: null, count: 0 },
  };

  const client = {
    from(table: string) {
      let inserted: Record<string, unknown> | null = null;
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "gte", "lte", "in", "order", "limit"]) {
        builder[method] = () => builder;
      }
      builder.update = (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return builder;
      };
      builder.insert = (row: Record<string, unknown>) => {
        inserted = row;
        inserts.push({ table, row });
        return builder;
      };
      const resolve = () =>
        inserted
          ? { data: { id: `${table}-${inserts.length}` }, error: null }
          : (results[table] ?? { data: null, error: null });
      builder.maybeSingle = async () => resolve();
      builder.single = async () => resolve();
      builder.then = (onFulfilled: (value: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled);
      return builder;
    },
  } as unknown as TypedClient;

  return { client, inserts, updates };
}

const refusal: RunRefusal = {
  code: "follow_up_stage_not_eligible",
  decision: "Contact non éligible à une relance automatique : aucun brouillon n'a été préparé.",
  detail: { contact_stage: "mandat_signe" },
};

describe("runStatusForRefusal", () => {
  it("classe les refus d'éligibilité et les garde-fous en « bloqué »", () => {
    for (const code of [...ELIGIBILITY_BLOCKING_CODES, "ai_paused", "ai_daily_run_limit_reached", "human_takeover"] as const) {
      expect(runStatusForRefusal(code), code).toBe("blocked");
    }
  });

  it("garde les vraies erreurs en « échec »", () => {
    for (const code of ["ai_response_invalid", "unexpected_error", "duplicate"] as const) {
      expect(runStatusForRefusal(code), code).toBe("failed");
    }
  });

  it("couvre exactement les refus d'éligibilité d'Emma, de Louis et de Sarah", () => {
    expect([...ELIGIBILITY_BLOCKING_CODES].sort()).toEqual(
      [
        "appointment_already_scheduled",
        "appointment_no_available_slot",
        "appointment_no_reachable_channel",
        "appointment_report_missing",
        "appointment_stage_not_ready",
        "consent_not_granted",
        "follow_up_already_drafted",
        "follow_up_already_prepared_today",
        "follow_up_contact_lost",
        "follow_up_mandate_signed",
        "follow_up_no_reachable_channel",
        "follow_up_stage_not_eligible",
      ].sort(),
    );
  });

  it("le consentement manquant est un garde-fou (« bloqué »), pas une erreur", () => {
    expect(runStatusForRefusal("consent_not_granted")).toBe("blocked");
    expect(runStatusForRefusal("follow_up_no_reachable_channel")).toBe("blocked");
  });

  it("Louis sans coordonnées ou sans créneau, Sarah sans compte-rendu : « bloqué », pas une erreur", () => {
    // Decided before the run opens (precheck): a task for a human, no
    // AI-authored activity, so nothing requires a `running` run any more.
    for (const code of [
      "appointment_no_reachable_channel",
      "appointment_no_available_slot",
      "appointment_report_missing",
    ] as const) {
      expect(runStatusForRefusal(code), code).toBe("blocked");
    }
  });

  it("une course découverte après l'ouverture du run reste une erreur (« échec »)", () => {
    expect(runStatusForRefusal("appointment_slot_taken")).toBe("failed");
  });
});

describe("startGuardedRun — precheck d'éligibilité", () => {
  it("un refus ouvre une exécution « blocked », jamais « running » ni « failed »", async () => {
    const { client, inserts } = stubClient();
    const result = await startGuardedRun(client, context, {
      agent: "emma",
      contactId: CONTACT_ID,
      input: { task: "test" },
      provider,
      precheck: async () => ok(refusal),
    });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("follow_up_stage_not_eligible");

    const runs = inserts.filter((insert) => insert.table === "ai_agent_runs");
    expect(runs).toHaveLength(1);
    expect(runs[0]!.row).toMatchObject({
      status: "blocked",
      error: "follow_up_stage_not_eligible",
      decision: refusal.decision,
      contact_id: CONTACT_ID,
    });

    const steps = inserts.filter((insert) => insert.table === "ai_agent_run_steps").map((insert) => insert.row);
    expect(steps.map((step) => [step.phase, step.status])).toEqual([
      ["guardrails", "ok"],
      ["decision", "blocked"],
    ]);
    expect(steps[1]!.detail).toMatchObject({ error_code: "follow_up_stage_not_eligible", run_status: "blocked" });
  });

  it("le coupe-circuit et la reprise humaine passent avant l'éligibilité", async () => {
    for (const [options, code] of [
      [{ aiPaused: true }, "ai_paused"],
      [{ humanTakeover: true }, "human_takeover"],
    ] as const) {
      const { client, inserts } = stubClient(options);
      let prechecked = false;
      const result = await startGuardedRun(client, context, {
        agent: "emma",
        contactId: CONTACT_ID,
        input: {},
        provider,
        precheck: async () => {
          prechecked = true;
          return ok(refusal);
        },
      });
      expect(result.error?.code).toBe(code);
      expect(prechecked).toBe(false);
      expect(inserts.find((insert) => insert.table === "ai_agent_runs")!.row.status).toBe("blocked");
    }
  });

  it("sans refus, l'exécution s'ouvre normalement en « running »", async () => {
    const { client, inserts } = stubClient();
    const result = await startGuardedRun(client, context, {
      agent: "emma",
      contactId: CONTACT_ID,
      input: {},
      provider,
      precheck: async () => ok(null),
    });
    expect(result.error).toBeNull();
    expect(inserts.find((insert) => insert.table === "ai_agent_runs")!.row.status).toBe("running");
  });

  it("une lecture impossible pendant le precheck est une erreur technique : exécution « failed », comptée comme telle", async () => {
    const { client, inserts, updates } = stubClient();
    const result = await startGuardedRun(client, context, {
      agent: "emma",
      contactId: CONTACT_ID,
      input: {},
      provider,
      precheck: async () => ({ data: null, error: { code: "unexpected_error", message: "x" } }),
    });
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("unexpected_error");

    const runs = inserts.filter((insert) => insert.table === "ai_agent_runs");
    expect(runs).toHaveLength(1);
    expect(runs[0]!.row.status).toBe("running");
    const closed = updates.filter((update) => update.table === "ai_agent_runs");
    expect(closed).toHaveLength(1);
    expect(closed[0]!.values).toMatchObject({ status: "failed", error: "unexpected_error" });
    const steps = inserts.filter((insert) => insert.table === "ai_agent_run_steps").map((insert) => insert.row);
    expect(steps.map((step) => [step.phase, step.status])).toEqual([
      ["guardrails", "ok"],
      ["context_loaded", "failed"],
    ]);
  });

  it("afterBlock reçoit l'identifiant de l'exécution bloquée ; son échec ne remplace pas le motif", async () => {
    const { client } = stubClient();
    const seen: (string | null)[] = [];
    const result = await startGuardedRun(client, context, {
      agent: "emma",
      contactId: CONTACT_ID,
      input: {},
      provider,
      precheck: async () =>
        ok({
          code: "consent_not_granted",
          decision: "Aucun consentement valide.",
          afterBlock: async (runId) => {
            seen.push(runId);
            throw new Error("task write failed");
          },
        }),
    });
    expect(result.error?.code).toBe("consent_not_granted");
    expect(seen).toEqual(["ai_agent_runs-1"]);
  });
});
