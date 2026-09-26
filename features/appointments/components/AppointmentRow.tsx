import Link from "next/link";

import { formatDayParts, formatSlotWithYear } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { APPOINTMENT_STATUS_LABELS } from "@/features/contacts/types";

import type { AppointmentListItem } from "../types";
import { followThroughAction, type FollowThroughAction } from "./follow-through-action";

const TEXTS = APP_TEXTS.appointments;

const ACTION_LABELS: Record<FollowThroughAction, string> = {
  confirm: TEXTS.confirmInFollowThrough,
  close: TEXTS.closeInFollowThrough,
  open: TEXTS.openInFollowThrough,
};

const LINK_CLASS =
  "rounded-xs font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-150 ease-standard hover:decoration-ink";

/**
 * Status weight without colour: outlined when proposed, a check mark when
 * confirmed, dashed when cancelled. Never `solid` here: the black pill is the
 * « Simulation » badge right next to it, and the two must not read alike.
 */
const STATUS_TONES: Record<AppointmentListItem["status"], BadgeTone> = {
  proposed: "outline",
  confirmed: "neutral",
  done: "neutral",
  cancelled: "dashed",
};

/**
 * One estimation appointment: slot in Paris time, contact, readable status,
 * « Simulation » when no real calendar holds it, and — only when a human
 * action is really possible — a link to the follow-through screen. A
 * confirmed appointment still to come reads « Ouvrir dans le suivi »: it
 * cannot be closed before it has taken place.
 */
export function AppointmentRow({ appointment, now }: { appointment: AppointmentListItem; now: number }) {
  const parts = formatDayParts(appointment.startsAt);
  const kind = followThroughAction(appointment, now);
  const action = kind ? ACTION_LABELS[kind] : null;

  return (
    <article
      data-testid="appointment-row"
      data-appointment-id={appointment.id}
      className="flex gap-5 px-6 py-5"
    >
      <div
        aria-hidden="true"
        className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-surface-muted"
      >
        <span className="text-heading leading-none font-semibold text-ink figure">{parts?.day ?? "—"}</span>
        <span className="mt-1 text-overline font-semibold text-ink-subtle uppercase">{parts?.month ?? ""}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-ink first-letter:uppercase">
            <time dateTime={appointment.startsAt}>{formatSlotWithYear(appointment.startsAt, appointment.endsAt)}</time>
          </h3>
          <p className="mt-1.5 text-sm">
            <span className="sr-only">{TEXTS.contactPrefix} </span>
            <Link href={`/contacts/${encodeURIComponent(appointment.contactId)}`} className={LINK_CLASS}>
              {appointment.contactName}
            </Link>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONES[appointment.status]} icon={appointment.status === "confirmed" ? "✓" : undefined}>
              <span className="sr-only">{TEXTS.statusPrefix} </span>
              {APPOINTMENT_STATUS_LABELS[appointment.status]}
            </Badge>
            {appointment.isSimulation ? <SimulationBadge /> : null}
          </div>
        </div>

        {action ? (
          <Link
            href="/agents-ia/suivi-rendez-vous"
            data-testid="appointment-follow-through"
            data-action={kind ?? undefined}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xs text-sm font-medium text-ink underline-offset-4 transition-colors duration-150 ease-standard hover:text-ink-muted hover:underline"
          >
            {action}
            <span className="sr-only"> {TEXTS.actionFor(appointment.contactName)}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}
