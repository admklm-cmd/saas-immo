import { describe, expect, it } from "vitest";

import { makePilotage } from "./pilotage-fixture";
import { buildFlow, buildPilotageView } from "./pilotage-view";

describe("buildPilotageView", () => {
  it("writes the mandates, their comparison and a running total that ends on the count", () => {
    const view = buildPilotageView(makePilotage());
    expect(view.stage.status).toBe("ok");
    if (view.stage.status !== "ok") return;
    expect(view.stage.value.comparison).toBe("+2 par rapport aux 12 mois précédents (3)");
    const last = view.stage.value.series?.points.at(-1);
    expect(last?.cumulative).toBe(5);
    expect(last?.previousCumulative).toBe(3);
  });

  it("shows no evolution when the history does not cover the previous period", () => {
    const data = makePilotage("365d");
    data.period.previousCoverage = "partial";
    const view = buildPilotageView(data);
    if (view.stage.status !== "ok") throw new Error("expected ok");
    expect(view.stage.value.comparison).toBe("Période précédente : indisponible");
    expect(view.stage.value.fairPrevious).toBe(false);
    expect(view.stage.value.historyNote).toContain("historique disponible depuis le");
  });

  it("keeps every block independent: unavailable never becomes zero", () => {
    const view = buildPilotageView(makePilotage("30d", { mandates: { status: "unavailable" }, conversion: { status: "unavailable" } }));
    expect(view.stage.status).toBe("unavailable");
    expect(view.conversion.status).toBe("unavailable");
    expect(view.delay.status).toBe("ok");
    expect(view.origins.status).toBe("ok");
  });

  it("explains the rate and the delay, and shows « — » when nothing is measurable", () => {
    const view = buildPilotageView(makePilotage());
    if (view.conversion.status !== "ok" || view.delay.status !== "ok") throw new Error("expected ok");
    expect(view.conversion.value.display).toBe("13 %");
    expect(view.conversion.value.basis).toBe("5 mandats pour 40 demandes reçues, sur 12 mois");
    expect(view.delay.value.display).toBe("3 h 20");
    expect(view.delay.value.basis).toBe("30 dossiers mesurés, 10 pas encore pris en charge");

    const empty = makePilotage("7d", {
      conversion: { status: "ok", value: { current: { numerator: 0, denominator: 0, rate: null }, previous: { numerator: 0, denominator: 0, rate: null } } },
    });
    const emptyView = buildPilotageView(empty);
    if (emptyView.conversion.status !== "ok") throw new Error("expected ok");
    expect(emptyView.conversion.value.display).toBe("—");
    expect(emptyView.conversion.value.empty).toContain("taux non calculable");
  });

  it("warns on a rate computed on very few requests", () => {
    const data = makePilotage("7d", {
      conversion: { status: "ok", value: { current: { numerator: 1, denominator: 3, rate: 1 / 3 }, previous: { numerator: 0, denominator: 0, rate: null } } },
    });
    const view = buildPilotageView(data);
    if (view.conversion.status !== "ok") throw new Error("expected ok");
    expect(view.conversion.value.caution).toContain("prudence");
  });

  it("groups the origins beyond four into « Autres » and the parts add up to the total", () => {
    const data = makePilotage();
    data.origins = {
      status: "ok",
      value: [
        { source: "estimation_form", count: 10, previousCount: 0 },
        { source: "website_form", count: 8, previousCount: 0 },
        { source: "inbound_call", count: 6, previousCount: 0 },
        { source: "manual_entry", count: 4, previousCount: 0 },
        { source: "referral", count: 3, previousCount: 0 },
        { source: "inbound_email", count: 2, previousCount: 0 },
      ],
    };
    const view = buildPilotageView(data);
    if (view.origins.status !== "ok") throw new Error("expected ok");
    expect(view.origins.value.parts).toHaveLength(5);
    expect(view.origins.value.parts.at(-1)).toMatchObject({ grouped: true, count: 5 });
    expect(view.origins.value.parts.reduce((s, p) => s + p.count, 0)).toBe(view.origins.value.total);
  });
});

describe("buildFlow", () => {
  it("partitions the cohort without losing a dossier", () => {
    const view = buildPilotageView(makePilotage());
    if (view.flow.status !== "ok" || !view.flow.value) throw new Error("expected a flow");
    const flow = view.flow.value;
    const sumOut = (id: string) => flow.links.filter((l) => l.source === id).reduce((s, l) => s + l.value, 0);
    expect(sumOut("received")).toBe(flow.received);
    expect(sumOut("hot")).toBe(flow.hot);
  });

  it("draws nothing rather than adjusting a figure that does not add up", () => {
    const data = makePilotage();
    if (data.flow.status !== "ok") throw new Error("expected ok");
    const broken = { ...data.flow.value, signed: 99 };
    expect(buildFlow(broken)).toBeNull();
  });
});
