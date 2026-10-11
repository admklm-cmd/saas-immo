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
import { createPrivacyGatewayProvider } from "@/lib/privacy-gateway/gateway";
import type { ExternalAiTransport } from "@/lib/privacy-gateway/types";
import { fail, ok, type Result } from "@/lib/utils/result";

import { ANTHROPIC_PROVIDER_NAME, createAnthropicTransport, readAnthropicConfig } from "./anthropic";
import type { AiProvider } from "./provider";
import { createSimulatorProvider, SIMULATOR_NAME } from "./simulator";

export const DEFAULT_AI_PROVIDER = SIMULATOR_NAME;

type EnvLike = Readonly<Record<string, string | undefined>>;

export type ResolveOptions = {
  /** Test seam: builds the external transport instead of the real SDK client. */
  createTransport?: (env: EnvLike) => Result<ExternalAiTransport>;
};

function defaultTransport(env: EnvLike): Result<ExternalAiTransport> {
  const config = readAnthropicConfig(env);
  if (config.error) return { data: null, error: config.error };
  return ok(createAnthropicTransport(config.data));
}

/**
 * Selects the provider.
 *  - missing / "simulator": the simulator, no network, nothing billed;
 *  - "anthropic": the real provider, ALWAYS behind the Privacy Gateway (the
 *    transport only accepts what the gateway produced);
 *  - anything else: explicit refusal.
 */
export function resolveAiProvider(
  rawName?: string,
  env: EnvLike = process.env,
  options: ResolveOptions = {},
): Result<AiProvider> {
  const name = (rawName ?? "").trim() || DEFAULT_AI_PROVIDER;

  if (name === SIMULATOR_NAME) {
    return ok(createSimulatorProvider());
  }

  if (name === ANTHROPIC_PROVIDER_NAME) {
    const transport = (options.createTransport ?? defaultTransport)(env);
    if (transport.error) {
      // No silent fallback to the simulator: the configuration is wrong, say so.
      console.error(`[ai] provider "${name}" refused: configuration incomplete or invalid.`);
      return { data: null, error: transport.error };
    }
    return ok(createPrivacyGatewayProvider(transport.data));
  }

  // Unknown provider: refuse loudly. Never fall back to a paid provider, never
  // silently fall back to the simulator either — the agency must know its
  // configuration is wrong.
  console.error(`[ai] refused provider "${name}": not configured (only "${SIMULATOR_NAME}" and "${ANTHROPIC_PROVIDER_NAME}" are wired).`);
  return fail("ai_provider_not_configured", AGENT_ERROR_MESSAGES.ai_provider_not_configured);
}

export function getAiProvider(): Result<AiProvider> {
  return resolveAiProvider(process.env.AI_PROVIDER, process.env);
}
