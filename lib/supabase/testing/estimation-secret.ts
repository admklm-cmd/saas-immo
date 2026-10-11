import { randomBytes } from "node:crypto";

import type { Client as PgClient } from "pg";

/**
 * Integration-test helper (LOCAL stack only): returns the estimation IP-hash
 * signing secret installed in the database Vault, installing a random one
 * through the official installer if none exists yet (clean database without
 * `npm run db:seed`). Never hard-coded, never logged.
 *
 * Reading `vault.decrypted_secrets` requires the direct Postgres connection
 * the integration tests already use (`postgres` role); the Data API never
 * exposes it.
 */
export const ESTIMATION_IP_HMAC_SECRET_NAME = "estimation_ip_hmac_secret";

export async function ensureEstimationHmacSecret(pg: PgClient): Promise<string> {
  const existing = await pg.query<{ decrypted_secret: string | null }>(
    "select decrypted_secret from vault.decrypted_secrets where name = $1",
    [ESTIMATION_IP_HMAC_SECRET_NAME],
  );
  const current = existing.rows[0]?.decrypted_secret;
  if (current) return current;

  const generated = randomBytes(32).toString("hex");
  await pg.query("select public.set_estimation_ip_hmac_secret($1)", [generated]);
  return generated;
}
