// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/features/contacts/types";

import { PipelineStageBadge } from "./PipelineStageBadge";

afterEach(() => {
  cleanup();
});

const STAGES = Object.keys(PIPELINE_STAGE_LABELS) as PipelineStage[];

describe("PipelineStageBadge", () => {
  it("shows the centralised French label of every pipeline stage", () => {
    for (const stage of STAGES) {
      const { unmount } = render(<PipelineStageBadge stage={stage} />);
      expect(screen.getByText(PIPELINE_STAGE_LABELS[stage])).toBeDefined();
      unmount();
    }
  });

  it("exposes the raw stage for tests and styling", () => {
    const { container } = render(<PipelineStageBadge stage="rdv_planifie" />);
    expect(container.querySelector("[data-stage='rdv_planifie']")).not.toBeNull();
  });

  it("carries meaning with text and shape, never with colour alone", () => {
    const { container: signed } = render(<PipelineStageBadge stage="mandat_signe" />);
    const { container: lost } = render(<PipelineStageBadge stage="perdu" />);

    // Six progress dots for a live stage, none for a lost deal.
    expect(signed.querySelectorAll("span[aria-hidden='true'] > span")).toHaveLength(6);
    expect(lost.querySelectorAll("span[aria-hidden='true'] > span")).toHaveLength(0);
    expect(lost.firstElementChild?.className).toContain("border-dashed");
  });
});
