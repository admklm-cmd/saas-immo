import { LANDING_TEXTS } from "@/components/landing-texts";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";

import { SceneFrame } from "./SceneFrame";
import { SceneRow } from "./SceneRow";

const SCENE = LANDING_TEXTS.agents.scenes.lea;

/** Léa: two fictitious requests come in, the source is checked, the duplicate caught, one file created. */
export function LeaScene() {
  return (
    <SceneFrame stepKey="lea" title={SCENE.title}>
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <ul className="grid gap-2">
          {SCENE.incoming.map((request) => (
            <li key={request.source} className="rounded-lg bg-surface-muted px-3.5 py-2.5">
              <span className="block text-xs font-semibold text-ink">{request.source}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{request.detail}</span>
            </li>
          ))}
        </ul>
        <Glyph name="arrowRight" width={18} className="mx-auto rotate-90 text-ink-subtle sm:rotate-0" />
        <p className="flex items-center gap-3 rounded-lg bg-inverse px-4 py-3.5 text-sm font-semibold text-ink-inverse">
          <Glyph name="document" width={18} className="shrink-0" />
          {SCENE.output}
        </p>
      </div>
      <SceneRow glyph="check" tone="done" label={SCENE.checks[0].label} detail={SCENE.checks[0].detail} />
      <SceneRow glyph="merge" tone="done" label={SCENE.checks[1].label} detail={SCENE.checks[1].detail} />
      <p className="px-2 text-xs text-ink-muted">{SCENE.note}</p>
    </SceneFrame>
  );
}
