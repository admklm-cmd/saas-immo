import { APP_TEXTS } from "@/components/texts";

import { Badge } from "./Badge";
import { PageHeader } from "./PageHeader";

export type ComingSoonProps = {
  title: string;
  /** What this screen will do, so the shell still explains the product. */
  description?: string;
};

/**
 * Placeholder screen for the parts of the product that are not built yet.
 * Deliberately calm and finished-looking: a prototype must never look broken.
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-28">
      <PageHeader
        title={title}
        description={description ?? APP_TEXTS.states.comingSoonBody}
        meta={<Badge tone="outline">{APP_TEXTS.states.comingSoon}</Badge>}
      />
    </div>
  );
}
