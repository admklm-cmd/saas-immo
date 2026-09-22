import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hashClientIp,
  ipHashSaltLogMessage,
  MIN_IP_HASH_SALT_LENGTH,
  resolveClientIp,
  resolveIpHashSalt,
  UNKNOWN_IP_BUCKET,
} from "./ip-hash";

/**
 * Test-only salt. Prefixed `test-only-` so it can never be confused with a
 * real secret, and only ever lives in test files / `process.env` overrides —
 * never in a committed source or documentation file. Redeclared (rather than
 * exported and imported) in each test file that needs it: importing a
 * `*.test.ts` module from another one would make Vitest collect its tests
 * twice.
 */
const TEST_ONLY_IP_HASH_SALT = "test-only-estimation-ip-hash-salt-0000000000";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveIpHashSalt", () => {
  it("accepte une valeur suffisamment longue", () => {
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", TEST_ONLY_IP_HASH_SALT);
    expect(resolveIpHashSalt()).toEqual({ ok: true, salt: TEST_ONLY_IP_HASH_SALT });
  });

  it("rejette une variable absente", () => {
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", undefined);
    expect(resolveIpHashSalt()).toEqual({ ok: false, problem: "missing" });
  });

  it("rejette une variable vide ou remplie d'espaces", () => {
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", "");
    expect(resolveIpHashSalt()).toEqual({ ok: false, problem: "missing" });
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", "      ");
    expect(resolveIpHashSalt()).toEqual({ ok: false, problem: "missing" });
  });

  it("rejette une valeur trop courte, y compris juste en dessous du minimum", () => {
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", "test-only-short");
    expect(resolveIpHashSalt()).toEqual({ ok: false, problem: "too_short" });

    const justUnder = "a".repeat(MIN_IP_HASH_SALT_LENGTH - 1);
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", justUnder);
    expect(resolveIpHashSalt()).toEqual({ ok: false, problem: "too_short" });
  });

  it("accepte exactement la longueur minimale", () => {
    const exact = "b".repeat(MIN_IP_HASH_SALT_LENGTH);
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", exact);
    expect(resolveIpHashSalt()).toEqual({ ok: true, salt: exact });
  });

  it("ne compte pas les espaces de bordure dans la longueur", () => {
    const padded = `   ${"c".repeat(MIN_IP_HASH_SALT_LENGTH - 2)}   `;
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", padded);
    expect(resolveIpHashSalt()).toEqual({ ok: false, problem: "too_short" });
  });

  it("exige un minimum d'au moins 32 caractères (le seuil ne doit pas être affaibli)", () => {
    expect(MIN_IP_HASH_SALT_LENGTH).toBeGreaterThanOrEqual(32);
  });
});

describe("ipHashSaltLogMessage", () => {
  it("nomme la variable et la marche à suivre, pour l'administrateur", () => {
    for (const problem of ["missing", "too_short"] as const) {
      const message = ipHashSaltLogMessage(problem);
      expect(message).toContain("ESTIMATION_IP_HASH_SALT");
      expect(message).toContain("openssl rand -hex 32");
    }
  });

  it("ne contient jamais la valeur du sel", () => {
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", TEST_ONLY_IP_HASH_SALT);
    expect(ipHashSaltLogMessage("too_short")).not.toContain(TEST_ONLY_IP_HASH_SALT);
  });
});

describe("hashClientIp", () => {
  it("produit un SHA-256 salé en hexadécimal, sans l'adresse en clair", () => {
    const hash = hashClientIp("203.0.113.7", TEST_ONLY_IP_HASH_SALT);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.7");
    expect(hash).toBe(
      createHash("sha256").update(`${TEST_ONLY_IP_HASH_SALT}:203.0.113.7`).digest("hex"),
    );
  });

  it("donne un résultat différent pour un sel différent (le sel est bien utilisé)", () => {
    const a = hashClientIp("203.0.113.7", TEST_ONLY_IP_HASH_SALT);
    const b = hashClientIp("203.0.113.7", `${TEST_ONLY_IP_HASH_SALT}-other`);
    expect(a).not.toBe(b);
  });

  it("est stable pour une même adresse et un même sel (limitation de débit fiable)", () => {
    expect(hashClientIp("198.51.100.4", TEST_ONLY_IP_HASH_SALT)).toBe(
      hashClientIp("198.51.100.4", TEST_ONLY_IP_HASH_SALT),
    );
  });
});

describe("resolveClientIp", () => {
  it("prend l'adresse ajoutée par notre propre proxy, pas celle annoncée par l'appelant", () => {
    // `x-forwarded-for` est une liste que le client commence et que chaque
    // proxy complète : la dernière entrée est celle de notre nginx.
    const headerList = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" });
    expect(resolveClientIp(headerList)).toBe("70.41.3.18");
  });

  it("ne crée pas un nouveau compartiment quand l'appelant préfixe des adresses forgées", () => {
    // Même visiteur (70.41.3.18 vu par le proxy), trois en-têtes forgés
    // différents : une seule et même empreinte, donc un seul compteur.
    const forged = ["1.1.1.1", "2.2.2.2, 3.3.3.3", "eviter-la-limite"].map((prefix) =>
      resolveClientIp(new Headers({ "x-forwarded-for": `${prefix}, 70.41.3.18` })),
    );
    expect(new Set(forged).size).toBe(1);
    expect(forged[0]).toBe("70.41.3.18");
  });

  it("utilise l'unique entrée disponible quand aucun proxy n'a complété l'en-tête", () => {
    expect(resolveClientIp(new Headers({ "x-forwarded-for": " 203.0.113.7 " }))).toBe("203.0.113.7");
  });

  it("se replie sur x-real-ip", () => {
    const headerList = new Headers({ "x-real-ip": " 198.51.100.4 " });
    expect(resolveClientIp(headerList)).toBe("198.51.100.4");
  });

  it("renvoie le compartiment `unknown` sans en-tête exploitable", () => {
    expect(resolveClientIp(new Headers())).toBe(UNKNOWN_IP_BUCKET);
    expect(resolveClientIp(new Headers({ "x-forwarded-for": "  " }))).toBe(UNKNOWN_IP_BUCKET);
  });

  it("ramène une même adresse écrite de plusieurs façons au même compartiment", () => {
    const variants = ["70.41.3.18", "70.41.3.18:54321", " 70.41.3.18 "].map((value) =>
      resolveClientIp(new Headers({ "x-forwarded-for": value })),
    );
    expect(new Set(variants)).toEqual(new Set(["70.41.3.18"]));

    const ipv6 = ["2001:DB8::1", "[2001:db8::1]", "[2001:db8::1]:443"].map((value) =>
      resolveClientIp(new Headers({ "x-forwarded-for": value })),
    );
    expect(new Set(ipv6)).toEqual(new Set(["2001:db8::1"]));
  });

  it("borne la longueur de l'empreinte même avec un en-tête démesuré", () => {
    const huge = "9".repeat(5_000);
    expect(resolveClientIp(new Headers({ "x-forwarded-for": huge })).length).toBeLessThanOrEqual(64);
  });
});
