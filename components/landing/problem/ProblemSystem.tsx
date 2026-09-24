"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { CAUSE_EVENTS, causeDelayMs, isProblemCause, type ProblemCause } from "./problem-scene";
import styles from "./ProblemSystem.module.css";

const TEXTS = LANDING_TEXTS.problem;

/** The cause pointed at by an element of the system (a cause, an event, a word). */
function causeOf(target: EventTarget | null): ProblemCause | null {
  if (!(target instanceof Element)) return null;
  const value = target.closest<HTMLElement | SVGElement>("[data-cause]")?.dataset.cause;
  return isProblemCause(value) ? value : null;
}

/**
 * The illustration and its causes, as one system. Hovering or focusing a cause
 * highlights its events on the chart, and hovering an event highlights its
 * cause. A cause can also be pinned (click, tap, Enter, Space; Escape
 * releases it): on a touch screen there is no hover.
 *
 * The chart itself stays a Server Component (`chart`); this client part only
 * sets `data-highlighted` on the chart elements carrying `data-cause-target`.
 * The link between a cause and its events is also written in the text of
 * each cause: the highlight never carries information on its own.
 */
export function ProblemSystem({ chart }: { chart: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<ProblemCause | null>(null);
  const [focused, setFocused] = useState<ProblemCause | null>(null);
  const [pinned, setPinned] = useState<ProblemCause | null>(null);
  const active = hovered ?? focused ?? pinned;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement | SVGElement>("[data-cause-target]").forEach((element) => {
      if (active && element.dataset.cause === active) element.dataset.highlighted = "true";
      else delete element.dataset.highlighted;
    });
  }, [active]);

  const onPointerOver = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    setHovered(causeOf(event.target));
  };

  const onChartClick = (event: MouseEvent<HTMLDivElement>) => {
    const cause = causeOf(event.target);
    if (cause) setPinned((current) => (current === cause ? null : cause));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && pinned) setPinned(null);
  };

  return (
    <div
      ref={rootRef}
      data-testid="problem-system"
      data-active-cause={active ?? undefined}
      className={styles.system}
      onPointerOver={onPointerOver}
      onPointerLeave={() => setHovered(null)}
      onFocus={(event: FocusEvent<HTMLDivElement>) => setFocused(causeOf(event.target))}
      onBlur={() => setFocused(null)}
      onKeyDown={onKeyDown}
    >
      {/* Chart: pointing at an event pins its cause on touch screens too. The
          chart is an image for assistive technology; the same action is
          offered by the buttons of the causes, reachable with the keyboard. */}
      <div className={styles.chart} onClick={onChartClick}>
        {chart}
      </div>

      <div className={styles.causes}>
        <p id="problem-causes" className="text-overline font-semibold text-ink-subtle uppercase">
          {TEXTS.chart.causesLabel}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-pretty text-ink-muted">{TEXTS.chart.causesHint}</p>

        <ul aria-labelledby="problem-causes" className={styles.list} data-testid="problem-causes">
          {TEXTS.symptoms.map((symptom) => {
            const isActive = active === symptom.key;
            const bodyId = `problem-cause-${symptom.key}`;
            return (
              <li
                key={symptom.key}
                data-testid="problem-cause"
                data-cause={symptom.key}
                data-highlighted={isActive ? "true" : undefined}
                data-pinned={pinned === symptom.key ? "true" : undefined}
                className={styles.cause}
                style={{ "--cause-delay": `${causeDelayMs(symptom.key)}ms` } as CSSProperties}
              >
                <span className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={pinned === symptom.key}
                    aria-describedby={bodyId}
                    className={styles.toggle}
                    onClick={() => setPinned((current) => (current === symptom.key ? null : symptom.key))}
                  >
                    {symptom.title}
                  </button>
                  <span id={bodyId} className="mt-1.5 block text-sm leading-relaxed text-pretty text-ink-muted">
                    {symptom.body}
                  </span>
                  <span className={styles.kinds}>
                    <span className="sr-only">{TEXTS.chart.eventsLabel} : </span>
                    {CAUSE_EVENTS[symptom.key].map((kind) => (
                      <span key={kind} className={styles.kind}>
                        {TEXTS.chart.events[kind]}
                      </span>
                    ))}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
