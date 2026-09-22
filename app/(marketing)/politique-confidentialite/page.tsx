import type { Metadata } from "next";
import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";

const TEXTS = APP_TEXTS.privacy;

export const metadata: Metadata = {
  title: `${TEXTS.title} — ${APP_TEXTS.brand.name}`,
  description: TEXTS.metaDescription,
};

/**
 * Privacy notice linked from the public estimation form.
 *
 * Deliberately short and honest: this is a training prototype, not a
 * commercialised product (CLAUDE.md, "Contexte actuel"). It states what the
 * form actually does and does not invent a legal position that has not been
 * reviewed — see the prototype notice below and `docs/security.md` §2.8.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-20">
      <PageHeader title={TEXTS.title} />

      <Alert tone="info" className="mt-8">
        {TEXTS.prototypeNotice}
      </Alert>

      <dl className="mt-10 flex flex-col gap-8">
        {TEXTS.sections.map((section) => (
          <div key={section.heading} className="border-t border-line pt-6">
            <dt className="text-sm font-semibold text-ink">{section.heading}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-ink-muted">{section.body}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-12 text-sm">
        <Link
          href="/estimation"
          className="rounded-xs font-medium text-ink underline underline-offset-2 transition-colors duration-150 ease-standard hover:text-ink-muted"
        >
          {TEXTS.backToEstimation}
        </Link>
      </p>
    </div>
  );
}
