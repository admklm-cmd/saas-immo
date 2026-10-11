import { describe, expect, it } from "vitest";

import { fail, isOk, ok, type Result } from "./result";

describe("result helpers", () => {
  it("ok() wraps data with a null error", () => {
    const result = ok({ id: "c1" });
    expect(result).toEqual({ data: { id: "c1" }, error: null });
    expect(isOk(result)).toBe(true);
  });

  it("ok() keeps falsy data values", () => {
    expect(ok(0)).toEqual({ data: 0, error: null });
    expect(isOk(ok(null))).toBe(true);
  });

  it("fail() returns a null data and a coded error", () => {
    const result: Result<string> = fail("consent_missing", "Consentement manquant pour ce canal.");
    expect(result).toEqual({
      data: null,
      error: { code: "consent_missing", message: "Consentement manquant pour ce canal." },
    });
    expect(isOk(result)).toBe(false);
  });

  it("isOk() narrows the type", () => {
    const result: Result<{ name: string }> = ok({ name: "Calanques Immobilier (fictive)" });
    if (isOk(result)) {
      expect(result.data.name).toContain("fictive");
    } else {
      throw new Error("expected an ok result");
    }
  });
});
