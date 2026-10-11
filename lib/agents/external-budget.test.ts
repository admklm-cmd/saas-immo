import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXTERNAL_DAILY_CALL_LIMIT,
  externalRunsAllowedPerDay,
  MAX_EXTERNAL_DAILY_CALL_LIMIT,
  readExternalDailyCallLimit,
} from "./external-budget";

describe("plafond d'appels externes", () => {
  it("applique une valeur par défaut prudente si la variable est absente ou invalide", () => {
    for (const raw of [undefined, "", "  ", "beaucoup", "-5", "12.5", "1e3", "99999999"]) {
      expect(readExternalDailyCallLimit(raw), String(raw)).toBe(DEFAULT_EXTERNAL_DAILY_CALL_LIMIT);
    }
  });

  it("lit une valeur valide, bornée, et accepte 0 (aucun appel externe)", () => {
    expect(readExternalDailyCallLimit("40")).toBe(40);
    expect(readExternalDailyCallLimit(" 0 ")).toBe(0);
    expect(readExternalDailyCallLimit("999999")).toBe(MAX_EXTERNAL_DAILY_CALL_LIMIT);
  });

  it("compte en exécutions en réservant la reprise de chacune", () => {
    expect(externalRunsAllowedPerDay(100)).toBe(50);
    expect(externalRunsAllowedPerDay(5)).toBe(2);
    expect(externalRunsAllowedPerDay(1)).toBe(0);
    expect(externalRunsAllowedPerDay(0)).toBe(0);
  });
});
