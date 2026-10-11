"use client";

import { useLayoutEffect, useRef } from "react";

import { Icon } from "@/components/icons/Icon";
import { LANDING_TEXTS } from "@/components/landing-texts";

import { RoiNumber } from "./RoiNumber";
import { FOLLOWUP, fill, formatInteger, splitTemplate } from "./roi-model";
import { playArrival, setNumber } from "./roi-motion";
import styles from "./roi.module.css";
import { useRoiArrival } from "./use-roi-arrival";

const TEXTS = LANDING_TEXTS.roi.widgets.followup;
const [MAIN_PREFIX, MAIN_SUFFIX] = splitTemplate(TEXTS.value.text);
const integer = (value: number) => formatInteger(value);

/**
 * W4 « La relance qui fait la différence » (docs/design-system.md §2.11.8.8
 * L4-B): one published US figure, no calculation. Scene: six successive
 * contacts on ALTERNATED channels (email, message, phone…), never « six
 * calls »; the consent sentence and the French calling rules sit right under
 * it. Arrival 1 120 ms: the discs fill one after the other, the 6th gets its
 * ring, « 93 % » counts.
 */
export function FollowupWidget() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ringRef = useRef<HTMLSpanElement>(null);
  const { state, finish } = useRoiArrival(rootRef);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const slot = { el: main, format: integer };
    if (state === "armed") {
      setNumber(slot, 0);
      return;
    }
    const fills = fillRefs.current.filter((node): node is HTMLSpanElement => Boolean(node));
    if (state !== "playing" || !lineRef.current || !ringRef.current || fills.length !== FOLLOWUP.contacts) return;
    const arrival = playArrival(
      [{ slot, from: 0, to: FOLLOWUP.share, at: 0, duration: 1000, ease: "outExpo" }],
      [
        { targets: lineRef.current, props: { scaleX: [0, 1] }, at: 0, duration: 960, ease: "outQuad" },
        { targets: fills, props: { opacity: [0, 1], scale: [0.6, 1] }, at: 0, duration: 280, ease: "outQuad", stagger: 160 },
        { targets: ringRef.current, props: { opacity: [0, 1] }, at: 960, duration: 160, ease: "outQuad" },
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
          text={integer(FOLLOWUP.share)}
          value={FOLLOWUP.share}
          prefix={MAIN_PREFIX || undefined}
          suffix={MAIN_SUFFIX}
          sr={fill(TEXTS.value.sr, { value: FOLLOWUP.share })}
        />
        <p className={styles.caption}>{TEXTS.caption}</p>
      </div>

      <div className={styles.scene} data-roi-scene="followup">
        <div className={styles.contacts} aria-hidden="true">
          <span ref={lineRef} className={styles.contactsLine} data-roi-move="" />
          {FOLLOWUP.channels.map((channel, index) => (
            <span key={`${index}-${channel}`} className={styles.contact}>
              <span className={styles.disc} data-last={index === FOLLOWUP.contacts - 1 ? "" : undefined}>
                <Icon name={channel} px={14} dimmed />
                <span
                  ref={(node) => {
                    fillRefs.current[index] = node;
                  }}
                  className={styles.discFill}
                  data-roi-move=""
                >
                  <Icon name={channel} px={14} />
                </span>
                {index === FOLLOWUP.contacts - 1 ? <span ref={ringRef} className={styles.discRing} data-roi-move="" /> : null}
              </span>
              <span className={styles.contactIndex}>{index + 1}</span>
            </span>
          ))}
        </div>
        <p className="sr-only">{TEXTS.timelineLabel}</p>
        <p className={styles.message}>{TEXTS.message}</p>
      </div>
    </div>
  );
}
