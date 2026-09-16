import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// This file runs in the default "node" environment: no `window` global.
describe("lib/supabase/admin", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("refuses to be imported when a window global exists (browser)", async () => {
    vi.stubGlobal("window", {});
    await expect(import("./admin")).rejects.toThrow(/never run in a browser/);
  });

  it("refuses to create a client when a window global appears after import", async () => {
    const { createAdminClient } = await import("./admin");
    vi.stubGlobal("window", {});
    expect(() => createAdminClient()).toThrow(/never run in a browser/);
  });

  it("throws a clear error when server configuration is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    const { createAdminClient } = await import("./admin");
    expect(() => createAdminClient()).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("creates a client on the server when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret-key-not-real");
    const { createAdminClient } = await import("./admin");
    const client = createAdminClient();
    expect(typeof client.from).toBe("function");
  });
});
