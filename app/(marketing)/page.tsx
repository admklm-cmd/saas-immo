import { LandingAgents } from "@/components/landing/LandingAgents";
import { LandingControl } from "@/components/landing/LandingControl";
import { LandingFinal } from "@/components/landing/LandingFinal";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingProblem } from "@/components/landing/LandingProblem";
import { LandingResult } from "@/components/landing/LandingResult";
import { LandingSolution } from "@/components/landing/LandingSolution";
import { LivingBackground } from "@/components/landing/living/LivingBackground";

/**
 * Public home page of the agency website.
 *
 * The living background is a fixed, `aria-hidden` illustration (fictitious
 * files, simulation) whose scene follows the section in view; every section
 * carries `data-living-scene`. The content is painted above it and is complete
 * without JavaScript. No figure, client, testimonial or price is shown.
 */
export default function HomePage() {
  return (
    <>
      <LivingBackground initialScene="hero" />
      {/* overflow-x-clip: the soft veils behind the headings reach past the edges on a phone. */}
      <div className="relative z-10 overflow-x-clip">
        <LandingHero />
        <LandingProblem />
        <LandingSolution />
        <LandingAgents />
        <LandingControl />
        <LandingResult />
        <LandingFinal />
      </div>
    </>
  );
}
