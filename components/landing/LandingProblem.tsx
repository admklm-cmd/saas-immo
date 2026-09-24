import { Reveal } from "@/components/ui/Reveal";

import { BlockerChart } from "./BlockerChart";
import { ProblemHeading } from "./problem/ProblemHeading";
import { ProblemSystem } from "./problem/ProblemSystem";

/**
 * Section « Le problème »: mandates progress, the administrative work absorbs
 * the time, progression plateaus. An illustration (fictitious example, no
 * figure) and the four causes that feed it, read as one system: hovering or
 * focusing a cause highlights its events on the chart.
 *
 * Server Component; only the link between causes and events is a small client
 * part (`ProblemSystem`). Everything is readable without JavaScript.
 */
export function LandingProblem() {
  return (
    <section
      aria-labelledby="problem-title"
      data-living-scene="probleme"
      className="mx-auto w-full max-w-7xl px-6 py-28 sm:px-8 lg:px-12 lg:py-44"
    >
      <Reveal>
        <div className="particle-veil">
          <ProblemHeading />
        </div>
      </Reveal>

      <Reveal index={1}>
        <ProblemSystem chart={<BlockerChart />} />
      </Reveal>
    </section>
  );
}
