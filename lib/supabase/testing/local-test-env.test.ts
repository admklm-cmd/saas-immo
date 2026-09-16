import { afterEach, describe, expect, it, vi } from "vitest";

import { assertLocalSupabaseUrl, setupTestEnv } from "./local-test-env";

describe("lib/supabase/testing/local-test-env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://127.0.0.1:54321/"])(
    "accepts the local Supabase URL %s",
    (url) => {
      expect(assertLocalSupabaseUrl(url)).toBe(url.replace(/\/$/, ""));
    },
  );

  it.each([
    undefined,
    "",
    "https://abcdefgh.supabase.co",
    "http://127.0.0.1:54322",
    "https://127.0.0.1:54321",
    "http://localhost:54321.evil.test",
    "http://192.168.1.10:54321",
  ])("refuses a non-local URL (%s)", (url) => {
    expect(() => assertLocalSupabaseUrl(url)).toThrow(/local Supabase only/);
  });

  it("refuses to set up anything against a non-local URL, before any network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");

    await expect(setupTestEnv()).rejects.toThrow(/local Supabase only/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails with a clear message when the local stack is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");

    await expect(setupTestEnv()).rejects.toThrow(/unreachable.*npm run db:start/);
  });

  it("fails with a clear message when a key is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    await expect(setupTestEnv()).rejects.toThrow(/missing SUPABASE_SECRET_KEY/);
  });
});
