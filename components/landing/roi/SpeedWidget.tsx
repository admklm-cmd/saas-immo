"use client";

import { useLayoutEffect, useRef } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { RoiNumber } from "./RoiNumber";
import { RoiTags } from "./RoiTag";
import { SPEED, fill, formatInteger, splitTemplate } from "./roi-model";
import { playArrival, setNumber, type NumberSlot } from "./roi-motion";
import styles from "./roi.module.css";
import { useRoiArrival } from "./use-roi-arrival";

const TEXTS = LANDING_TEXTS.roi.widgets.speed;
const [MAIN_PREFIX, MAIN_SUFFIX] = splitTemplate(TEXTS.value.text);
const [SECOND_PREFIX, SECOND_SUFFIX] = splitTemplate(TEXTS.secondary.value.text);
const integer = (value: number) => formatInteger(value);

/**
 * W1 « Chaque minute compte » (docs/design-system.md §2.11.8.8 L4-B): two
 * published US figures, no calculation. Scene: two bars — 5 min full, 30 min
 * at 1/21 of the track. Arrival (1 220 ms): ×21 counts from 1, the bars grow,
 * then the « ×7 » line rises and counts.
 */
export function SpeedWidget() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLSpanElement>(null);
  const secondRef = useRef<HTMLSpanElement>(null);
  const fastRef = useRef<HTMLSpanElement>(null);
  const slowRef = useRef<HTMLSpanElement>(null);
  const secondaryRef = useRef<HTMLDivElement>(null);
  const { state, finish } = useRoiArrival(rootRef);

  useLayoutEffect(() => {
    const main = mainRef.current;
    const second = secondRef.current;
    if (!main || !second) return;
    const slots: [NumberSlot, NumberSlot] = [
      { el: main, format: integer },
      { el: second, format: integer },
    ];
    if (state === "armed") {
      setNumber(slots[0], 1);
      setNumber(slots[1], 1);
      return;
    }
    if (state !== "playing" || !fastRef.current || !slowRef.current || !secondaryRef.current) return;
    const arrival = playArrival(
      [
        { slot: slots[0], from: 1, to: SPEED.odds, at: 0, duration: 900, ease: "outExpo" },
        { slot: slots[1], from: 1, to: SPEED.hourOdds, at: 900, duration: 320, ease: "outQuad" },
      ],
      [
        { targets: fastRef.current, props: { scaleX: [0, 1] }, at: 100, duration: 700, ease: "outQuart" },
        { targets: slowRef.current, props: { scaleX: [0, 1] }, at: 300, duration: 600, ease: "outQuart" },
        { targets: secondaryRef.current, props: { opacity: [0, 1], translateY: [6, 0] }, at: 900, duration: 320, ease: "outQuad" },
      ],
      finish,
    );
    const onHidden = () => {
      if (document.visibilityState === "hidden") arrival.finishNow();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      arrival.stop();
    };
  }, [state, finish]);

  return (
    <div ref={rootRef} className={styles.body} data-roi-state={state}>
      <div className={styles.figure}>
        <RoiNumber
          numberRef={mainRef}
          text={integer(SPEED.odds)}
          value={SPEED.odds}
          prefix={MAIN_PREFIX}
          suffix={MAIN_SUFFIX}
          sr={fill(TEXTS.value.sr, { value: SPEED.odds })}
        />
        <p className={styles.caption}>{TEXTS.caption}</p>
      </div>

      <div className={styles.scene} aria-hidden="true" data-roi-scene="bars">
        <div className={styles.barRow}>
          <span className={styles.barLabel}>{TEXTS.bars.fast}</span>
          <span className={styles.barTrack}>
            <span ref={fastRef} className={styles.barFast} data-roi-move="" />
          </span>
          <span className={styles.barRatio}>{TEXTS.bars.fastRatio}</span>
        </div>
        <div className={styles.barRow}>
          <span className={styles.barLabel}>{TEXTS.bars.slow}</span>
          <span className={styles.barTrack}>
            <span ref={slowRef} className={styles.barSlow} data-roi-move="" />
          </span>
          <span className={styles.barRatio}>{TEXTS.bars.slowRatio}</span>
        </div>
      </div>

      <div ref={secondaryRef} className={styles.secondary} data-roi-move="">
        <RoiNumber
          numberRef={secondRef}
          size="secondary"
          text={integer(SPEED.hourOdds)}
          value={SPEED.hourOdds}
          prefix={SECOND_PREFIX}
          suffix={SECOND_SUFFIX}
          sr={fill(TEXTS.secondary.value.sr, { value: SPEED.hourOdds })}
        />
        <p className={styles.secondaryCaption}>
          {TEXTS.secondary.caption} <RoiTags kind={TEXTS.secondary.value.kind} us={TEXTS.secondary.value.us} />
        </p>
      </div>
    </div>
  );
}
