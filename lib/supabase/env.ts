/**
 * Public Supabase configuration (safe for the browser).
 *
 * `NEXT_PUBLIC_*` variables are inlined at build time only when they are
 * referenced literally as `process.env.NEXT_PUBLIC_...`, so do not refactor
 * these accesses into a dynamic lookup.
 *
 * Never read a secret in this file: it is imported by the browser client.
 */
export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase configuration: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }

  return { url, publishableKey };
}
