import { APP_TEXTS } from "@/components/texts";

const TEXTS = APP_TEXTS.dashboard.activity;

/** Two entries; the line style (solid / dashed) tells them apart without colour. */
export function ActivityLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-muted" data-testid="activity-legend">
      <li className="flex items-center gap-2">
        <svg aria-hidden="true" width="24" height="8" className="shrink-0">
          <line x1="0" y1="4" x2="24" y2="4" stroke="var(--color-ink)" strokeWidth="2" />
        </svg>
        <span>
          {TEXTS.receivedSeries}
          <span className="sr-only"> ({TEXTS.legendSolid})</span>
        </span>
      </li>
      <li className="flex items-center gap-2">
        <svg aria-hidden="true" width="24" height="8" className="shrink-0">
          <line x1="0" y1="4" x2="24" y2="4" stroke="var(--color-accent-strong)" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
        <span>
          {TEXTS.qualifiedSeries}
          <span className="sr-only"> ({TEXTS.legendDashed})</span>
        </span>
      </li>
    </ul>
  );
}
