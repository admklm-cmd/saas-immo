import { formatDateAtTime, formatDateTime } from "@/components/format";
import { APP_TEXTS, MEMBERSHIP_ROLE_LABELS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendingDots } from "@/components/ui/PendingDots";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { RunStatusBadge } from "@/features/agents-ia/components/RunStatusBadge";
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

function metaString(entry: TimelineEntry, key: string): string | null {
  const value = entry.meta[key];
  return typeof value === "string" && value.trim() ? value : null;
}

type Review = {
  outcome: "approved" | "rejected" | "pending";
  /** « Validé par x (Conseiller) », « Refusé », « En attente de validation humaine ». */
  lead: string;
  /** Raw stored timestamp and its Paris rendering; both null when absent or unreadable. */
  at: string | null;
  when: string | null;
  authorMissing: boolean;
};

/**
 * Human review of a message, read ONLY from what the server stamped on it
 * (`meta.review_outcome`, `validated_by_email`, `validated_by_role_label`,
 * `validated_at`). A missing author reads « Auteur non disponible » and a
 * missing time is simply not written: neither is ever deduced from another
 * event (not the send, not the date of the entry). Null for anything that is
 * not a message, or a message without review metadata.
 */
function reviewOf(entry: TimelineEntry): Review | null {
  if (entry.kind !== "message" || !Object.hasOwn(entry.meta, "review_outcome")) return null;
  const outcome = entry.meta.review_outcome;
  if (outcome === null) {
    return { outcome: "pending", lead: TEXTS.reviewPending, at: null, when: null, authorMissing: false };
  }
  if (outcome !== "approved" && outcome !== "rejected") return null;

  const email = metaString(entry, "validated_by_email");
  const role = metaString(entry, "validated_by_role_label");
  const stored = metaString(entry, "validated_at");
  const when = stored ? formatDateAtTime(stored) : null;

  const verb = outcome === "approved" ? TEXTS.reviewApproved : TEXTS.reviewRejected;
  const lead = email
    ? `${verb} ${TEXTS.reviewBy(role ? TEXTS.reviewAuthorWithRole(email, role) : email)}`
    : verb;
  return { outcome, lead, at: when ? stored : null, when, authorMissing: !email };
}

/** « Validé par x (Conseiller) le 23 sept. 2026 à 10:12 », as plain text. */
function ReviewLine({ review }: { review: Review }) {
  return (
    <p
      className="mt-2 flex items-start gap-2 text-xs text-ink-muted"
      data-testid="timeline-review"
      data-outcome={review.outcome}
    >
      {review.outcome === "pending" ? (
        // Waiting for a human decision: passive dots, the text says it.
        <span className="mt-1.5 flex shrink-0 text-ink-subtle">
          <PendingDots label={null} />
        </span>
      ) : (
        <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-ink" />
      )}
      <span className="min-w-0 break-words">
        <span className={review.outcome === "pending" ? undefined : "font-medium text-ink"}>{review.lead}</span>
        {review.when && review.at ? (
          <>
            {` ${TEXTS.reviewAtPrefix} `}
            <time dateTime={review.at}>{review.when}</time>
          </>
        ) : null}
        {review.authorMissing ? ` — ${TEXTS.reviewAuthorUnknown}` : null}
      </span>
    </p>
  );
}

/** Blocked or failed AI run: named explicitly, a guard rail is not an error. */
function runOutcomeOf(entry: TimelineEntry): "blocked" | "failed" | null {
  if (entry.kind !== "ai_run") return null;
  return entry.status === "blocked" || entry.status === "failed" ? entry.status : null;
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
        const review = reviewOf(entry);
        const runOutcome = runOutcomeOf(entry);
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
                {runOutcome ? <RunStatusBadge status={runOutcome} /> : null}
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
              {review ? <ReviewLine review={review} /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
