import "server-only";

/**
 * Provider selection — server only.
 *
 * `AI_PROVIDER` decides which implementation the product agents use. It
 * defaults to `simulator`, and ANY other value is refused with a clear error:
 * no paid call can leave by accident as long as no budget and no API key have
 * been defined by the user (CLAUDE.md, "IA du produit vs IA de développement").
 *
 * Wiring a real provider later means: adding its adapter next to
 * `simulator.ts`, reading its key from a server-side environment variable, and
 * adding one branch below. Nothing else in the codebase has to change.
 */

import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";
import { fail, ok, type Result } from "@/lib/utils/result";

import type { AiProvider } from "./provider";
import { createSimulatorProvider, SIMULATOR_NAME } from "./simulator";

export const DEFAULT_AI_PROVIDER = SIMULATOR_NAME;

export function resolveAiProvider(rawName?: string): Result<AiProvider> {
  const name = (rawName ?? "").trim() || DEFAULT_AI_PROVIDER;

  if (name === SIMULATOR_NAME) {
    return ok(createSimulatorProvider());
  }

  // Unknown or not-yet-wired provider: refuse loudly. Never fall back to a
  // paid provider, never silently fall back to the simulator either — the
  // agency must know its configuration is wrong.
  console.error(`[ai] refused provider "${name}": not configured (only "${SIMULATOR_NAME}" is wired).`);
  return fail("ai_provider_not_configured", AGENT_ERROR_MESSAGES.ai_provider_not_configured);
}

export function getAiProvider(): Result<AiProvider> {
  return resolveAiProvider(process.env.AI_PROVIDER);
}
