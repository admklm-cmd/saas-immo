import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PipelineStage } from "@/lib/agents/types";
import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";
import type { Database } from "@/types/database";

/**
 * SEC-007 — every change of `contacts.stage` goes through an audited path.
 *
 * Against the LOCAL Supabase stack, with real sessions (RLS applies):
 *   * a direct `UPDATE contacts SET stage = …` from an authenticated session
 *     is refused for EVERY pair of stages, by an agent and by a director, and
 *     the stage is left untouched;
 *   * other columns of a contact can still be updated directly;
 *   * the agent path (`apply_agent_stage_change`) only accepts the documented
 *     transitions of Hugo and Sarah, bound to a RUNNING run of that agent for
 *     that contact, started by the caller, with the kill switch off and no
 *     human takeover — and it is an optimistic lock on the expected stage.
 *
 * The human path (`change_contact_stage`) is covered by
 * `stage-change.integration.test.ts`, the appointment confirmation by the
 * appointments suite: both must keep passing unchanged.
 */

type AgentName = Database["public"]["Enums"]["ai_agent_name"];

const ALL_STAGES: readonly PipelineStage[] = [
  "nouveau",
  "qualifie",
  "chaud",
  "rdv_planifie",
  "estimation_faite",
  "mandat_signe",
  "perdu",
];

let env: TestEnv;
let directorA: TypedClient;
let agentA: TypedClient;
let userB: TypedClient;

async function createContact(label: string, stage: PipelineStage = "nouveau"): Promise<string> {
  const inserted = await env.admin
    .from("contacts")
    .insert({ agency_id: env.agencyA.agencyId, first_name: "Étape", last_name: label, source: "manual_entry", stage })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "contact missing");
  return inserted.data.id;
}

async function stageOf(contactId: string): Promise<PipelineStage> {
  const row = await env.admin.from("contacts").select("stage").eq("id", contactId).single();
  if (row.error || !row.data) throw new Error(row.error?.message ?? "contact missing");
  return row.data.stage;
}

/** Starts a run exactly like `lib/agents/runner.ts` does: with the caller's own session. */
async function startRun(client: TypedClient, agent: AgentName, contactId: string): Promise<string> {
  const inserted = await client
    .from("ai_agent_runs")
    .insert({ agency_id: env.agencyA.agencyId, agent, contact_id: contactId })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "run missing");
  return inserted.data.id;
}

function applyAgentStage(
  client: TypedClient,
  args: { contactId: string; runId: string; expected: PipelineStage; next: PipelineStage },
) {
  return client.rpc("apply_agent_stage_change", {
    target_contact: args.contactId,
    agent_run: args.runId,
    expected_stage: args.expected,
    new_stage: args.next,
  });
}

beforeAll(async () => {
  env = await setupTestEnv();
  directorA = env.users.directorA.client;
  agentA = env.users.agentA.client;
  userB = env.users.userB.client;
}, 120_000);

afterAll(async () => {
  if (env) {
    await env.admin.from("agencies").update({ ai_paused: false }).eq("id", env.agencyA.agencyId);
    await env.cleanup();
  }
});

describe("UPDATE direct de contacts.stage (SEC-007)", () => {
  it("refusé pour toutes les paires d'étapes, par un agent comme par un directeur", async () => {
    const accepted: string[] = [];
    for (const from of ALL_STAGES) {
      const contactId = await createContact(`direct-${from}`, from);
      for (const to of ALL_STAGES) {
        if (to === from) continue;
        for (const [label, client] of [
          ["agent", agentA],
          ["directeur", directorA],
        ] as const) {
          const direct = await client.from("contacts").update({ stage: to }).eq("id", contactId).select("stage");
          if (!direct.error) accepted.push(`${label}: ${from} -> ${to}`);
          else expect(direct.error.code).toBe("42501");
        }
      }
      expect(await stageOf(contactId)).toBe(from);
    }
    expect(accepted).toEqual([]);
  });

  it("le message d'erreur nomme la RPC obligatoire (hors mandat signé)", async () => {
    const contactId = await createContact("message", "nouveau");
    const direct = await agentA.from("contacts").update({ stage: "qualifie" }).eq("id", contactId);
    expect(direct.error?.message).toBe("stage_change_requires_rpc");
  });

  it("les autres colonnes restent modifiables directement, et réécrire la même étape n'est pas un changement", async () => {
    const contactId = await createContact("autres-colonnes", "chaud");
    const notes = await agentA.from("contacts").update({ notes: "Rappeler après 18h." }).eq("id", contactId);
    expect(notes.error).toBeNull();
    const same = await agentA.from("contacts").update({ stage: "chaud", notes: "Idem." }).eq("id", contactId);
    expect(same.error).toBeNull();
    expect(await stageOf(contactId)).toBe("chaud");
  });

  it("un membre d'une autre agence ne modifie rien (RLS)", async () => {
    const contactId = await createContact("autre-agence", "nouveau");
    const direct = await userB.from("contacts").update({ stage: "qualifie" }).eq("id", contactId).select("id");
    expect(direct.data ?? []).toEqual([]);
    expect(await stageOf(contactId)).toBe("nouveau");
  });
});

describe("apply_agent_stage_change — chemin des agents IA", () => {
  it("Hugo : nouveau -> qualifié, nouveau -> chaud, qualifié -> chaud acceptés", async () => {
    for (const [from, to] of [
      ["nouveau", "qualifie"],
      ["nouveau", "chaud"],
      ["qualifie", "chaud"],
    ] as const) {
      const contactId = await createContact(`hugo-${from}-${to}`, from);
      const runId = await startRun(agentA, "hugo", contactId);
      const result = await applyAgentStage(agentA, { contactId, runId, expected: from, next: to });
      expect(result.error).toBeNull();
      expect(result.data).toBe(true);
      expect(await stageOf(contactId)).toBe(to);
    }
  });

  it("Sarah : qualifié / chaud / rdv planifié -> estimation faite acceptés", async () => {
    for (const from of ["qualifie", "chaud", "rdv_planifie"] as const) {
      const contactId = await createContact(`sarah-${from}`, from);
      const runId = await startRun(agentA, "sarah", contactId);
      const result = await applyAgentStage(agentA, { contactId, runId, expected: from, next: "estimation_faite" });
      expect(result.error).toBeNull();
      expect(result.data).toBe(true);
      expect(await stageOf(contactId)).toBe("estimation_faite");
    }
  });

  it("toute autre transition est refusée, quel que soit l'agent (mandat signé et perdu compris)", async () => {
    const cases: [AgentName, PipelineStage, PipelineStage][] = [
      ["hugo", "nouveau", "rdv_planifie"],
      ["hugo", "chaud", "qualifie"],
      ["hugo", "estimation_faite", "mandat_signe"],
      ["hugo", "nouveau", "perdu"],
      ["sarah", "estimation_faite", "mandat_signe"],
      ["sarah", "rdv_planifie", "perdu"],
      ["sarah", "nouveau", "estimation_faite"],
      ["emma", "nouveau", "qualifie"],
      ["louis", "chaud", "rdv_planifie"],
      ["lea", "nouveau", "qualifie"],
    ];
    for (const [agent, from, to] of cases) {
      const contactId = await createContact(`refus-${agent}-${from}-${to}`, from);
      const runId = await startRun(agentA, agent, contactId);
      const result = await applyAgentStage(agentA, { contactId, runId, expected: from, next: to });
      expect(result.error?.message, `${agent} ${from} -> ${to}`).toBe("agent_stage_transition_forbidden");
      expect(await stageOf(contactId)).toBe(from);
    }
  });

  it("refusé sans exécution en cours valide : inconnue, d'un autre contact, terminée ou lancée par un autre membre", async () => {
    const contactId = await createContact("run-invalide", "nouveau");
    const otherContact = await createContact("run-autre-contact", "nouveau");

    const unknown = await applyAgentStage(agentA, {
      contactId,
      runId: "00000000-0000-4000-8000-000000000000",
      expected: "nouveau",
      next: "qualifie",
    });
    expect(unknown.error?.message).toBe("agent_run_invalid");

    const otherRun = await startRun(agentA, "hugo", otherContact);
    const wrongContact = await applyAgentStage(agentA, { contactId, runId: otherRun, expected: "nouveau", next: "qualifie" });
    expect(wrongContact.error?.message).toBe("agent_run_invalid");

    const finishedRun = await startRun(agentA, "hugo", contactId);
    const finished = await agentA
      .from("ai_agent_runs")
      .update({ status: "succeeded", finished_at: new Date().toISOString(), decision: "Test." })
      .eq("id", finishedRun);
    expect(finished.error).toBeNull();
    const afterFinish = await applyAgentStage(agentA, { contactId, runId: finishedRun, expected: "nouveau", next: "qualifie" });
    expect(afterFinish.error?.message).toBe("agent_run_invalid");

    const directorRun = await startRun(directorA, "hugo", contactId);
    const byOther = await applyAgentStage(agentA, { contactId, runId: directorRun, expected: "nouveau", next: "qualifie" });
    expect(byOther.error?.message).toBe("agent_run_invalid");

    const fromOtherAgency = await applyAgentStage(userB, { contactId, runId: directorRun, expected: "nouveau", next: "qualifie" });
    expect(fromOtherAgency.error?.message).toBe("agent_run_invalid");

    expect(await stageOf(contactId)).toBe("nouveau");
  });

  it("isolation : un membre de l'agence B, avec sa propre exécution en cours, ne déplace pas un contact de l'agence A", async () => {
    const contactA = await createContact("cible-agence-a", "nouveau");
    const insertedB = await env.admin
      .from("contacts")
      .insert({ agency_id: env.agencyB.agencyId, first_name: "Étape", last_name: "contact-b", source: "manual_entry" })
      .select("id")
      .single();
    if (insertedB.error || !insertedB.data) throw new Error(insertedB.error?.message ?? "contact B missing");
    const runB = await userB
      .from("ai_agent_runs")
      .insert({ agency_id: env.agencyB.agencyId, agent: "hugo", contact_id: insertedB.data.id })
      .select("id")
      .single();
    expect(runB.error).toBeNull();
    const runBId = runB.data?.id ?? "";

    const crossAgency = await applyAgentStage(userB, { contactId: contactA, runId: runBId, expected: "nouveau", next: "qualifie" });
    expect(crossAgency.error?.message).toBe("agent_run_invalid");
    expect(await stageOf(contactA)).toBe("nouveau");

    // A run of agency B cannot even be created for a contact of agency A (RLS + composite foreign key).
    const forged = await userB
      .from("ai_agent_runs")
      .insert({ agency_id: env.agencyB.agencyId, agent: "hugo", contact_id: contactA })
      .select("id");
    expect(forged.error).not.toBeNull();
  });

  it("verrou optimiste : une étape modifiée entre-temps n'est pas écrasée (renvoie false)", async () => {
    const contactId = await createContact("verrou", "qualifie");
    const runId = await startRun(agentA, "sarah", contactId);
    // A human moves the file while the agent is working.
    const human = await agentA.rpc("change_contact_stage", { target_contact: contactId, new_stage: "chaud" });
    expect(human.error).toBeNull();

    const result = await applyAgentStage(agentA, { contactId, runId, expected: "qualifie", next: "estimation_faite" });
    expect(result.error).toBeNull();
    expect(result.data).toBe(false);
    expect(await stageOf(contactId)).toBe("chaud");
  });

  it("refusé quand l'agence a coupé ses agents, ou quand un conseiller a repris la main", async () => {
    const pausedContact = await createContact("coupe-circuit", "nouveau");
    const pausedRun = await startRun(agentA, "hugo", pausedContact);
    await env.admin.from("agencies").update({ ai_paused: true }).eq("id", env.agencyA.agencyId);
    const paused = await applyAgentStage(agentA, { contactId: pausedContact, runId: pausedRun, expected: "nouveau", next: "qualifie" });
    await env.admin.from("agencies").update({ ai_paused: false }).eq("id", env.agencyA.agencyId);
    expect(paused.error?.message).toBe("ai_paused");
    expect(await stageOf(pausedContact)).toBe("nouveau");

    const takeoverContact = await createContact("reprise", "nouveau");
    const takeoverRun = await startRun(agentA, "hugo", takeoverContact);
    await env.admin.from("contacts").update({ human_takeover: true }).eq("id", takeoverContact);
    const takeover = await applyAgentStage(agentA, {
      contactId: takeoverContact,
      runId: takeoverRun,
      expected: "nouveau",
      next: "qualifie",
    });
    expect(takeover.error?.message).toBe("human_takeover");
    expect(await stageOf(takeoverContact)).toBe("nouveau");
  });

  it("inaccessible sans session (anon)", async () => {
    const contactId = await createContact("anon", "nouveau");
    const runId = await startRun(agentA, "hugo", contactId);
    const result = await applyAgentStage(env.anon, { contactId, runId, expected: "nouveau", next: "qualifie" });
    expect(result.error).not.toBeNull();
    expect(await stageOf(contactId)).toBe("nouveau");
  });
});
