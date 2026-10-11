import { describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/lib/utils/result";

import { DEFAULT_AI_PROVIDER, resolveAiProvider } from "./client";
import { SIMULATOR_NAME } from "./simulator";

/**
 * No paid AI call can leave by accident: the simulator is the default, the real
 * provider needs an explicit opt-in AND a complete configuration, and any other
 * value of AI_PROVIDER is refused with a clear French message. Nothing here
 * ever reaches the network: the external transport is always a stub.
 */

describe("resolveAiProvider", () => {
  it("utilise le simulateur par défaut", () => {
    expect(DEFAULT_AI_PROVIDER).toBe(SIMULATOR_NAME);
    for (const value of [undefined, "", "   "]) {
      const result = resolveAiProvider(value, {});
      expect(result.error, String(value)).toBeNull();
      expect(result.data?.name).toBe(SIMULATOR_NAME);
      expect(result.data?.isSimulation).toBe(true);
    }
  });

  it("accepte explicitement « simulator »", () => {
    const result = resolveAiProvider(" simulator ", {});
    expect(result.error).toBeNull();
    expect(result.data?.isSimulation).toBe(true);
  });

  it("même avec une clé présente, le simulateur reste le défaut (jamais d'activation implicite)", () => {
    const createTransport = vi.fn();
    const result = resolveAiProvider(undefined, { ANTHROPIC_API_KEY: "sk-ant-test", AI_MODEL: "claude-haiku-5-5" }, { createTransport });
    expect(result.data?.isSimulation).toBe(true);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("refuse tout autre fournisseur, sans repli silencieux", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const value of ["claude", "openai", "mistral", "SIMULATOR_2", "Anthropic"]) {
      const result = resolveAiProvider(value, {});
      expect(result.data, value).toBeNull();
      expect(result.error?.code).toBe("ai_provider_not_configured");
      expect(result.error?.message).toContain("Fournisseur d'IA non configuré");
      expect(result.error?.message).toContain("simulator");
    }
  });

  it("« anthropic » sans clé : refus explicite, jamais de repli sur le simulateur", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = resolveAiProvider("anthropic", { AI_MODEL: "claude-haiku-5-5" });
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("ai_provider_not_configured");
    expect(result.error?.message).toContain("clé d'API");
  });

  it("« anthropic » sans modèle : refus explicite", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = resolveAiProvider("anthropic", { ANTHROPIC_API_KEY: "sk-ant-test" });
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("modèle");
  });

  it("« anthropic » complet : fournisseur réel (non simulé), toujours derrière la Privacy Gateway", () => {
    const transport = {
      name: "anthropic",
      model: "claude-haiku-5-5",
      complete: vi.fn(async () => ok({ raw: {}, usage: { provider: "anthropic", model: "claude-haiku-5-5", inputTokens: 1, outputTokens: 1 } })),
    };
    const result = resolveAiProvider("anthropic", {}, { createTransport: () => ok(transport) });
    expect(result.error).toBeNull();
    expect(result.data?.name).toBe("anthropic");
    expect(result.data?.isSimulation).toBe(false);
    // The agents get the gateway's AiProvider, not the raw transport.
    expect(typeof result.data?.restoreOutput).toBe("function");
    expect(typeof result.data?.endRun).toBe("function");
    expect(result.data).not.toBe(transport);
    expect(transport.complete).not.toHaveBeenCalled();
  });

  it("propage l'erreur de configuration du transport", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = resolveAiProvider("anthropic", {}, { createTransport: () => fail("ai_provider_not_configured", "Fournisseur d'IA non configuré : test.") });
    expect(result.error?.message).toBe("Fournisseur d'IA non configuré : test.");
  });
});
