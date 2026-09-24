import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.agents;

/** Section « Cinq agents »: what each one does, and where it stops. */
export function LandingAgents() {
  return (
    <section
      aria-labelledby="agents-title"
      data-living-scene="agents"
      className="mx-auto grid w-full max-w-7xl gap-14 px-6 py-24 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-12 lg:py-36"
    >
      <Reveal>
        <div className="lg:sticky lg:top-28">
          <LandingHeading id="agents-title" kicker={TEXTS.kicker} title={TEXTS.title} body={TEXTS.body} />
        </div>
      </Reveal>

      <ol className="stagger rounded-xl border border-line bg-surface/90 px-6 shadow-subtle backdrop-blur-sm sm:px-8">
        {TEXTS.list.map((agent) => (
          <li
            key={agent.name}
            className="grid gap-4 border-b border-line py-8 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:py-10"
          >
            <div>
              <p className="text-heading font-semibold text-ink">{agent.name}</p>
              <p className="mt-1 text-overline font-medium text-ink-subtle uppercase">{agent.role}</p>
            </div>
            <div>
              <p className="text-lg leading-relaxed text-ink">{agent.action}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{agent.boundary}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
