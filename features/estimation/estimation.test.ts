import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mapEstimationDatabaseError, submitEstimationRequestForClient, type TypedClient } from "./estimation";
import { ESTIMATION_ERROR_MESSAGES, type EstimationRequestInput } from "./types";

/**
 * Test-only salt: prefixed `test-only-` so it can never pass for a real
 * secret, and injected through `process.env` here only — never committed to a
 * source or documentation file. `features/estimation/ip-hash.test.ts` covers
 * the validation rules themselves; this file checks what the request path
 * does when the variable is missing or too short.
 */
const TEST_ONLY_IP_HASH_SALT = "test-only-estimation-ip-hash-salt-0000000000";

const TEST_CLIENT_IP = "203.0.113.7";
const EXPECTED_IP_HASH = createHash("sha256")
  .update(`${TEST_ONLY_IP_HASH_SALT}:${TEST_CLIENT_IP}`)
  .digest("hex");

function validInput(overrides: Partial<EstimationRequestInput> = {}): EstimationRequestInput {
  return {
    firstName: "Camille",
    lastName: "Berthier",
    email: "camille.berthier@example.test",
    phone: "06 12 34 56 78",
    propertyType: "appartement",
    city: "La Ciotat",
    postalCode: "13600",
    surfaceM2: 68,
    rooms: 3,
    message: "Bonjour, je souhaite une estimation de mon appartement.",
    consents: { email: true, sms: false, whatsapp: false, phone: false },
    website: "",
    ...overrides,
  };
}

function mockClient(rpcResult: { error: { message: string; code?: string } | null }): {
  client: TypedClient;
  rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { client: { rpc } as unknown as TypedClient, rpc };
}

describe("mapEstimationDatabaseError", () => {
  it("mappe le code de limitation de débit", () => {
    expect(mapEstimationDatabaseError("estimation_rate_limited")).toBe("rate_limited");
  });

  it("mappe le code de validation invalide", () => {
    expect(mapEstimationDatabaseError("estimation_request_invalid")).toBe("validation_failed");
  });

  it("mappe le refus de caractères de contrôle de la base sur le même message qu'une validation", () => {
    // `private.guard_inbound_lead_text()` (migration 20260923090000) : un
    // appelant direct du RPC n'apprend pas quel garde-fou l'a arrêté.
    expect(mapEstimationDatabaseError("inbound_lead_unsafe_text")).toBe("validation_failed");
  });

  it("replie toute autre erreur (y compris l'agence indisponible) sur un message générique", () => {
    expect(mapEstimationDatabaseError("estimation_agency_unavailable")).toBe("unavailable");
    expect(mapEstimationDatabaseError("connection refused")).toBe("unavailable");
    expect(mapEstimationDatabaseError(undefined)).toBe("unavailable");
  });
});

describe("submitEstimationRequestForClient", () => {
  beforeEach(() => {
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", TEST_ONLY_IP_HASH_SALT);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renvoie un succès et appelle le RPC avec les bons arguments", async () => {
    const { client, rpc } = mockClient({ error: null });

    const result = await submitEstimationRequestForClient(client, validInput(), {
      clientIp: "203.0.113.7",
      userAgent: "vitest",
    });

    expect(result).toEqual({ data: { status: "received" }, error: null });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("submit_estimation_request");
    expect(args).toMatchObject({
      p_first_name: "Camille",
      p_last_name: "Berthier",
      p_email: "camille.berthier@example.test",
      p_phone: "06 12 34 56 78",
      p_property_type: "apartment",
      p_city: "La Ciotat",
      p_postal_code: "13600",
      // Salted SHA-256, computed here from the raw IP: the address itself
      // never reaches the database.
      p_ip_hash: EXPECTED_IP_HASH,
      p_user_agent: "vitest",
      p_website: "",
    });
    expect(args.p_ip_hash).not.toBe(TEST_CLIENT_IP);
    expect(JSON.stringify(args)).not.toContain(TEST_CLIENT_IP);
    expect(JSON.stringify(args)).not.toContain(TEST_ONLY_IP_HASH_SALT);
    // No `agency_id` in the arguments at all: the target agency is resolved
    // entirely server-side, inside the database function.
    expect(args).not.toHaveProperty("agency_id");
    expect(args).not.toHaveProperty("p_agency_id");
  });

  it("ne fait AUCUN appel réseau quand la validation zod échoue", async () => {
    const { client, rpc } = mockClient({ error: null });

    const result = await submitEstimationRequestForClient(client, validInput({ email: null, phone: null }), {
      clientIp: "203.0.113.7",
      userAgent: "vitest",
    });

    expect(result.error?.code).toBe("validation_failed");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ne fait AUCUN appel réseau quand le champ piège est rempli", async () => {
    const { client, rpc } = mockClient({ error: null });

    const result = await submitEstimationRequestForClient(
      client,
      validInput({ website: "http://spam.example" }),
      { clientIp: "203.0.113.7", userAgent: "vitest" },
    );

    expect(result.error?.code).toBe("validation_failed");
    expect(result.error?.message).toBe(ESTIMATION_ERROR_MESSAGES.validation_failed);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuse sans appel réseau quand aucune adresse IP n'a été résolue", async () => {
    const { client, rpc } = mockClient({ error: null });

    const result = await submitEstimationRequestForClient(client, validInput(), {
      clientIp: "",
      userAgent: "vitest",
    });

    expect(result.error?.code).toBe("validation_failed");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("traduit une erreur de limitation de débit renvoyée par la base en message clair", async () => {
    const { client } = mockClient({ error: { message: "estimation_rate_limited" } });

    const result = await submitEstimationRequestForClient(client, validInput(), {
      clientIp: "203.0.113.7",
      userAgent: "vitest",
    });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("rate_limited");
    expect(result.error?.message).toBe(ESTIMATION_ERROR_MESSAGES.rate_limited);
  });

  it("ne renvoie jamais le détail technique d'une erreur de base inattendue", async () => {
    const { client } = mockClient({ error: { message: "relation \"public.consents\" does not exist" } });

    const result = await submitEstimationRequestForClient(client, validInput(), {
      clientIp: "203.0.113.7",
      userAgent: "vitest",
    });

    expect(result.error?.code).toBe("unavailable");
    expect(result.error?.message).not.toContain("relation");
    expect(result.error?.message).toBe(ESTIMATION_ERROR_MESSAGES.unavailable);
  });
});

/**
 * No hard-coded fallback salt exists (see `ip-hash.ts`): a misconfigured
 * server must refuse the request instead of storing an IP hash that could be
 * brute-forced. Here at unit level we prove the database is never even
 * contacted; `estimation.integration.test.ts` proves, by counting rows, that
 * nothing at all is written.
 */
describe("submitEstimationRequestForClient — sel de hachage d'IP manquant ou trop court", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const cases: ReadonlyArray<{ label: string; value: string | undefined }> = [
    { label: "absent", value: undefined },
    { label: "vide", value: "" },
    { label: "uniquement des espaces", value: "   " },
    { label: "trop court", value: "test-only-court" },
  ];

  for (const { label, value } of cases) {
    it(`refuse la demande sans aucun appel à la base quand le sel est ${label}`, async () => {
      vi.stubEnv("ESTIMATION_IP_HASH_SALT", value);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const { client, rpc } = mockClient({ error: null });

      const result = await submitEstimationRequestForClient(client, validInput(), {
        clientIp: TEST_CLIENT_IP,
        userAgent: "vitest",
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("unavailable");
      expect(result.error?.message).toBe(ESTIMATION_ERROR_MESSAGES.unavailable);
      // The whole point: nothing is written, because nothing is even sent.
      expect(rpc).not.toHaveBeenCalled();
      // The administrator gets an explicit server-side diagnosis.
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(String(consoleError.mock.calls[0]?.[0])).toContain("ESTIMATION_IP_HASH_SALT");
    });
  }

  it("ne laisse fuir aucun détail technique dans le message du visiteur", async () => {
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = mockClient({ error: null });

    const result = await submitEstimationRequestForClient(client, validInput(), {
      clientIp: TEST_CLIENT_IP,
      userAgent: "vitest",
    });

    const message = result.error?.message ?? "";
    expect(message).toBe(ESTIMATION_ERROR_MESSAGES.unavailable);
    for (const forbidden of [
      "ESTIMATION_IP_HASH_SALT",
      "salt",
      "sel",
      "hash",
      "SHA-256",
      "variable",
      "configuration",
      "process.env",
    ]) {
      expect(message.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("refuse avant même la validation zod : une demande invalide ET un sel manquant ne touchent pas la base", async () => {
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, rpc } = mockClient({ error: null });

    const result = await submitEstimationRequestForClient(
      client,
      validInput({ email: null, phone: null }),
      { clientIp: TEST_CLIENT_IP, userAgent: "vitest" },
    );

    expect(result.error?.code).toBe("unavailable");
    expect(rpc).not.toHaveBeenCalled();
  });
});
