/**
 * Calls the AI provider and validates its answer BEFORE anything is used.
 *
 * Non-negotiable sequence (CLAUDE.md):
 *   provider → raw output → zod schema → (invalid ? limited retry) → safe
 *   fallback (no action at all, a task is opened for a human by the caller).
 *
 * Nothing outside the validated schema is ever read by the business logic, so
 * an injected instruction in the prospect's text cannot become an action.
 *
 * The outcome always carries the token usage, including on failure: a failed
 * attempt still costs money with a real provider and must be accounted for.
 *
 * The `ai_call` and `output_validated` steps of the run journal are recorded
 * HERE, around the two operations they actually describe, so their durations
 * are measured and not guessed. A retry naturally produces a second pair of
 * steps: the agency sees the real number of attempts.
 */

import { addUsage, emptyUsage, type AiGenerationRequest, type AiProvider, type AiUsage } from "@/lib/claude/provider";
import type { ResultError } from "@/lib/utils/result";
import type { ZodType } from "zod";

import { agentError } from "./errors";
import { AGENT_STEP_LABELS } from "./messages";
import type { AgentStepRecorder } from "./steps";

export const MAX_AI_ATTEMPTS = 2;

export type GenerationOutcome<T> =
  | { ok: true; output: T; usage: AiUsage; attempts: number }
  | { ok: false; error: ResultError; usage: AiUsage; attempts: number };

export type GenerateValidatedOptions = {
  maxAttempts?: number;
  /** Run step journal; omit it and nothing is journaled (unit tests). */
  steps?: AgentStepRecorder;
};

export async function generateValidated<T>(
  provider: AiProvider,
  request: AiGenerationRequest,
  schema: ZodType<T>,
  options: GenerateValidatedOptions = {},
): Promise<GenerationOutcome<T>> {
  const attemptLimit = Math.max(1, options.maxAttempts ?? MAX_AI_ATTEMPTS);
  const steps = options.steps;
  let usage = emptyUsage(provider);
  let attempts = 0;

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    attempts = attempt;
    // The cursor is reset here so the `ai_call` step measures the provider
    // call only, not the business work that preceded it.
    steps?.mark();
    const generation = await provider.generate({ ...request, attempt });

    if (generation.error) {
      // Provider unavailable: stop immediately, no action.
      await steps?.step({
        phase: "ai_call",
        label: AGENT_STEP_LABELS.ai_call_unavailable,
        status: "failed",
        detail: {
          provider: provider.name,
          model: provider.model,
          attempt,
          max_attempts: attemptLimit,
          error_code: generation.error.code,
        },
      });
      return { ok: false, error: generation.error, usage, attempts };
    }

    usage = addUsage(usage, generation.data.usage);
    await steps?.step({
      phase: "ai_call",
      label: AGENT_STEP_LABELS.ai_call_ok,
      detail: {
        provider: provider.name,
        model: provider.model,
        is_simulation: provider.isSimulation,
        attempt,
        max_attempts: attemptLimit,
        input_tokens: generation.data.usage.inputTokens,
        output_tokens: generation.data.usage.outputTokens,
      },
    });

    const parsed = schema.safeParse(generation.data.raw);
    if (parsed.success) {
      await steps?.step({
        phase: "output_validated",
        label: AGENT_STEP_LABELS.output_valid,
        detail: { task: request.task, attempt, issues: 0 },
      });
      return { ok: true, output: parsed.data, usage, attempts };
    }

    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(racine)"}: ${issue.message}`)
      .join(" | ");
    console.error(
      `[agents] invalid AI output for task "${request.task}" (attempt ${attempt}/${attemptLimit}): ${issues}`,
    );
    await steps?.step({
      phase: "output_validated",
      label: AGENT_STEP_LABELS.output_invalid,
      status: "failed",
      detail: {
        task: request.task,
        attempt,
        max_attempts: attemptLimit,
        issues: parsed.error.issues.length,
        // Field paths only: never the model's raw text, which could echo the
        // prospect's personal data back into the journal.
        fields: parsed.error.issues.slice(0, 5).map((issue) => issue.path.join(".") || "(racine)"),
      },
    });
  }

  return { ok: false, error: agentError("ai_response_invalid"), usage, attempts };
}
