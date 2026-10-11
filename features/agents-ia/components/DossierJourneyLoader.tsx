import { cache, Suspense } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";
import { getContactTimeline } from "@/features/contacts/queries";

import { DossierJourneyRail, type MeasuredRun } from "./DossierJourneyRail";

const TEXTS = APP_TEXTS.dossierJourney;

/** One read per contact and per request. */
const readTimeline = cache(getContactTimeline);

type LoaderProps = {
  contactId: string;
  contactName: string;
  measured?: MeasuredRun | null;
};

async function DossierJourneyContent({ contactId, contactName, measured }: LoaderProps) {
  const { data, error } = await readTimeline(contactId);
  if (error) {
    // The server's French message, as-is: no stage is drawn in place of the history.
    return (
      <p className="text-sm text-ink-muted" data-testid="dossier-rail-unavailable">
        <span className="font-medium text-ink">{TEXTS.unavailableTitle} : </span>
        {error.message}
      </p>
    );
  }
  return <DossierJourneyRail entries={data} contactName={contactName} measured={measured} />;
}

/**
 * Server read of a dossier's recorded history, streamed behind a skeleton so
 * the page is never held back by it.
 */
export function DossierJourneyLoader(props: LoaderProps) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" data-testid="dossier-rail-loading">
          <span className="sr-only">{TEXTS.loading}</span>
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <DossierJourneyContent {...props} />
    </Suspense>
  );
}
