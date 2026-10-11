import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { assertLocalSupabaseUrl, assertNotProduction } from "@/lib/supabase/local-only";
import type { Database } from "@/types/database";

/**
 * Single entry point of the E2E tooling towards the LOCAL Supabase stack
 * (global setup + helpers that prepare a journey's starting state).
 *
 * Safety rules, identical to the fixtures loader: local Supabase only, never a
 * production environment, no hard-coded secret — everything comes from the
 * environment. The guards themselves live in `lib/supabase/local-only.ts` and
 * are shared with the fixtures loader and the integration tests.
 */

export const E2E_CONTEXT = "E2E tests";

/** Playwright always runs from the project root. */
const ROOT = process.cwd();

let loaded = false;

/**
 * Loads `.env.local` then `.env`, as Next.js does.
 *
 * `process.loadEnvFile` never overwrites an already-defined variable, so the
 * precedence is: shell environment > .env.local > .env.
 */
export function loadLocalEnv(): void {
  if (loaded) return;
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(path.join(ROOT, file));
    } catch {
      // Missing file: the variables may already come from the shell.
    }
  }
  loaded = true;
}

/** Secret-key client, restricted to the local stack by the shared guards. */
export function adminClient(): SupabaseClient<Database> {
  loadLocalEnv();
  assertNotProduction(E2E_CONTEXT);
  const url = assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, E2E_CONTEXT);
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(`${E2E_CONTEXT}: missing SUPABASE_SECRET_KEY (see .env.example, \`npx supabase status\`).`);
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
