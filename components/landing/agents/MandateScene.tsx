import { CheckIcon, PersonIcon, ReaderIcon } from "@radix-ui/react-icons";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { SceneFrame } from "./SceneFrame";
import { SceneRow } from "./SceneRow";

const SCENE = LANDING_TEXTS.agents.scenes.mandate;

/** Mandate: Sarah flags it, a person confirms it. Never self-declared by an agent. */
export function MandateScene() {
  return (
    <SceneFrame stepKey="mandate" title={SCENE.title}>
      <ol className="grid gap-3">
        <li>
          <SceneRow icon={ReaderIcon} tone="plain" label={SCENE.proposal} />
        </li>
        <li>
          <SceneRow icon={PersonIcon} tone="flag" label={SCENE.pending} />
        </li>
        <li>
          <SceneRow icon={CheckIcon} tone="done" label={SCENE.confirmed} />
        </li>
      </ol>
      <p className="text-xs text-ink-muted">{SCENE.note}</p>
    </SceneFrame>
  );
}
