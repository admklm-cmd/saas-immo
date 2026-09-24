import { formatDurationMs } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import type { TimelineEntry } from "@/features/contacts/types";

import { AGENT_ICONS, JOURNEY_ICONS } from "./agent-icons";
import { buildDossierJourney, type JourneyStage, type JourneyStageKey } from "./dossier-journey";
import { OperationalRail, type RailNode } from "./OperationalRail";

const TEXTS = APP_TEXTS.dossierJourney;

const STAGE_ICONS: Readonly<Record<JourneyStageKey, RailNode["icon"]>> = {
  prospect: JOURNEY_ICONS.prospect,
  lea: AGENT_ICONS.lea,
  first_review: JOURNEY_ICONS.human,
  hugo: AGENT_ICONS.hugo,
  emma: AGENT_ICONS.emma,
  follow_up_review: JOURNEY_ICONS.human,
  louis: AGENT_ICONS.louis,
  appointment: JOURNEY_ICONS.appointment,
  sarah: AGENT_ICONS.sarah,
  mandate: JOURNEY_ICONS.mandate,
};

/** The run replayed on the current page, with its measured duration. */
export type MeasuredRun = { runId: string; durationMs: number };

/**
 * Stages of a dossier → nodes of the rail. Pure: unit-tested on its own.
 *
 * A duration is attached ONLY to the stage whose run is the one being replayed,
 * with the duration the server measured for it. The timeline carries no other
 * measured duration, so every other node shows none (never an estimate).
 */
export function journeyRailNodes(stages: readonly JourneyStage[], measured?: MeasuredRun | null): RailNode[] {
  return stages.map((stage) => {
    const isMeasured = Boolean(measured && stage.runId === measured.runId);
    const href =
      stage.runId && !isMeasured
        ? `/agents-ia/executions/${stage.runId}`
        : stage.state === "human" && (stage.key === "first_review" || stage.key === "follow_up_review")
          ? "/agents-ia/a-valider"
          : undefined;
    return {
      key: stage.key,
      icon: STAGE_ICONS[stage.key],
      name: TEXTS.stages[stage.key].name,
      action: TEXTS.stages[stage.key].action,
      state: stage.state,
      statusLabel: stage.statusLabel,
      duration: isMeasured && measured ? formatDurationMs(measured.durationMs) : undefined,
      href,
    };
  });
}

export type DossierJourneyRailProps = {
  /** Recorded history of the contact, newest first (`getContactTimeline`). */
  entries: readonly TimelineEntry[];
  contactName: string;
  measured?: MeasuredRun | null;
  testId?: string;
};

/**
 * Rail « réseau opérationnel » of one dossier: Prospect → Léa → validation
 * humaine → Hugo → Emma → validation humaine → Louis → rendez-vous → Sarah →
 * mandat confirmé par un humain. Server Component: no client JavaScript.
 */
export function DossierJourneyRail({ entries, contactName, measured, testId = "dossier-rail" }: DossierJourneyRailProps) {
  const nodes = journeyRailNodes(buildDossierJourney(entries), measured);
  return <OperationalRail nodes={nodes} label={TEXTS.listLabel(contactName)} playback="stagger" testId={testId} />;
}
