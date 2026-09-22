import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
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
 */
export default function EstimationPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-20">
      <PageHeader
        eyebrow={TEXTS.eyebrow}
        title={TEXTS.title}
        description={TEXTS.subtitle}
      />

      <Card className="mt-10">
        <EstimationForm />
      </Card>
    </div>
  );
}
