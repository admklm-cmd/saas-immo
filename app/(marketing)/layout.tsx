import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";

/** Public agency website: light, spacious, no session required. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="panel-blur sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/" className="inline-flex items-baseline gap-2 rounded-xs">
            <span className="text-heading font-semibold tracking-tight text-ink">
              {APP_TEXTS.brand.name}
            </span>
            <span className="text-xs text-ink-subtle">{APP_TEXTS.brand.prototype}</span>
          </Link>
          <div className="flex items-center gap-2">
            <ButtonLink href="/estimation" variant="ghost" size="sm">
              {APP_TEXTS.marketing.estimation}
            </ButtonLink>
            <ButtonLink href="/connexion" size="sm">
              {APP_TEXTS.marketing.signIn}
            </ButtonLink>
          </div>
        </div>
      </header>

      <main id="content" className="flex flex-1 flex-col">
        {children}
      </main>

      <footer className="border-t border-line px-6 py-8">
        <p className="mx-auto w-full max-w-6xl text-xs text-ink-subtle">
          {APP_TEXTS.brand.name} · {APP_TEXTS.brand.tagline}. {APP_TEXTS.marketing.heroNote}
        </p>
      </footer>
    </div>
  );
}
