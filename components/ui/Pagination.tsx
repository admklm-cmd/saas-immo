import { APP_TEXTS } from "@/components/texts";

import { buttonStyles } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { cn } from "./cn";

const TEXTS = APP_TEXTS.pagination;

export type PaginationProps = {
  /** Offset of the first item of the page (0-based). */
  offset: number;
  /** Page size used by the server. */
  limit: number;
  /** Number of items actually on this page. */
  count: number;
  /** EXACT total of the list, all pages included. */
  total: number;
  /** True when items exist after this page. */
  hasMore: boolean;
  /** URL of the page starting at `offset` (keeps the current filters). */
  hrefFor: (offset: number) => string;
  className?: string;
  testId?: string;
};

/**
 * « 26–50 sur 131 » and Précédent / Suivant, as plain links (works without
 * JavaScript, keeps the page in the URL). A direction that does not exist is
 * shown disabled (and hidden from assistive technology, where it would only
 * be noise), so the two buttons never jump around between pages.
 */
export function Pagination({ offset, limit, count, total, hasMore, hrefFor, className, testId }: PaginationProps) {
  const from = count > 0 ? offset + 1 : 0;
  const to = count > 0 ? offset + count : 0;
  const hasPrevious = offset > 0;
  // Everything fits on one page: the range says it all, no inert buttons.
  const singlePage = !hasPrevious && !hasMore;
  const disabled = cn(buttonStyles("secondary", "sm"), "pointer-events-none opacity-40 shadow-none");

  return (
    <nav
      aria-label={TEXTS.label}
      data-testid={testId}
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
    >
      <p className="text-xs text-ink-muted tabular-nums" data-testid={testId ? `${testId}-range` : undefined}>
        {TEXTS.range(from, to, total)}
      </p>
      {singlePage ? null : (
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <ButtonLink href={hrefFor(Math.max(0, offset - limit))} variant="secondary" size="sm" rel="prev">
            <span aria-hidden="true">←</span>
            {TEXTS.previous}
          </ButtonLink>
        ) : (
          <span aria-hidden="true" data-disabled="true" className={disabled}>
            <span aria-hidden="true">←</span>
            {TEXTS.previous}
          </span>
        )}
        {hasMore ? (
          <ButtonLink href={hrefFor(offset + limit)} variant="secondary" size="sm" rel="next">
            {TEXTS.next}
            <span aria-hidden="true">→</span>
          </ButtonLink>
        ) : (
          <span aria-hidden="true" data-disabled="true" className={disabled}>
            {TEXTS.next}
            <span aria-hidden="true">→</span>
          </span>
        )}
      </div>
      )}
    </nav>
  );
}
