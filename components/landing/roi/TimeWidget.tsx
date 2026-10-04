"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { RoiNumber } from "./RoiNumber";
import { RoiSettings } from "./RoiSettings";
import { RoiSlider } from "./RoiSlider";
import {
  TIME,
  TIME_DEFAULTS,
  computeTime,
  differsFromDefaults,
  fill,
  formatInteger,
  roundTo,
  splitTemplate,
  type TimeInput,
} from "./roi-model";
import { playArrival, setNumber, tweenNumber, type Arrival, type NumberSlot } from "./roi-motion";
import styles from "./roi.module.css";
import { useHydrated, useRoiArrival } from "./use-roi-arrival";

const TEXTS = LANDING_TEXTS.roi.widgets.time;
const [MAIN_PREFIX, MAIN_SUFFIX] = splitTemplate(TEXTS.value.text);
const [TOTAL_PREFIX, TOTAL_SUFFIX] = splitTemplate(TEXTS.total.text);
const [WORTH_PREFIX, WORTH_SUFFIX] = splitTemplate(TEXTS.worth.text);

const toTen = (value: number) => formatInteger(roundTo(value, 10));
const toUnit = (value: number) => formatInteger(value);
const toHundred = (value: number) => formatInteger(roundTo(value, 100));

/**
 * W2 « Le temps qui vous échappe » (docs/design-system.md §2.11.8.8 L4-B):
 * hours of admin per year (published range + hypotheses), the share that
 * could be won back and its value — an estimate, rounded. Scene: one bar,
 * the recoverable part in ink. Arrival 1 300 ms; a slider change counts in
 * 320 ms. Values stay in this component: never stored, never sent.
 */
export function TimeWidget() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const worthRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const partRef = useRef<HTMLSpanElement>(null);
  const arrivalRef = useRef<Arrival | null>(null);
  const { state, motion, finish } = useRoiArrival(rootRef);
  const hydrated = useHydrated();
  const [input, setInput] = useState<TimeInput>(TIME_DEFAULTS);
  const [changes, setChanges] = useState(0);
  const result = useMemo(() => computeTime(input), [input]);
  const [initial] = useState(result);

  const slots = (): [NumberSlot, NumberSlot, NumberSlot] | null =>
    mainRef.current && totalRef.current && worthRef.current
      ? [
          { el: mainRef.current, format: toTen },
          { el: totalRef.current, format: toUnit },
          { el: worthRef.current, format: toHundred },
        ]
      : null;

  // Arrival: armed (zeros), then playing up to the CURRENT values (kept on a replay).
  const latest = useRef(result);
  useLayoutEffect(() => {
    latest.current = result;
  });
  useLayoutEffect(() => {
    const numbers = slots();
    if (!numbers) return;
    if (state === "armed") {
      numbers.forEach((slot) => setNumber(slot, 0));
      return;
    }
    if (state !== "playing" || !barRef.current || !partRef.current) return;
    const target = latest.current;
    const arrival = playArrival(
      [
        { slot: numbers[0], from: 0, to: target.recoverableHours, at: 0, duration: 1300, ease: "outExpo" },
        { slot: numbers[1], from: 0, to: target.yearlyHours, at: 600, duration: 700, ease: "outExpo" },
        { slot: numbers[2], from: 0, to: target.value, at: 600, duration: 700, ease: "outExpo" },
      ],
      [
        { targets: barRef.current, props: { scaleX: [0, 1] }, at: 0, duration: 600, ease: "outQuart" },
        { targets: partRef.current, props: { scaleX: [0, 1] }, at: 500, duration: 600, ease: "outQuart" },
      ],
      finish,
    );
    arrivalRef.current = arrival;
    const onHidden = () => {
      if (document.visibilityState === "hidden") arrival.finishNow();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      arrival.stop();
      arrivalRef.current = null;
    };
  }, [state, finish]);

  // A slider change: each number from what it shows to its new value (320 ms; instant in reduced motion).
  useEffect(() => {
    if (changes === 0) return;
    const numbers = slots();
    if (!numbers || state === "armed") return;
    arrivalRef.current?.finishNow();
    tweenNumber(numbers[0], result.recoverableHours, motion);
    tweenNumber(numbers[1], result.yearlyHours, motion);
    tweenNumber(numbers[2], result.value, motion);
    // Only a new result (a slider change) tweens; the state and the motion are read as they are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const update = (next: TimeInput) => {
    setInput(next);
    setChanges((count) => count + 1);
  };
  const sliders = TEXTS.sliders;

  return (
    <div ref={rootRef} className={styles.body} data-roi-state={state}>
      <div className={styles.figure}>
        <RoiNumber
          numberRef={mainRef}
          text={toTen(initial.recoverableHours)}
          value={result.recoverableHours}
          prefix={MAIN_PREFIX}
          suffix={MAIN_SUFFIX}
          sr={fill(TEXTS.value.sr, { value: toTen(result.recoverableHours) })}
        />
        <p className={styles.caption}>{TEXTS.caption}</p>
      </div>

      <div className={styles.scene} data-roi-scene="time">
        <span className={styles.timeTrack} aria-hidden="true">
          <span ref={barRef} className={styles.timeTotal} data-roi-move="" />
          <span ref={partRef} className={styles.timePart} style={{ width: `${result.share * 100}%` }} data-roi-move="" />
        </span>
        <div className={styles.timeLegend}>
          <RoiNumber
            numberRef={totalRef}
            size="inline"
            text={toUnit(initial.yearlyHours)}
            value={result.yearlyHours}
            prefix={TOTAL_PREFIX}
            suffix={TOTAL_SUFFIX}
            sr={fill(TEXTS.total.sr, { value: toUnit(result.yearlyHours) })}
          />
          <RoiNumber
            numberRef={worthRef}
            size="inline"
            text={toHundred(initial.value)}
            value={result.value}
            prefix={WORTH_PREFIX}
            suffix={WORTH_SUFFIX}
            sr={fill(TEXTS.worth.sr, { value: toHundred(result.value) })}
          />
        </div>
      </div>

      <RoiSettings
        changed={differsFromDefaults(input, TIME_DEFAULTS)}
        hydrated={hydrated}
        onReset={() => update(TIME_DEFAULTS)}
        fixed={TEXTS.fixed}
        changes={changes}
        announcement={fill(TEXTS.live, { hours: toTen(result.recoverableHours), euros: toHundred(result.value) })}
      >
        <RoiSlider
          label={sliders.negotiators.label}
          spec={TIME.negotiators}
          value={input.negotiators}
          display={fill(TEXTS.display.negotiators, { n: input.negotiators })}
          valueText={fill(sliders.negotiators.valueText, { n: input.negotiators })}
          kind={sliders.negotiators.kind}
          disabled={!hydrated}
          onChange={(negotiators) => update({ ...input, negotiators })}
        />
        <RoiSlider
          label={sliders.hours.label}
          spec={TIME.hours}
          value={input.hours}
          display={fill(TEXTS.display.hours, { n: input.hours })}
          valueText={fill(sliders.hours.valueText, { n: input.hours })}
          kind={sliders.hours.kind}
          benchmark={sliders.hours.benchmark}
          disabled={!hydrated}
          onChange={(hours) => update({ ...input, hours })}
        />
      </RoiSettings>
    </div>
  );
}
