import { afterEach, describe, expect, it, vi } from "vitest";

// notFound() throws in Next.js; the mock mirrors that so nothing renders after it.
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
vi.mock("./IconGallery", () => ({ IconGallery: () => null }));

import { IconGallery } from "./IconGallery";
import IconsPage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe("/dev/icons (development gallery)", () => {
  it("is a 404 in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => IconsPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders the gallery in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(IconsPage().type).toBe(IconGallery);
    expect(notFound).not.toHaveBeenCalled();
  });
});
