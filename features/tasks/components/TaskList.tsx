import { APP_TEXTS } from "@/components/texts";
import { Pagination } from "@/components/ui/Pagination";

import type { OpenTasksPage } from "../types";
import { TaskCompletionProvider } from "./TaskCompletionProvider";
import { TaskRow } from "./TaskRow";
import { tasksHref } from "./task-urls";

const TEXTS = APP_TEXTS.tasks;

/** One page of open tasks, the completion live region, then the pagination. */
export function TaskList({ page }: { page: OpenTasksPage }) {
  return (
    <TaskCompletionProvider>
      <section
        aria-labelledby="tasks-list-title"
        className="overflow-hidden rounded-xl border border-line bg-surface shadow-subtle"
      >
        <h2 id="tasks-list-title" className="sr-only">
          {TEXTS.listLabel}
        </h2>
        <ul className="divide-y divide-line stagger" data-testid="task-list">
          {page.items.map((task) => (
            <li key={task.id}>
              <TaskRow task={task} />
            </li>
          ))}
        </ul>
      </section>
      <Pagination
        className="mt-5"
        testId="tasks-pagination"
        offset={page.offset}
        limit={page.limit}
        count={page.items.length}
        total={page.total}
        hasMore={page.hasMore}
        hrefFor={(offset) => tasksHref(page.scope, offset)}
      />
    </TaskCompletionProvider>
  );
}
