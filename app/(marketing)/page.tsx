import { AccentReplayController } from "@/components/landing/AccentReplayController";
import { HeroMotionProvider } from "@/components/landing/hero/HeroMotionProvider";
import { LandingAgents } from "@/components/landing/LandingAgents";
import { LandingControl } from "@/components/landing/LandingControl";
import { LandingFinal } from "@/components/landing/LandingFinal";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingProblem } from "@/components/landing/LandingProblem";
import { LandingResult } from "@/components/landing/LandingResult";
import { LandingSolution } from "@/components/landing/LandingSolution";
import { LivingBackground } from "@/components/landing/living/LivingBackground";
import { ReplayAnimationsButton } from "@/components/landing/replay/ReplayAnimationsButton";

/**
 * Public home page of the agency website.
 *
 * The hero background is its own particle opening (§2.11.4 ter, T, band 1); the page
 * behind the rest is a field of about 22 000 small particles (`LivingBackground`, fixed, `aria-hidden`).
 * The pause of the motion is shared by both (`HeroMotionProvider`).
 * Every section
 * carries `data-living-scene` (its name). The content is painted above it and
 * is complete without JavaScript. Three titles carry an accent effect, each a different
 * one (§2.11.8.2), replayed when a mouse enters them (§2.11.2 D). No figure, client, testimonial or
 * price is shown.
 */
export default function HomePage() {
  return (
    <HeroMotionProvider>
      <LivingBackground />
      {/* overflow-x-clip: the soft veils behind the headings reach past the edges on a phone. */}
      <div data-landing="" className="relative z-10 overflow-x-clip">
        <LandingHero />
        <LandingProblem />
        <LandingSolution />
        <LandingAgents />
        <LandingControl />
        <LandingResult />
        <LandingFinal />
        {/* Last focusable of the landing: « Rejouer les animations » (§2.11.8.8 L4-D; absent without JS and under reduced motion). */}
        <ReplayAnimationsButton />
        {/* One delegated controller for the hover replay of the three titles (§2.11.2 D; the tech one replays itself). */}
        <AccentReplayController />
      </div>
    </HeroMotionProvider>
  );
}
