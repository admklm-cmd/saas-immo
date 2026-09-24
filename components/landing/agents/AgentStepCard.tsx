import type { KeyboardEvent, Ref } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";

import { STEP_ICONS, STEP_PANEL_ID, stepTabId, type AgentStep } from "./agent-steps";

const TEXTS = LANDING_TEXTS.agents.carousel;

export type AgentStepCardProps = {
  step: AgentStep;
  selected: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * One step of the carousel, drawn like an app: a linear symbol on a tile, the
 * name, the short role. A tab of the WAI-ARIA tabs pattern (roving tabindex).
 *
 * An AI agent has a solid black tile; a human step (validation, mandate) has a
 * DOUBLE CONTOUR, on the card and on the tile, so it never reads as an agent.
 * The selected step is the active one: cobalt border; the words say the rest.
 */
export function AgentStepCard({ step, selected, onSelect, onKeyDown, ref }: AgentStepCardProps) {
  const Icon = STEP_ICONS[step.key];
  const human = step.kind === "human";

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={stepTabId(step.key)}
      aria-selected={selected}
      aria-controls={STEP_PANEL_ID}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      data-testid="agent-step-card"
      data-step={step.key}
      data-kind={step.kind}
      className={cn(
        "ui-focus relative flex w-40 shrink-0 snap-start flex-col items-start gap-4 rounded-xl border bg-surface p-4 text-left sm:w-44",
        "transition-[border-color,box-shadow,translate] duration-(--duration-base) ease-standard",
        "hover:shadow-raised motion-safe:hover:-translate-y-0.5",
        selected ? "border-accent shadow-raised" : "border-line-strong shadow-subtle hover:border-ink-subtle",
      )}
    >
      {human ? (
        // Second contour of a human step: the shape, not the colour, says « a person decides ».
        <span
          aria-hidden="true"
          data-testid="human-contour"
          className="pointer-events-none absolute inset-1 rounded-lg border border-line-strong"
        />
      ) : null}

      <span
        aria-hidden="true"
        className={cn(
          "relative grid size-11 place-items-center",
          human
            ? "rounded-full border-[1.5px] border-ink text-ink ring-1 ring-ink-subtle ring-offset-2 ring-offset-surface"
            : "rounded-lg bg-inverse text-ink-inverse shadow-subtle",
        )}
      >
        <Icon width={18} height={18} />
      </span>

      <span className="relative min-w-0">
        <span className="block text-overline font-semibold text-ink-subtle uppercase">
          {human ? TEXTS.kinds.human : TEXTS.kinds.agent}
        </span>
        <span className="mt-1 block text-base leading-tight font-semibold text-ink">{step.name}</span>
        <span className="mt-0.5 block text-sm text-ink-muted">{step.role}</span>
      </span>
    </button>
  );
}
