import { LANDING_TEXTS } from "@/components/landing-texts";
import type { GlyphName } from "@/features/agents-ia/components/icons/glyphs";

import { SceneFrame } from "./SceneFrame";
import { SceneRow, type SceneRowTone } from "./SceneRow";

const SCENE = LANDING_TEXTS.agents.scenes.louis;

type SlotState = (typeof SCENE.slots)[number]["state"];

const SLOT_TONES: Readonly<Record<SlotState, SceneRowTone>> = {
  taken: "muted",
  proposed: "active",
  free: "plain",
};

const SLOT_GLYPHS: Readonly<Record<SlotState, GlyphName>> = { taken: "lock", proposed: "clock", free: "clock" };

/** Louis: a free slot proposed, the booked one never offered again, the file prepared. */
export function LouisScene() {
  return (
    <SceneFrame stepKey="louis" title={SCENE.title}>
      <p className="px-2 text-overline font-semibold text-ink-subtle uppercase">{SCENE.day}</p>
      {SCENE.slots.map((slot) => (
        <SceneRow
          key={slot.time}
          glyph={SLOT_GLYPHS[slot.state]}
          tone={SLOT_TONES[slot.state]}
          label={slot.time}
          detail={slot.label}
          testId={`louis-slot-${slot.state}`}
        />
      ))}
      <SceneRow glyph="document" tone="done" label={SCENE.folder} />
      <p className="px-2 text-xs text-ink-muted">{SCENE.note}</p>
    </SceneFrame>
  );
}
