import { LANDING_TEXTS } from "@/components/landing-texts";
import { Icon } from "@/components/icons/Icon";

import { SceneFrame } from "./SceneFrame";
import { SceneRow } from "./SceneRow";

const SCENE = LANDING_TEXTS.agents.scenes.hugo;

/**
 * Hugo: the project structured field by field. A known field sits on a pearl
 * surface; the missing one is the only framed field — dashed, because it is
 * flagged, never filled in.
 */
export function HugoScene() {
  return (
    <SceneFrame stepKey="hugo" title={SCENE.title}>
      <dl className="grid gap-2 sm:grid-cols-2">
        {SCENE.fields.map((field) =>
          field.value ? (
            <div key={field.label} className="rounded-lg bg-surface-muted px-3.5 py-3">
              <dt className="text-overline font-semibold text-ink-subtle uppercase">{field.label}</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{field.value}</dd>
            </div>
          ) : (
            <div
              key={field.label}
              data-testid="hugo-missing"
              className="rounded-lg border border-dashed border-ink-subtle px-3.5 py-3"
            >
              <dt className="text-overline font-semibold text-ink-subtle uppercase">{field.label}</dt>
              <dd className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon name="question" px={16} className="shrink-0" />
                {SCENE.missing}
              </dd>
            </div>
          ),
        )}
      </dl>
      <SceneRow glyph="document" tone="flag" label={SCENE.task} />
    </SceneFrame>
  );
}
