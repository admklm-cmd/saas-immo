import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";

const TEXTS = APP_TEXTS.marketing;

/** Public home page of the agency website. */
export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-24 sm:py-32">
      <div className="animate-rise max-w-3xl">
        <Badge tone="outline">{APP_TEXTS.brand.prototype}</Badge>
        <h1 className="mt-6 text-display font-semibold text-balance text-ink">{TEXTS.heroTitle}</h1>
        <p className="mt-5 max-w-2xl text-lg text-pretty text-ink-muted">{TEXTS.heroSubtitle}</p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <ButtonLink href="/estimation" size="lg">
            {TEXTS.estimation}
          </ButtonLink>
          <ButtonLink href="/connexion" variant="secondary" size="lg">
            {TEXTS.signIn}
          </ButtonLink>
        </div>

        <p className="mt-8 text-xs text-ink-subtle">{TEXTS.heroNote}</p>
      </div>
    </section>
  );
}
