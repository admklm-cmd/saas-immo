import { expect, test } from "@playwright/test";

/**
 * Security audit regression test.
 *
 * `lib/security/headers.ts` was written and unit-tested, but it was never wired
 * into `next.config.ts`: NO response carried a CSP, an X-Frame-Options or any
 * other hardening header. A unit test on the builder function cannot catch
 * that — only a real HTTP response can. Hence this end-to-end check.
 *
 * Runs against the dev server, so `Strict-Transport-Security` is deliberately
 * absent (it is production-only: pinning localhost to HTTPS would break local
 * development) and the CSP allows `'unsafe-eval'` for Turbopack.
 */

const PAGES = ["/", "/connexion"];

for (const path of PAGES) {
  test(`${path} sert les en-têtes de sécurité`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const headers = response.headers();

    const csp = headers["content-security-policy"];
    expect(csp, "Content-Security-Policy manquant").toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");

    // The framework must not advertise itself.
    expect(headers["x-powered-by"]).toBeUndefined();
  });
}
