// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { DASHBOARD_PIPELINE_STAGES } from "../types";
import { buildFrieze, FRIEZE_COLUMN_ROWS, FRIEZE_DOT_CAP, friezeDots, friezeRows } from "./frieze";
import { PipelineFrieze } from "./PipelineFrieze";
import { makeSummary, okList, SCOPES } from "./summary-fixture";

const TEXTS = APP_TEXTS.dashboard;

afterEach(() => cleanup());

/** Pipeline with distinct, recognisable counts: 11, 7, 5, 3, 2, 4 and 6 lost. */
function summaryWithCounts() {
  const summary = makeSummary();
  const values = [11, 7, 5, 3, 2, 4, 6];
  summary.pipeline.stages = DASHBOARD_PIPELINE_STAGES.map((stage, index) => ({
    stage,
    count: { status: "ok", scope: SCOPES.current, value: values[index]! },
  }));
  return summary;
}

describe("buildFrieze", () => {
  it("garde l'ordre du parcours et place les trois points de décision humaine", () => {
    const summary = makeSummary();
    const { steps, lost } = buildFrieze(summary.pipeline, summary.todo);

    expect(steps.map((step) => (step.kind === "stage" ? step.stage : `[${step.id}]`))).toEqual([
      "[leads]",
      "nouveau",
      "qualifie",
      "chaud",
      "[to-confirm]",
      "rdv_planifie",
      "[to-close]",
      "estimation_faite",
      "mandat_signe",
    ]);
    expect(lost?.stage).toBe("perdu");
  });

  it("ne calcule rien : chaque nombre est celui du résumé, tel quel", () => {
    const summary = summaryWithCounts();
    summary.todo.inboundLeadsToProcess = okList(SCOPES.pending, [], 9);
    const { steps, lost } = buildFrieze(summary.pipeline, summary.todo);

    for (const step of steps) {
      if (step.kind === "stage") {
        expect(step.count).toBe(summary.pipeline.stages.find((stage) => stage.stage === step.stage)!.count);
      }
    }
    expect(lost?.count).toBe(summary.pipeline.stages[6]!.count);
    const leads = steps.find((step) => step.kind === "checkpoint" && step.id === "leads");
    expect(leads?.kind === "checkpoint" && leads.total).toEqual({ status: "ok", scope: SCOPES.pending, value: 9 });
  });

  it("dessine un point par dossier, plafonné et jamais pour un compte indisponible", () => {
    expect(friezeDots({ status: "ok", scope: SCOPES.current, value: 3 })).toEqual({ drawn: 3, capped: false });
    expect(friezeDots({ status: "ok", scope: SCOPES.current, value: FRIEZE_DOT_CAP + 8 })).toEqual({
      drawn: FRIEZE_DOT_CAP,
      capped: true,
    });
    expect(friezeDots({ status: "unavailable", scope: SCOPES.current })).toEqual({ drawn: 0, capped: false });
  });
});

describe("friezeRows", () => {
  it("donne à la bande des barres la hauteur de la plus haute barre réelle, bornée", () => {
    const summary = summaryWithCounts(); // tallest active stage: 11 → capped at one full column
    expect(friezeRows(buildFrieze(summary.pipeline, summary.todo))).toBe(FRIEZE_COLUMN_ROWS);
    summary.pipeline.stages = summary.pipeline.stages.map((stage) => ({
      ...stage,
      count: { status: "ok", scope: SCOPES.current, value: stage.stage === "chaud" ? 4 : 1 },
    }));
    expect(friezeRows(buildFrieze(summary.pipeline, summary.todo))).toBe(4);
    summary.pipeline.stages = summary.pipeline.stages.map((stage) => ({
      ...stage,
      count: { status: "unavailable", scope: SCOPES.current },
    }));
    expect(friezeRows(buildFrieze(summary.pipeline, summary.todo))).toBe(1);
  });
});

describe("PipelineFrieze", () => {
  it("affiche les vrais nombres de chaque étape, et autant de points que de dossiers", () => {
    const summary = summaryWithCounts();
    render(<PipelineFrieze pipeline={summary.pipeline} todo={summary.todo} />);

    for (const { stage, count } of summary.pipeline.stages) {
      const item = screen.getByTestId(`dashboard-stage-${stage}`);
      const value = count.status === "ok" ? count.value : -1;
      const figure = within(item).getByTestId("dashboard-figure");
      expect(Number.parseInt(figure.querySelector("p")?.textContent ?? "", 10)).toBe(value);
      expect(within(item).getByTestId("frieze-dots").children).toHaveLength(value);
    }
    expect(screen.getByTestId("dashboard-scope").textContent).toContain(TEXTS.scopes.current);
    expect(screen.getByRole("link", { name: TEXTS.pipelineLink }).getAttribute("href")).toBe("/pipeline");
  });

  it("n'invente aucune valeur : pas de pourcentage, pas de tendance, aucun nombre absent du résumé", () => {
    const summary = summaryWithCounts();
    const { container } = render(<PipelineFrieze pipeline={summary.pipeline} todo={summary.todo} />);

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/%|↑|↓|€|moyenne|taux/i);
    const allowed = new Set<number>([
      ...summary.pipeline.stages.map((stage) => (stage.count.status === "ok" ? stage.count.value : -1)),
      ...[summary.todo.inboundLeadsToProcess, summary.todo.appointmentsToConfirm, summary.todo.appointmentsToClose].map(
        (list) => (list.status === "ok" ? list.value.total : -1),
      ),
      1, // « 1 point = 1 dossier », the legend
    ]);
    for (const match of text.match(/\d+/g) ?? []) expect(allowed.has(Number(match)), match).toBe(true);
  });

  it("met « perdu » à part, en pointillés, hors de la ligne du parcours", () => {
    const summary = summaryWithCounts();
    render(<PipelineFrieze pipeline={summary.pipeline} todo={summary.todo} />);

    const lost = screen.getByTestId("dashboard-stage-perdu");
    expect(lost.className).toContain("border-dashed");
    expect(lost.textContent).toContain(TEXTS.pipelineLostNote);
    const line = screen.getByRole("list", { name: TEXTS.friezeListLabel });
    expect(line.contains(lost)).toBe(false);
    expect(within(line).getAllByRole("listitem")).toHaveLength(9);
  });

  it("un point de décision humaine n'est actif (anneau cobalt) que si quelque chose attend", () => {
    const summary = makeSummary();
    // Fixture: 1 lead, 1 appointment to confirm, 0 to close.
    const { container } = render(<PipelineFrieze pipeline={summary.pipeline} todo={summary.todo} />);

    const state = (id: string) =>
      container.querySelector(`[data-testid="dashboard-checkpoint-${id}"] [data-kind="human"]`)?.getAttribute("data-state");
    expect(state("leads")).toBe("active");
    expect(state("to-confirm")).toBe("active");
    expect(state("to-close")).toBe("idle");
    expect(screen.getByTestId("dashboard-checkpoint-leads").querySelector("a")?.getAttribute("href")).toBe(
      "/agents-ia/leads-entrants",
    );
    expect(screen.getByTestId("dashboard-checkpoint-to-close").querySelector("a")?.getAttribute("href")).toBe(
      "/agents-ia/suivi-rendez-vous",
    );
    // The mandate ends the line with the outcome shape, sealed by a person.
    const mandate = screen.getByTestId("dashboard-stage-mandat_signe");
    expect(mandate.querySelector('[data-kind="outcome"]')).not.toBeNull();
    expect(mandate.textContent).toContain(TEXTS.friezeMandateNote);
  });

  it("une étape ou un point de décision indisponible le dit, sans effacer les autres", () => {
    const summary = summaryWithCounts();
    summary.pipeline.stages[2] = { stage: "chaud", count: { status: "unavailable", scope: SCOPES.current } };
    summary.todo.appointmentsToClose = { status: "unavailable", scope: SCOPES.pending };
    const { container } = render(<PipelineFrieze pipeline={summary.pipeline} todo={summary.todo} />);

    expect(screen.getByTestId("dashboard-stage-chaud").textContent).toContain(TEXTS.unavailable);
    expect(screen.getByTestId("dashboard-stage-qualifie").textContent).not.toContain(TEXTS.unavailable);
    expect(screen.getByTestId("dashboard-checkpoint-to-close").textContent).toContain(TEXTS.unavailable);
    expect(
      container.querySelector('[data-testid="dashboard-checkpoint-to-close"] [data-kind="human"]')?.getAttribute("data-state"),
    ).toBe("inactive");
  });

  it("est complet au rendu serveur : aucune information derrière une animation", () => {
    const summary = summaryWithCounts();
    const { container } = render(<PipelineFrieze pipeline={summary.pipeline} todo={summary.todo} />);

    expect(container.querySelector("[data-reveal]")).toBeNull();
    expect(container.querySelector('[style*="opacity"]')).toBeNull();
    expect(screen.getAllByTestId("dashboard-figure")).toHaveLength(7);
  });
});
