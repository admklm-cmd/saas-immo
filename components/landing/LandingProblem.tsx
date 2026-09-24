import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.problem;

/** Section « Le problème »: the background wanders, duplicates and loses files. */
export function LandingProblem() {
  return (
    <section
      aria-labelledby="problem-title"
      data-living-scene="probleme"
      className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36"
    >
      <Reveal>
        <LandingHeading id="problem-title" kicker={TEXTS.kicker} title={TEXTS.title} body={TEXTS.body} />
      </Reveal>
      <ul className="stagger mt-14 grid gap-4 md:grid-cols-3">
        {TEXTS.symptoms.map((symptom) => (
          <li key={symptom.title} className="rounded-xl border border-line bg-surface/90 p-6 shadow-subtle backdrop-blur-sm">
            <p className="text-heading font-semibold text-ink">{symptom.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{symptom.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
