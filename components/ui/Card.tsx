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
        "rounded-xl border shadow-subtle",
        inverse ? "border-inverse bg-inverse text-ink-inverse" : "border-line bg-surface text-ink",
        className,
      )}
    >
      {title || actions ? (
        <header
          className={cn(
            "flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5",
            inverse ? "border-white/12" : "border-line",
          )}
        >
          <div className="min-w-0">
            <Heading className="text-heading font-semibold">{title}</Heading>
            {description ? (
              <p className={cn("mt-1 text-sm", inverse ? "text-ink-inverse-muted" : "text-ink-muted")}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children ? <div className="px-6 py-5">{children}</div> : null}
    </section>
  );
}
