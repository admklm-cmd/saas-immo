import { afterEach, describe, expect, it, vi } from "vitest";

import { createPseudonymSession } from "@/lib/privacy-gateway/pseudonyms";
import { sanitizeAiRequest } from "@/lib/privacy-gateway/sanitize";
import type { SanitizedAiRequest } from "@/lib/privacy-gateway/types";

import {
  ANTHROPIC_BASE_URL,
  classifyProviderError,
  createAnthropicClient,
  createAnthropicTransport,
  extractRawJson,
  readAnthropicConfig,
  type AnthropicClientLike,
  type AnthropicConfig,
  type AnthropicMessageLike,
} from "./anthropic";

/**
 * The real provider is never reached: every test injects a mocked SDK client.
 * `createAnthropicClient` is only CONSTRUCTED (no request is made).
 */

const SECRET_KEY = "sk-ant-test-0000000000000000";
const ENV = { ANTHROPIC_API_KEY: SECRET_KEY, AI_MODEL: "claude-haiku-5-5" };

const CONFIG: AnthropicConfig = {
  apiKey: SECRET_KEY,
  model: "claude-haiku-5-5",
  maxTokens: 1024,
  timeoutMs: 10_000,
  maxRetries: 1,
};

function sanitized(): SanitizedAiRequest {
  const outcome = sanitizeAiRequest(
    {
      task: "hugo_qualification",
      systemPrompt: "Tu es Hugo.",
      promptVersion: "test-v1",
      facts: { contact_stage: "nouveau" },
      untrusted: [{ label: "contact_notes", content: "Rappeler Camille Berthier au 06 39 98 10 01." }],
      privacy: { persons: [{ firstName: "Camille", lastName: "Berthier" }] },
    },
    createPseudonymSession(),
  );
  if (!outcome.ok) throw new Error("fixture request refused");
  return outcome.request;
}

function mockClient(create: AnthropicClientLike["messages"]["create"]) {
  const spy = vi.fn(create);
  return { client: { messages: { create: spy } } satisfies AnthropicClientLike, spy };
}

const answer = (text: string, extra: Partial<AnthropicMessageLike> = {}): AnthropicMessageLike => ({
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
  usage: { input_tokens: 120, output_tokens: 30 },
  ...extra,
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("readAnthropicConfig", () => {
  it("refuse explicitement sans clé, sans repli", () => {
    for (const key of [undefined, "", "   "]) {
      const result = readAnthropicConfig({ ...ENV, ANTHROPIC_API_KEY: key });
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("ai_provider_not_configured");
      expect(result.error?.message).toContain("clé d'API");
    }
  });

  it("refuse sans modèle ou avec un modèle mal formé : le modèle est une décision de budget", () => {
    for (const model of [undefined, "", "gpt-4", "claude-", "claude haiku", "claude-haiku-5-5; drop"]) {
      const result = readAnthropicConfig({ ...ENV, AI_MODEL: model });
      expect(result.error?.code, String(model)).toBe("ai_provider_not_configured");
      expect(result.error?.message).toContain("modèle");
    }
  });

  it("applique des valeurs par défaut bornées", () => {
    expect(readAnthropicConfig(ENV).data).toEqual({
      apiKey: SECRET_KEY,
      model: "claude-haiku-5-5",
      maxTokens: 2048,
      timeoutMs: 30_000,
      maxRetries: 1,
    });
  });

  it("refuse une limite hors bornes plutôt que de la corriger en silence", () => {
    for (const override of [
      { AI_MAX_OUTPUT_TOKENS: "999999" },
      { AI_MAX_OUTPUT_TOKENS: "10" },
      { AI_MAX_OUTPUT_TOKENS: "beaucoup" },
      { AI_TIMEOUT_MS: "1" },
      { AI_TIMEOUT_MS: "900000" },
      { AI_MAX_RETRIES: "10" },
      { AI_MAX_RETRIES: "-1" },
    ]) {
      const result = readAnthropicConfig({ ...ENV, ...override });
      expect(result.error?.code, JSON.stringify(override)).toBe("ai_provider_not_configured");
    }
    expect(readAnthropicConfig({ ...ENV, AI_MAX_RETRIES: "0", AI_MAX_OUTPUT_TOKENS: "4096", AI_TIMEOUT_MS: "20000" }).data).toMatchObject({
      maxRetries: 0,
      maxTokens: 4096,
      timeoutMs: 20_000,
    });
  });

  it("ne met jamais la clé dans un message d'erreur", () => {
    const result = readAnthropicConfig({ ...ENV, AI_MODEL: "n'importe quoi" });
    expect(JSON.stringify(result)).not.toContain(SECRET_KEY);
  });
});

describe("transport Anthropic (SDK simulé)", () => {
  it("n'envoie que le système, le message utilisateur assaini et les bornes, sans paramètre d'échantillonnage", async () => {
    const { client, spy } = mockClient(async () => answer('{"ok":true}'));
    const request = sanitized();
    const result = await createAnthropicTransport(CONFIG, client).complete(request);

    expect(result.error).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    const [params, options] = spy.mock.calls[0] ?? [];
    expect(Object.keys(params ?? {}).sort()).toEqual(["max_tokens", "messages", "model", "system"]);
    expect(params).toMatchObject({ model: "claude-haiku-5-5", max_tokens: 1024, system: request.system });
    expect(params?.messages).toEqual([{ role: "user", content: request.user }]);
    expect(options).toMatchObject({ timeout: 10_000, maxRetries: 1 });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(params)).not.toContain("Berthier");
    expect(JSON.stringify(params)).not.toContain("06 39 98 10 01");
  });

  it("refuse une requête qui ne vient pas de la Privacy Gateway, sans appel réseau", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, spy } = mockClient(async () => answer("{}"));
    const forged = { task: "hugo_qualification", promptVersion: "x", attempt: 1, system: "s", user: "Camille 06 39 98 10 01" } as unknown as SanitizedAiRequest;

    const result = await createAnthropicTransport(CONFIG, client).complete(forged);
    expect(result.error?.code).toBe("privacy_gateway_refused");
    expect(spy).not.toHaveBeenCalled();
  });

  it("renvoie le JSON brut non validé et compte les jetons, cache compris", async () => {
    const { client } = mockClient(async () =>
      answer('{"a":1}', { usage: { input_tokens: 100, output_tokens: 40, cache_creation_input_tokens: 10, cache_read_input_tokens: 5 } }),
    );
    const result = await createAnthropicTransport(CONFIG, client).complete(sanitized());
    expect(result.data).toEqual({
      raw: { a: 1 },
      usage: { provider: "anthropic", model: "claude-haiku-5-5", inputTokens: 115, outputTokens: 40 },
    });
  });

  it.each([
    ["```json\n{\"a\":1}\n```", { a: 1 }],
    ["pas du JSON", null],
    ["", null],
    ["{\"a\":", null],
  ])("extrait le JSON de %j", (text, expected) => {
    expect(extractRawJson(answer(text))).toEqual(expected);
  });

  it("traite une réponse tronquée ou refusée comme invalide (raw = null), sans l'utiliser", () => {
    expect(extractRawJson(answer('{"a":1}', { stop_reason: "max_tokens" }))).toBeNull();
    expect(extractRawJson(answer('{"a":1}', { stop_reason: "refusal" }))).toBeNull();
  });

  it("ignore les blocs de réflexion et ne lit que le texte", () => {
    const message: AnthropicMessageLike = {
      content: [
        { type: "thinking", text: "raisonnement qui ne doit pas être lu" },
        { type: "text", text: '{"a":2}' },
      ],
      stop_reason: "end_turn",
    };
    expect(extractRawJson(message)).toEqual({ a: 2 });
  });
});

describe("erreurs du fournisseur : jamais de détail technique", () => {
  const failures: [string, { name?: string; status?: number }][] = [
    ["délai dépassé", { name: "APIConnectionTimeoutError" }],
    ["clé refusée", { name: "AuthenticationError", status: 401 }],
    ["quota dépassé", { name: "RateLimitError", status: 429 }],
    ["erreur serveur", { name: "InternalServerError", status: 529 }],
    ["requête invalide", { name: "BadRequestError", status: 400 }],
    ["réseau coupé", { name: "APIConnectionError" }],
    ["erreur inconnue", {}],
  ];

  it.each(failures)("%s -> ai_provider_unavailable, sans fuite", async (_label, shape) => {
    const logged: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
    const secretBody = `bad request for ${SECRET_KEY} prompt=Rappeler Camille`;
    const { client } = mockClient(async () => {
      throw Object.assign(new Error(secretBody), shape);
    });

    const result = await createAnthropicTransport(CONFIG, client).complete(sanitized());

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("ai_provider_unavailable");
    expect(JSON.stringify(result)).not.toContain(SECRET_KEY);
    expect(JSON.stringify(result)).not.toContain("Camille");
    const everything = logged.join("\n");
    expect(everything).not.toContain(SECRET_KEY);
    expect(everything).not.toContain("Camille");
    expect(everything).not.toContain("bad request");
    expect(everything).toContain("[ai] anthropic call failed");
  });

  it("classe les erreurs sans lire leur message", () => {
    expect(classifyProviderError({ name: "APIConnectionTimeoutError" }).kind).toBe("timeout");
    expect(classifyProviderError({ status: 403 }).kind).toBe("auth");
    expect(classifyProviderError({ status: 429 }).kind).toBe("rate_limit");
    expect(classifyProviderError({ status: 503 }).kind).toBe("server");
    expect(classifyProviderError({ status: 422 }).kind).toBe("bad_request");
    expect(classifyProviderError(null).kind).toBe("unknown");
  });

  it("coupe l'appel au délai global même si le SDK ne rend jamais la main", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = mockClient(
      (_params, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        }),
    );

    const pending = createAnthropicTransport({ ...CONFIG, timeoutMs: 1_000, maxRetries: 1 }, client).complete(sanitized());
    await vi.advanceTimersByTimeAsync(1_000 * 2 + 2_000);
    const result = await pending;
    expect(result.error?.code).toBe("ai_provider_unavailable");
  });
});

describe("construction du vrai client (aucun appel réseau)", () => {
  it("épingle l'URL, coupe les logs du SDK et ignore les variables d'environnement du SDK", () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://exemple-malveillant.test");
    vi.stubEnv("ANTHROPIC_LOG", "debug");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "jeton-parasite");
    const client = createAnthropicClient(CONFIG) as unknown as {
      baseURL: string;
      logLevel: string;
      authToken: string | null;
      apiKey: string | null;
      maxRetries: number;
      timeout: number;
    };
    expect(client.baseURL).toBe(ANTHROPIC_BASE_URL);
    expect(client.logLevel).toBe("off");
    expect(client.authToken).toBeNull();
    expect(client.apiKey).toBe(SECRET_KEY);
    expect(client.maxRetries).toBe(1);
    expect(client.timeout).toBe(10_000);
  });
});
