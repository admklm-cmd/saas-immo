import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { TIMELINE_KIND_LABELS, type TimelineEntry } from "@/features/contacts/types";
import { AGENT_LABELS } from "@/lib/agents/messages";

const TEXTS = APP_TEXTS.contact;

function actorLabel(entry: TimelineEntry): string | null {
  if (entry.actor.type === "ai_agent" && entry.actor.agent) return AGENT_LABELS[entry.actor.agent];
  if (entry.actor.type === "user") return "Conseiller";
  return null;
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

              <p className="mt-2 text-sm font-medium text-ink">{entry.title}</p>
              {entry.description ? (
                <p className="mt-1 text-sm whitespace-pre-line text-ink-muted">{entry.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
