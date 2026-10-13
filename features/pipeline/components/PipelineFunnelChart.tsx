"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";

import { FunnelChart, type FunnelStage } from "@/components/charts/bklit/funnel-chart";
import { useChartReady } from "@/components/charts/ChartReadyContext";
import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";

import { describeSlice, funnelAriaLabel, type FunnelSlice } from "./funnel-chart";
import styles from "./PipelineFunnel.module.css";

const TEXTS = APP_TEXTS.pipeline.funnel;
const GAP = 8;
/** The chart's own entrance: at most 900 ms, at most 70 ms between two slices (docs §3.5.1.D). */
const STAGGER_S = 0.07;
const ENTER = { duration: 0.6, ease: [0.22, 0.61, 0.36, 1] } as const;
const WIDE_QUERY = "(min-width: 48rem)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
/** Reduced motion: the slices are drawn at once (MotionConfig does not cover the chart's own progress values). */
const INSTANT = { duration: 0 } as const;

/** Fill of a slice: its grey, plus fine ink dots (12 %) on the one slice being read. */
function ReadingPattern({ id, color, reading }: { id: string; color: string; reading: boolean }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill={color} />
      {reading ? <circle cx="3" cy="3" r="0.9" fill="var(--color-ink)" fillOpacity="0.12" /> : null}
    </pattern>
  );
}

export type PipelineFunnelChartProps = {
  /** One slice per stage, in order, with the figures and texts already written. */
  slices: readonly FunnelSlice[];
};

/**
 * The funnel (Bklit UI) with its labels, figures and pass rates. A client
 * island: the chart measures itself and follows the pointer. It only receives
 * counts and written rates; the rates are the database's exact ratios, rounded
 * once on the server.
 *
 * Labels and figures stay OUTSIDE the slices (contrast holds whatever the grey).
 * The SVG is hidden from assistive technology; the group carries a written
 * summary, the table under the card holds every value, and a live region reads
 * the active stage. Arrow keys move the active stage (the chart's own hover
 * state is controlled from here, so keyboard and pointer share one tooltip).
 */
export function PipelineFunnelChart({ slices }: PipelineFunnelChartProps) {
  const ready = useChartReady();
  const [active, setActive] = useState<number | null>(null);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // The chart only mounts after hydration (`ready`), so reading the media query here cannot mismatch.
  const reduced = ready && window.matchMedia(REDUCED_QUERY).matches;
  const stages: FunnelStage[] = slices.map((slice, i) => ({
    label: slice.label,
    value: slice.reached,
    color: `var(--chart-${i + 1})`,
  }));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = slices.length - 1;
    const go = (to: number | null) => {
      event.preventDefault();
      setActive(to);
    };
    if (event.key === "ArrowRight" || event.key === "ArrowDown") go(active === null ? 0 : Math.min(last, active + 1));
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") go(active === null ? last : Math.max(0, active - 1));
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(last);
    else if (event.key === "Escape" && active !== null) go(null);
  }

  const activeSlice = active === null ? null : (slices[active] ?? null);
  const at = (i: number) => ({ "--i": i }) as CSSProperties;
  const dim = (i: number) => active !== null && active !== i && "opacity-40";

  return (
    <div>
      <div
        role="group"
        tabIndex={0}
        aria-label={funnelAriaLabel(slices)}
        aria-describedby="funnel-keyboard-hint"
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onMouseLeave={() => setActive(null)}
        data-testid="funnel-chart"
        className="chart-scope chart-scope-band rounded-lg"
      >
        <div className={styles.grid}>
          {slices.map((slice, i) => (
            <p
              key={`label-${slice.stage}`}
              data-testid="funnel-label"
              style={at(i)}
              className={cn(
                styles.label,
                "text-sm leading-tight font-medium text-balance text-ink-muted transition-opacity duration-150 ease-standard",
                dim(i),
              )}
            >
              {slice.label}
            </p>
          ))}
          {slices.map((slice, i) => (
            <p
              key={`value-${slice.stage}`}
              data-chart-figure=""
              data-testid="funnel-value"
              style={at(i)}
              className={cn(
                styles.value,
                "figure text-title leading-none font-semibold text-ink transition-opacity duration-150 ease-standard",
                dim(i),
              )}
            >
              {slice.reached}
            </p>
          ))}

          <div className={styles.chart} aria-hidden="true" data-testid="funnel-plot">
            {ready ? (
              <MotionConfig reducedMotion="user">
                <FunnelChart
                  data={stages}
                  orientation={wide ? "horizontal" : "vertical"}
                  edges="curved"
                  layers={3}
                  gap={GAP}
                  showValues={false}
                  showLabels={false}
                  showPercentage={false}
                  staggerDelay={reduced ? 0 : STAGGER_S}
                  enterTransition={reduced ? INSTANT : ENTER}
                  hoveredIndex={active}
                  onHoverChange={setActive}
                  grid={wide ? { bands: false, lines: true, lineColor: "var(--chart-grid)" } : false}
                  renderPattern={(id, color) => (
                    <ReadingPattern id={id} color={color} reading={Number(/(\d+)$/.exec(id)?.[1]) === active} />
                  )}
                  style={{ aspectRatio: "auto", height: "100%" }}
                />
              </MotionConfig>
            ) : null}
          </div>

          {slices.map((slice, i) =>
            slice.rate === null ? null : (
              <span
                key={`rate-${slice.stage}`}
                role="img"
                aria-label={slice.rateName ?? undefined}
                data-testid="funnel-rate"
                style={at(i)}
                className={cn(
                  styles.rate,
                  "figure inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface px-2 py-0.5 text-xs font-medium whitespace-nowrap text-ink",
                )}
              >
                <span aria-hidden="true">{wide ? "→" : "↓"}</span>
                {slice.rate}
              </span>
            ),
          )}

          <p className={cn(styles.note, "text-xs text-ink-subtle")} data-testid="funnel-signed-note">
            {TEXTS.signedNote}
          </p>

          {activeSlice && active !== null ? (
            <div
              aria-hidden="true"
              data-testid="funnel-tooltip"
              style={at(active)}
              className={cn(
                styles.tip,
                active === 0 && styles.tipFirst,
                active === slices.length - 1 && styles.tipLast,
                "w-max max-w-64 rounded-md border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink shadow-overlay",
              )}
            >
              <p className="font-medium">
                {activeSlice.label} : {TEXTS.stageDossiers(activeSlice.reached)}
              </p>
              {activeSlice.passToNext ? <p className="mt-0.5 text-ink-muted">{activeSlice.passToNext}</p> : null}
              {activeSlice.ratioToNext ? <p className="mt-0.5 text-ink-subtle">{activeSlice.ratioToNext}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
      <p id="funnel-keyboard-hint" className="sr-only">
        {TEXTS.keyboardHint}
      </p>
      <p aria-live="polite" data-testid="funnel-live" className="sr-only">
        {activeSlice ? describeSlice(activeSlice) : ""}
      </p>
    </div>
  );
}
