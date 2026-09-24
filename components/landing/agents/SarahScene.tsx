import { LANDING_TEXTS } from "@/components/landing-texts";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";

import { SceneFrame } from "./SceneFrame";

const SCENE = LANDING_TEXTS.agents.scenes.sarah;

/** Sarah: the report written by the adviser becomes the next actions of the file. */
export function SarahScene() {
  return (
    <SceneFrame stepKey="sarah" title={SCENE.title}>
      {/* The report is a person's words: a quote, marked by its left rule. */}
      <blockquote className="rounded-r-xl border-l-2 border-ink bg-surface-muted px-4 py-3.5">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{SCENE.reportLabel}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{SCENE.report}</p>
      </blockquote>
      <Glyph name="arrowDown" width={18} className="mx-auto text-ink-subtle" />
      <div className="rounded-xl bg-surface-muted px-4 py-3.5">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{SCENE.actionsLabel}</p>
        <ul className="mt-3 grid gap-2.5">
          {SCENE.actions.map((action) => (
            <li key={action} className="flex items-start gap-3 text-sm text-ink">
              <span
                aria-hidden="true"
                className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-inverse text-ink-inverse"
              >
                <Glyph name="check" width={11} />
              </span>
              {action}
            </li>
          ))}
        </ul>
      </div>
    </SceneFrame>
  );
}
