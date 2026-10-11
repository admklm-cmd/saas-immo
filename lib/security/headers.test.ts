import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, buildSecurityHeaders, securityHeadersFromEnv } from "./headers";

const LOCAL_SUPABASE = "http://127.0.0.1:54321";
const HOSTED_SUPABASE = "https://abcdefgh.supabase.co";

function headerValue(headers: { key: string; value: string }[], key: string): string | undefined {
  return headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value;
}

describe("buildContentSecurityPolicy", () => {
  it("verrouille les directives structurantes", () => {
    const csp = buildContentSecurityPolicy({ supabaseUrl: HOSTED_SUPABASE, isDevelopment: false });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("autorise Supabase (REST et websocket) et rien d'autre en connect-src", () => {
    const csp = buildContentSecurityPolicy({ supabaseUrl: HOSTED_SUPABASE, isDevelopment: false });
    const connectSrc = csp.split("; ").find((directive) => directive.startsWith("connect-src"));

    expect(connectSrc).toBe(`connect-src 'self' ${HOSTED_SUPABASE} wss://abcdefgh.supabase.co`);
  });

  it("ajoute le websocket local du rechargement à chaud uniquement en développement", () => {
    const dev = buildContentSecurityPolicy({ supabaseUrl: LOCAL_SUPABASE, isDevelopment: true });
    const prod = buildContentSecurityPolicy({ supabaseUrl: HOSTED_SUPABASE, isDevelopment: false });

    expect(dev).toContain("ws://127.0.0.1:*");
    expect(dev).toContain("'unsafe-eval'");
    expect(prod).not.toContain("ws://127.0.0.1:*");
    expect(prod).not.toContain("'unsafe-eval'");
  });

  it("ignore une URL Supabase invalide au lieu de produire une politique cassée", () => {
    const csp = buildContentSecurityPolicy({ supabaseUrl: "pas-une-url", isDevelopment: false });
    expect(csp).toContain("connect-src 'self';");
  });
});

describe("buildSecurityHeaders", () => {
  it("pose les en-têtes de durcissement classiques", () => {
    const headers = buildSecurityHeaders({ supabaseUrl: HOSTED_SUPABASE, isDevelopment: false });

    expect(headerValue(headers, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(headers, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerValue(headers, "Permissions-Policy")).toContain("geolocation=()");
    expect(headerValue(headers, "Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("n'active HSTS qu'en production (jamais sur http://localhost)", () => {
    expect(
      headerValue(buildSecurityHeaders({ isDevelopment: false }), "Strict-Transport-Security"),
    ).toContain("max-age=63072000");
    expect(
      headerValue(buildSecurityHeaders({ isDevelopment: true }), "Strict-Transport-Security"),
    ).toBeUndefined();
  });
});

describe("securityHeadersFromEnv", () => {
  it("lit l'URL Supabase publique et le mode depuis l'environnement", () => {
    const headers = securityHeadersFromEnv({
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE,
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);

    expect(headerValue(headers, "Content-Security-Policy")).toContain(LOCAL_SUPABASE);
    expect(headerValue(headers, "Strict-Transport-Security")).toBeDefined();
  });

  it("ne contient jamais de secret", () => {
    const serialised = JSON.stringify(
      securityHeadersFromEnv({
        NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE,
        SUPABASE_SECRET_KEY: "sb_secret_valeur_de_test",
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv),
    );

    expect(serialised).not.toContain("sb_secret");
  });
});
