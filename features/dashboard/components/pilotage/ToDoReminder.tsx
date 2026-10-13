import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/components/ui/cn";

import type { DashboardTodo } from "../../types";

const TEXTS = APP_TEXTS.dashboard.pilotage;
const REMINDER = TEXTS.reminder;

type Count = number | null;

function totalOf(list: { status: "ok"; value: { total: number } } | { status: "unavailable" }): Count {
  return list.status === "ok" ? list.value.total : null;
}

/** Appointments waiting for a human decision: to confirm, plus to close. `null` unless both were counted. */
export function appointmentsWaiting(todo: DashboardTodo): Count {
  const toConfirm = totalOf(todo.appointmentsToConfirm);
  const toClose = totalOf(todo.appointmentsToClose);
  return toConfirm === null || toClose === null ? null : toConfirm + toClose;
}

const linkClass =
  "ui-focus inline-flex min-h-11 items-center gap-1.5 rounded-xs text-sm text-ink-muted underline-offset-4 hover:underline lg:min-h-9";

function Item({ href, count, label, testId }: { href: string; count: Count; label: string; testId: string }) {
  return (
    <li className="flex-none snap-start">
      <Link href={href} data-testid={testId} className={linkClass}>
        <span className="figure font-medium text-ink">{count === null ? REMINDER.unavailable : count}</span>
        <span>{label}</span>
      </Link>
    </li>
  );
}

export type ToDoReminderProps = { todo: DashboardTodo };

/**
 * « À traiter » (docs §3.5.2.C): the decisions that wait for a person, as three links (a
 * fourth only when a slot is waiting for confirmation). It replaces the lists of the old
 * dashboard: the work happens on the screens these links open. A count that could not be
 * computed reads « Indisponible », never 0, and does not hide the others.
 */
export function ToDoReminder({ todo }: ToDoReminderProps) {
  const messages = totalOf(todo.messagesToValidate);
  const leads = totalOf(todo.inboundLeadsToProcess);
  const tasks = totalOf(todo.openTasks);
  const appointments = appointmentsWaiting(todo);

  return (
    <nav aria-label={REMINDER.label} data-testid="todo-reminder" className="particle-veil particle-veil-tight min-w-0">
      <ul className="flex snap-x items-center gap-x-5 overflow-x-auto pb-1 lg:justify-end lg:overflow-visible lg:pb-0 [&>li+li]:border-l [&>li+li]:border-line [&>li+li]:pl-5">
        <li className="flex-none snap-start">
          {messages !== null && messages > 0 ? (
            <ButtonLink href="/agents-ia/a-valider" variant="primary" size="sm" arrow="forward" data-testid="dashboard-primary-action">
              <span className="figure">{messages}</span> {REMINDER.messages(messages)}
            </ButtonLink>
          ) : (
            <Link href="/agents-ia/a-valider" data-testid="dashboard-primary-action" className={cn(linkClass, "text-ink-subtle")}>
              {messages === null ? (
                <>
                  <span className="figure font-medium text-ink">{REMINDER.unavailable}</span> {REMINDER.messages(2)}
                </>
              ) : (
                REMINDER.messagesNone
              )}
            </Link>
          )}
        </li>
        <Item href="/agents-ia/leads-entrants" count={leads} label={leads === null ? REMINDER.leads(2) : REMINDER.leads(leads)} testId="todo-leads" />
        <Item href="/taches" count={tasks} label={tasks === null ? REMINDER.tasks(2) : REMINDER.tasks(tasks)} testId="todo-tasks" />
        {appointments !== null && appointments > 0 ? (
          <Item href="/agents-ia/suivi-rendez-vous" count={appointments} label={REMINDER.appointments()} testId="todo-appointments" />
        ) : null}
      </ul>
    </nav>
  );
}
