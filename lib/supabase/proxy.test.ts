import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SEC-003 — session refresh in the Next.js proxy, with `@supabase/ssr`
 * replaced by a stub that behaves like the real client: `getClaims()` calls
 * `setAll` with the refreshed cookies and the anti-cache headers when (and
 * only when) the session had to be refreshed.
 */

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };
type CookieMethods = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: CookieToSet[], headers: Record<string, string>) => void;
};

const refresh: { cookies: CookieToSet[]; headers: Record<string, string>; throws: boolean } = {
  cookies: [],
  headers: {},
  throws: false,
};
const seenRequestCookies: { name: string; value: string }[][] = [];
const callOrder: string[] = [];

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: { cookies: CookieMethods }) => {
    callOrder.push("createServerClient");
    return {
      auth: {
        getClaims: vi.fn(async () => {
          callOrder.push("getClaims");
          if (refresh.throws) throw new TypeError("fetch failed");
          seenRequestCookies.push(options.cookies.getAll());
          if (refresh.cookies.length > 0) options.cookies.setAll(refresh.cookies, refresh.headers);
          return { data: { claims: { sub: "user-1" } }, error: null };
        }),
      },
    };
  }),
}));

const { updateSession } = await import("./proxy");
const { config, proxy } = await import("../../proxy");

const SESSION_COOKIE = "sb-127-auth-token";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_only");
  refresh.cookies = [];
  refresh.headers = {};
  refresh.throws = false;
  seenRequestCookies.length = 0;
  callOrder.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function requestWithSession(value = "expired-token"): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/dashboard", {
    headers: { cookie: `${SESSION_COOKIE}=${value}` },
  });
}

describe("updateSession", () => {
  it("transmet les cookies de session renouvelés au navigateur, avec leurs options", async () => {
    refresh.cookies = [
      { name: SESSION_COOKIE, value: "fresh-token", options: { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 } },
    ];
    refresh.headers = {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    };

    const response = await updateSession(requestWithSession());

    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBe("fresh-token");
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("lax");
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=fresh-token`);
  });

  it("applique les en-têtes anti-cache fournis par la bibliothèque (aucune session servie à un autre utilisateur)", async () => {
    refresh.cookies = [{ name: SESSION_COOKIE, value: "fresh-token", options: { path: "/" } }];
    refresh.headers = {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    };

    const response = await updateSession(requestWithSession());

    expect(response.headers.get("cache-control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("propage aussi la session renouvelée à la requête en cours (rendu serveur de la même navigation)", async () => {
    refresh.cookies = [{ name: SESSION_COOKIE, value: "fresh-token", options: { path: "/" } }];

    const response = await updateSession(requestWithSession());

    // NextResponse.next({ request }) forwards the overridden request cookies to
    // the render through this internal header.
    expect(response.headers.get("x-middleware-override-headers")).toContain("cookie");
    expect(response.headers.get("x-middleware-request-cookie")).toContain(`${SESSION_COOKIE}=fresh-token`);
  });

  it("une suppression de session (déconnexion, jeton révoqué) est elle aussi propagée", async () => {
    refresh.cookies = [{ name: SESSION_COOKIE, value: "", options: { path: "/", maxAge: 0 } }];

    const response = await updateSession(requestWithSession());

    expect(response.headers.get("set-cookie")).toMatch(new RegExp(`${SESSION_COOKIE}=;.*Max-Age=0`, "i"));
  });

  it("session encore valide : aucun cookie écrit, aucune mise en cache modifiée", async () => {
    const response = await updateSession(requestWithSession("valid-token"));

    expect(seenRequestCookies[0]).toEqual([{ name: SESSION_COOKIE, value: "valid-token" }]);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("appelle getClaims immédiatement après la création du client (règle officielle)", async () => {
    await updateSession(requestWithSession());
    expect(callOrder).toEqual(["createServerClient", "getClaims"]);
  });

  it("Supabase injoignable : la requête continue sans erreur (le site public ne tombe pas)", async () => {
    refresh.throws = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await updateSession(requestWithSession());

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0]?.[0])).not.toContain("expired-token");
  });

  it("n'effectue aucune redirection : l'autorisation reste aux pages", async () => {
    const response = await updateSession(new NextRequest("http://127.0.0.1:3000/dashboard"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy.ts (racine)", () => {
  it("délègue à updateSession", async () => {
    refresh.cookies = [{ name: SESSION_COOKIE, value: "fresh-token", options: { path: "/" } }];
    const response = await proxy(requestWithSession());
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("fresh-token");
  });

  it("le matcher exclut les ressources statiques et couvre les pages et actions", () => {
    const [pattern] = config.matcher;
    // Next.js anchors the source pattern on the full pathname.
    const matches = (pathname: string) => new RegExp(`^${pattern}$`).test(pathname);

    for (const page of ["/", "/dashboard", "/contacts/123", "/agents-ia/a-valider", "/connexion", "/estimation"]) {
      expect(matches(page), page).toBe(true);
    }
    for (const asset of [
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/images/particle-handoff.jpg",
      "/logo.svg",
      "/fonts/inter.woff2",
    ]) {
      expect(matches(asset), asset).toBe(false);
    }
  });
});
