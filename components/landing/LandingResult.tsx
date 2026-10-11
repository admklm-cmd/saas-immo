import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";
import { FollowupWidget } from "./roi/FollowupWidget";
import { MandatesWidget } from "./roi/MandatesWidget";
import { RoiTag, RoiTags } from "./roi/RoiTag";
import { RoiWidget, type RoiWidgetKey } from "./roi/RoiWidget";
import { SpeedWidget } from "./roi/SpeedWidget";
import { TimeWidget } from "./roi/TimeWidget";
import styles from "./roi/roi.module.css";

const TEXTS = LANDING_TEXTS.roi;
const WIDGETS = TEXTS.widgets;

/** DOM and reading order (W1, W3, W2, W4) and the span of each tile on twelve columns (≥ 1280 px). */
const ORDER: readonly { key: RoiWidgetKey; span: 5 | 7 }[] = [
  { key: "speed", span: 5 },
  { key: "mandates", span: 7 },
  { key: "time", span: 7 },
  { key: "followup", span: 5 },
];

const ISLANDS = {
  speed: SpeedWidget,
  mandates: MandatesWidget,
  time: TimeWidget,
  followup: FollowupWidget,
} as const;

/**
 * Section ROI (docs/design-system.md §2.11.8.8 L4-B; figures:
 * docs/recherche-roi-agences.md). Keeps the name, the `section`, its
 * `aria-labelledby` and `data-living-scene="resultat"` (the background
 * depends on it). Four widgets — each a big figure that lands, a small scene
 * and a provenance tag (source, hypothesis, estimate) — and the general
 * disclaimer. Indicative orders of magnitude, never a promise. Every value
 * stays in the visitor's browser: nothing is stored nor sent.
 */
export function LandingResult() {
  return (
    <section
      aria-labelledby="result-title"
      data-living-scene="resultat"
      data-testid="roi"
      className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36"
    >
      <Reveal frame="still">
        <LandingHeading
          id="result-title"
          kicker={TEXTS.kicker}
          titleLines={TEXTS.titleLines}
          titleAccent={TEXTS.titleAccent}
          body={TEXTS.body}
        />
      </Reveal>

      <ul className={`particle-veil particle-veil-tight w-fit max-w-full ${styles.legend}`} data-network-quiet="">
        {TEXTS.legend.map((entry) => (
          <li key={entry.tag} className={styles.legendItem}>
            <RoiTag tag={entry.tag} />
            <span>{entry.text}</span>
          </li>
        ))}
      </ul>

      <ul className={styles.grid} data-testid="roi-grid">
        {ORDER.map(({ key, span }, index) => {
          const texts = WIDGETS[key];
          const Island = ISLANDS[key];
          return (
            <li key={key} className={styles.cell} data-span={span}>
              <Reveal index={index}>
                <RoiWidget
                  widget={key}
                  kicker={texts.kicker}
                  title={texts.title}
                  note={texts.note}
                  tags={<RoiTags kind={texts.value.kind} us={"us" in texts.value ? texts.value.us : false} />}
                >
                  <Island />
                </RoiWidget>
              </Reveal>
            </li>
          );
        })}
      </ul>

      <p className={`particle-veil particle-veil-tight ${styles.disclaimer}`} data-network-quiet="" data-testid="roi-disclaimer">
        {TEXTS.disclaimer}
      </p>
    </section>
  );
}
