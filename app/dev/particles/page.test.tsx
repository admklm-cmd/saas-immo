import { afterEach, describe, expect, it, vi } from "vitest";

// notFound() throws in Next.js; the mock mirrors that so nothing renders after it.
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
vi.mock("./BackgroundPreview", () => ({ BackgroundPreview: () => null }));
vi.mock("./ParticleGallery", () => ({ ParticleGallery: () => null }));

import { BackgroundPreview } from "./BackgroundPreview";
import ParticlesPage from "./page";
import { ParticleGallery } from "./ParticleGallery";

function params(value: Record<string, string | string[] | undefined>) {
  return { searchParams: Promise.resolve(value) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe("/dev/particles (development gallery)", () => {
  it("is a 404 in production, whatever the query string", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const query of [{}, { fond: "vortex" }, { only: "agents" }, { fond: "<script>" }]) {
      await expect(ParticlesPage(params(query))).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(notFound).toHaveBeenCalledTimes(4);
  });

  it("only accepts a preset from the closed list for ?fond= and ?only=", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const valid = await ParticlesPage(params({ fond: "vortex" }));
    expect(valid.type).toBe(BackgroundPreview);
    expect(valid.props).toEqual({ initial: "vortex" });

    for (const fond of ["<img src=x onerror=alert(1)>", "VORTEX", ["vortex", "grid"], "__proto__"]) {
      const element = await ParticlesPage(params({ fond, only: "javascript:alert(1)" }));
      expect(element.type).toBe(ParticleGallery);
      expect(element.props).toEqual({ only: null });
    }
    expect(notFound).not.toHaveBeenCalled();
  });
});
