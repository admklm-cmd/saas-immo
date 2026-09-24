import { EnvelopeClosedIcon, LockClosedIcon } from "@radix-ui/react-icons";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { SceneFrame } from "./SceneFrame";

const SCENE = LANDING_TEXTS.agents.scenes.emma;

/**
 * Emma: a follow-up draft with its unsubscribe line, the consent checked, and
 * nothing sent. The unsubscribe line is illustrative text, not a link.
 */
export function EmmaScene() {
  return (
    <SceneFrame stepKey="emma" title={SCENE.title}>
      <div className="rounded-md border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <EnvelopeClosedIcon aria-hidden="true" width={14} height={14} />
            {SCENE.channel}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <LockClosedIcon aria-hidden="true" width={12} height={12} />
            {SCENE.consent}
          </span>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-semibold text-ink">{SCENE.subject}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{SCENE.body}</p>
          <p className="mt-3 border-t border-line pt-2.5 text-xs text-ink-muted" data-testid="emma-unsubscribe">
            <span className="underline decoration-ink-subtle underline-offset-2">{SCENE.unsubscribe}</span>
          </p>
        </div>
      </div>
      <p className="w-fit rounded-full border border-dashed border-ink-subtle bg-surface px-3 py-1 text-xs font-semibold text-ink">
        {SCENE.status}
      </p>
    </SceneFrame>
  );
}
