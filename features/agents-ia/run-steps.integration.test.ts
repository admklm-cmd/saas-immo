import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { runHugoQualification } from "@/features/agents-ia/hugo-qualification/hugo";
import { runLouisAppointment } from "@/features/agents-ia/louis-rendez-vous/louis";
import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { findRunSteps } from "./data";

/**
 * The step journal, end to end, against the LOCAL Supabase stack.
 *
 * What is being proved here is the one thing the animated replay depends on:
 * the steps are REAL. They are recorded by the agents themselves, in the order
 * the work actually happens, with instants measured on the server and a
 * duration recomputed by the database. A blocked run also leaves a step saying
 * why it stopped, and a run of another agency is unreadable.
 */

const NOTES_COMPLETE =
  "Formulaire d'estimation : appartement T3 de 68 m² à La Ciotat, quartier de la gare. " +
  "Mutation professionnelle à Lyon, souhaite vendre d'ici 6 mois.";

const NOTES_LOUIS =
  "Formulaire d'estimation : maison de 110 m² à La Ciotat, quartier de la gare. Succession, vente sous 3 mois.";

let env: TestEnv;
let agentA: TypedClient;
let userB: TypedClient;

async function createContact(
  label: string,
  seed: { notes: string; stage?: "nouveau" | "qualifie"; withConsent?: boolean } = { notes: NOTES_COMPLETE },
): Promise<string> {
  const { data, error } = await env.admin
    .from("contacts")
    .insert({
      agency_id: env.agencyA.agencyId,
      first_name: "Étapes",
      last_name: `Test ${label}`,
      email: `etapes-${label}.${env.runId}@example.test`,
      source: "estimation_form",
      stage: seed.stage ?? "nouveau",
      notes: seed.notes,
      assigned_user_id: env.agencyA.directorUserId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createContact(${label}): ${error?.message ?? "no row"}`);

  if (seed.withConsent) {
    const consent = await env.admin.from("consents").insert({
      agency_id: env.agencyA.agencyId,
      contact_id: data.id,
      channel: "email",
      status: "granted",
      presented_text: "J'accepte d'être recontacté par l'agence (texte de test).",
      text_version: "test-v1",
      source: "estimation_form",
      proof: { form_id: `test-${env.runId}` },
    });
    if (consent.error) throw new Error(`createConsent(${label}): ${consent.error.message}`);
  }
  return data.id;
}

async function readSteps(runId: string) {
  const { data, error } = await env.admin
    .from("ai_agent_run_steps")
    .select("step_index, phase, label, status, detail, started_at, finished_at, duration_ms, agency_id")
    .eq("run_id", runId)
    .order("step_index", { ascending: true });
  if (error) throw new Error(`readSteps: ${error.message}`);
  return data ?? [];
}

async function readRunId(contactId: string): Promise<string> {
  const { data, error } = await env.admin
    .from("ai_agent_runs")
    .select("id")
    .eq("contact_id", contactId)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) throw new Error(`readRunId: ${error?.message ?? "no row"}`);
  return data.id;
}

/** Steps must be ordered, non-overlapping, and dated around the run itself. */
function expectCoherentTimeline(
  steps: { step_index: number; started_at: string; finished_at: string; duration_ms: number }[],
  window: { from: number; to: number },
): void {
  expect(steps.map((step) => step.step_index)).toEqual(steps.map((_, index) => index));

  let previousEnd = window.from;
  for (const step of steps) {
    const startedAt = Date.parse(step.started_at);
    const finishedAt = Date.parse(step.finished_at);

    expect(finishedAt).toBeGreaterThanOrEqual(startedAt);
    // The duration is the one the DATABASE recomputed from the two instants.
    expect(step.duration_ms).toBe(Math.floor(finishedAt - startedAt));
    // Inside the real wall-clock window of the run: nothing back-dated, nothing
    // dated in the future.
    expect(startedAt).toBeGreaterThanOrEqual(window.from - 1_000);
    expect(finishedAt).toBeLessThanOrEqual(window.to + 1_000);
    // Steps follow each other, they never overlap nor go backwards.
    expect(startedAt).toBeGreaterThanOrEqual(previousEnd - 1);
    previousEnd = finishedAt;
  }
}

beforeAll(async () => {
  env = await setupTestEnv();
  agentA = env.users.agentA.client;
  userB = env.users.userB.client;
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("Hugo — journal des étapes", () => {
  it("produit la séquence attendue, avec de vrais horodatages", async () => {
    const contactId = await createContact("hugo-ok");

    const from = Date.now();
    const result = await runHugoQualification(agentA, contactId);
    const to = Date.now();

    expect(result.error).toBeNull();
    const runId = result.data!.runId;

    const steps = await readSteps(runId);
    expect(steps.map((step) => step.phase)).toEqual([
      "guardrails",
      "context_loaded",
      "prompt_built",
      "ai_call",
      "output_validated",
      "decision",
      "persisted",
    ]);
    expect(steps.every((step) => step.status === "ok")).toBe(true);
    expect(steps.every((step) => step.agency_id === env.agencyA.agencyId)).toBe(true);
    expectCoherentTimeline(steps, { from, to });

    // The in-memory steps returned to the caller match what was persisted.
    expect(result.data!.steps.map((step) => step.phase)).toEqual(steps.map((step) => step.phase));
    expect(result.data!.steps.every((step) => step.persisted)).toBe(true);

    // The displayable detail says what happened, never the prospect's text.
    const promptStep = steps.find((step) => step.phase === "prompt_built")!;
    expect(promptStep.detail).toMatchObject({ untrusted_blocks: 2 });
    expect(JSON.stringify(steps)).not.toContain("Mutation professionnelle à Lyon");

    const decisionStep = steps.find((step) => step.phase === "decision")!;
    expect(decisionStep.detail).toMatchObject({ decision: "qualified", stage: "qualifie", stage_changed: true });
  });

  it("une sortie IA invalide journalise deux tentatives et le repli sûr", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const contactId = await createContact("hugo-invalide");

    const result = await runHugoQualification(agentA, contactId, { scenario: "invalid_output" });
    expect(result.error?.code).toBe("ai_response_invalid");

    const runId = await readRunId(contactId);
    const steps = await readSteps(runId);

    // Two real attempts, each with its call and its refused validation.
    expect(steps.filter((step) => step.phase === "ai_call")).toHaveLength(2);
    const validations = steps.filter((step) => step.phase === "output_validated");
    expect(validations).toHaveLength(2);
    expect(validations.every((step) => step.status === "failed")).toBe(true);

    const last = steps.at(-1)!;
    expect(last.phase).toBe("persisted");
    expect(last.status).toBe("failed");
    expect(last.detail).toMatchObject({ error_code: "ai_response_invalid", task_type: "ai_response_invalid" });
  });
});

describe("Louis — journal des étapes", () => {
  it("montre que les créneaux sont calculés par le code avant l'appel IA", async () => {
    const contactId = await createContact("louis-ok", {
      notes: NOTES_LOUIS,
      stage: "qualifie",
      withConsent: true,
    });

    const from = Date.now();
    const result = await runLouisAppointment(agentA, contactId);
    const to = Date.now();

    expect(result.error).toBeNull();
    const steps = await readSteps(result.data!.runId);

    expect(steps.map((step) => step.phase)).toEqual([
      "guardrails",
      "context_loaded",
      // The code decides: eligibility, channel, consent, free slots — all
      // BEFORE the model is called.
      "decision",
      "prompt_built",
      "ai_call",
      "output_validated",
      // The code decides again: the slot is re-read from its own table.
      "decision",
      "persisted",
    ]);
    expect(steps.every((step) => step.status === "ok")).toBe(true);
    expectCoherentTimeline(steps, { from, to });

    const codeRules = steps.filter((step) => step.phase === "decision")[0]!;
    expect(codeRules.detail).toMatchObject({ channel: "email", consent_checked: true });
    expect(Number((codeRules.detail as { free_slots: number }).free_slots)).toBeGreaterThan(0);

    const persisted = steps.at(-1)!;
    expect(persisted.detail).toMatchObject({
      appointment_status: "proposed",
      message_status: "pending_validation",
      is_simulation: true,
    });
  });

  it("un arrêt métier (aucun consentement) laisse une étape qui dit pourquoi", async () => {
    const contactId = await createContact("louis-sans-consentement", {
      notes: NOTES_LOUIS,
      stage: "qualifie",
      withConsent: false,
    });

    const result = await runLouisAppointment(agentA, contactId);
    expect(result.error?.code).toBe("consent_not_granted");

    const steps = await readSteps(await readRunId(contactId));
    const last = steps.at(-1)!;
    expect(last.phase).toBe("decision");
    expect(last.status).toBe("failed");
    expect(last.detail).toMatchObject({
      error_code: "consent_not_granted",
      appointment_created: false,
      message_created: false,
    });
    // Nothing was proposed and nothing was drafted.
    const { data: appointments } = await env.admin.from("appointments").select("id").eq("contact_id", contactId);
    expect(appointments).toEqual([]);
  });
});

describe("Exécution bloquée", () => {
  it("le coupe-circuit produit une étape explicative, pas un silence", async () => {
    const contactId = await createContact("coupe-circuit");
    const paused = await env.admin
      .from("agencies")
      .update({ ai_paused: true })
      .eq("id", env.agencyA.agencyId);
    expect(paused.error).toBeNull();

    try {
      const result = await runHugoQualification(agentA, contactId);
      expect(result.error?.code).toBe("ai_paused");

      const runId = await readRunId(contactId);
      const steps = await readSteps(runId);
      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({ step_index: 0, phase: "guardrails", status: "blocked" });
      expect(steps[0]!.label).toContain("coupe-circuit");
      expect(steps[0]!.detail).toMatchObject({ reason: "ai_paused", agent: "hugo" });
      expect(steps[0]!.duration_ms).toBeGreaterThanOrEqual(0);
    } finally {
      await env.admin.from("agencies").update({ ai_paused: false }).eq("id", env.agencyA.agencyId);
    }
  });

  it("la reprise en main humaine aussi", async () => {
    const contactId = await createContact("reprise");
    const takeover = await env.admin.from("contacts").update({ human_takeover: true }).eq("id", contactId);
    expect(takeover.error).toBeNull();

    const result = await runHugoQualification(agentA, contactId);
    expect(result.error?.code).toBe("human_takeover");

    const steps = await readSteps(await readRunId(contactId));
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ phase: "guardrails", status: "blocked" });
    expect(steps[0]!.label).toContain("conseiller");
  });
});

describe("getRunSteps (lecture)", () => {
  it("renvoie l'exécution et ses étapes, libellées en français", async () => {
    const contactId = await createContact("lecture");
    const run = await runHugoQualification(agentA, contactId);
    expect(run.error).toBeNull();

    const replay = await findRunSteps(agentA, run.data!.runId);
    expect(replay.error).toBeNull();

    expect(replay.data!.run).toMatchObject({
      id: run.data!.runId,
      agent: "hugo",
      agentLabel: "Hugo",
      status: "succeeded",
      provider: "simulator",
      isSimulation: true,
    });
    expect(replay.data!.steps).toHaveLength(7);
    expect(replay.data!.steps[0]).toMatchObject({ index: 0, phase: "guardrails", phaseLabel: "Garde-fous", statusLabel: "Terminé" });
    // Canonical ISO-8601 UTC, whatever PostgREST spells.
    expect(replay.data!.steps[0]!.startedAt).toMatch(/Z$/);
    expect(replay.data!.totalDurationMs).toBe(
      replay.data!.steps.reduce((total, step) => total + step.durationMs, 0),
    );
  });

  it("un membre d'une autre agence ne lit rien et n'apprend rien", async () => {
    const contactId = await createContact("lecture-isolation");
    const run = await runHugoQualification(agentA, contactId);
    expect(run.error).toBeNull();

    const replay = await findRunSteps(userB, run.data!.runId);
    expect(replay.data).toBeNull();
    expect(replay.error?.code).toBe("ai_run_not_found");
    expect(replay.error?.message).toBe("Exécution d'agent introuvable.");
    expect(JSON.stringify(replay.error)).not.toContain(env.agencyA.agencyId);

    // Same generic answer for an identifier that does not exist at all.
    const unknown = await findRunSteps(agentA, "00000000-0000-4000-8000-000000000000");
    expect(unknown.error?.code).toBe("ai_run_not_found");
    const malformed = await findRunSteps(agentA, "pas-un-uuid");
    expect(malformed.error?.code).toBe("ai_run_not_found");

    // And nothing leaks through the raw table either.
    const direct = await userB.from("ai_agent_run_steps").select("id").eq("run_id", run.data!.runId);
    expect(direct.error).toBeNull();
    expect(direct.data).toEqual([]);
  });
});
