import Link from "next/link";
import type { CSSProperties } from "react";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";

import type { DashboardPipeline, DashboardTodo } from "../types";
import { buildFrieze, friezeRows } from "./frieze";
import { FriezeCheckpoint } from "./FriezeCheckpoint";
import { FriezeDots } from "./FriezeDots";
import { FriezeStage } from "./FriezeStage";
import { ITEM_LINK_CLASS } from "./link-styles";
import styles from "./PipelineFrieze.module.css";

const TEXTS = APP_TEXTS.dashboard;

/**
 * « Où en sont les dossiers » — the demonstration of the dashboard.
 *
 * The six active stages on one line, in the order of the seller's journey,
 * each with ONE DOT PER DOSSIER and its exact count; the three places where a
 * person must decide sit on the line as checkpoints (cobalt ring only when
 * something waits). The mandate ends the line, sealed by a person. « Perdu »
 * is set apart, dashed, off the line.
 *
 * Composition: below 768 px the vertical line takes the whole card; from 768
 * to 1279 px it takes the left three fifths and the legend and « Perdu » sit
 * beside it (the legend level with the start of the line, « Perdu » level with
 * its end), so the card is never half empty; from 1280 px the line is
 * horizontal and both go under it.
 *
 * Every figure comes from `getDashboardSummary` as is (`buildFrieze` only
 * reorders). Server Component: complete without JavaScript and under reduced
 * motion; the only motion is the hover emphasis of a stage (CSS module).
 */
export function PipelineFrieze({ pipeline, todo }: { pipeline: DashboardPipeline; todo: DashboardTodo }) {
  const frieze = buildFrieze(pipeline, todo);
  const { steps, lost } = frieze;
  const lostValue = lost?.count.status === "ok" ? lost.count.value : null;

  return (
    <section
      aria-labelledby="dashboard-frieze-title"
      data-testid="dashboard-pipeline"
      className="rounded-2xl border border-line bg-surface px-5 pt-6 pb-5 shadow-subtle sm:px-8 sm:pt-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h2 id="dashboard-frieze-title" className="text-section font-bold text-ink">
            {TEXTS.friezeTitle}
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            <span data-testid="dashboard-scope" className="label whitespace-nowrap text-ink-subtle">
              <span className="sr-only">{TEXTS.scopePrefix} </span>
              {TEXTS.scopes.current}
            </span>
          </p>
        </div>
        <Link href="/pipeline" className={cn(ITEM_LINK_CLASS, "text-sm")}>
          {TEXTS.pipelineLink}
        </Link>
      </div>

      <div className="mt-6 md:grid md:grid-cols-[minmax(0,3fr)_minmax(14rem,2fr)] md:gap-x-10 xl:mt-8 xl:block">
        <ol
          aria-label={TEXTS.friezeListLabel}
          className={cn(styles.frieze, "stagger flex flex-col xl:flex-row")}
          style={{ "--frieze-rows": friezeRows(frieze) } as CSSProperties}
        >
          {steps.map((step, index) =>
            step.kind === "stage" ? (
              <FriezeStage key={step.stage} step={step} last={index === steps.length - 1} />
            ) : (
              <FriezeCheckpoint key={step.id} step={step} first={index === 0} />
            ),
          )}
        </ol>

        {/* Beside the vertical line (768-1279 px): « Perdu » at the bottom, the legend at the top. */}
        <div className="mt-6 flex flex-col gap-5 md:mt-0 md:flex-col-reverse md:justify-between md:border-l md:border-line md:pl-8 xl:mt-6 xl:flex-col xl:justify-start xl:border-l-0 xl:pl-0">
          {lost ? (
            <div
              data-testid="dashboard-stage-perdu"
              className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-dashed border-line-strong bg-surface-muted px-4 py-3 md:max-xl:gap-x-4 md:max-xl:py-4"
            >
              <PipelineStageBadge stage="perdu" />
              <div data-testid="dashboard-figure" data-status={lost.count.status}>
                <p className="flex items-baseline gap-1.5">
                  {lostValue !== null ? (
                    <>
                      <span className="text-heading font-semibold text-ink-subtle figure">{lostValue}</span>
                      <span className="text-xs text-ink-muted">{TEXTS.pipelineUnit(lostValue)}</span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-ink">{TEXTS.unavailable}</span>
                  )}
                </p>
                <span className="sr-only">
                  {TEXTS.scopePrefix} {TEXTS.scopes[lost.count.scope.key]}
                </span>
              </div>
              <FriezeDots count={lost.count} tone="lost" layout="row" className="max-w-40" />
              <p className="text-xs text-ink-subtle sm:ml-auto md:max-xl:ml-0 md:max-xl:basis-full">
                {TEXTS.pipelineLostNote}
              </p>
            </div>
          ) : null}

          <div
            aria-hidden="true"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-subtle md:max-xl:flex-col md:max-xl:items-start md:max-xl:gap-y-3 md:max-xl:pt-2"
          >
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-ink-subtle/55" />
              {TEXTS.friezeLegendDot}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full border border-ink outline-[1.5px] outline-offset-2 outline-accent outline-solid" />
              {TEXTS.friezeLegendHuman}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
