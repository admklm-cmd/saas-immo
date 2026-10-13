import { APP_TEXTS } from "@/components/texts";

import type { StagePoint } from "./pilotage-view";

const TEXTS = APP_TEXTS.dashboard.pilotage.stage;

export type StageValuesTableProps = {
  points: readonly StagePoint[];
  showPrevious: boolean;
  grainTitle: string;
  period: string;
};

/** The values of the Scène chart, as a real table inside a native disclosure (keyboard, screen readers). */
export function StageValuesTable({ points, showPrevious, grainTitle, period }: StageValuesTableProps) {
  return (
    <details className="group mt-2 text-sm text-ink-inverse-muted" data-testid="stage-table">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-xs underline-offset-4 hover:text-ink-inverse hover:underline lg:min-h-8">
        {TEXTS.tableSummary}
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-stage-tooltip-line">
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">{TEXTS.tableCaption(period)}</caption>
          <thead className="text-ink-inverse-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{grainTitle}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{TEXTS.colSigned}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{TEXTS.colCumulative}</th>
              {showPrevious ? (
                <>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{TEXTS.colPreviousSigned}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{TEXTS.colPreviousCumulative}</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="text-ink-inverse">
            {points.map((point) => (
              <tr key={point.bucketStart} className="border-t border-stage-tooltip-line">
                <th scope="row" className="px-3 py-1.5 font-normal">{point.table}</th>
                <td className="figure px-3 py-1.5 text-right">{point.signed}</td>
                <td className="figure px-3 py-1.5 text-right">{point.cumulative}</td>
                {showPrevious ? (
                  <>
                    <td className="figure px-3 py-1.5 text-right">{point.previousSigned}</td>
                    <td className="figure px-3 py-1.5 text-right">{point.previousCumulative}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

