import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";

import { STEP_ICONS, type AgentStep } from "./agent-steps";

const TEXTS = LANDING_TEXTS.agents.carousel;

export type StepDetailsProps = {
  step: AgentStep;
  /** 1-based position of the step, and the number of steps. */
  position: number;
  count: number;
};

/** Left side of the panel: who the step is, what it does, where it stops. */
export function StepDetails({ step, position, count }: StepDetailsProps) {
  const Icon = STEP_ICONS[step.key];
  const human = step.kind === "human";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-12 shrink-0 place-items-center",
            human
              ? "rounded-full border-[1.5px] border-ink text-ink ring-1 ring-ink-subtle ring-offset-2 ring-offset-surface"
              : "rounded-lg bg-inverse text-ink-inverse",
          )}
        >
          <Icon width={20} height={20} />
        </span>
        <div className="min-w-0">
          <p className="text-overline font-semibold text-ink-subtle uppercase">
            {TEXTS.stepPrefix} {position} / {count} · {human ? TEXTS.kinds.human : TEXTS.kinds.agent}
          </p>
          <h3 className="mt-1 text-title font-semibold text-ink" data-testid="agent-step-title">
            {step.name}
          </h3>
          <p className="text-sm text-ink-muted">{step.role}</p>
        </div>
      </div>

      <dl className="grid gap-5">
        <div>
          <dt className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.missionLabel}</dt>
          <dd className="mt-1.5 text-lg leading-relaxed text-ink">{step.action}</dd>
        </div>
        <div className="border-t border-line pt-5">
          <dt className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.boundaryLabel}</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.boundary}</dd>
        </div>
      </dl>
    </div>
  );
}
