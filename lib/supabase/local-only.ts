/**
 * Local-only guard, shared by every tool that is allowed to use the Supabase
 * secret key (integration tests, fixtures loader).
 *
 * It must be impossible to run those tools against anything else than the local
 * Supabase stack: they bypass RLS and they delete data.
 */

export const ALLOWED_LOCAL_SUPABASE_URLS = ["http://127.0.0.1:54321", "http://localhost:54321"] as const;

/**
 * Returns the normalised local Supabase URL, or throws if it is not one of the
 * two allowed local addresses.
 */
export function assertLocalSupabaseUrl(rawUrl: string | undefined, context = "Integration tests"): string {
  const url = (rawUrl ?? "").trim().replace(/\/+$/, "");
  if (!(ALLOWED_LOCAL_SUPABASE_URLS as readonly string[]).includes(url)) {
    throw new Error(
      `${context} refused: NEXT_PUBLIC_SUPABASE_URL must be one of ${ALLOWED_LOCAL_SUPABASE_URLS.join(
        ", ",
      )} (local Supabase only). Got "${url || "(empty)"}".`,
    );
  }
  return url;
}

/** Refuses to run in a production environment, whatever the URL says. */
export function assertNotProduction(context = "Integration tests"): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${context} refused: NODE_ENV is "production".`);
  }
}
