import { formatDurationMs } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";

import { stepAuthor, type ReplayStep } from "./replay";

const TEXTS = APP_TEXTS.replay;

/** Visual state of a row during the replay. */
export type StepPlayState = "active" | "done";

/**
 * A technical failure is inverted; a guard-rail stop is outlined — it is the
 * product doing its job, never shown as an error.
 */
function statusTone(step: ReplayStep) {
  if (step.status === "failed") return "solid" as const;
  if (step.status === "blocked") return "outline" as const;
  if (step.status === "skipped") return "dashed" as const;
  return "outline" as const;
}

/**
 * Machine detail of a step, displayed as TEXT and folded away by default.
 *
 * The values come from the agent's journal (counts, codes, flags) and never
 * contain a prospect's own words — and they are rendered as text in every case:
 * no `dangerouslySetInnerHTML`, anywhere, ever.
 */
function StepDetail({ detail }: { detail: ReplayStep["detail"] }) {
  const entries = Object.entries(detail);
  if (entries.length === 0) return null;

  return (
    <details className="mt-2 group">
      <summary className="inline-flex cursor-pointer list-none rounded-xs text-xs text-ink-subtle hover:text-ink">
        {TEXTS.detailSummary}
      </summary>
      <dl className="mt-2 grid gap-x-6 gap-y-1 rounded-md bg-surface-sunken px-3 py-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex min-w-0 gap-2 text-xs">
            <dt className="shrink-0 font-mono text-ink-subtle">{key}</dt>
            <dd className="min-w-0 font-mono break-all text-ink">
              {typeof value === "string" ? value : JSON.stringify(value)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export type AgentRunStepRowProps = {
  step: ReplayStep;
  position: number;
  total: number;
  state: StepPlayState;
  /** Draws the vertical rail down to the next step. */
  withRail: boolean;
};

/**
 * One measured step of a run.
 *
 * Two things must be readable at a glance: WHO did the work (the agency's code,
 * or the AI provider — one single phase) and WHERE a run stopped when it was
 * blocked or failed. The duration displayed is the measured one, unrounded.
 */
export function AgentRunStepRow({ step, position, total, state, withRail }: AgentRunStepRowProps) {
  const author = stepAuthor(step.phase);
  const stopped = step.status === "blocked" || step.status === "failed";
  const isDecision = step.phase === "decision";

  return (
    <li
      data-testid="replay-step"
      data-phase={step.phase}
      data-status={step.status}
      data-state={state}
      className={cn("relative flex gap-4 pb-5 last:pb-0", state === "done" ? "animate-rise" : "animate-fade")}
    >
      {withRail ? (
        <span aria-hidden="true" className="absolute top-5 bottom-0 left-[9px] w-px bg-line" />
      ) : null}

      <span
        aria-hidden="true"
        className={cn(
          "relative mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.5625rem] font-semibold",
          step.status === "failed"
            ? "border-inverse bg-inverse text-ink-inverse"
            : step.status === "blocked"
              ? "border-ink bg-surface-sunken text-ink"
              : state === "active"
              ? "animate-pulse border-ink bg-surface text-ink"
              : "border-line-strong bg-surface text-ink-subtle",
        )}
      >
        {position}
      </span>

      <div
        className={cn(
          "min-w-0 flex-1 rounded-lg px-3 py-2",
          isDecision ? "border border-line-strong bg-surface-muted" : "",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-overline font-semibold text-ink-subtle uppercase">{step.phaseLabel}</span>
          <Badge tone={author === "ai" ? "solid" : "outline"}>
            {author === "ai" ? TEXTS.authorAi : TEXTS.authorCode}
          </Badge>
          <Badge tone={statusTone(step)}>{step.statusLabel}</Badge>
          <span className="ml-auto text-xs whitespace-nowrap tabular-nums text-ink-subtle">
            {formatDurationMs(step.durationMs)}
          </span>
        </div>

        <p className="mt-1.5 text-sm text-ink">{step.label}</p>

        {isDecision ? <p className="mt-1 text-xs text-ink-muted">{TEXTS.decisionMarker}</p> : null}
        {stopped && position === total ? (
          <p className="mt-1 text-xs font-medium text-ink">
            {step.status === "blocked" ? APP_TEXTS.guardRail.stopped : TEXTS.stopped}
          </p>
        ) : null}

        <StepDetail detail={step.detail} />
      </div>
    </li>
  );
}
