import { formatDateTime } from "@/components/format";
import { APP_TEXTS, MEMBERSHIP_ROLE_LABELS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import {
  PIPELINE_STAGE_LABELS,
  TIMELINE_KIND_LABELS,
  type PipelineStage,
  type TimelineEntry,
} from "@/features/contacts/types";
import { AGENT_LABELS } from "@/lib/agents/messages";

const TEXTS = APP_TEXTS.contact;

/** Activity type written by the human stage change (`change_contact_stage`). */
const STAGE_CHANGE_TYPE = "contact_stage_changed";

/**
 * Who acted. A human stage change records the role of its author
 * (`meta.actor_role`): « Directeur » only when it says so — a missing or
 * unknown role keeps the neutral « Conseiller », never a guessed promotion.
 */
function actorLabel(entry: TimelineEntry): string | null {
  if (entry.actor.type === "ai_agent" && entry.actor.agent) return AGENT_LABELS[entry.actor.agent];
  if (entry.actor.type === "user") {
    const isDirector =
      entry.kind === "activity" && entry.meta.type === STAGE_CHANGE_TYPE && entry.meta.actor_role === "director";
    return isDirector ? MEMBERSHIP_ROLE_LABELS.director : MEMBERSHIP_ROLE_LABELS.agent;
  }
  return null;
}

function stageLabel(value: unknown): string | null {
  return typeof value === "string" && Object.hasOwn(PIPELINE_STAGE_LABELS, value)
    ? PIPELINE_STAGE_LABELS[value as PipelineStage]
    : null;
}

/**
 * A human stage change, read from its metadata: « Étape : X → Y » and the
 * motive (plain text, exactly as typed). Null when the entry is anything else
 * or its stages are unreadable — the stored summary is then shown instead.
 */
function stageChangeOf(entry: TimelineEntry): { title: string; reason: string | null } | null {
  if (entry.kind !== "activity" || entry.meta.type !== STAGE_CHANGE_TYPE) return null;
  const from = stageLabel(entry.meta.previous_stage);
  const to = stageLabel(entry.meta.stage);
  if (!from || !to) return null;
  const reason = typeof entry.meta.reason === "string" && entry.meta.reason.trim() ? entry.meta.reason : null;
  return { title: TEXTS.timelineStageChange(from, to), reason };
}

/** Chronological history of a contact, most recent first. */
export function ContactTimeline({ entries }: { entries: readonly TimelineEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title={TEXTS.timelineEmpty} />;
  }

  return (
    <ol data-testid="contact-timeline" className="relative flex flex-col">
      {entries.map((entry, index) => {
        const actor = actorLabel(entry);
        const stageChange = stageChangeOf(entry);
        return (
          <li key={`${entry.kind}-${entry.id}`} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical rail, purely decorative. */}
            {index < entries.length - 1 ? (
              <span aria-hidden="true" className="absolute top-4 bottom-0 left-[5px] w-px bg-line" />
            ) : null}
            <span
              aria-hidden="true"
              className="relative mt-1.5 size-2.5 shrink-0 rounded-full border border-ink bg-surface"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="outline">{TIMELINE_KIND_LABELS[entry.kind]}</Badge>
                {actor ? <Badge>{actor}</Badge> : null}
                {entry.isSimulation ? <SimulationBadge /> : null}
                <time
                  dateTime={entry.occurredAt}
                  className="ml-auto text-xs whitespace-nowrap text-ink-subtle"
                >
                  {formatDateTime(entry.occurredAt)}
                </time>
              </div>

              {stageChange ? (
                <>
                  <p className="mt-2 text-sm font-medium text-ink" data-testid="timeline-stage-change">
                    {stageChange.title}
                  </p>
                  {stageChange.reason ? (
                    <p className="mt-1 text-sm whitespace-pre-line text-ink-muted">
                      <span className="font-medium text-ink">{TEXTS.timelineStageReason} : </span>
                      {stageChange.reason}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm font-medium text-ink">{entry.title}</p>
              )}
              {!stageChange && entry.description ? (
                <p className="mt-1 text-sm whitespace-pre-line text-ink-muted">{entry.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
