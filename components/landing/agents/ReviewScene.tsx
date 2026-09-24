import { LANDING_TEXTS } from "@/components/landing-texts";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";

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
      <div className="rounded-xl bg-surface-muted p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <AgentAppIcon glyph="human" kind="human" size="md" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">{SCENE.reviewer}</span>
            <span className="block text-xs text-ink-muted">{SCENE.message}</span>
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" aria-hidden="true">
          <span className="rounded-full bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-muted shadow-subtle">
            {SCENE.actions.edit}
          </span>
          <span className="rounded-full bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-muted shadow-subtle">
            {SCENE.actions.reject}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-inverse px-3.5 py-1.5 text-xs font-semibold text-ink-inverse">
            <Glyph name="check" width={13} />
            {SCENE.actions.approve}
          </span>
        </div>
      </div>
      <SceneRow glyph="check" tone="done" label={SCENE.result} />
      <p className="px-2 text-xs text-ink-muted">{SCENE.note}</p>
    </SceneFrame>
  );
}
