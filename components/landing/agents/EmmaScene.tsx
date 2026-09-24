import { LANDING_TEXTS } from "@/components/landing-texts";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";

import { SceneFrame } from "./SceneFrame";

const SCENE = LANDING_TEXTS.agents.scenes.emma;

/**
 * Emma: a follow-up draft with its unsubscribe line, the consent checked, and
 * nothing sent. The unsubscribe line is illustrative text, not a link.
 */
export function EmmaScene() {
  return (
    <SceneFrame stepKey="emma" title={SCENE.title}>
      <div className="rounded-xl bg-surface-muted px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Glyph name="mail" width={15} />
            {SCENE.channel}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Glyph name="lock" width={13} />
            {SCENE.consent}
          </span>
        </div>
        <p className="mt-4 text-sm font-semibold text-ink">{SCENE.subject}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{SCENE.body}</p>
        <p className="mt-4 text-xs text-ink-muted" data-testid="emma-unsubscribe">
          <span className="underline decoration-ink-subtle underline-offset-2">{SCENE.unsubscribe}</span>
        </p>
      </div>
      <p className="w-fit rounded-full border border-dashed border-ink-subtle px-3 py-1 text-xs font-semibold text-ink">
        {SCENE.status}
      </p>
    </SceneFrame>
  );
}
