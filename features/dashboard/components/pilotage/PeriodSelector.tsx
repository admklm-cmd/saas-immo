"use client";

import { useRef, type KeyboardEvent } from "react";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";

import type { PilotagePeriodKey } from "../../pilotage-periods";
import { PERIOD_ORDER } from "./pilotage-format";

const TEXTS = APP_TEXTS.dashboard.pilotage;

export type PeriodSelectorProps = {
  value: PilotagePeriodKey;
  onChange: (key: PilotagePeriodKey) => void;
};

/**
 * Segmented control of the period (docs §3.5.2.C): a radio group with a roving tab
 * stop. The arrows change AND confirm the period; Home / End go to the ends. The dark
 * pill slides with `transform` only.
 */
export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, PERIOD_ORDER.indexOf(value));

  function move(next: number) {
    const target = PERIOD_ORDER[(next + PERIOD_ORDER.length) % PERIOD_ORDER.length] ?? value;
    onChange(target);
    buttons.current[PERIOD_ORDER.indexOf(target)]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number | undefined> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: PERIOD_ORDER.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    move(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label={TEXTS.periodGroupLabel}
      data-testid="period-selector"
      onKeyDown={onKeyDown}
      className="relative grid w-full grid-cols-4 rounded-full bg-surface-sunken p-1 lg:w-88"
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full bg-inverse transition-transform duration-(--duration-base) ease-standard"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {PERIOD_ORDER.map((key, position) => {
        const selected = key === value;
        return (
          <button
            key={key}
            ref={(node) => {
              buttons.current[position] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-testid={`period-${key}`}
            onClick={() => onChange(key)}
            className={cn(
              "ui-focus relative z-10 h-11 rounded-full px-2 text-sm font-medium transition-colors duration-(--duration-fast) ease-standard lg:h-10",
              selected ? "text-ink-inverse" : "text-ink-muted hover:text-ink",
            )}
          >
            {TEXTS.periods[key].short}
          </button>
        );
      })}
    </div>
  );
}
