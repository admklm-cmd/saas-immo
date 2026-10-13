import type { ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";

import { formatCount, formatDelay } from "./pilotage-format";
import type { FigureView, PilotageView, ViewBlock } from "./pilotage-view";
import { RollingFigure } from "./RollingFigure";

const TEXTS = APP_TEXTS.dashboard.pilotage;
const COPY = TEXTS.figures;

/** Same writing as `formatPercent`, from a whole number (the intermediate values of the roll). */
function writePercent(value: number): string {
  return `${value} %`;
}

function FigureShell({
  id,
  overline,
  status,
  children,
}: {
  id: string;
  overline: string;
  status: "ok" | "unavailable";
  children: ReactNode;
}) {
  return (
    <article data-testid={`figure-${id}`} data-status={status} className="min-w-0 px-0 py-6 first:pt-0 last:pb-0 md:px-8 md:py-0 md:first:pl-0 md:last:pr-0">
      <p className="label-mono text-ink-subtle">{overline}</p>
      {children}
    </article>
  );
}

function Unavailable() {
  return (
    <>
      <p className="figure mt-4 text-4xl font-medium text-ink" data-testid="figure-unavailable">
        {TEXTS.unavailable}
      </p>
      <p className="mt-3 text-sm text-ink-muted">{TEXTS.unavailableCalc}</p>
    </>
  );
}

function Measured({
  figure,
  sentence,
  format,
  rollingValue,
}: {
  figure: FigureView;
  sentence: string;
  format: (value: number) => string;
  rollingValue: number | null;
}) {
  return (
    <>
      <p className="mt-4 text-pilotage-stat font-medium text-ink">
        <RollingFigure text={figure.display} value={rollingValue} format={format} />
      </p>
      <p className="mt-3 text-sm text-ink">{figure.empty ?? sentence}</p>
      {figure.empty ? null : <p className="mt-2 text-sm text-ink-muted">{figure.basis}</p>}
      {figure.comparison ? (
        <p className="figure mt-3 text-sm text-ink" data-testid="figure-comparison">
          {figure.comparison}
        </p>
      ) : null}
      {figure.caution ? <p className="mt-2 text-sm text-ink-muted">{figure.caution}</p> : null}
    </>
  );
}

function PartialBlock({ block, children }: { block: ViewBlock<FigureView>; children: (figure: FigureView) => ReactNode }) {
  return block.status === "ok" ? <>{children(block.value)}</> : <Unavailable />;
}

export type PilotageFiguresProps = {
  view: PilotageView;
  /** The links to the oldest lonely dossiers: rendered on the server, no name reaches the browser. */
  sample: ReactNode;
};

/**
 * « Trois chiffres » (docs §3.5.2.E2): three typographic figures separated by hairlines,
 * never cards. Each states what it is computed on; a rate shows its numerator and
 * denominator, a delay the dossiers it is measured on.
 */
export function PilotageFigures({ view, sample }: PilotageFiguresProps) {
  const noAction = view.noAction;
  return (
    <div
      data-testid="pilotage-figures"
      className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0"
    >
      <FigureShell id="conversion" overline={COPY.conversion.overline} status={view.conversion.status}>
        <PartialBlock block={view.conversion}>
          {(figure) => (
            <Measured figure={figure} sentence={COPY.conversion.sentence} format={writePercent} rollingValue={figure.rolling} />
          )}
        </PartialBlock>
      </FigureShell>

      <FigureShell id="delay" overline={COPY.delay.overline} status={view.delay.status}>
        <PartialBlock block={view.delay}>
          {(figure) => (
            <Measured figure={figure} sentence={COPY.delay.sentence} format={formatDelay} rollingValue={figure.rolling} />
          )}
        </PartialBlock>
      </FigureShell>

      <FigureShell id="no-action" overline={COPY.noAction.overline} status={noAction.status}>
        {noAction.status === "ok" ? (
          <>
            <p className={cn("mt-4 text-pilotage-stat font-medium text-ink")}>
              <RollingFigure text={noAction.value.display} value={noAction.value.count} format={formatCount} />
            </p>
            <p className="mt-3 text-sm text-ink">{noAction.value.empty ?? COPY.noAction.sentence}</p>
            {noAction.value.empty ? null : <p className="mt-2 text-sm text-ink-muted">{noAction.value.basis}</p>}
            {sample}
          </>
        ) : (
          <Unavailable />
        )}
      </FigureShell>
    </div>
  );
}
