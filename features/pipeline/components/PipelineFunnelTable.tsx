import { APP_TEXTS } from "@/components/texts";
import { Disclosure } from "@/components/ui/Disclosure";

import type { FunnelSlice } from "./funnel-chart";

const TEXTS = APP_TEXTS.pipeline.funnel;

/** Every value of the funnel, stage by stage: the text version of the graphic. */
export function PipelineFunnelTable({ slices }: { slices: readonly FunnelSlice[] }) {
  return (
    <Disclosure summary={TEXTS.tableSummary} size="sm" testId="funnel-values" contentClassName="mt-3">
      <div className="overflow-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label={TEXTS.tableCaption}>
        <table className="w-full min-w-72 border-collapse text-left text-sm">
          <caption className="sr-only">{TEXTS.tableCaption}</caption>
          <thead className="bg-surface-muted text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                {TEXTS.colStage}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {TEXTS.colReached}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {TEXTS.colRate}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {slices.map((slice, i) => {
              const next = slices[i + 1];
              return (
                <tr key={slice.stage}>
                  <th scope="row" className="px-4 py-2 font-normal text-ink-muted">
                    {slice.label}
                  </th>
                  <td className="figure px-4 py-2 text-right text-ink">{slice.reached}</td>
                  <td className="figure px-4 py-2 text-right text-ink">{next ? (next.rate ?? TEXTS.noRate) : TEXTS.noRate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Disclosure>
  );
}
