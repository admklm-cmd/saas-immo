import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.control;

/** Section « Le contrôle reste humain »: the guard rails, as the server applies them. */
export function LandingControl() {
  return (
    <section
      aria-labelledby="control-title"
      data-living-scene="controle"
      className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36"
    >
      <Reveal>
        <LandingHeading id="control-title" kicker={TEXTS.kicker} title={TEXTS.title} body={TEXTS.body} />
      </Reveal>
      <ul className="stagger mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEXTS.facts.map((fact) => (
          <li key={fact.title} className="rounded-xl border border-line bg-surface/90 p-6 shadow-subtle backdrop-blur-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span aria-hidden="true" className="size-2 rounded-full border-2 border-accent" />
              {fact.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{fact.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
