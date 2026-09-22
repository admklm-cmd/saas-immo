/**
 * Public estimation request — visitor IP handling.
 *
 * The raw IP address of a visitor is NEVER stored and never reaches the
 * browser: only a salted SHA-256 hash is sent to the database, and only to
 * feed the rate limiter (`private.estimation_submissions`).
 *
 * The salt comes exclusively from the server-only environment variable
 * `ESTIMATION_IP_HASH_SALT`. There is deliberately **no fallback value**: a
 * hard-coded default committed to this repository would be public, and an
 * attacker who obtained the database could then brute-force the whole IPv4
 * space in seconds and recover every visitor's address — the hash would only
 * look like anonymisation. CLAUDE.md forbids any hard-coded secret, and this
 * is exactly why.
 *
 * Consequence, enforced in `estimation.ts`: when the variable is missing,
 * empty or too short, the request is refused BEFORE any write, the visitor
 * gets a generic French message, and the technical cause is logged
 * server-side only.
 *
 * Pure module (no `next/headers`, no Supabase): unit-tested directly in
 * `ip-hash.test.ts`.
 */

import { createHash } from "node:crypto";

/**
 * Minimum accepted length for `ESTIMATION_IP_HASH_SALT`.
 *
 * `openssl rand -hex 32` (the documented way to generate it, see
 * `.env.example`) produces 64 hexadecimal characters / 256 bits of entropy.
 * 32 characters is the floor below which we refuse to run at all: anything
 * shorter is plausibly a human-typed placeholder rather than a random secret.
 */
export const MIN_IP_HASH_SALT_LENGTH = 32;

/** Bucket used when no proxy header carries a client IP (e.g. local `next dev` without a reverse proxy). */
export const UNKNOWN_IP_BUCKET = "unknown";

/** Why the salt was rejected. Server-side diagnostics only — never returned to the visitor. */
export type IpHashSaltProblem = "missing" | "too_short";

export type IpHashSaltResolution =
  | { ok: true; salt: string }
  | { ok: false; problem: IpHashSaltProblem };

/**
 * Reads and validates the IP-hash salt from the server environment.
 * Returns a discriminated result instead of throwing, so the caller can stop
 * before writing anything and return the project's `{ data, error }` shape.
 */
export function resolveIpHashSalt(): IpHashSaltResolution {
  const raw = process.env.ESTIMATION_IP_HASH_SALT;
  const salt = typeof raw === "string" ? raw.trim() : "";
  if (salt.length === 0) return { ok: false, problem: "missing" };
  if (salt.length < MIN_IP_HASH_SALT_LENGTH) return { ok: false, problem: "too_short" };
  return { ok: true, salt };
}

/**
 * Explicit, actionable server log for an administrator. Contains no secret
 * value (only the variable name and the rule it broke) and is never sent to
 * the client.
 */
export function ipHashSaltLogMessage(problem: IpHashSaltProblem): string {
  const howTo =
    `set it to a random value of at least ${MIN_IP_HASH_SALT_LENGTH} characters ` +
    "(generate one with `openssl rand -hex 32`) and restart the server";
  if (problem === "missing") {
    return (
      "[estimation] ESTIMATION_IP_HASH_SALT is not set: refusing to store any estimation request. " +
      `There is no fallback salt by design (it would make the IP hash reversible) — ${howTo}.`
    );
  }
  return (
    `[estimation] ESTIMATION_IP_HASH_SALT is shorter than ${MIN_IP_HASH_SALT_LENGTH} characters: ` +
    `refusing to store any estimation request — ${howTo}.`
  );
}

/** Salted SHA-256 of the visitor's IP address. The raw address is never stored. */
export function hashClientIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Number of reverse proxies WE control in front of the application.
 *
 * `x-forwarded-for` is a list the client starts and each proxy appends to, so
 * the LEFTMOST entry is whatever the caller claimed and the RIGHTMOST entries
 * are the ones our own proxies added. With one nginx in front (the planned VPS
 * deployment, see docs/security.md §4), the last entry is the only one a
 * visitor cannot choose. Raise this only if more proxies we control are added
 * in front — a value that is too high hands the choice back to the caller.
 */
export const TRUSTED_PROXY_HOPS = 1;

/** Upper bound on the bucket key: the header is attacker-sized, the hash is not. */
const MAX_IP_LENGTH = 64;

/**
 * Normalises a client IP into a stable rate-limit bucket key: lower case,
 * without the `[...]` of a bracketed IPv6 address and without a trailing
 * `:port`. Without this, the SAME address written in several shapes
 * (`1.2.3.4` / `1.2.3.4:5678` / `[::1]:443` / mixed-case IPv6) would land in
 * as many different buckets and multiply the allowance.
 */
function normaliseIp(value: string): string {
  let ip = value.trim().toLowerCase().slice(0, MAX_IP_LENGTH);
  const bracketed = /^\[(.+)\](?::\d+)?$/.exec(ip);
  if (bracketed?.[1]) ip = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));
  return ip;
}

/**
 * Best-effort client IP, read from request headers only — never from a form
 * field.
 *
 * These headers are only trustworthy behind OUR OWN reverse proxy: in this
 * prototype nothing sits in front of `next dev`, so a caller can still send
 * whatever they like and land in the bucket of their choice. What this
 * function does guarantee, once a proxy IS in front, is that prepending a
 * forged entry to `x-forwarded-for` does NOT move the caller to a fresh
 * bucket: the entry appended by our own proxy is the one used
 * (`TRUSTED_PROXY_HOPS`). The database-side rate limit therefore never
 * depends solely on this value being real — see docs/security.md §2.8 for
 * what per-IP counting does and does not cover.
 */
export function resolveClientIp(headerList: Headers): string {
  const entries = (headerList.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (entries.length > 0) {
    // Clamp the index: fewer entries than trusted hops means the request did
    // not come through the expected proxy chain, so use the oldest entry
    // available rather than falling back to the caller's own claim.
    const index = Math.max(0, entries.length - TRUSTED_PROXY_HOPS);
    const candidate = entries[index];
    if (candidate) return normaliseIp(candidate);
  }
  const real = headerList.get("x-real-ip")?.trim();
  if (real) return normaliseIp(real);
  return UNKNOWN_IP_BUCKET;
}
