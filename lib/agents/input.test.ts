import { describe, expect, it } from "vitest";

import { parseContactId } from "./input";

/**
 * Security audit regression test: a server action is a public HTTP endpoint,
 * its declared TypeScript type proves nothing at runtime.
 */
describe("parseContactId", () => {
  it("accepte un uuid, quelle que soit la casse", () => {
    expect(parseContactId("0f8fad5b-d9cb-469f-a165-70867728950e")).toBe(
      "0f8fad5b-d9cb-469f-a165-70867728950e",
    );
    expect(parseContactId("0F8FAD5B-D9CB-469F-A165-70867728950E")).toBe(
      "0F8FAD5B-D9CB-469F-A165-70867728950E",
    );
  });

  it("refuse tout ce qui n'est pas un uuid", () => {
    const attacks: unknown[] = [
      undefined,
      null,
      42,
      true,
      {},
      [],
      { toString: () => "0f8fad5b-d9cb-469f-a165-70867728950e" },
      "",
      "not-a-uuid",
      // PostgREST filter smuggling / SQL-ish payloads
      "0f8fad5b-d9cb-469f-a165-70867728950e' or '1'='1",
      "*",
      "eq.any",
      "0f8fad5b-d9cb-469f-a165-70867728950e\n",
      "0f8fad5b-d9cb-469f-a165-70867728950e ",
    ];
    for (const attack of attacks) {
      expect(parseContactId(attack), JSON.stringify(attack)).toBeNull();
    }
  });
});
