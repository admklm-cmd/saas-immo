import { describe, expect, it } from "vitest";

import { presetForPath } from "./route-presets";

describe("presetForPath", () => {
  it("maps every app screen to its preset, most specific route first", () => {
    expect(presetForPath("/dashboard")).toBe("veil");
    expect(presetForPath("/contacts")).toBe("sphere");
    expect(presetForPath("/contacts/123")).toBe("sphere");
    expect(presetForPath("/pipeline")).toBe("current");
    expect(presetForPath("/agents-ia")).toBe("agents");
    expect(presetForPath("/agents-ia/lea-acquisition")).toBe("agents");
    expect(presetForPath("/agents-ia/a-valider")).toBe("vortex");
    expect(presetForPath("/parametres")).toBe("grid");
  });

  it("does not match a mere prefix of a segment and falls back to the veil", () => {
    expect(presetForPath("/contactsx")).toBe("veil");
    expect(presetForPath("/rendez-vous")).toBe("veil");
  });
});
