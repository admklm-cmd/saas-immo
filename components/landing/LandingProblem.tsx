import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";

import { BlockerChart } from "./BlockerChart";
import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.problem;

/**
 * Section « Le problème »: mandates stop growing at the level of the
 * administrative work. An illustrative chart (no figure, fictitious example)
 * and its three causes, written out next to it.
 */
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

      <Reveal index={1}>
        <div className="mt-14 grid gap-10 rounded-xl border border-line bg-surface p-6 shadow-subtle sm:p-8 lg:grid-cols-[1.55fr_1fr] lg:gap-14 lg:p-10">
          <BlockerChart />

          <div className="lg:border-l lg:border-line lg:pl-12">
            <p id="problem-causes" className="text-overline font-semibold text-ink-subtle uppercase">
              {TEXTS.chart.causesLabel}
            </p>
            <ul aria-labelledby="problem-causes" className="mt-5 grid gap-6" data-testid="problem-causes">
              {TEXTS.symptoms.map((symptom) => (
                <li key={symptom.title} className="grid grid-cols-[0.875rem_1fr] gap-3">
                  <span aria-hidden="true" className="mt-1.5 size-3.5 rounded-xs border-[1.5px] border-dashed border-ink" />
                  <span>
                    <span className="block text-heading font-semibold text-ink">{symptom.title}</span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-ink-muted">{symptom.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
