import type { ReactNode } from "react";

import { cn } from "./cn";

export type CardProps = {
  title?: ReactNode;
  description?: ReactNode;
  /** Rendered on the right of the header (buttons, badges…). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Heading level of the card title, so the page outline stays correct. */
  headingLevel?: 2 | 3;
  /** Renders the card on the inverse (near-black) surface. */
  tone?: "default" | "inverse";
  /** Hook for E2E tests (`data-testid`). */
  testId?: string;
};

export function Card({
  title,
  description,
  actions,
  children,
  className,
  headingLevel = 2,
  tone = "default",
  testId,
}: CardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const inverse = tone === "inverse";

  return (
    <section
      data-testid={testId}
      className={cn(
        "motion-card rounded-xl border shadow-subtle",
        inverse ? "border-inverse bg-inverse text-ink-inverse" : "border-line bg-surface text-ink",
        className,
      )}
    >
      {title || actions ? (
        <header className={cn("border-b px-6 py-5", inverse ? "border-white/12" : "border-line")}>
          {/* Actions sit on the title line at every width; the description runs
              full width underneath, so it can never push a badge onto its own row. */}
          <div className="flex items-start justify-between gap-3">
            <Heading className="min-w-0 text-heading font-semibold">{title}</Heading>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
            ) : null}
          </div>
          {description ? (
            <p className={cn("mt-1 text-sm", inverse ? "text-ink-inverse-muted" : "text-ink-muted")}>
              {description}
            </p>
          ) : null}
        </header>
      ) : null}
      {children ? <div className="px-6 py-5">{children}</div> : null}
    </section>
  );
}
