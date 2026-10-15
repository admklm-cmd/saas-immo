import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Logo } from "@/components/ui/Logo";
import { PointerField } from "@/components/ui/PointerField";

/** Public agency website: light, spacious, no session required. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="panel-blur sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:gap-6 sm:px-6">
          <Link href="/" className="inline-flex shrink-0 items-center gap-3 rounded-xs">
            <Logo />
            {/* Hidden on a phone so the header fits 390 px; the footer still says it is a prototype. */}
            <span className="hidden text-xs text-ink-subtle sm:inline">{APP_TEXTS.brand.prototype}</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* One line at any width: the short label below 40 rem, the full one (still the accessible name) above. */}
            <ButtonLink href="/estimation" variant="ghost" size="sm" aria-label={APP_TEXTS.marketing.estimation} className="whitespace-nowrap">
              <span className="max-sm:hidden">{APP_TEXTS.marketing.estimation}</span>
              <span aria-hidden="true" className="sm:hidden">
                {APP_TEXTS.marketing.estimationShort}
              </span>
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

      {/* Above the fixed living background of the home page. */}
      <footer className="relative z-10 border-t border-line bg-canvas px-6 py-8">
        <p className="mx-auto w-full max-w-6xl text-xs text-ink-subtle">
          {APP_TEXTS.brand.name} · {APP_TEXTS.brand.tagline}. {APP_TEXTS.marketing.heroNote}
        </p>
      </footer>

      {/* One delegated pointer listener for the halo and magnetic controls. */}
      <PointerField />
    </div>
  );
}
