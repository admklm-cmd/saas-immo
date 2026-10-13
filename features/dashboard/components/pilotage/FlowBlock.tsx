"use client";

import dynamic from "next/dynamic";
import { useState, type KeyboardEvent } from "react";

import { ChartStage } from "@/components/charts/ChartStage";
import { APP_TEXTS } from "@/components/texts";

import { Deferred } from "./Deferred";
import type { FlowView, PilotageView } from "./pilotage-view";

const TEXTS = APP_TEXTS.dashboard.pilotage;
const FLOW = TEXTS.flow;

const FlowSankey = dynamic(() => import("./FlowSankey").then((module) => module.FlowSankey), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-80 w-full rounded-lg border border-dashed border-line" />,
});

const HATCH = "repeating-linear-gradient(45deg, var(--color-ink) 0 1.5px, transparent 1.5px 4px)";

function FlowTable({ flow, period }: { flow: FlowView; period: string }) {
  return (
    <details className="mt-4 text-sm text-ink-muted" data-testid="flow-table">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-xs underline-offset-4 hover:text-ink hover:underline lg:min-h-8">
        {FLOW.tableSummary}
      </summary>
      <table className="mt-2 w-full text-left text-[13px]">
        <caption className="sr-only">{FLOW.tableCaption(period)}</caption>
        <thead>
          <tr className="text-ink-subtle">
            <th scope="col" className="py-1.5 pr-3 font-medium">{FLOW.colStep}</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">{FLOW.colDossiers}</th>
            <th scope="col" className="py-1.5 font-medium">{FLOW.colTo}</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {flow.rows.map((row) => (
            <tr key={row.id} className="border-t border-line align-top">
              <th scope="row" className="py-1.5 pr-3 font-normal">{row.name}</th>
              <td className="figure py-1.5 pr-3 text-right">{row.value}</td>
              <td className="py-1.5 text-ink-muted">
                {row.to.length === 0 ? "—" : row.to.map((target) => `${target.name} (${target.value})`).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Small screens: the same flow as three ranks of bars (the Sankey needs width). Lengths are only a drawing of the counts. */
function FlowRanks({ flow }: { flow: FlowView }) {
  const widest = Math.max(flow.received, 1);
  const ranks = [["received"], ["hot", "notHot", "lostBefore"], ["signed", "stillHot", "lostAfter"]];
  return (
    <div className="mt-6 flex flex-col gap-5 sm:hidden" data-testid="flow-ranks">
      {ranks.map((ids, rank) => (
        <ol key={rank} className="flex flex-col gap-2">
          {ids
            .map((id) => flow.nodes.find((node) => node.id === id))
            .filter((node): node is FlowView["nodes"][number] => Boolean(node))
            .map((node) => (
              <li key={node.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">{node.name}</span>
                  <span className="figure text-ink">{node.value}</span>
                </div>
                <div
                  className="mt-1 h-2 rounded-xs"
                  style={{
                    width: `${Math.max(2, Math.round((node.value / widest) * 100))}%`,
                    backgroundColor: node.id === "signed" || node.id === "received" ? "var(--color-ink)" : "var(--chart-4)",
                    backgroundImage: node.hatched ? HATCH : undefined,
                  }}
                />
              </li>
            ))}
        </ol>
      ))}
    </div>
  );
}

export type FlowBlockProps = {
  view: PilotageView;
};

/**
 * « Du premier contact au mandat » (docs §3.5.2.E4). The Sankey is a lazy island (≥ 640 px);
 * below, three ranks of bars. The title, the scope, the note, the table and a live region
 * are always in the HTML. If the stages do not add up, nothing is drawn.
 */
export function FlowBlock({ view }: FlowBlockProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const block = view.flow;
  const flow = block.status === "ok" ? block.value : null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!flow) return;
    const last = flow.nodes.length - 1;
    const go = (to: number | null) => {
      event.preventDefault();
      setHovered(to);
    };
    if (event.key === "ArrowRight" || event.key === "ArrowDown") go(hovered === null ? 0 : Math.min(last, hovered + 1));
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") go(hovered === null ? last : Math.max(0, hovered - 1));
    else if (event.key === "Escape" && hovered !== null) go(null);
  }

  const row = flow && hovered !== null ? flow.rows[hovered] : null;
  const detail = row ? row.to.map((target) => FLOW.liveTo(target.value, target.name)).join("") : "";

  return (
    <section aria-labelledby="flow-title" data-testid="pilotage-flow" data-status={block.status} className="min-w-0">
      <h2 id="flow-title" className="text-heading font-semibold text-ink">
        {FLOW.title}
      </h2>
      <p className="mt-1 text-sm text-ink-muted" data-testid="flow-scope">
        {FLOW.scope(view.span)}
      </p>

      {block.status === "unavailable" ? (
        <div className="mt-8" data-testid="flow-unavailable">
          <p className="figure text-3xl font-medium text-ink">{TEXTS.unavailable}</p>
          <p className="mt-2 text-sm text-ink-muted">{TEXTS.unavailableCalc}</p>
        </div>
      ) : flow === null ? (
        <p className="mt-8 text-base text-ink" data-testid="flow-inconsistent">
          {FLOW.inconsistent}
        </p>
      ) : flow.received === 0 ? (
        <p className="mt-8 text-base text-ink" data-testid="flow-empty">
          {FLOW.empty}
        </p>
      ) : (
        <ChartStage className="mt-6" testId="flow-stage">
          <div
            role="group"
            tabIndex={0}
            aria-label={FLOW.label(view.announce, flow.received, flow.hot, flow.lost, flow.signed)}
            aria-describedby="flow-keyboard-hint"
            onKeyDown={onKeyDown}
            onBlur={() => setHovered(null)}
            data-testid="flow-group"
            className="hidden rounded-lg sm:block"
          >
            <Deferred testId="flow-sankey-zone" className="h-80 w-full" swap>
              <FlowSankey key={view.key} flow={flow} hovered={hovered} onHover={setHovered} />
            </Deferred>
          </div>
          <FlowRanks flow={flow} />
          <p id="flow-keyboard-hint" className="sr-only">
            {FLOW.keyboardHint}
          </p>
          <p aria-live="polite" data-testid="flow-live" className="sr-only">
            {row ? FLOW.live(row.name, row.value, detail) : ""}
          </p>
          <p className="mt-3 text-xs text-ink-subtle">{FLOW.note}</p>
          {flow.untraced > 0 ? <p className="mt-1 text-xs text-ink-subtle">{FLOW.untraced(flow.untraced)}</p> : null}
          <FlowTable flow={flow} period={view.announce} />
        </ChartStage>
      )}
    </section>
  );
}
