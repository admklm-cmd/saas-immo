import { describe, expect, it, vi } from "vitest";

import {
  AGENT_RUN_PHASES,
  AGENT_RUN_PHASE_LABELS,
  AGENT_RUN_STEP_STATUS_LABELS,
  createNullStepRecorder,
  createStepRecorder,
  MAX_STEP_LABEL_LENGTH,
} from "./steps";
import type { TypedClient } from "./types";

/**
 * The step journal is what the UI replays. Two properties matter more than
 * anything else here:
 *   1. the order and the timestamps are REAL (measured, monotonic, consistent),
 *      because an animated replay built on invented durations would be staging;
 *   2. a journalling failure never breaks the run — same rule as `finishRun`.
 */

type InsertedRow = Record<string, unknown>;

function fakeClient(options: { fail?: boolean; throws?: boolean } = {}): {
  client: TypedClient;
  rows: InsertedRow[];
  tables: string[];
} {
  const rows: InsertedRow[] = [];
  const tables: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      return {
        async insert(row: InsertedRow) {
          if (options.throws) throw new Error("connexion perdue");
          if (options.fail) return { error: { code: "42501", message: "refusé" } };
          rows.push(row);
          return { error: null };
        },
      };
    },
  } as unknown as TypedClient;
  return { client, rows, tables };
}

const RUN = { agencyId: "agency-1", runId: "run-1" };

describe("createStepRecorder", () => {
  it("numérote les étapes dans l'ordre et les écrit dans ai_agent_run_steps", async () => {
    const { client, rows, tables } = fakeClient();
    const recorder = createStepRecorder(client, RUN);

    await recorder.step({ phase: "guardrails", label: "Garde-fous vérifiés." });
    await recorder.step({ phase: "context_loaded", label: "Dossier chargé.", detail: { history: 3 } });
    await recorder.step({ phase: "persisted", label: "Écritures effectuées." });

    expect(tables).toEqual([
      "ai_agent_run_steps",
      "ai_agent_run_steps",
      "ai_agent_run_steps",
    ]);
    expect(rows.map((row) => row.step_index)).toEqual([0, 1, 2]);
    expect(rows.map((row) => row.phase)).toEqual(["guardrails", "context_loaded", "persisted"]);
    expect(rows.every((row) => row.agency_id === "agency-1" && row.run_id === "run-1")).toBe(true);
    expect(rows[1]!.detail).toEqual({ history: 3 });
    expect(recorder.steps.map((step) => step.index)).toEqual([0, 1, 2]);
    expect(recorder.steps.every((step) => step.persisted)).toBe(true);
  });

  it("mesure des durées cohérentes : positives et chronologiques", async () => {
    const { client } = fakeClient();
    const before = Date.now();
    const recorder = createStepRecorder(client, RUN);

    await recorder.step({ phase: "guardrails", label: "Garde-fous." });
    await new Promise((resolve) => setTimeout(resolve, 12));
    await recorder.step({ phase: "ai_call", label: "Appel du simulateur." });
    const after = Date.now();

    const [first, second] = recorder.steps;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    for (const step of recorder.steps) {
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
      expect(Date.parse(step.finishedAt)).toBeGreaterThanOrEqual(Date.parse(step.startedAt));
      expect(step.durationMs).toBe(Date.parse(step.finishedAt) - Date.parse(step.startedAt));
      // Never dated outside the wall-clock window of the test itself.
      expect(Date.parse(step.startedAt)).toBeGreaterThanOrEqual(before - 1);
      expect(Date.parse(step.finishedAt)).toBeLessThanOrEqual(after + 1);
    }

    // Steps never overlap and never go backwards.
    expect(Date.parse(second!.startedAt)).toBeGreaterThanOrEqual(Date.parse(first!.finishedAt));
    // The real 12 ms wait is visible in the second step, not invented elsewhere.
    expect(second!.durationMs).toBeGreaterThanOrEqual(10);
  });

  it("mark() ne journalise rien et repart de maintenant", async () => {
    const { client, rows } = fakeClient();
    const recorder = createStepRecorder(client, RUN);

    await new Promise((resolve) => setTimeout(resolve, 15));
    recorder.mark();
    await recorder.step({ phase: "ai_call", label: "Appel du simulateur." });

    expect(rows).toHaveLength(1);
    // The 15 ms spent before the mark are not charged to the AI call.
    expect(recorder.steps[0]!.durationMs).toBeLessThan(15);
  });

  it("une panne d'enregistrement ne casse rien et ne lève jamais", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, rows } = fakeClient({ fail: true });
    const recorder = createStepRecorder(client, RUN);

    const step = await recorder.step({ phase: "decision", label: "Décision prise." });

    expect(rows).toHaveLength(0);
    expect(step.persisted).toBe(false);
    // The measurement is still available to the caller, and the run continues.
    expect(recorder.steps).toHaveLength(1);
    expect(errors).toHaveBeenCalled();
  });

  it("une exception du client est absorbée de la même façon", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ throws: true });
    const recorder = createStepRecorder(client, RUN);

    await expect(recorder.step({ phase: "persisted", label: "Écritures." })).resolves.toMatchObject({
      persisted: false,
      phase: "persisted",
    });
  });

  it("applique le statut par défaut, borne le libellé et refuse un libellé vide", async () => {
    const { client, rows } = fakeClient();
    const recorder = createStepRecorder(client, RUN);

    await recorder.step({ phase: "decision", label: "  Décision prise par le code.  " });
    await recorder.step({ phase: "decision", label: "   " });
    await recorder.step({ phase: "decision", label: "x".repeat(400), status: "blocked" });

    expect(rows[0]).toMatchObject({ status: "ok", label: "Décision prise par le code." });
    expect(rows[1]!.label).toBe("Étape");
    expect((rows[2]!.label as string).length).toBe(MAX_STEP_LABEL_LENGTH);
    expect(rows[2]).toMatchObject({ status: "blocked" });
  });

  it("borne la durée d'une étape à l'intervalle accepté par la base", async () => {
    const { client } = fakeClient();
    // A cursor left two hours in the past (clock jump): the database refuses
    // anything above one hour, so the recorder clamps instead of failing.
    const recorder = createStepRecorder(client, {
      ...RUN,
      startedAt: new Date(Date.now() - 2 * 3_600_000),
    });

    await recorder.step({ phase: "guardrails", label: "Garde-fous." });

    expect(recorder.steps[0]!.durationMs).toBeLessThanOrEqual(3_600_000);
    expect(recorder.steps[0]!.durationMs).toBeGreaterThan(3_000_000);
  });
});

describe("createNullStepRecorder", () => {
  it("n'écrit rien, ne mémorise rien et ne lève pas", async () => {
    const recorder = createNullStepRecorder();
    const step = await recorder.step({ phase: "guardrails", label: "Garde-fous." });

    expect(recorder.runId).toBeNull();
    expect(recorder.steps).toEqual([]);
    expect(step.persisted).toBe(false);
    expect(step.durationMs).toBe(0);
    expect(() => {
      recorder.mark();
    }).not.toThrow();
  });
});

describe("vocabulaire des étapes", () => {
  it("chaque phase et chaque statut a un libellé français", () => {
    expect(AGENT_RUN_PHASES).toEqual([
      "guardrails",
      "context_loaded",
      "prompt_built",
      "ai_call",
      "output_validated",
      "decision",
      "persisted",
    ]);
    for (const phase of AGENT_RUN_PHASES) {
      expect(AGENT_RUN_PHASE_LABELS[phase]).toBeTruthy();
    }
    for (const status of ["ok", "blocked", "failed", "skipped"] as const) {
      expect(AGENT_RUN_STEP_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});
