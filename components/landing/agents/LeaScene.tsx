import { ArrowRightIcon, CheckIcon, IdCardIcon, Link2Icon } from "@radix-ui/react-icons";

import { LANDING_TEXTS } from "@/components/landing-texts";

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
            <li key={request.source} className="rounded-md border border-dashed border-ink-subtle bg-surface px-3 py-2">
              <span className="block text-xs font-semibold text-ink">{request.source}</span>
              <span className="block text-xs text-ink-muted">{request.detail}</span>
            </li>
          ))}
        </ul>
        <ArrowRightIcon aria-hidden="true" className="mx-auto rotate-90 text-ink-subtle sm:rotate-0" width={18} height={18} />
        <p className="flex items-center gap-3 rounded-md border-[1.5px] border-ink bg-surface px-3 py-3 text-sm font-semibold text-ink">
          <IdCardIcon aria-hidden="true" width={18} height={18} className="shrink-0" />
          {SCENE.output}
        </p>
      </div>
      <SceneRow icon={CheckIcon} tone="done" label={SCENE.checks[0].label} detail={SCENE.checks[0].detail} />
      <SceneRow icon={Link2Icon} tone="done" label={SCENE.checks[1].label} detail={SCENE.checks[1].detail} />
      <p className="text-xs text-ink-muted">{SCENE.note}</p>
    </SceneFrame>
  );
}
