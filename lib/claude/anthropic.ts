import "server-only";

/**
 * Anthropic transport — the real, PAID provider. Off by default.
 *
 * It is selected only by `AI_PROVIDER=anthropic` (see client.ts) and needs a
 * server-side key (`ANTHROPIC_API_KEY`) and an explicit model (`AI_MODEL`).
 * Nothing falls back silently: a missing key or model is an explicit refusal.
 *
 * Structural guarantee: this adapter does NOT implement `AiProvider`. Its only
 * input is a `SanitizedAiRequest`, which only the Privacy Gateway can produce
 * (lib/privacy-gateway/sanitize.ts); `createPrivacyGatewayProvider` wraps it
 * into the `AiProvider` the agents use. Raw CRM data cannot reach it.
 *
 * SDK usage checked against the official documentation (Messages API,
 * `@anthropic-ai/sdk` 0.133.0, models page of October 2026):
 *  - `system` is a top-level field, `max_tokens` is required;
 *  - thinking is ON by default on the 5.5 models and its tokens count toward
 *    `max_tokens`: hence a generous default budget and the refusal to accept a
 *    truncated answer (`stop_reason: "max_tokens"` -> invalid output);
 *  - sampling parameters (`temperature`, `top_p`, `top_k`) are rejected by
 *    these models: none is sent;
 *  - errors are subclasses of `APIError` with a `status`; the SDK retries
 *    connection errors, 408, 409, 429 and >= 500 by itself (`maxRetries`).
 *
 * Privacy: no prompt and no response is ever logged. The SDK logger is switched
 * off (its debug level would print request and response bodies) and the base
 * URL is pinned, so a stray `ANTHROPIC_BASE_URL` cannot redirect the traffic.
 */

import Anthropic from "@anthropic-ai/sdk";

import { AGENT_ERROR_MESSAGES, AI_PROVIDER_CONFIG_MESSAGES } from "@/lib/agents/messages";
import { isSanitizedRequest } from "@/lib/privacy-gateway/sanitize";
import type { ExternalAiTransport, SanitizedAiRequest } from "@/lib/privacy-gateway/types";
import { fail, ok, type Result } from "@/lib/utils/result";

import type { AiGeneration } from "./provider";

export const ANTHROPIC_PROVIDER_NAME = "anthropic";
export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";

export const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
export const MIN_MAX_OUTPUT_TOKENS = 256;
export const HARD_MAX_OUTPUT_TOKENS = 8192;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RETRIES = 1;
/** Longest raw text parsed from a response (bytes of JSON, not tokens). */
const MAX_RESPONSE_CHARS = 100_000;

export type AnthropicConfig = {
  apiKey: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
};

type EnvLike = Readonly<Record<string, string | undefined>>;

function boundedInteger(raw: string | undefined, fallback: number, min: number, max: number): number | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return fallback;
  if (!/^\d{1,9}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value < min || value > max ? null : value;
}

/**
 * Reads and validates the configuration. Every anomaly is a refusal: a typo in
 * a limit must not silently become "no limit".
 *  - ANTHROPIC_API_KEY  required, server only
 *  - AI_MODEL           required (a budget decision, never defaulted)
 *  - AI_MAX_OUTPUT_TOKENS  256..8192, default 2048
 *  - AI_TIMEOUT_MS         5000..120000, default 30000 (per attempt)
 *  - AI_MAX_RETRIES        0..3, default 1 (transport retries inside the SDK)
 */
export function readAnthropicConfig(env: EnvLike): Result<AnthropicConfig> {
  const apiKey = (env.ANTHROPIC_API_KEY ?? "").trim();
  if (apiKey.length === 0) {
    return fail("ai_provider_not_configured", AI_PROVIDER_CONFIG_MESSAGES.missing_key);
  }

  const model = (env.AI_MODEL ?? "").trim();
  if (!/^claude-[a-z0-9][a-z0-9.\-_]{1,80}$/i.test(model)) {
    return fail("ai_provider_not_configured", AI_PROVIDER_CONFIG_MESSAGES.missing_model);
  }

  const maxTokens = boundedInteger(env.AI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS, MIN_MAX_OUTPUT_TOKENS, HARD_MAX_OUTPUT_TOKENS);
  const timeoutMs = boundedInteger(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 120_000);
  const maxRetries = boundedInteger(env.AI_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0, 3);
  if (maxTokens === null || timeoutMs === null || maxRetries === null) {
    return fail("ai_provider_not_configured", AI_PROVIDER_CONFIG_MESSAGES.invalid_limit);
  }

  return ok({ apiKey, model, maxTokens, timeoutMs, maxRetries });
}

// ---------------------------------------------------------------------------
// Minimal structural view of the SDK (lets the tests inject a mock)
// ---------------------------------------------------------------------------

export type AnthropicMessageLike = {
  content?: readonly { type: string; text?: string }[];
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  };
};

export type AnthropicCreateParams = {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: "user"; content: string }[];
};

export type AnthropicClientLike = {
  messages: {
    create(
      params: AnthropicCreateParams,
      options?: { timeout?: number; maxRetries?: number; signal?: AbortSignal },
    ): Promise<AnthropicMessageLike>;
  };
};

export function createAnthropicClient(config: AnthropicConfig): AnthropicClientLike {
  return new Anthropic({
    apiKey: config.apiKey,
    authToken: null,
    baseURL: ANTHROPIC_BASE_URL,
    timeout: config.timeoutMs,
    maxRetries: config.maxRetries,
    // The SDK's debug level prints bodies: keep it off whatever ANTHROPIC_LOG says.
    logLevel: "off",
  }) as unknown as AnthropicClientLike;
}

// ---------------------------------------------------------------------------
// Errors and output
// ---------------------------------------------------------------------------

export type ProviderErrorKind = "timeout" | "auth" | "rate_limit" | "bad_request" | "server" | "network" | "unknown";

/** Classifies an SDK error without ever touching its message or body. */
export function classifyProviderError(error: unknown): { kind: ProviderErrorKind; status: number | null } {
  const candidate = (error ?? {}) as { name?: unknown; status?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const status = typeof candidate.status === "number" ? candidate.status : null;

  if (name === "APIConnectionTimeoutError" || name === "AbortError") return { kind: "timeout", status };
  if (status === 401 || status === 403) return { kind: "auth", status };
  if (status === 429) return { kind: "rate_limit", status };
  if (status !== null && status >= 500) return { kind: "server", status };
  if (status !== null && status >= 400) return { kind: "bad_request", status };
  if (name === "APIConnectionError") return { kind: "network", status };
  return { kind: "unknown", status };
}

function stripCodeFence(text: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim());
  return fenced?.[1] ?? text.trim();
}

/** Raw JSON of the answer, or `null` when it is truncated, refused or not JSON. */
export function extractRawJson(message: AnthropicMessageLike): unknown {
  if (message.stop_reason === "max_tokens" || message.stop_reason === "refusal") return null;
  const text = (message.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("");
  if (text.length === 0 || text.length > MAX_RESPONSE_CHARS) return null;
  try {
    return JSON.parse(stripCodeFence(text)) as unknown;
  } catch {
    return null;
  }
}

function tokens(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export function createAnthropicTransport(
  config: AnthropicConfig,
  client: AnthropicClientLike = createAnthropicClient(config),
): ExternalAiTransport {
  return {
    name: ANTHROPIC_PROVIDER_NAME,
    model: config.model,

    async complete(request: SanitizedAiRequest): Promise<Result<AiGeneration>> {
      // Runtime twin of the type: only gateway output is ever sent.
      if (!isSanitizedRequest(request)) {
        console.error("[ai] anthropic transport refused a request that did not come from the Privacy Gateway.");
        return fail("privacy_gateway_refused", AGENT_ERROR_MESSAGES.privacy_gateway_refused);
      }

      // Overall deadline across the SDK's own retries.
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), config.timeoutMs * (config.maxRetries + 1) + 2_000);

      try {
        const message = await client.messages.create(
          {
            model: config.model,
            max_tokens: config.maxTokens,
            system: request.system,
            messages: [{ role: "user", content: request.user }],
          },
          { timeout: config.timeoutMs, maxRetries: config.maxRetries, signal: controller.signal },
        );

        return ok({
          raw: extractRawJson(message),
          usage: {
            provider: ANTHROPIC_PROVIDER_NAME,
            model: config.model,
            inputTokens:
              tokens(message.usage?.input_tokens) +
              tokens(message.usage?.cache_creation_input_tokens) +
              tokens(message.usage?.cache_read_input_tokens),
            outputTokens: tokens(message.usage?.output_tokens),
          },
        });
      } catch (cause) {
        // Kind and HTTP status only: never the message, the body or the prompt.
        const { kind, status } = classifyProviderError(cause);
        console.error(`[ai] anthropic call failed: kind=${kind} status=${status ?? "none"} task=${request.task}`);
        return fail("ai_provider_unavailable", AGENT_ERROR_MESSAGES.ai_provider_unavailable);
      } finally {
        clearTimeout(deadline);
      }
    },
  };
}
