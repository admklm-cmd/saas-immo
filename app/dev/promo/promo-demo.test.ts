import { expect, it } from "vitest";

import { buildDemoFigures, DEMO_NOW } from "./promo-demo";

const now = Date.parse(DEMO_NOW);
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();

it("reads the figures from the contacts it is given, never from constants", () => {
  const demo = buildDemoFigures(
    [
      { created_at: ago(0), stage: "nouveau" },
      { created_at: ago(2), stage: "rdv_planifie" },
      { created_at: ago(2), stage: "mandat_signe" },
      { created_at: ago(90), stage: "mandat_signe" },
    ],
    now,
  );
  expect(demo.received).toBe(3);
  expect(demo.cumulative).toHaveLength(30);
  expect(demo.cumulative[29]).toBe(3);
  expect(demo.cumulative[27]).toBe(2);
  expect(demo.appointmentsPlanned).toBe(1);
  expect(demo.openDossiers).toBe(2);
  expect(demo.mandatesConfirmed).toBe(2);
});
