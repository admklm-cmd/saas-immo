import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * Session refresh for the Next.js 16 proxy (`proxy.ts` at the project root,
 * formerly `middleware.ts`). SEC-003.
 *
 * Server Components cannot write cookies (`lib/supabase/server.ts` swallows
 * that error on purpose). Without this proxy, an expired access token was
 * refreshed during a render but the new tokens were never sent back to the
 * browser: the session degraded silently instead of being renewed.
 *
 * Follows the official `@supabase/ssr` pattern for Next.js (Supabase example
 * `examples/auth/nextjs/lib/supabase/proxy.ts`, @supabase/ssr 0.12):
 *   * a new server client per request, never a global one;
 *   * `auth.getClaims()` called IMMEDIATELY after creating the client: it
 *     validates the JWT and, when it has expired, refreshes the session, which
 *     calls `setAll` with the new cookies;
 *   * `setAll` writes the cookies on the REQUEST (so the Server Components of
 *     this same navigation see the fresh session) and on the RESPONSE (so the
 *     browser stores it), and applies the anti-cache headers the library hands
 *     over (`Cache-Control: private, no-store…`), so that no CDN or reverse
 *     proxy ever serves one user's session cookie to another;
 *   * the response built by the LAST `setAll` call is the one returned.
 *
 * Deliberately NOT done here: authorisation. Every private page and every
 * server action keeps calling `auth.getUser()` itself and redirects to
 * `/connexion` on its own (CLAUDE.md: each one re-checks the session). The
 * proxy only keeps the cookies fresh, it never decides who may see what.
 *
 * Failure mode: if Supabase is unreachable, the request continues unchanged
 * (the pages then treat the user as signed out, exactly as before). The proxy
 * must never take the public site down.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  try {
    const { url, publishableKey } = getSupabasePublicEnv();

    const supabase = createServerClient<Database>(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    });

    // Nothing between createServerClient and getClaims (official guidance):
    // this call is what refreshes an expired session.
    await supabase.auth.getClaims();
  } catch (error) {
    console.error(
      `[proxy] session refresh skipped: ${error instanceof Error ? error.name : "unknown error"}`,
    );
  }

  return response;
}
