import { describe, expect, it } from "vitest";

import {
  DEFAULT_REDIRECT_TARGET,
  MAX_REDIRECT_TARGET_LENGTH,
  safeInternalPath,
} from "./safe-redirect";

/**
 * Regression test of the `?suivant=` open-redirect guard.
 *
 * The listed payloads are the classic ways to turn a "starts with /" check into
 * a redirect towards another host. `/\evil.example` is the important one: it
 * passed the previous check and browsers normalise it to `//evil.example`.
 */
describe("safeInternalPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeInternalPath("/contacts")).toBe("/contacts");
    expect(safeInternalPath("/contacts/9f1c7f3a-0000-4000-8000-000000000000")).toBe(
      "/contacts/9f1c7f3a-0000-4000-8000-000000000000",
    );
    expect(safeInternalPath("/pipeline?vue=liste#bas")).toBe("/pipeline?vue=liste#bas");
    expect(safeInternalPath("/")).toBe("/");
  });

  it.each([
    ["//evil.example", "scheme-relative"],
    ["/\\evil.example", "backslash normalisé en slash par le navigateur"],
    ["/\\/evil.example", "backslash au milieu"],
    ["\\\\evil.example", "UNC"],
    ["https://evil.example", "absolu"],
    ["http://evil.example", "absolu"],
    ["https:evil.example", "schéma sans slash"],
    ["javascript:alert(1)", "pseudo-schéma"],
    ["data:text/html,<script>alert(1)</script>", "data URI"],
    ["evil.example", "sans slash initial"],
    ["/contacts\r\nLocation: https://evil.example", "injection d'en-tête"],
    ["/contacts\nSet-Cookie: a=b", "saut de ligne"],
    ["/\tevil.example", "tabulation"],
    [" //evil.example", "espace en tête"],
    ["/ /evil.example", "espace interne"],
    ["", "vide"],
  ])("refuse %s (%s)", (payload) => {
    expect(safeInternalPath(payload)).toBe(DEFAULT_REDIRECT_TARGET);
  });

  it("refuse tout ce qui n'est pas une chaîne (paramètre répété, absent, objet)", () => {
    expect(safeInternalPath(["/contacts", "//evil.example"])).toBe(DEFAULT_REDIRECT_TARGET);
    expect(safeInternalPath(undefined)).toBe(DEFAULT_REDIRECT_TARGET);
    expect(safeInternalPath(null)).toBe(DEFAULT_REDIRECT_TARGET);
    expect(safeInternalPath({ toString: () => "/contacts" })).toBe(DEFAULT_REDIRECT_TARGET);
  });

  it("refuse un chemin démesuré", () => {
    expect(safeInternalPath(`/${"a".repeat(MAX_REDIRECT_TARGET_LENGTH)}`)).toBe(DEFAULT_REDIRECT_TARGET);
  });

  it("utilise le repli demandé", () => {
    expect(safeInternalPath("//evil.example", "/dashboard")).toBe("/dashboard");
  });
});
