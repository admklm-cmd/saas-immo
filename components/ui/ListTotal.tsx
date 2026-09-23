import { APP_TEXTS } from "@/components/texts";

import { cn } from "./cn";

export type ListTotalProps = {
  /** EXACT total counted by the server, all pages included. */
  total: number;
  /** What is counted, agreed with the figure (« 3 tâches ouvertes »). */
  unit: (total: number) => string;
  /** Perimeter of the figure, always displayed (« toutes dates »). */
  scope: string;
  className?: string;
  testId?: string;
};

/**
 * The total of a paginated list, ALWAYS next to its scope — same motif as the
 * dashboard figures (« chiffre + périmètre »), so a figure read on the
 * dashboard is recognised on the screen it links to.
 */
export function ListTotal({ total, unit, scope, className, testId }: ListTotalProps) {
  return (
    <div data-testid={testId} className={cn("min-w-0", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-title font-semibold text-ink tabular-nums" data-testid={testId ? `${testId}-value` : undefined}>
          {total}
        </span>
        <span className="text-sm text-ink-muted">{unit(total)}</span>
      </p>
      <p className="mt-1 text-xs text-ink-subtle">
        <span className="sr-only">{APP_TEXTS.dashboard.scopePrefix} </span>
        {scope}
      </p>
    </div>
  );
}
