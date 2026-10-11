import { describe, expect, it, vi } from "vitest";

import { DEFAULT_AI_PROVIDER, resolveAiProvider } from "./client";
import { SIMULATOR_NAME } from "./simulator";

/**
 * No paid AI call can leave by accident: only the simulator is wired, and any
 * other value of AI_PROVIDER is refused with a clear French message.
 */

describe("resolveAiProvider", () => {
  it("utilise le simulateur par défaut", () => {
    expect(DEFAULT_AI_PROVIDER).toBe(SIMULATOR_NAME);
    for (const value of [undefined, "", "   "]) {
      const result = resolveAiProvider(value);
      expect(result.error, String(value)).toBeNull();
      expect(result.data?.name).toBe(SIMULATOR_NAME);
      expect(result.data?.isSimulation).toBe(true);
    }
  });

  it("accepte explicitement « simulator »", () => {
    const result = resolveAiProvider(" simulator ");
    expect(result.error).toBeNull();
    expect(result.data?.isSimulation).toBe(true);
  });

  it("refuse tout autre fournisseur, sans repli silencieux", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const value of ["anthropic", "claude", "openai", "mistral", "SIMULATOR_2"]) {
      const result = resolveAiProvider(value);
      expect(result.data, value).toBeNull();
      expect(result.error?.code).toBe("ai_provider_not_configured");
      expect(result.error?.message).toContain("Fournisseur d'IA non configuré");
      expect(result.error?.message).toContain("simulator");
    }
  });
});
