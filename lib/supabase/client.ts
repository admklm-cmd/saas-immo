import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * Supabase client for Client Components (browser).
 *
 * Uses the publishable key only: every read and write is subject to RLS.
 */
export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
