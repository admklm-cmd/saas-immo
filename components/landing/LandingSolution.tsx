import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { cn } from "@/components/ui/cn";

import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.solution;

/**
 * Section « La solution »: the order of a seller's file, owner by owner. The
 * two human checkpoints carry the accent (plan: point de contrôle humain).
 */
export function LandingSolution() {
  return (
    <section
      aria-labelledby="solution-title"
      data-living-scene="solution"
      className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36"
    >
      <Reveal>
        <LandingHeading id="solution-title" kicker={TEXTS.kicker} title={TEXTS.title} body={TEXTS.body} />
      </Reveal>

      <div className="mt-14 rounded-xl border border-line bg-surface/90 p-6 shadow-subtle backdrop-blur-sm sm:p-8">
        <ol aria-label={TEXTS.railLabel} className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {TEXTS.rail.map((step, index) => {
            const human = "human" in step && step.human;
            return (
              <li
                key={step.label}
                data-kind={human ? "human" : "agent"}
                className={cn(
                  "rounded-lg border px-4 py-3",
                  human ? "border-accent bg-accent-soft" : "border-line bg-surface",
                )}
              >
                <span className="text-overline font-semibold text-ink-subtle">{String(index + 1).padStart(2, "0")}</span>
                <span className="mt-1 block text-sm font-semibold text-ink">{step.label}</span>
                <span className={cn("block text-xs", human ? "text-accent-strong" : "text-ink-muted")}>
                  {step.owner}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <SimulationBadge />
          {TEXTS.railNote}
        </p>
      </div>
    </section>
  );
}
