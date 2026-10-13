import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";

import type { PilotageWithoutNextAction } from "../../pilotage-types";

const COPY = APP_TEXTS.dashboard.pilotage.figures.noAction;

/**
 * The dossiers left alone the longest, as links to their files, plus the way to the
 * whole list. Rendered on the server: the names are in the page, never in the props of
 * a client island.
 */
export function NoActionSample({ data }: { data: PilotageWithoutNextAction }) {
  if (data.count === 0) return null;
  return (
    <div className="mt-4" data-testid="no-action-sample">
      <p className="text-xs text-ink-subtle">{COPY.sampleLabel}</p>
      <ul className="mt-1 flex flex-col">
        {data.sample.map((item) => (
          <li key={item.contactId}>
            <Link
              href={`/contacts/${item.contactId}`}
              className="ui-focus flex min-h-11 items-center justify-between gap-3 rounded-xs text-sm text-ink underline-offset-4 hover:underline lg:min-h-8"
            >
              <span className="min-w-0 break-words">{item.contactName}</span>
              <PipelineStageBadge stage={item.stage} />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/contacts"
        className="ui-focus mt-2 inline-flex min-h-11 items-center rounded-xs text-sm text-ink-muted underline underline-offset-4 hover:text-ink lg:min-h-8"
      >
        {COPY.link}
      </Link>
    </div>
  );
}
