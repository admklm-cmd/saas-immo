import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ESTIMATION_IP_SIGNATURE_MAX_AGE_SECONDS,
  ipHmacSecretLogMessage,
  ipSignaturePayload,
  MIN_IP_HMAC_SECRET_LENGTH,
  resolveIpHmacSecret,
  signIpHash,
} from "./ip-signature";

const SECRET = "a".repeat(64);
const HASH = "f".repeat(64);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveIpHmacSecret", () => {
  it("refuse une variable absente ou vide (aucune valeur de repli)", () => {
    vi.stubEnv("ESTIMATION_IP_HMAC_SECRET", "");
    expect(resolveIpHmacSecret()).toEqual({ ok: false, problem: "missing" });
    vi.stubEnv("ESTIMATION_IP_HMAC_SECRET", "   ");
    expect(resolveIpHmacSecret()).toEqual({ ok: false, problem: "missing" });
  });

  it("refuse un secret trop court", () => {
    vi.stubEnv("ESTIMATION_IP_HMAC_SECRET", "x".repeat(MIN_IP_HMAC_SECRET_LENGTH - 1));
    expect(resolveIpHmacSecret()).toEqual({ ok: false, problem: "too_short" });
  });

  it("accepte un secret suffisamment long (espaces de bord retirés)", () => {
    vi.stubEnv("ESTIMATION_IP_HMAC_SECRET", `  ${SECRET}  `);
    expect(resolveIpHmacSecret()).toEqual({ ok: true, secret: SECRET });
  });

  it("le message de journal nomme la variable sans jamais contenir de valeur", () => {
    for (const problem of ["missing", "too_short"] as const) {
      const message = ipHmacSecretLogMessage(problem);
      expect(message).toContain("ESTIMATION_IP_HMAC_SECRET");
      expect(message).not.toContain(SECRET);
    }
  });
});

describe("signIpHash", () => {
  const now = new Date("2026-10-10T12:00:00.900Z");

  it("signe exactement « estimation-ip:v1:<hash>:<secondes> » en HMAC-SHA256 hexadécimal", () => {
    const signed = signIpHash(HASH, SECRET, now);
    expect(signed.issuedAt).toBe(Math.floor(now.getTime() / 1000));
    expect(ipSignaturePayload(HASH, signed.issuedAt)).toBe(`estimation-ip:v1:${HASH}:${signed.issuedAt}`);
    const expected = createHmac("sha256", SECRET)
      .update(`estimation-ip:v1:${HASH}:${signed.issuedAt}`)
      .digest("hex");
    expect(signed.signature).toBe(expected);
    expect(signed.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("la signature dépend du hash, de l'instant et du secret", () => {
    const base = signIpHash(HASH, SECRET, now).signature;
    expect(signIpHash("e".repeat(64), SECRET, now).signature).not.toBe(base);
    expect(signIpHash(HASH, SECRET, new Date(now.getTime() + 1000)).signature).not.toBe(base);
    expect(signIpHash(HASH, "b".repeat(64), now).signature).not.toBe(base);
  });

  it("fenêtre de validité courte (60 s maximum)", () => {
    expect(ESTIMATION_IP_SIGNATURE_MAX_AGE_SECONDS).toBeLessThanOrEqual(60);
  });
});
