import Link from "next/link";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { AGENT_LABELS } from "@/lib/agents/messages";

import type { OpenTaskItem } from "../types";
import { CompleteTaskButton } from "./CompleteTaskButton";

const TEXTS = APP_TEXTS.tasks;

const LINK_CLASS =
  "rounded-xs font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-150 ease-standard hover:decoration-ink";

/**
 * One open task. Server Component: only the button is interactive.
 *
 * The title is rendered as plain text. « En retard » is a written badge next
 * to the due date (never a colour alone), and an agency-level task says so
 * instead of showing an empty contact.
 */
export function TaskRow({ task }: { task: OpenTaskItem }) {
  return (
    <article
      data-testid="task-row"
      data-task-id={task.id}
      className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-medium break-words text-ink">{task.title}</h3>

        <p className="mt-1.5 text-sm">
          <span className="sr-only">{TEXTS.contactPrefix} </span>
          {task.contactId && task.contactName ? (
            <Link href={`/contacts/${encodeURIComponent(task.contactId)}`} className={LINK_CLASS}>
              {task.contactName}
            </Link>
          ) : (
            <span className="text-ink-subtle">{TEXTS.agencyTask}</span>
          )}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-muted">
          {task.isOverdue ? (
            <Badge tone="solid" icon="!">
              {TEXTS.overdue}
            </Badge>
          ) : null}
          {task.dueAt ? (
            <span data-testid="task-due">
              <time dateTime={task.dueAt}>{TEXTS.dueAt(formatDateTime(task.dueAt))}</time>
            </span>
          ) : (
            <span data-testid="task-due">{TEXTS.noDueDate}</span>
          )}
          {task.createdByAgent ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{TEXTS.openedBy(AGENT_LABELS[task.createdByAgent])}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="shrink-0">
        <CompleteTaskButton taskId={task.id} taskTitle={task.title} />
      </div>
    </article>
  );
}
