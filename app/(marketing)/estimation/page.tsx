import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Card } from "@/components/ui/Card";
import { EditorialTitle } from "@/components/ui/EditorialTitle";
import { Overline } from "@/components/ui/Overline";
import { EstimationForm } from "@/features/estimation/components/EstimationForm";

const TEXTS = APP_TEXTS.estimation;

export const metadata: Metadata = {
  // Neither the title nor the description may promise a figure: the form
  // collects a request, a human answers it.
  title: `${TEXTS.eyebrow} — ${APP_TEXTS.brand.name}`,
  description: TEXTS.metaDescription,
};

/**
 * Public estimation request — the product's main lead-acquisition channel.
 *
 * A visitor who is NOT signed in describes their property and explicitly
 * chooses which channels they authorise. The request becomes a lead in
 * `/agents-ia/leads-entrants`, which Léa then processes — see
 * `features/estimation/actions.ts` for the (already-secured) server contract
 * this screen only consumes.
 *
 * Header (docs/design-system.md §2.2.9, §7): overline, sentence title at the
 * page scale (the `max-w-2xl` column cannot hold a statement), revealed line
 * by line on load, then the subtitle — unchanged, it says no figure is given.
 */
export default function EstimationPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-20">
      <header>
        <Overline>{TEXTS.eyebrow}</Overline>
        <EditorialTitle
          as="h1"
          id="estimation-title"
          lines={TEXTS.titleLines}
          accent={TEXTS.titleAccent}
          size="page"
          reveal="load"
          className="mt-4"
        />
        <p className="mt-4 text-lede text-pretty text-ink-muted">{TEXTS.subtitle}</p>
      </header>

      <Card className="mt-10">
        <EstimationForm />
      </Card>
    </div>
  );
}
