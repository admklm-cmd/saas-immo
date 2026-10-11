import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Supabase admin client (secret / service_role key) — BYPASSES RLS.
 *
 * RESTRICTED USAGE: only for precise server-side tasks that must legitimately
 * bypass RLS (local fixtures loader, scheduled jobs). Never use it in a code
 * path triggered directly by a user request (page, server action, route
 * handler): use `lib/supabase/server.ts` instead.
 *
 * Two safety nets prevent it from reaching the browser:
 * - `import "server-only"` makes the Next.js build fail if a Client Component
 *   imports this module;
 * - a runtime guard throws if a `window` global exists.
 */

const BROWSER_ERROR = "lib/supabase/admin.ts must never run in a browser environment.";

export function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error(BROWSER_ERROR);
  }
}

// Fail as early as possible: at module evaluation.
assertServerRuntime();

export function createAdminClient() {
  assertServerRuntime();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing Supabase admin configuration: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example).",
    );
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
