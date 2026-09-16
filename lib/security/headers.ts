/**
 * HTTP security headers applied to every response (wired in `next.config.ts`).
 *
 * What they cover:
 *  - `Content-Security-Policy`: forbids loading scripts, styles, images, fonts
 *    or opening connections towards any origin other than this site and the
 *    configured Supabase project; `frame-ancestors 'none'` blocks clickjacking;
 *    `form-action 'self'` blocks a form posting credentials elsewhere;
 *    `base-uri 'self'` blocks a `<base>` hijack; `object-src 'none'` blocks
 *    legacy plugin content.
 *  - `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
 *    `Permissions-Policy`, `Cross-Origin-Opener-Policy`: classic hardening.
 *  - `Strict-Transport-Security`: production only (meaningless over http, and
 *    pinning `localhost` to HTTPS would break local development).
 *
 * KNOWN LIMIT, documented in docs/security.md: `script-src` still allows
 * `'unsafe-inline'` because Next.js injects inline bootstrap scripts. Removing
 * it requires a nonce generated per request in a `middleware.ts`, which is out
 * of the prototype's scope. The policy therefore raises the bar (no external
 * script origin, no eval in production) without claiming to stop every XSS.
 */

export type SecurityHeader = { key: string; value: string };

export type SecurityHeadersOptions = {
  /** `NEXT_PUBLIC_SUPABASE_URL`, added to `connect-src` (REST, auth, realtime). */
  supabaseUrl?: string;
  /** Development mode: Turbopack needs `eval` and a websocket for HMR. */
  isDevelopment: boolean;
};

/** Origins the browser is allowed to talk to, beyond this site. */
function connectSources(supabaseUrl: string | undefined, isDevelopment: boolean): string[] {
  const sources = new Set<string>(["'self'"]);

  if (supabaseUrl) {
    try {
      const { origin, protocol, host } = new URL(supabaseUrl);
      sources.add(origin);
      // Supabase Realtime uses a websocket on the same host.
      sources.add(`${protocol === "https:" ? "wss" : "ws"}://${host}`);
    } catch {
      // Malformed value: ignore it rather than emit a broken policy.
    }
  }

  if (isDevelopment) {
    // Turbopack hot reload.
    sources.add("ws://127.0.0.1:*");
    sources.add("ws://localhost:*");
  }

  return [...sources];
}

export function buildContentSecurityPolicy(options: SecurityHeadersOptions): string {
  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (options.isDevelopment) {
    // Turbopack evaluates modules with `eval` in development only.
    scriptSources.push("'unsafe-eval'");
  }

  const directives: string[] = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    // Tailwind and Next.js inject <style> tags.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources(options.supabaseUrl, options.isDevelopment).join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
  ];

  if (!options.isDevelopment) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function buildSecurityHeaders(options: SecurityHeadersOptions): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];

  if (!options.isDevelopment) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

/** Reads the environment and returns the headers for the current mode. */
export function securityHeadersFromEnv(env: NodeJS.ProcessEnv = process.env): SecurityHeader[] {
  return buildSecurityHeaders({
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    isDevelopment: env.NODE_ENV !== "production",
  });
}
