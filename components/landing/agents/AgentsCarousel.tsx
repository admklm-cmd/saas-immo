"use client";

import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { AGENT_STEPS, nextStepIndex, STEP_PANEL_ID, stepTabId } from "./agent-steps";
import styles from "./agents.module.css";
import { AgentStepCard } from "./AgentStepCard";
import { flipKeyframe, flipTransform, type Box } from "./flip";
import { StepConnector } from "./StepConnector";
import { StepDetails } from "./StepDetails";
import { StepNavigator } from "./StepNavigator";
import { StepScene } from "./StepScene";
import { useTrackPhysics } from "./useTrackPhysics";

const TEXTS = LANDING_TEXTS.agents.carousel;
const COUNT = AGENT_STEPS.length;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** « Open the app »: the tile grows into the header, with a soft spring-like ease. */
const OPEN_DURATION_MS = 460;
const OPEN_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

function prefersReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION).matches ?? false;
}

function boxOf(element: Element | null | undefined): Box | null {
  if (!element) return null;
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}

/**
 * The seven steps of a dossier (Léa → Hugo → Emma → validation humaine →
 * Louis → Sarah → mandat), drawn as the interface of an OS: a row of modules
 * over the application they open. Selecting a module (click, Enter, Space,
 * arrows, Home/End, ← → of the navigation) opens its application: the tile
 * grows into the header of the panel (hand-made FLIP), then the words, then
 * the window of the scene, labelled « Exemple fictif — simulation ».
 *
 * WAI-ARIA tabs with automatic activation and a roving tabindex. Native
 * horizontal scroll with scroll-snap for touch and trackpad; a mouse drag has
 * inertia (`useTrackPhysics`) and never selects by accident.
 *
 * Without JavaScript the first step is selected and its scene is in the server
 * HTML. Reduced motion: no glide, no flight, no entrance — the final state at once.
 */
export function AgentsCarousel() {
  const [selected, setSelected] = useState(0);
  const [opening, setOpening] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const panelIcon = useRef<HTMLSpanElement>(null);
  const flipFrom = useRef<Box | null>(null);
  const { reveal, handlers } = useTrackPhysics(trackRef);
  const step = AGENT_STEPS[selected] ?? AGENT_STEPS[0];

  function select(index: number, focus: boolean) {
    const next = Math.min(Math.max(index, 0), COUNT - 1);
    const tab = tabs.current[next];
    if (next !== selected) {
      flipFrom.current = boxOf(tab?.querySelector("[data-step-icon]"));
      setSelected(next);
      setOpening((count) => count + 1);
    }
    if (!tab) return;
    if (focus) tab.focus({ preventScroll: true });
    reveal(next);
  }

  // Play: the header tile starts where the module tile is, and grows into place.
  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    const target = panelIcon.current;
    if (!from || !target || typeof target.animate !== "function" || prefersReducedMotion()) return;
    const transform = flipTransform(from, boxOf(target) ?? from);
    if (!transform) return;
    target.animate([{ transform: flipKeyframe(transform) }, { transform: "none" }], {
      duration: OPEN_DURATION_MS,
      easing: OPEN_EASING,
    });
  }, [selected]);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = nextStepIndex(event.key, selected, COUNT);
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  }

  return (
    <div data-testid="agents-carousel" className={styles.os}>
      <div className={styles.bar}>
        <p className={styles.hint}>{TEXTS.hint}</p>
        <StepNavigator
          position={selected + 1}
          count={COUNT}
          onPrevious={() => select(selected - 1, false)}
          onNext={() => select(selected + 1, false)}
        />
      </div>

      <div
        ref={trackRef}
        role="tablist"
        aria-label={TEXTS.label}
        aria-orientation="horizontal"
        data-testid="agents-tablist"
        data-at-start=""
        className={styles.track}
        {...handlers}
      >
        {AGENT_STEPS.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? <StepConnector lit={index <= selected} /> : null}
            <AgentStepCard
              ref={(element) => {
                tabs.current[index] = element;
              }}
              step={item}
              selected={index === selected}
              flowInLit={index <= selected}
              flowOutLit={index < selected}
              first={index === 0}
              last={index === COUNT - 1}
              onSelect={() => select(index, false)}
              onKeyDown={onTabKeyDown}
            />
          </Fragment>
        ))}
      </div>

      <div
        role="tabpanel"
        id={STEP_PANEL_ID}
        aria-labelledby={stepTabId(step.key)}
        tabIndex={0}
        data-testid="agents-panel"
        data-step={step.key}
        className={styles.stage}
      >
        {/* Keyed by the opening: the entrance replays on each selection, never on the first render. */}
        <div key={opening} data-opening={opening > 0 || undefined} className="contents">
          <StepDetails step={step} position={selected + 1} count={COUNT} iconRef={panelIcon} />
          <StepScene stepKey={step.key} />
        </div>
      </div>
    </div>
  );
}
