// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { PipelineSummary } from "./PipelineSummary";
import { makeSummary, SCOPES } from "./summary-fixture";

const TEXTS = APP_TEXTS.dashboard;

afterEach(() => cleanup());

describe("PipelineSummary", () => {
  it("affiche un compte par étape avec son périmètre, et le lien vers le pipeline", () => {
    render(<PipelineSummary pipeline={makeSummary().pipeline} />);

    const nouveau = screen.getByTestId("dashboard-stage-nouveau");
    expect(within(nouveau).getByText("Nouveau")).toBeDefined();
    expect(within(nouveau).getByTestId("dashboard-figure").textContent).toContain("0");
    expect(nouveau.textContent).toContain(TEXTS.scopes.current);

    expect(screen.getByTestId("dashboard-stage-mandat_signe").textContent).toContain("5");
    expect(screen.getByRole("link", { name: TEXTS.pipelineLink }).getAttribute("href")).toBe("/pipeline");
  });

  it("met « perdu » en retrait, à part des étapes actives", () => {
    render(<PipelineSummary pipeline={makeSummary().pipeline} />);

    const lost = screen.getByTestId("dashboard-stage-perdu");
    expect(lost.className).toContain("border-dashed");
    expect(lost.textContent).toContain(TEXTS.pipelineLostNote);
    expect(screen.getByTestId("dashboard-stage-nouveau").className).not.toContain("border-dashed");
  });

  it("intègre « perdu » sur une rangée pleine largeur sous un filet, jamais comme une tuile orpheline", () => {
    render(<PipelineSummary pipeline={makeSummary().pipeline} />);

    const lost = screen.getByTestId("dashboard-stage-perdu");
    const lostList = lost.parentElement!;
    expect(lostList.className).toContain("border-t");
    expect(lostList.className).not.toContain("grid-cols");
    expect(lostList.children).toHaveLength(1);
    // Its figure and scope stay readable, exactly like the active stages.
    expect(within(lost).getByTestId("dashboard-figure").getAttribute("data-status")).toBe("ok");
    expect(lost.textContent).toContain(TEXTS.scopes.current);
    // The six active stages share one grid, perdu is outside it.
    const activeList = screen.getByTestId("dashboard-stage-nouveau").parentElement!;
    expect(activeList.children).toHaveLength(6);
    expect(activeList.contains(lost)).toBe(false);
  });

  it("une étape indisponible n'efface pas les autres", () => {
    const pipeline = makeSummary().pipeline;
    pipeline.stages[2] = { stage: "chaud", count: { status: "unavailable", scope: SCOPES.current } };

    render(<PipelineSummary pipeline={pipeline} />);

    expect(screen.getByTestId("dashboard-stage-chaud").textContent).toContain(TEXTS.unavailable);
    expect(screen.getByTestId("dashboard-stage-qualifie").textContent).not.toContain(TEXTS.unavailable);
  });
});
