"use client";

import { PatternLines } from "@visx/pattern";
import { MotionConfig } from "motion/react";

import { SankeyChart } from "@/components/charts/bklit/sankey/sankey-chart";
import { SankeyLink } from "@/components/charts/bklit/sankey/sankey-link";
import { SankeyNode } from "@/components/charts/bklit/sankey/sankey-node";
import { SankeyTooltip } from "@/components/charts/bklit/sankey/sankey-tooltip";
import { APP_TEXTS } from "@/components/texts";

import { prefersReducedMotion } from "./motion";
import type { FlowView } from "./pilotage-view";

const TEXTS = APP_TEXTS.dashboard.pilotage.flow;
const HATCH_ID = "flow-hatch";
const NODE_WIDTH = 14;
const NODE_PADDING = 30;
const MARGIN = { top: 8, right: 130, bottom: 8, left: 120 };
/** Entrance: nodes then links (docs §3.5.2.E4: 500 ms for the links). */
const ENTER_MS = 900;

/** Node fills: the ink ramp of `.chart-scope-sheet`; the lost nodes are hatched; only the mandate is full ink. */
const FILL: Record<string, string> = {
  received: "var(--chart-1)",
  hot: "var(--chart-2)",
  notHot: "var(--chart-4)",
  lostBefore: `url(#${HATCH_ID})`,
  signed: "var(--chart-1)",
  stillHot: "var(--chart-3)",
  lostAfter: `url(#${HATCH_ID})`,
};

const dossiers = (value: number) => `${value} ${value > 1 ? "dossiers" : "dossier"}`;

export type FlowSankeyProps = {
  flow: FlowView;
  hovered: number | null;
  onHover: (index: number | null) => void;
};

/**
 * « Du premier contact au mandat » (Bklit `SankeyChart`): requests in, what they became
 * today. Seven nodes at most, three columns; labels sit outside the nodes, on a light
 * halo. Lost nodes are hatched. Hidden from assistive technology: the block writes the
 * same figures as a table and a live region.
 */
export function FlowSankey({ flow, hovered, onHover }: FlowSankeyProps) {
  const index = new Map(flow.nodes.map((node, position) => [node.id, position]));
  const data = {
    nodes: flow.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      category: node.kind === "source" ? ("source" as const) : node.kind === "outcome" ? ("outcome" as const) : ("landing" as const),
    })),
    links: flow.links.map((link) => ({
      source: index.get(link.source) ?? 0,
      target: index.get(link.target) ?? 0,
      value: link.value,
    })),
  };

  return (
    <div aria-hidden="true" className="chart-scope chart-scope-sheet h-80 w-full" data-testid="flow-sankey">
      <MotionConfig reducedMotion="user">
        <SankeyChart
          data={data}
          margin={MARGIN}
          nodeWidth={NODE_WIDTH}
          nodePadding={NODE_PADDING}
          animationDuration={prefersReducedMotion() ? 0 : ENTER_MS}
          enterTransition={prefersReducedMotion() ? { duration: 0 } : undefined}
          aspectRatio="auto"
          className="h-full"
          hoveredNodeIndex={hovered}
          onNodeHoverChange={onHover}
        >
          <SankeyLink
            useGradient={false}
            stroke="var(--color-ink)"
            strokeOpacity={0.14}
            fadedOpacity={0.05}
            patterns={
              <PatternLines
                id={HATCH_ID}
                height={5}
                width={5}
                orientation={["diagonal"]}
                stroke="var(--color-ink)"
                strokeWidth={1.2}
                background="var(--chart-4)"
              />
            }
          />
          <SankeyNode
            lineCap={2}
            valueLabel={dossiers}
            labelSide={(node) => (node.category === "source" || node.category === "landing" ? "left" : "right")}
            getNodeColor={(node) => FILL[String((node as unknown as { id: string }).id)] ?? "var(--chart-3)"}
          />
          <SankeyTooltip nodeLabel={TEXTS.tooltipFlow} linkLabel={TEXTS.tooltipFlow} formatValue={(value) => String(value)} />
        </SankeyChart>
      </MotionConfig>
    </div>
  );
}
