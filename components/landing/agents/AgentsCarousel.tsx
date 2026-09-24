"use client";

import { Fragment, useRef, useState, type KeyboardEvent } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { Button } from "@/components/ui/Button";

import { AGENT_STEPS, nextStepIndex, STEP_PANEL_ID, stepTabId } from "./agent-steps";
import { AgentStepCard } from "./AgentStepCard";
import { StepConnector } from "./StepConnector";
import { StepDetails } from "./StepDetails";
import { StepScene } from "./StepScene";

const TEXTS = LANDING_TEXTS.agents.carousel;
const COUNT = AGENT_STEPS.length;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Carousel of the seven steps of a dossier (Léa → Hugo → Emma → validation
 * humaine → Louis → Sarah → mandat), cards like apps with arrows between them.
 * Selecting a card (click, Enter, Space, arrows, Home/End) shows what the step
 * concretely does in an illustrated scene, labelled « Exemple fictif —
 * simulation ».
 *
 * WAI-ARIA tabs with automatic activation and a roving tabindex. Native
 * horizontal scroll with scroll-snap (touch, trackpad), plus previous/next
 * buttons that keep the selected card in view. No library.
 *
 * Without JavaScript the first step is selected and its scene is rendered by
 * the server: the content stays readable. Reduced motion: no smooth scroll,
 * no entrance (the global rule stops the one-shot stagger of the scene).
 */
export function AgentsCarousel() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const step = AGENT_STEPS[selected] ?? AGENT_STEPS[0];

  function select(index: number, focus: boolean) {
    const next = Math.min(Math.max(index, 0), COUNT - 1);
    setSelected(next);
    const tab = tabs.current[next];
    if (!tab) return;
    if (focus) tab.focus({ preventScroll: true });
    const reduced = window.matchMedia?.(REDUCED_MOTION).matches ?? false;
    tab.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = nextStepIndex(event.key, selected, COUNT);
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  }

  const atStart = selected === 0;
  const atEnd = selected === COUNT - 1;

  return (
    <div data-testid="agents-carousel" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-ink-muted">{TEXTS.hint}</p>
        <div className="flex gap-2">
          {/* aria-disabled rather than disabled: the focus never falls off the page at an end. */}
          <Button
            variant="secondary"
            size="sm"
            arrow="back"
            aria-label={TEXTS.previous}
            aria-disabled={atStart || undefined}
            onClick={() => (atStart ? undefined : select(selected - 1, false))}
            data-testid="agents-previous"
            className="w-9 px-0 aria-disabled:opacity-40"
          />
          <Button
            variant="secondary"
            size="sm"
            arrow="forward"
            aria-label={TEXTS.next}
            aria-disabled={atEnd || undefined}
            onClick={() => (atEnd ? undefined : select(selected + 1, false))}
            data-testid="agents-next"
            className="w-9 px-0 aria-disabled:opacity-40"
          />
        </div>
      </div>

      <div
        role="tablist"
        aria-label={TEXTS.label}
        aria-orientation="horizontal"
        data-testid="agents-tablist"
        className="-mx-2 mt-5 flex snap-x snap-mandatory scroll-px-2 items-stretch overflow-x-auto overscroll-x-contain p-2 pb-4 [scrollbar-width:thin]"
      >
        {AGENT_STEPS.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? <StepConnector /> : null}
            <AgentStepCard
              ref={(element) => {
                tabs.current[index] = element;
              }}
              step={item}
              selected={index === selected}
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
        className="ui-focus mt-4 grid gap-8 rounded-xl border border-line bg-surface p-6 shadow-subtle sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12 lg:p-10"
      >
        <StepDetails step={step} position={selected + 1} count={COUNT} />
        {/* Keyed by step: the scene enters once when the selection changes. */}
        <StepScene key={step.key} stepKey={step.key} />
      </div>
    </div>
  );
}
