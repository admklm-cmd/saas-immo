import { APP_TEXTS } from "@/components/texts";
import { AGENT_ACTIVITY_TEXTS } from "@/lib/agents/messages";

const TEXTS = APP_TEXTS.agentsIa;

export type ActivityFigureProps = {
  /** Exact count read from the journal, or `null` when it could not be read. */
  runs: number | null;
  /** French name of the window the count covers ("aujourd'hui", "sur 7 jours"). */
  windowLabel: string;
  className?: string;
};

/**
 * A count of executions, ALWAYS with the window it was counted in.
 *
 * Two product rules are enforced here and nowhere else:
 *   1. a figure that could not be read shows "Indisponible" — never `0`, which
 *      would be a reassuring lie (CLAUDE.md: statistics come from the recorded
 *      data, or they are not shown);
 *   2. "12 exécutions" alone means nothing: the window is part of the fact.
 */
export function ActivityFigure({ runs, windowLabel, className }: ActivityFigureProps) {
  const known = typeof runs === "number" && Number.isFinite(runs);
  return (
    <span className={className} data-testid="activity-figure">
      {known ? TEXTS.runsLabel(runs, windowLabel) : AGENT_ACTIVITY_TEXTS.unknownFigure}
    </span>
  );
}
