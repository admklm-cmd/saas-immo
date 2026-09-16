import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * Supabase client for Server Components, server actions and route handlers.
 *
 * Acts on behalf of the signed-in user (session cookies): every query is
 * subject to RLS. Create a new client per request, never store it globally.
 *
 * Follows the official @supabase/ssr pattern for the Next.js App Router.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore once a proxy refreshes the session on each request.
        }
      },
    },
  });
}
