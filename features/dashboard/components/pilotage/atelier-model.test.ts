import { describe, expect, it } from "vitest";

import { buildAtelierModel, railThickness } from "./atelier-model";
import { makePilotage } from "./pilotage-fixture";
import { buildPilotageView } from "./pilotage-view";

const names = { human: "Validation humaine", mandate: "Mandat" };

function model(overrides: Partial<Parameters<typeof buildAtelierModel>[0]> = {}) {
  const view = buildPilotageView(makePilotage());
  return buildAtelierModel({ agents: view.atelier, paused: false, humanWaiting: 12, mandates: 5, names, ...overrides });
}

describe("buildAtelierModel", () => {
  it("shows min(blocked, 2) hollow tokens per agent and at most 3 waiting tokens", () => {
    const m = model();
    expect(m.stations.find((s) => s.id === "hugo")?.blockedVisible).toBe(2);
    expect(m.stations.find((s) => s.id === "lea")?.blockedVisible).toBe(0);
    expect(m.waitingTokens).toBe(3);
    expect(m.mandateToken).toBe(true);
    expect(m.mode).toBe("live");
  });

  it("is paused when the kill switch is on, whatever the counts", () => {
    expect(model({ paused: true }).mode).toBe("paused");
  });

  it("is unavailable, with no token, when the counts could not be read", () => {
    const m = model({ agents: { status: "unavailable" }, humanWaiting: null, mandates: null });
    expect(m.mode).toBe("unavailable");
    expect(m.waitingTokens).toBe(0);
    expect(m.mandateToken).toBe(false);
  });

  it("rail thickness is 3 to 8 px by upstream volume", () => {
    expect(railThickness([0, 0])).toEqual([3, 3]);
    expect(railThickness([10, 5])).toEqual([8, 5.5]);
  });
});
