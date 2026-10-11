import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";

import type { DashboardIndicator } from "../types";

const TEXTS = APP_TEXTS.dashboard;

export type DashboardFigureProps = {
  indicator: DashboardIndicator<number>;
  /** What is counted, agreed with the figure ("3 tâches ouvertes"). */
  unit: (total: number) => string;
  size?: "lg" | "md";
  /** De-emphasised figure (the `perdu` stage), never colour-only. */
  muted?: boolean;
  /** Explains an unavailable figure. Off in compact tiles. */
  showUnavailableHint?: boolean;
  className?: string;
};

/**
 * One figure of the dashboard, ALWAYS next to its scope.
 *
 * Product rules enforced here (docs/plans/2026-09-23-dashboard.md):
 *   * a figure without its period or perimeter does not exist;
 *   * a computation that failed reads « Indisponible », never `0` — a zero is
 *     only ever a measured zero (`status: "ok"`, `value: 0`).
 */
export function DashboardFigure({
  indicator,
  unit,
  size = "lg",
  muted = false,
  showUnavailableHint = true,
  className,
}: DashboardFigureProps) {
  const available = indicator.status === "ok";

  return (
    <div data-testid="dashboard-figure" data-status={indicator.status} className={cn("min-w-0", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {available ? (
          <>
            <span
              className={cn(
                "font-semibold figure",
                size === "lg" ? "text-title" : "text-heading",
                muted ? "text-ink-subtle" : "text-ink",
              )}
            >
              {indicator.value}
            </span>
            <span className="text-sm text-ink-muted">{unit(indicator.value)}</span>
          </>
        ) : (
          <span className={cn("font-semibold text-ink", size === "lg" ? "text-heading" : "text-base")}>
            {TEXTS.unavailable}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-ink-subtle" data-testid="dashboard-scope">
        <span className="sr-only">{TEXTS.scopePrefix} </span>
        {TEXTS.scopes[indicator.scope.key]}
      </p>
      {!available && showUnavailableHint ? (
        <p className="mt-2 text-xs text-ink-muted">{TEXTS.unavailableHint}</p>
      ) : null}
    </div>
  );
}
