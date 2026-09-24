import { CalendarIcon, ClockIcon, FileTextIcon, LockClosedIcon } from "@radix-ui/react-icons";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { SceneFrame } from "./SceneFrame";
import { SceneRow, type SceneRowTone } from "./SceneRow";

const SCENE = LANDING_TEXTS.agents.scenes.louis;

const SLOT_TONES: Readonly<Record<(typeof SCENE.slots)[number]["state"], SceneRowTone>> = {
  taken: "muted",
  proposed: "active",
  free: "plain",
};

const SLOT_ICONS = { taken: LockClosedIcon, proposed: ClockIcon, free: ClockIcon } as const;

/** Louis: a free slot proposed, the booked one never offered again, the file prepared. */
export function LouisScene() {
  return (
    <SceneFrame stepKey="louis" title={SCENE.title}>
      <p className="flex items-center gap-2 text-xs font-semibold text-ink">
        <CalendarIcon aria-hidden="true" width={14} height={14} />
        {SCENE.day}
      </p>
      {SCENE.slots.map((slot) => (
        <SceneRow
          key={slot.time}
          icon={SLOT_ICONS[slot.state]}
          tone={SLOT_TONES[slot.state]}
          label={slot.time}
          detail={slot.label}
          testId={`louis-slot-${slot.state}`}
        />
      ))}
      <SceneRow icon={FileTextIcon} tone="done" label={SCENE.folder} />
      <p className="text-xs text-ink-muted">{SCENE.note}</p>
    </SceneFrame>
  );
}
