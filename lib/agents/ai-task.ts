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
 */

import { addUsage, emptyUsage, type AiGenerationRequest, type AiProvider, type AiUsage } from "@/lib/claude/provider";
import type { ResultError } from "@/lib/utils/result";
import type { ZodType } from "zod";

import { agentError } from "./errors";

export const MAX_AI_ATTEMPTS = 2;

export type GenerationOutcome<T> =
  | { ok: true; output: T; usage: AiUsage; attempts: number }
  | { ok: false; error: ResultError; usage: AiUsage; attempts: number };

export async function generateValidated<T>(
  provider: AiProvider,
  request: AiGenerationRequest,
  schema: ZodType<T>,
  maxAttempts: number = MAX_AI_ATTEMPTS,
): Promise<GenerationOutcome<T>> {
  const attemptLimit = Math.max(1, maxAttempts);
  let usage = emptyUsage(provider);
  let attempts = 0;

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    attempts = attempt;
    const generation = await provider.generate({ ...request, attempt });

    if (generation.error) {
      // Provider unavailable: stop immediately, no action.
      return { ok: false, error: generation.error, usage, attempts };
    }

    usage = addUsage(usage, generation.data.usage);

    const parsed = schema.safeParse(generation.data.raw);
    if (parsed.success) {
      return { ok: true, output: parsed.data, usage, attempts };
    }

    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(racine)"}: ${issue.message}`)
      .join(" | ");
    console.error(
      `[agents] invalid AI output for task "${request.task}" (attempt ${attempt}/${attemptLimit}): ${issues}`,
    );
  }

  return { ok: false, error: agentError("ai_response_invalid"), usage, attempts };
}
