import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Reveal } from "@/components/ui/Reveal";

const TEXTS = APP_TEXTS.marketing;

/** Public home page of the agency website. */
export default function HomePage() {
  return (
    <>
      <section className="mx-auto flex min-h-[calc(100dvh-73px)] w-full max-w-7xl flex-col justify-between px-6 pb-10 pt-16 sm:px-8 sm:pb-14 sm:pt-20 lg:px-12">
        <div className="animate-rise max-w-6xl">
          <p className="text-overline font-semibold uppercase text-ink-subtle">
            {TEXTS.heroKicker}
          </p>
          <h1 className="mt-6 max-w-6xl text-[clamp(3.25rem,8.5vw,8.5rem)] leading-[0.9] font-semibold tracking-[-0.065em] text-balance text-ink">
            {TEXTS.heroTitle}
          </h1>
        </div>

        <div className="mt-14 grid items-end gap-8 border-t border-line pt-6 md:grid-cols-[1fr_auto]">
          <p className="max-w-xl text-lg leading-relaxed text-pretty text-ink-muted">
            {TEXTS.heroSubtitle}
          </p>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <ButtonLink href="/estimation" size="lg">
              {TEXTS.estimation}
            </ButtonLink>
            <ButtonLink href="/connexion" variant="secondary" size="lg">
              {TEXTS.signIn}
            </ButtonLink>
          </div>
        </div>
      </section>

      <Reveal>
        <section aria-labelledby="proof-title" className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-32">
          <h2 id="proof-title" className="max-w-lg text-title font-semibold tracking-tight text-ink">
            {TEXTS.proofTitle}
          </h2>
          <dl className="stagger mt-12 grid border-y border-line md:grid-cols-2 lg:grid-cols-4">
            {TEXTS.proofs.map((proof) => (
              <div key={proof.value} className="border-b border-line py-7 md:px-6 md:even:border-l lg:border-b-0 lg:border-l lg:first:border-l-0">
                <dt className="text-3xl font-semibold tracking-tight text-ink">{proof.value}</dt>
                <dd className="mt-3 max-w-[15rem] text-sm leading-relaxed text-ink-muted">{proof.label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-ink-subtle">{TEXTS.heroNote}</p>
        </section>
      </Reveal>

      <section aria-labelledby="story-title" className="mx-auto grid w-full max-w-7xl gap-16 px-6 py-24 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-12 lg:py-36">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="text-overline font-semibold uppercase text-ink-subtle">{TEXTS.storyKicker}</p>
            <h2 id="story-title" className="mt-5 max-w-xl text-[clamp(2.5rem,5vw,5rem)] leading-[0.98] font-semibold tracking-[-0.05em] text-balance text-ink">
              {TEXTS.storyTitle}
            </h2>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-ink-muted">{TEXTS.storyBody}</p>
          </div>
        </Reveal>

        <ol className="stagger border-t border-line">
          {TEXTS.agents.map((agent) => (
            <li key={agent.name} className="grid gap-5 border-b border-line py-9 sm:grid-cols-[8rem_1fr] sm:py-11">
              <div>
                <p className="text-heading font-semibold text-ink">{agent.name}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-subtle">{agent.role}</p>
              </div>
              <div>
                <p className="text-lg leading-relaxed text-ink">{agent.action}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{agent.boundary}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Reveal>
        <section aria-labelledby="control-title" className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36">
          <div className="grid gap-14 border-t border-line pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-24">
            <div>
              <p className="text-overline font-semibold uppercase text-ink-subtle">{TEXTS.controlKicker}</p>
              <h2 id="control-title" className="mt-5 max-w-3xl text-[clamp(2.5rem,5.5vw,5.5rem)] leading-[0.98] font-semibold tracking-[-0.05em] text-balance text-ink">
                {TEXTS.controlTitle}
              </h2>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-ink-muted">{TEXTS.controlBody}</p>
            </div>
            <ul className="stagger self-end border-t border-line">
              {TEXTS.controls.map((control) => (
                <li key={control} className="grid grid-cols-[1.25rem_1fr] gap-3 border-b border-line py-5 text-sm leading-relaxed text-ink">
                  <span aria-hidden="true" className="font-semibold">✓</span>
                  <span>{control}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="final-title" className="mx-auto w-full max-w-7xl px-6 pb-24 pt-16 sm:px-8 lg:px-12 lg:pb-36">
          <div className="grid gap-10 border-y border-line py-12 md:grid-cols-[1fr_auto] md:items-end lg:py-16">
            <div>
              <h2 id="final-title" className="max-w-3xl text-[clamp(2.25rem,4.8vw,4.75rem)] leading-[1] font-semibold tracking-[-0.05em] text-balance text-ink">
                {TEXTS.finalTitle}
              </h2>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted">{TEXTS.finalBody}</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <ButtonLink href="/estimation" size="lg">{TEXTS.estimation}</ButtonLink>
              <ButtonLink href="/connexion" variant="ghost" size="lg">{TEXTS.signIn}</ButtonLink>
            </div>
          </div>
        </section>
      </Reveal>
    </>
  );
}
