import { ArrowDownIcon, CheckIcon } from "@radix-ui/react-icons";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { SceneFrame } from "./SceneFrame";

const SCENE = LANDING_TEXTS.agents.scenes.sarah;

/** Sarah: the report written by the adviser becomes the next actions of the file. */
export function SarahScene() {
  return (
    <SceneFrame stepKey="sarah" title={SCENE.title}>
      <blockquote className="rounded-md border border-line border-l-[3px] border-l-ink bg-surface px-4 py-3">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{SCENE.reportLabel}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{SCENE.report}</p>
      </blockquote>
      <ArrowDownIcon aria-hidden="true" className="mx-auto text-ink-subtle" width={18} height={18} />
      <div className="rounded-md border border-line bg-surface px-4 py-3">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{SCENE.actionsLabel}</p>
        <ul className="mt-2 grid gap-2">
          {SCENE.actions.map((action) => (
            <li key={action} className="flex items-start gap-2.5 text-sm text-ink">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-xs border border-ink text-ink"
              >
                <CheckIcon width={10} height={10} />
              </span>
              {action}
            </li>
          ))}
        </ul>
      </div>
    </SceneFrame>
  );
}
