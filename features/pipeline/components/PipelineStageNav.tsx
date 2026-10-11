"use client";

import { useEffect, useState, type MouseEvent } from "react";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/features/contacts/types";

const TEXTS = APP_TEXTS.pipeline;

export type PipelineStageNavItem = {
  stage: PipelineStage;
  count: number;
  /** Id of the column (or of the lost lane) the link leads to. */
  targetId: string;
};

export type PipelineStageNavProps = {
  /** The six active stages, in the order of the journey. */
  stages: readonly PipelineStageNavItem[];
  /** « Perdu », set apart (dashed). */
  lost: PipelineStageNavItem;
  /** Id of the horizontal scroller that holds the six columns. */
  scrollerId: string;
};

/** Share of a column that must be visible in the scroller for it to count as « in view ». */
const IN_VIEW_RATIO = 0.6;

/**
 * Map of the board: one segment per stage, in the order of the line, with
 * its exact count. It is also the position of the scroller — the segments of
 * the columns in view are inked — so on a phone (one column per screen) it
 * says where you are in the journey.
 *
 * Plain in-page links: without JavaScript the browser jumps to the column.
 * With it, the scroller is brought to the column at once (no scripted,
 * eased scrolling) without moving the page, and the focus goes to the
 * column's heading so Tab continues from there.
 */
export function PipelineStageNav({ stages, lost, scrollerId }: PipelineStageNavProps) {
  const [inView, setInView] = useState<ReadonlySet<PipelineStage>>(() => new Set());

  useEffect(() => {
    const scroller = document.getElementById(scrollerId);
    if (!scroller || typeof IntersectionObserver === "undefined") return;
    const columns = Array.from(scroller.querySelectorAll<HTMLElement>("[data-pipeline-column]"));
    const visible = new Set<PipelineStage>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const stage = (entry.target as HTMLElement).dataset.pipelineColumn as PipelineStage;
          if (entry.intersectionRatio >= IN_VIEW_RATIO) visible.add(stage);
          else visible.delete(stage);
        }
        setInView(new Set(visible));
      },
      { root: scroller, threshold: [0, IN_VIEW_RATIO, 1] },
    );
    for (const column of columns) observer.observe(column);
    return () => observer.disconnect();
  }, [scrollerId]);

  function jump(event: MouseEvent<HTMLAnchorElement>, targetId: string) {
    const scroller = document.getElementById(scrollerId);
    const target = document.getElementById(targetId);
    if (!scroller || !target || !scroller.contains(target)) return; // the lost lane: native jump
    event.preventDefault();
    const padding = Number.parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart) || 0;
    const left = target.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    scroller.scrollTo({ left: left - padding, behavior: "instant" });
    target.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }

  return (
    <nav aria-label={TEXTS.stageNavLabel}>
      {/* Six equal segments when there is room; from 1024 px a segment is never
          narrower than its label (the longer ones take what they need, the
          others share the rest), so no label is cut at 1024, 1280 or 1440 px.
          Below, a label may wrap onto two lines — never an ellipsis. */}
      <ol className="grid grid-cols-[repeat(6,minmax(0,1fr))_auto] items-start gap-1.5 sm:gap-2 lg:grid-cols-[repeat(6,minmax(max-content,1fr))_auto]">
        {stages.map((item) => {
          const active = inView.has(item.stage);
          return (
            <li key={item.stage} className="min-w-0">
              <a
                href={`#${item.targetId}`}
                onClick={(event) => jump(event, item.targetId)}
                data-in-view={active ? "true" : undefined}
                className="group/seg ui-focus block rounded-xs pt-1.5 pb-1"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-0.5 rounded-full transition-colors duration-(--duration-base) ease-standard",
                    active ? "bg-ink" : "bg-line-strong group-hover/seg:bg-ink-subtle",
                  )}
                />
                {/* Inline: a wrapped label keeps its count right after its last word.
                    Tight veil on the words only (not on the spacing padding): it
                    never reaches the bar above (mt-2) nor the next label (§2.5.8). */}
                <span className="mt-2 block text-xs text-balance sm:pr-2 lg:pr-3 lg:whitespace-nowrap">
                  <span className="particle-veil particle-veil-tight inline-block max-w-full">
                    <span
                      className={cn(
                        "max-sm:sr-only",
                        active ? "font-medium text-ink" : "text-ink-muted group-hover/seg:text-ink",
                      )}
                    >
                      {PIPELINE_STAGE_LABELS[item.stage]}
                    </span>
                    <span aria-hidden="true" className="whitespace-nowrap text-ink-subtle tabular-nums sm:ml-1.5">
                      {item.count}
                    </span>
                  </span>
                  {/* Outside the veil: an absolutely positioned sr-only text would
                      overflow the (positioned) veil box. */}
                  <span className="sr-only">, {TEXTS.columnCount(item.count)}</span>
                </span>
              </a>
            </li>
          );
        })}
        <li className="w-14 pl-1.5 sm:w-24 sm:pl-3">
          <a href={`#${lost.targetId}`} className="group/seg ui-focus block rounded-xs pt-1.5 pb-1">
            <span
              aria-hidden="true"
              className="block h-0 border-t-2 border-dotted border-line-strong group-hover/seg:border-ink-subtle"
            />
            <span className="mt-2 block text-xs whitespace-nowrap">
              <span className="particle-veil particle-veil-tight inline-block">
                <span className="text-ink-subtle max-sm:sr-only">{PIPELINE_STAGE_LABELS[lost.stage]}</span>
                <span aria-hidden="true" className="text-ink-subtle tabular-nums sm:ml-1.5">
                  {lost.count}
                </span>
              </span>
              <span className="sr-only">, {TEXTS.columnCount(lost.count)}</span>
            </span>
          </a>
        </li>
      </ol>
    </nav>
  );
}
