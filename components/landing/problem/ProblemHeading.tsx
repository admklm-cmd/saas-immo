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
 */
export function ProblemHeading() {
  return (
    <div className={styles.heading}>
      <Overline>{TEXTS.kicker}</Overline>
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
      <p className="max-w-[52ch] text-lede text-pretty text-ink-muted">{TEXTS.body}</p>
    </div>
  );
}
