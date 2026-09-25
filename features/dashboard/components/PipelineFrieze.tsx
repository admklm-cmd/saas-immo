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
 * is set apart, dashed, under the line.
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
          <h2 id="dashboard-frieze-title" className="text-section font-semibold text-ink">
            {TEXTS.friezeTitle}
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            {TEXTS.friezeSubtitle}
            <span data-testid="dashboard-scope" className="whitespace-nowrap text-ink-subtle">
              <span aria-hidden="true" className="px-1.5">
                ·
              </span>
              <span className="sr-only">. {TEXTS.scopePrefix} </span>
              {TEXTS.scopes.current}
            </span>
          </p>
        </div>
        <Link href="/pipeline" className={cn(ITEM_LINK_CLASS, "text-sm")}>
          {TEXTS.pipelineLink}
        </Link>
      </div>

      <ol
        aria-label={TEXTS.friezeListLabel}
        className={cn(styles.frieze, "stagger mt-6 flex flex-col lg:max-w-xl xl:mt-8 xl:max-w-none xl:flex-row")}
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

      {lost ? (
        <div
          data-testid="dashboard-stage-perdu"
          className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-dashed border-line-strong bg-surface-muted px-4 py-3"
        >
          <PipelineStageBadge stage="perdu" />
          <div data-testid="dashboard-figure" data-status={lost.count.status}>
            <p className="flex items-baseline gap-1.5">
              {lostValue !== null ? (
                <>
                  <span className="text-heading font-semibold text-ink-subtle tabular-nums">{lostValue}</span>
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
          <p className="text-xs text-ink-subtle sm:ml-auto">{TEXTS.pipelineLostNote}</p>
        </div>
      ) : null}

      <div aria-hidden="true" className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-subtle">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-ink-subtle/55" />
          {TEXTS.friezeLegendDot}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full border border-ink outline-[1.5px] outline-offset-2 outline-accent outline-solid" />
          {TEXTS.friezeLegendHuman}
        </span>
      </div>
    </section>
  );
}
