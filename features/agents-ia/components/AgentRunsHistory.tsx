import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

import type { AgentRunsPage } from "../types";
import { AgentRunsFilters } from "./AgentRunsFilters";
import { AgentRunsTable } from "./AgentRunsTable";

const TEXTS = APP_TEXTS.runHistory;

/** Builds a history URL that keeps the current filters and moves the page. */
function pageHref(selected: { agent: string; status: string }, offset: number): string {
  const params = new URLSearchParams();
  if (selected.agent) params.set("agent", selected.agent);
  if (selected.status) params.set("status", selected.status);
  if (offset > 0) params.set("offset", String(offset));
  const query = params.toString();
  return query ? `/agents-ia?${query}#historique` : "/agents-ia#historique";
}

export type AgentRunsHistoryProps = {
  /** One page of the journal, or `null` when the read failed. */
  page: AgentRunsPage | null;
  /** French message returned by the server, displayed as-is. */
  errorMessage: string | null;
  selected: { agent: string; status: string };
};

/**
 * The execution journal with its filters and its pagination.
 *
 * "x–y sur total" uses the exact total counted by the server, and a page past
 * the end is an empty list with a true total — not an error.
 */
export function AgentRunsHistory({ page, errorMessage, selected }: AgentRunsHistoryProps) {
  const from = page && page.runs.length > 0 ? page.offset + 1 : 0;
  const to = page ? page.offset + page.runs.length : 0;

  return (
    <Card
      title={TEXTS.title}
      description={TEXTS.subtitle}
      testId="run-history"
      className="scroll-mt-6"
    >
      <div id="historique" className="flex flex-col gap-5">
        <AgentRunsFilters selected={selected} />

        {errorMessage ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            testId="run-history-error"
            action={
              <ButtonLink href="/agents-ia" variant="secondary" size="sm">
                {TEXTS.filterReset}
              </ButtonLink>
            }
          >
            {errorMessage}
          </Alert>
        ) : null}

        {page && page.runs.length === 0 ? (
          <EmptyState title={TEXTS.emptyTitle} description={TEXTS.emptyBody} />
        ) : null}

        {page && page.runs.length > 0 ? (
          <>
            <AgentRunsTable runs={page.runs} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs tabular-nums text-ink-muted">{TEXTS.range(from, to, page.total)}</p>
              <div className="flex items-center gap-2">
                {page.offset > 0 ? (
                  <ButtonLink
                    href={pageHref(selected, Math.max(0, page.offset - page.limit))}
                    variant="secondary"
                    size="sm"
                  >
                    {TEXTS.previous}
                  </ButtonLink>
                ) : null}
                {page.hasMore ? (
                  <ButtonLink
                    href={pageHref(selected, page.offset + page.limit)}
                    variant="secondary"
                    size="sm"
                  >
                    {TEXTS.next}
                  </ButtonLink>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
