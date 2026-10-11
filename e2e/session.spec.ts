import { expect, test, type BrowserContext, type Cookie } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";

import { signIn } from "./helpers/sign-in";

/**
 * SEC-003 — session renewal by the Next.js proxy (`proxy.ts`), against the
 * local stack.
 *
 *   * an expired access token with a valid refresh token is renewed BY THE
 *     SERVER on the next navigation: the document response itself carries the
 *     new session cookie (before the proxy existed, the refresh happened only
 *     in memory during the render and the browser kept the stale cookie);
 *   * a session that can no longer be renewed sends the user to /connexion;
 *   * sign-out works, and the private space is closed afterwards;
 *   * ordinary signed-in navigation is unaffected.
 *
 * The session cookie is the one written by @supabase/ssr:
 * `sb-<ref>-auth-token`, value `base64-<base64url(JSON session)>`, possibly
 * split into `.0`, `.1`… chunks. The test only edits `expires_at` (and, for the
 * dead-session case, the refresh token) of the fictitious user's own session.
 */

const COLD_START = 60_000;
const AUTH_COOKIE = /^sb-.+-auth-token(?:\.(\d+))?$/;
const BASE64_PREFIX = "base64-";

type StoredSession = { access_token: string; refresh_token: string; expires_at: number } & Record<string, unknown>;

async function authCookies(context: BrowserContext): Promise<Cookie[]> {
  const cookies = (await context.cookies()).filter((cookie) => AUTH_COOKIE.test(cookie.name));
  return cookies.sort((a, b) => Number(AUTH_COOKIE.exec(a.name)?.[1] ?? -1) - Number(AUTH_COOKIE.exec(b.name)?.[1] ?? -1));
}

function decodeSession(cookies: Cookie[]): StoredSession {
  const joined = cookies.map((cookie) => cookie.value).join("");
  const encoded = joined.startsWith(BASE64_PREFIX) ? joined.slice(BASE64_PREFIX.length) : joined;
  const json = encoded.startsWith("{") ? encoded : Buffer.from(encoded, "base64url").toString("utf8");
  return JSON.parse(json) as StoredSession;
}

function baseName(cookie: Cookie): string {
  return cookie.name.replace(/\.\d+$/, "");
}

/** Replaces the (possibly chunked) session cookie by one edited, unchunked cookie. */
async function rewriteSession(context: BrowserContext, edit: (session: StoredSession) => StoredSession): Promise<StoredSession> {
  const cookies = await authCookies(context);
  expect(cookies.length, "session cookie present after sign-in").toBeGreaterThan(0);
  const first = cookies[0]!;
  const session = edit(decodeSession(cookies));

  await context.clearCookies({ name: AUTH_COOKIE });
  await context.addCookies([
    {
      name: baseName(first),
      value: `${BASE64_PREFIX}${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`,
      domain: first.domain,
      path: first.path,
      expires: first.expires,
      httpOnly: first.httpOnly,
      secure: first.secure,
      sameSite: first.sameSite,
    },
  ]);
  return session;
}

test.describe("session (SEC-003)", () => {
  test("une session expirée mais renouvelable est renouvelée par le serveur, cookie compris", async ({ page, context }) => {
    test.setTimeout(180_000);
    await signIn(page, "agentA");

    const nowSeconds = Math.floor(Date.now() / 1000);
    const stale = await rewriteSession(context, (session) => ({ ...session, expires_at: nowSeconds - 120 }));

    const response = await page.goto("/dashboard");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: COLD_START });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COLD_START });

    // The renewed session arrives with the DOCUMENT response itself, from the
    // server: this is what the proxy adds.
    const setCookies = (await response!.headersArray())
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value);
    expect(setCookies.some((value) => /^sb-.+-auth-token(?:\.\d+)?=base64-/.test(value))).toBe(true);
    // Next.js sets the final Cache-Control of a dynamic page itself (it differs
    // between `next dev` and a production build); what matters here is that a
    // response carrying a session is never publicly cacheable. The exact
    // headers the proxy applies are covered by lib/supabase/proxy.test.ts.
    const cacheControl = response!.headers()["cache-control"] ?? "";
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).not.toContain("public");

    const renewed = decodeSession(await authCookies(context));
    expect(renewed.refresh_token).not.toBe(stale.refresh_token);
    expect(renewed.expires_at).toBeGreaterThan(nowSeconds);

    // And it keeps working on the next navigation.
    const next = await page.goto("/contacts");
    expect(next?.status()).toBe(200);
    await expect(page).toHaveURL(/\/contacts$/, { timeout: COLD_START });
  });

  test("une session expirée qui ne peut plus être renouvelée renvoie vers /connexion", async ({ page, context }) => {
    test.setTimeout(180_000);
    await signIn(page, "agentA");

    await rewriteSession(context, (session) => ({
      ...session,
      expires_at: Math.floor(Date.now() / 1000) - 120,
      refresh_token: "revoked-refresh-token",
    }));

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/connexion$/, { timeout: COLD_START });
  });

  test("la déconnexion ferme l'espace privé", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, "agentA");

    await page.getByRole("button", { name: APP_TEXTS.nav.signOut }).first().click();
    await expect(page).toHaveURL(/\/connexion$/, { timeout: COLD_START });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/connexion$/, { timeout: COLD_START });
  });

  test("la navigation connectée fonctionne normalement", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, "agentA");

    for (const href of ["/dashboard", "/pipeline", "/agents-ia", "/contacts"]) {
      const response = await page.goto(href);
      expect(response?.status(), href).toBe(200);
      await expect(page, href).toHaveURL(new RegExp(`${href}$`), { timeout: COLD_START });
      await expect(page.getByRole("heading", { level: 1 }), href).toBeVisible({ timeout: COLD_START });
    }
  });
});
