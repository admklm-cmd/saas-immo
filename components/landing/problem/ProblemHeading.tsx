import { LANDING_TEXTS } from "@/components/landing-texts";
import { EditorialTitle } from "@/components/ui/EditorialTitle";
import { Overline } from "@/components/ui/Overline";

import styles from "./ProblemHeading.module.css";

const TEXTS = LANDING_TEXTS.problem;

/**
 * Heading of the problem section, composed locally: the observation (first two
 * author lines) in the subtle ink, the answer in full ink with its accented
 * word « administratif » (docs/design-system.md §2.2.9). The author lines set
 * the measure. The accessible name is the full title.
 *
 * One veil per role of text (docs/design-system.md §2.11.4): overline and
 * paragraph on `.particle-veil` (90 %), the title on `.network-veil-title`
 * (70 %, option A validated by the user: the network stays visible behind the
 * two subtle-ink lines, ≥ 3:1 measured). Each block is a quiet zone.
 */
export function ProblemHeading() {
  return (
    <div className={styles.heading}>
      <div className="particle-veil particle-veil-tight" data-network-quiet="">
        <Overline>{TEXTS.kicker}</Overline>
      </div>
      <div className="network-veil-title max-w-full" data-network-quiet="">
        <EditorialTitle
          as="h2"
          id="problem-title"
          lines={TEXTS.titleLines}
          accent={TEXTS.titleAccent}
          subtleBefore={TEXTS.titleSubtleBefore}
          size="statement"
          reveal="in-view"
          accentEffect="focus"
        />
      </div>
      <p className="particle-veil max-w-[52ch] text-lede text-pretty text-ink-muted" data-network-quiet="">
        {TEXTS.body}
      </p>
    </div>
  );
}
