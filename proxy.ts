import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 proxy (formerly `middleware.ts`): refreshes the Supabase session
 * cookies before each page / server action renders. SEC-003.
 *
 * It does NOT authorise anything: private pages and server actions still check
 * `auth.getUser()` themselves. Security headers (CSP…) stay defined in
 * `next.config.ts` and apply to the response returned here unchanged.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every request path except static assets, which never carry a session
     * decision: Next.js build output (_next/static), image optimisation
     * (_next/image), favicon and image / font files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
