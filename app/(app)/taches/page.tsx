import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { ListTotal } from "@/components/ui/ListTotal";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaskList } from "@/features/tasks/components/TaskList";
import { tasksHref } from "@/features/tasks/components/task-urls";
import { getOpenTasks } from "@/features/tasks/queries";
import { TASK_SCOPES, type OpenTasksInput, type OpenTasksPage, type TaskScope } from "@/features/tasks/types";

const TEXTS = APP_TEXTS.tasks;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Filters exactly as the browser sent them. They are NOT cleaned up here: an
 * unknown scope or a nonsense offset is refused by the server-side schema, so
 * the screen never shows a list that does not match the filter it displays.
 */
function toInput(scope: string, offset: string): OpenTasksInput {
  const input: Record<string, string> = {};
  if (scope) input.scope = scope;
  if (offset) input.offset = offset;
  return input as unknown as OpenTasksInput;
}

function isTaskScope(value: string): value is TaskScope {
  return (TASK_SCOPES as readonly string[]).includes(value);
}

/**
 * `/taches` — the agency's open tasks, with the EXACT total of the chosen
 * filter. « Toutes » counts the same rows as the dashboard's « Tâches
 * ouvertes ». A task is closed with « Marquer comme faite » (server action
 * `completeTask`); it then leaves the list.
 */
export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rawScope = first(params.scope);
  const { data: page, error } = await getOpenTasks(toInput(rawScope, first(params.offset)));
  const selected: TaskScope | null = rawScope === "" ? "all" : isTaskScope(rawScope) ? rawScope : null;

  return (
    <div className="page-frame page-frame-reading">
      <PageHeader title={TEXTS.title} description={TEXTS.subtitle} />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        {page ? (
          <ListTotal
            testId="tasks-total"
            total={page.total}
            unit={TEXTS.unit}
            scope={TEXTS.scopes[page.scope]}
          />
        ) : null}
        <LinkTabs
          label={TEXTS.filtersLabel}
          testId="tasks-filters"
          tabs={TASK_SCOPES.map((scope) => ({
            key: scope,
            href: tasksHref(scope),
            label: TEXTS.filters[scope],
            current: scope === (page?.scope ?? selected),
          }))}
        />
      </div>

      <div className="mt-6">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            testId="tasks-error"
            action={
              <ButtonLink href="/taches" variant="secondary" size="sm">
                {selected === "all" ? APP_TEXTS.states.retry : TEXTS.resetFilters}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : (
          <TasksContent page={page} />
        )}
      </div>
    </div>
  );
}

function TasksContent({ page }: { page: OpenTasksPage }) {
  if (page.items.length > 0) return <TaskList page={page} />;

  // A page past the end (the list shrank since the link was built) is not
  // « no task at all »: say so and offer the first page.
  if (page.total > 0) {
    return (
      <EmptyState
        title={TEXTS.pastEndTitle}
        description={TEXTS.pastEndBody}
        action={
          <ButtonLink href={tasksHref(page.scope)} variant="secondary">
            {TEXTS.pastEndAction}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <EmptyState
      title={TEXTS.emptyTitles[page.scope]}
      description={TEXTS.emptyBodies[page.scope]}
      action={
        page.scope === "all" ? (
          <ButtonLink href="/contacts" variant="secondary">
            {TEXTS.emptyAction}
          </ButtonLink>
        ) : (
          <ButtonLink href="/taches" variant="secondary">
            {TEXTS.emptyActionOtherScope}
          </ButtonLink>
        )
      }
    />
  );
}
