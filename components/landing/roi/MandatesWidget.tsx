"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { RoiNumber } from "./RoiNumber";
import { RoiSettings } from "./RoiSettings";
import { RoiSlider } from "./RoiSlider";
import {
  MANDATES,
  MANDATES_DEFAULTS,
  computeMandates,
  differsFromDefaults,
  fill,
  formatInteger,
  formatOneDecimal,
  roundTo,
  splitTemplate,
  type MandatesInput,
  type MandatesResult,
} from "./roi-model";
import { playArrival, setNumber, tweenNumber, type Arrival, type NumberSlot } from "./roi-motion";
import styles from "./roi.module.css";
import { useHydrated, useRoiArrival } from "./use-roi-arrival";

const TEXTS = LANDING_TEXTS.roi.widgets.mandates;
const [MAIN_PREFIX, MAIN_SUFFIX] = splitTemplate(TEXTS.value.text);

/** Below this width the funnel is a column (roi.module.css). */
const COLUMN = "(width < 40rem)";
const toThousand = (value: number) => formatInteger(roundTo(value, 1000));
const toUnit = (value: number) => formatInteger(value);
const toTenth = (value: number) => formatOneDecimal(value);

/** The four steps of the funnel: raw value and format. */
function funnelOf(result: MandatesResult): { value: number; format: (value: number) => string }[] {
  return [
    { value: result.yearlyRequests, format: toUnit },
    { value: result.late, format: toUnit },
    { value: result.mandates, format: toTenth },
    { value: result.sales, format: toTenth },
  ];
}

/**
 * W3 « Les mandats qui partent ailleurs » (docs/design-system.md §2.11.8.8
 * L4-B): requests handled too late → mandates → sales → fees, from two
 * adjustable hypotheses, a published median price and a published fee rate.
 * Scene: a funnel of four steps. Arrival 1 600 ms; a slider change counts in
 * 320 ms. Values stay in this component: never stored, never sent.
 */
export function MandatesWidget() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLSpanElement>(null);
  const stepRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pillRefs = useRef<(HTMLLIElement | null)[]>([]);
  const lineRef = useRef<HTMLSpanElement>(null);
  const arrivalRef = useRef<Arrival | null>(null);
  const { state, motion, finish } = useRoiArrival(rootRef);
  const hydrated = useHydrated();
  const [input, setInput] = useState<MandatesInput>(MANDATES_DEFAULTS);
  const [changes, setChanges] = useState(0);
  const result = useMemo(() => computeMandates(input), [input]);
  const [initial] = useState(result);
  const latest = useRef(result);
  useLayoutEffect(() => {
    latest.current = result;
  });

  const slots = (): NumberSlot[] | null => {
    const steps = stepRefs.current;
    if (!mainRef.current || steps.length !== 4 || steps.some((step) => !step)) return null;
    const formats = funnelOf(result).map((step) => step.format);
    return [{ el: mainRef.current, format: toThousand }, ...steps.map((el, index) => ({ el: el!, format: formats[index]! }))];
  };

  useLayoutEffect(() => {
    const numbers = slots();
    if (!numbers) return;
    if (state === "armed") {
      numbers.forEach((slot) => setNumber(slot, 0));
      return;
    }
    const pills = pillRefs.current.filter((pill): pill is HTMLLIElement => Boolean(pill));
    if (state !== "playing" || !lineRef.current || pills.length !== 4) return;
    const target = latest.current;
    const steps = funnelOf(target);
    const arrival = playArrival(
      [
        { slot: numbers[0]!, from: 0, to: target.fees, at: 300, duration: 1300, ease: "outExpo" },
        ...steps.map((step, index) => ({ slot: numbers[index + 1]!, from: 0, to: step.value, at: index * 140, duration: 280, ease: "outQuad" })),
      ],
      [
        // Below 640 px the funnel is a column: its link grows downward.
        { targets: lineRef.current, props: window.matchMedia?.(COLUMN).matches ? { scaleY: [0, 1] } : { scaleX: [0, 1] }, at: 0, duration: 700, ease: "outQuad" },
        { targets: pills, props: { opacity: [0, 1], translateX: [8, 0] }, at: 0, duration: 280, ease: "outQuad", stagger: 140 },
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
    // `slots` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finish]);

  useEffect(() => {
    if (changes === 0) return;
    const numbers = slots();
    if (!numbers || state === "armed") return;
    arrivalRef.current?.finishNow();
    tweenNumber(numbers[0]!, result.fees, motion);
    funnelOf(result).forEach((step, index) => tweenNumber(numbers[index + 1]!, step.value, motion));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const update = (next: MandatesInput) => {
    setInput(next);
    setChanges((count) => count + 1);
  };
  const sliders = TEXTS.sliders;
  const initialSteps = funnelOf(initial);
  const steps = funnelOf(result);

  return (
    <div ref={rootRef} className={styles.body} data-roi-state={state}>
      <div className={styles.figure}>
        <RoiNumber
          numberRef={mainRef}
          text={toThousand(initial.fees)}
          value={result.fees}
          prefix={MAIN_PREFIX}
          suffix={MAIN_SUFFIX}
          sr={fill(TEXTS.value.sr, { value: toThousand(result.fees) })}
        />
        <p className={styles.caption}>{TEXTS.caption}</p>
      </div>

      <div className={styles.scene} data-roi-scene="funnel">
        <span ref={lineRef} className={styles.funnelLine} aria-hidden="true" data-roi-move="" />
        <ol className={styles.funnel} aria-label={TEXTS.funnelLabel}>
          {TEXTS.funnel.map((step, index) => (
            <li
              key={step.label}
              ref={(node) => {
                pillRefs.current[index] = node;
              }}
              className={styles.funnelStep}
              data-roi-move=""
              data-last={index === TEXTS.funnel.length - 1 ? "" : undefined}
            >
              <RoiNumber
                numberRef={(node) => {
                  stepRefs.current[index] = node;
                }}
                size="step"
                text={initialSteps[index]!.format(initialSteps[index]!.value)}
                value={steps[index]!.value}
                prefix={step.prefix.trim() || undefined}
                sr={`${step.prefix}${steps[index]!.format(steps[index]!.value)} ${step.label}`}
              />
              <span className={styles.funnelLabel} aria-hidden="true">
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <RoiSettings
        changed={differsFromDefaults(input, MANDATES_DEFAULTS)}
        hydrated={hydrated}
        onReset={() => update(MANDATES_DEFAULTS)}
        fixed={TEXTS.fixed}
        changes={changes}
        announcement={fill(TEXTS.live, { euros: toThousand(result.fees) })}
      >
        <RoiSlider
          label={sliders.requests.label}
          spec={MANDATES.requests}
          value={input.requests}
          display={fill(TEXTS.display.requests, { n: input.requests })}
          valueText={fill(sliders.requests.valueText, { n: input.requests })}
          kind={sliders.requests.kind}
          disabled={!hydrated}
          onChange={(requests) => update({ ...input, requests })}
        />
        <RoiSlider
          label={sliders.lateShare.label}
          spec={MANDATES.lateShare}
          value={input.lateShare}
          display={fill(TEXTS.display.lateShare, { n: input.lateShare })}
          valueText={fill(sliders.lateShare.valueText, { n: input.lateShare })}
          kind={sliders.lateShare.kind}
          benchmark={sliders.lateShare.benchmark}
          disabled={!hydrated}
          onChange={(lateShare) => update({ ...input, lateShare })}
        />
      </RoiSettings>
    </div>
  );
}
