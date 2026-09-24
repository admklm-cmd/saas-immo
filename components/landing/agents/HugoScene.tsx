import { QuestionMarkIcon, ReaderIcon } from "@radix-ui/react-icons";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { SceneFrame } from "./SceneFrame";
import { SceneRow } from "./SceneRow";

const SCENE = LANDING_TEXTS.agents.scenes.hugo;

/** Hugo: the project structured field by field; what is missing is flagged, never filled in. */
export function HugoScene() {
  return (
    <SceneFrame stepKey="hugo" title={SCENE.title}>
      <dl className="grid gap-2 sm:grid-cols-2">
        {SCENE.fields.map((field) =>
          field.value ? (
            <div key={field.label} className="rounded-md border border-line bg-surface px-3 py-2.5">
              <dt className="text-overline font-semibold text-ink-subtle uppercase">{field.label}</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{field.value}</dd>
            </div>
          ) : (
            <div
              key={field.label}
              data-testid="hugo-missing"
              className="rounded-md border border-dashed border-ink bg-surface px-3 py-2.5"
            >
              <dt className="text-overline font-semibold text-ink-subtle uppercase">{field.label}</dt>
              <dd className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink">
                <QuestionMarkIcon aria-hidden="true" width={14} height={14} className="shrink-0" />
                {SCENE.missing}
              </dd>
            </div>
          ),
        )}
      </dl>
      <SceneRow icon={ReaderIcon} tone="flag" label={SCENE.task} />
    </SceneFrame>
  );
}
