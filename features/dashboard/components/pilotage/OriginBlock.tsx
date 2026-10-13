"use client";

import dynamic from "next/dynamic";
import { useState, type KeyboardEvent } from "react";

import { ChartStage } from "@/components/charts/ChartStage";
import { APP_TEXTS } from "@/components/texts";

import { Deferred } from "./Deferred";
import { partColor } from "./origin-colors";
import type { OriginPart, PilotageView } from "./pilotage-view";

const TEXTS = APP_TEXTS.dashboard.pilotage;
const ORIGIN = TEXTS.origin;

const OriginRing = dynamic(() => import("./OriginRing").then((module) => module.OriginRing), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="mx-auto aspect-square w-full rounded-full border border-dashed border-line" />,
});

const HATCH = "repeating-linear-gradient(45deg, var(--color-ink) 0 1.5px, transparent 1.5px 4px)";

function Swatch({ index, grouped }: { index: number; grouped: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: partColor(index), backgroundImage: grouped ? HATCH : undefined }}
    />
  );
}

function OriginTable({ parts, period }: { parts: readonly OriginPart[]; period: string }) {
  return (
    <details className="mt-4 text-sm text-ink-muted" data-testid="origin-table">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-xs underline-offset-4 hover:text-ink hover:underline lg:min-h-8">
        {ORIGIN.tableSummary}
      </summary>
      <table className="mt-2 w-full text-left text-[13px]">
        <caption className="sr-only">{ORIGIN.tableCaption(period)}</caption>
        <thead>
          <tr className="text-ink-subtle">
            <th scope="col" className="py-1.5 pr-3 font-medium">{ORIGIN.colOrigin}</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">{ORIGIN.colCount}</th>
            <th scope="col" className="py-1.5 text-right font-medium">{ORIGIN.colShare}</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {parts.map((part) => (
            <tr key={part.key} className="border-t border-line">
              <th scope="row" className="py-1.5 pr-3 font-normal">{part.label}</th>
              <td className="figure py-1.5 pr-3 text-right">{part.count}</td>
              <td className="figure py-1.5 text-right">{part.share} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export type OriginBlockProps = {
  view: PilotageView;
};

/**
 * « Origine des demandes » (docs §3.5.2.E3): the ring (lazy island) and, always in the
 * HTML, its legend, its written summary and a table. The legend and the ring share the
 * hovered part; the arrow keys walk the parts and a live region reads them.
 */
export function OriginBlock({ view }: OriginBlockProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const block = view.origins;
  const parts = block.status === "ok" ? block.value.parts : [];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (parts.length === 0) return;
    const last = parts.length - 1;
    const go = (to: number | null) => {
      event.preventDefault();
      setHovered(to);
    };
    if (event.key === "ArrowRight" || event.key === "ArrowDown") go(hovered === null ? 0 : Math.min(last, hovered + 1));
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") go(hovered === null ? last : Math.max(0, hovered - 1));
    else if (event.key === "Escape" && hovered !== null) go(null);
  }

  const hoveredPart = hovered === null ? null : (parts[hovered] ?? null);

  return (
    <section aria-labelledby="origin-title" data-testid="pilotage-origin" data-status={block.status} className="@container min-w-0">
      <h2 id="origin-title" className="text-heading font-semibold text-ink">
        {ORIGIN.title}
      </h2>
      <p className="mt-1 text-sm text-ink-muted" data-testid="origin-scope">
        {ORIGIN.scope(view.span)}
      </p>

      {block.status === "unavailable" ? (
        <div className="mt-8" data-testid="origin-unavailable">
          <p className="figure text-3xl font-medium text-ink">{TEXTS.unavailable}</p>
          <p className="mt-2 text-sm text-ink-muted">{TEXTS.unavailableCalc}</p>
        </div>
      ) : block.value.total === 0 ? (
        <p className="mt-8 text-base text-ink" data-testid="origin-empty">
          {ORIGIN.empty}
        </p>
      ) : (
        <ChartStage className="mt-6" testId="origin-stage">
          <div
            role="group"
            tabIndex={0}
            aria-label={ORIGIN.label(view.announce, parts.map((part) => `${part.label} ${part.count}`).join(", "))}
            aria-describedby="origin-keyboard-hint"
            onKeyDown={onKeyDown}
            onBlur={() => setHovered(null)}
            data-testid="origin-group"
            className="grid items-center gap-6 rounded-lg @md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] @md:gap-8"
          >
            <Deferred testId="origin-ring-zone" className="mx-auto aspect-square w-full max-w-56 @md:max-w-none" swap>
              <OriginRing key={view.key} parts={parts} hovered={hovered} onHover={setHovered} />
            </Deferred>

            <ul className="min-w-0 divide-y divide-line border-y border-line" data-testid="origin-legend">
              {parts.map((part, index) => (
                <li
                  key={part.key}
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  data-active={hovered === index ? "true" : undefined}
                  className="flex min-h-11 items-center gap-3 py-2 text-sm text-ink transition-opacity duration-(--duration-fast) ease-standard data-[active=true]:font-medium"
                  style={{ opacity: hovered === null || hovered === index ? 1 : 0.4 }}
                >
                  <Swatch index={index} grouped={part.grouped} />
                  <span className="min-w-0 flex-1">{part.label}</span>
                  <span className="figure">{part.count}</span>
                  <span className="figure w-12 text-right text-ink-muted">{part.share} %</span>
                </li>
              ))}
            </ul>
          </div>
          <p id="origin-keyboard-hint" className="sr-only">
            {ORIGIN.keyboardHint}
          </p>
          <p aria-live="polite" data-testid="origin-live" className="sr-only">
            {hoveredPart ? ORIGIN.live(hoveredPart.label, hoveredPart.count, hoveredPart.share) : ""}
          </p>
          <p className="mt-3 text-[11px] text-ink-subtle">{ORIGIN.rounding}</p>
          <OriginTable parts={parts} period={view.announce} />
        </ChartStage>
      )}
    </section>
  );
}
