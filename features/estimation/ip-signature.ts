/**
 * Public estimation request — signature of the rate-limit bucket (SEC-001).
 *
 * `public.submit_estimation_request` is executable by `anon`: anyone holding
 * the public key can call it directly, without going through the Next.js
 * server. Before SEC-001, the caller chose `p_ip_hash` freely and could
 * therefore land in a fresh rate-limit bucket on every call.
 *
 * Now the Next.js server computes the IP hash (`ip-hash.ts`) and SIGNS it:
 *
 *   signature = HMAC-SHA256(secret, "estimation-ip:v1:<ip_hash>:<issued_at>")
 *
 * where `issued_at` is a Unix time in seconds. The database recomputes the same
 * HMAC with the same secret (kept in Supabase Vault, never in a migration nor
 * in Git) and refuses the call when the signature does not match or is older
 * than `ESTIMATION_IP_SIGNATURE_MAX_AGE_SECONDS`. Without the secret, a direct
 * caller cannot produce a valid signature for any bucket of their choosing,
 * and a signature captured for one hash cannot be reused with another.
 *
 * The secret comes exclusively from the server-only environment variable
 * `ESTIMATION_IP_HMAC_SECRET` — no fallback, same reasoning as the IP-hash
 * salt: a default value committed here would be public.
 *
 * Pure module (no `next/headers`, no Supabase): unit-tested directly in
 * `ip-signature.test.ts`. The signature never reaches the browser: it is
 * computed and used inside the server action only.
 */

import { createHmac } from "node:crypto";

/** Must match `max_age` in `public.submit_estimation_request` (migration 20261010130000). */
export const ESTIMATION_IP_SIGNATURE_MAX_AGE_SECONDS = 60;

/** Domain-separation prefix; bump the version in BOTH places if the format changes. */
export const ESTIMATION_IP_SIGNATURE_PREFIX = "estimation-ip:v1";

/** Same floor as the IP-hash salt: `openssl rand -hex 32` gives 64 characters. */
export const MIN_IP_HMAC_SECRET_LENGTH = 32;

export type IpHmacSecretProblem = "missing" | "too_short";

export type IpHmacSecretResolution =
  | { ok: true; secret: string }
  | { ok: false; problem: IpHmacSecretProblem };

export type SignedIpHash = {
  ipHash: string;
  /** Unix time in seconds. */
  issuedAt: number;
  /** Lower-case hexadecimal HMAC-SHA256. */
  signature: string;
};

/** Reads and validates the signing secret from the server environment. Never throws. */
export function resolveIpHmacSecret(): IpHmacSecretResolution {
  const raw = process.env.ESTIMATION_IP_HMAC_SECRET;
  const secret = typeof raw === "string" ? raw.trim() : "";
  if (secret.length === 0) return { ok: false, problem: "missing" };
  if (secret.length < MIN_IP_HMAC_SECRET_LENGTH) return { ok: false, problem: "too_short" };
  return { ok: true, secret };
}

/** Server-side diagnostic only: names the variable, never contains its value. */
export function ipHmacSecretLogMessage(problem: IpHmacSecretProblem): string {
  const howTo =
    `set it to the same random value (at least ${MIN_IP_HMAC_SECRET_LENGTH} characters) as the one ` +
    "installed in the database Vault by `npm run db:seed`, and restart the server";
  if (problem === "missing") {
    return `[estimation] ESTIMATION_IP_HMAC_SECRET is not set: refusing to submit any estimation request — ${howTo}.`;
  }
  return (
    `[estimation] ESTIMATION_IP_HMAC_SECRET is shorter than ${MIN_IP_HMAC_SECRET_LENGTH} characters: ` +
    `refusing to submit any estimation request — ${howTo}.`
  );
}

/** Exact message the database signs over. */
export function ipSignaturePayload(ipHash: string, issuedAt: number): string {
  return `${ESTIMATION_IP_SIGNATURE_PREFIX}:${ipHash}:${issuedAt}`;
}

/** Signs an IP hash at `now` (defaults to the current time). */
export function signIpHash(ipHash: string, secret: string, now: Date = new Date()): SignedIpHash {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const signature = createHmac("sha256", secret).update(ipSignaturePayload(ipHash, issuedAt), "utf8").digest("hex");
  return { ipHash, issuedAt, signature };
}
