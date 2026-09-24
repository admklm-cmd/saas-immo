import { LANDING_TEXTS } from "@/components/landing-texts";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";

import { SceneRow } from "./SceneRow";
import { SceneFrame } from "./SceneFrame";

const SCENE = LANDING_TEXTS.agents.scenes.mandate;

/**
 * Mandate: Sarah flags it, a person confirms it. Never self-declared by an
 * agent. The confirmation is the conclusion of the journey: the only dark
 * block of the scene, sealed by the outcome tile.
 */
export function MandateScene() {
  return (
    <SceneFrame stepKey="mandate" title={SCENE.title}>
      <ol className="grid gap-1.5">
        <li>
          <SceneRow glyph="sarah" tone="plain" label={SCENE.proposal} />
        </li>
        <li>
          <SceneRow glyph="human" tone="flag" label={SCENE.pending} />
        </li>
        <li
          data-testid="mandate-confirmed"
          data-tone="done"
          className="mt-2 flex items-center gap-4 rounded-xl bg-inverse px-4 py-4 text-ink-inverse"
        >
          <AgentAppIcon glyph="mandate" kind="outcome" size="md" surface="dark" />
          <span className="text-sm font-semibold">{SCENE.confirmed}</span>
        </li>
      </ol>
      <p className="px-2 text-xs text-ink-muted">{SCENE.note}</p>
    </SceneFrame>
  );
}
