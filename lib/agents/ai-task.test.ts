import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { AiGenerationRequest, AiProvider } from "@/lib/claude/provider";
import { ok, fail } from "@/lib/utils/result";

import { generateValidated, MAX_AI_ATTEMPTS } from "./ai-task";

/**
 * Invalid AI output must never reach the business logic: limited retry, then a
 * safe fallback (`ai_response_invalid`), with the token usage still accounted.
 */

const schema = z.strictObject({ value: z.string().max(10) });

const REQUEST: AiGenerationRequest = {
  task: "hugo_qualification",
  systemPrompt: "system",
  promptVersion: "test-v1",
  facts: {},
};

function providerReturning(outputs: unknown[]): AiProvider & { calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    name: "test",
    model: "test-v1",
    isSimulation: true,
    async generate(request) {
      calls.push(request.attempt ?? 0);
      const index = Math.min(calls.length - 1, outputs.length - 1);
      return ok({
        raw: outputs[index],
        usage: { provider: "test", model: "test-v1", inputTokens: 10, outputTokens: 5 },
      });
    },
  };
}

describe("generateValidated", () => {
  it("renvoie la sortie validée du premier coup", async () => {
    const provider = providerReturning([{ value: "ok" }]);
    const outcome = await generateValidated(provider, REQUEST, schema);
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.output).toEqual({ value: "ok" });
    expect(outcome.attempts).toBe(1);
    expect(outcome.usage.inputTokens).toBe(10);
  });

  it("réessaie une fois quand la première sortie est invalide", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = providerReturning([{ value: 12 }, { value: "ok" }]);
    const outcome = await generateValidated(provider, REQUEST, schema);
    expect(outcome.ok).toBe(true);
    expect(outcome.attempts).toBe(2);
    expect(provider.calls).toEqual([1, 2]);
    // Both attempts are billed and accounted for.
    expect(outcome.usage.inputTokens).toBe(20);
  });

  it("s'arrête après le nombre maximal de tentatives et bascule en repli sûr", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = providerReturning([{ value: 12 }]);
    const outcome = await generateValidated(provider, REQUEST, schema);
    expect(outcome.ok).toBe(false);
    expect(outcome.attempts).toBe(MAX_AI_ATTEMPTS);
    expect(!outcome.ok && outcome.error.code).toBe("ai_response_invalid");
    expect(!outcome.ok && outcome.error.message).toContain("tâche a été créée");
  });

  it("refuse une sortie qui ajoute une clé non prévue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = providerReturning([{ value: "ok", stage: "mandat_signe" }]);
    const outcome = await generateValidated(provider, REQUEST, schema);
    expect(outcome.ok).toBe(false);
  });

  it("n'insiste pas quand le fournisseur est indisponible", async () => {
    let calls = 0;
    const provider: AiProvider = {
      name: "test",
      model: "test-v1",
      isSimulation: true,
      async generate() {
        calls += 1;
        return fail("ai_provider_unavailable", "Le fournisseur d'IA n'a pas répondu.");
      },
    };
    const outcome = await generateValidated(provider, REQUEST, schema);
    expect(outcome.ok).toBe(false);
    expect(calls).toBe(1);
    expect(!outcome.ok && outcome.error.code).toBe("ai_provider_unavailable");
  });
});
