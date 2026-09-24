import { CheckIcon, PersonIcon } from "@radix-ui/react-icons";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { SceneFrame } from "./SceneFrame";
import { SceneRow } from "./SceneRow";

const SCENE = LANDING_TEXTS.agents.scenes.review;

/**
 * Human validation: a person of the agency reads the first contact and
 * approves it. The three choices are drawn, not interactive (illustration).
 */
export function ReviewScene() {
  return (
    <SceneFrame stepKey="review" title={SCENE.title}>
      <div className="rounded-md border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-ink text-ink ring-1 ring-ink-subtle ring-offset-2 ring-offset-surface"
          >
            <PersonIcon width={16} height={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">{SCENE.reviewer}</span>
            <span className="block text-xs text-ink-muted">{SCENE.message}</span>
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-hidden="true">
          <span className="rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-ink-muted">
            {SCENE.actions.edit}
          </span>
          <span className="rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-ink-muted">
            {SCENE.actions.reject}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-inverse px-3 py-1 text-xs font-semibold text-ink-inverse">
            <CheckIcon width={12} height={12} />
            {SCENE.actions.approve}
          </span>
        </div>
      </div>
      <SceneRow icon={CheckIcon} tone="done" label={SCENE.result} />
      <p className="text-xs text-ink-muted">{SCENE.note}</p>
    </SceneFrame>
  );
}
