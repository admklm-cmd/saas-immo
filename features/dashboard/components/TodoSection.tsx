import { APP_TEXTS } from "@/components/texts";

import type { DashboardTodo } from "../types";
import { AppointmentItem } from "./AppointmentItem";
import { InboundLeadItem } from "./InboundLeadItem";
import { MessageItem } from "./MessageItem";
import { TaskItem } from "./TaskItem";
import { TodoRow } from "./TodoRow";

const TEXTS = APP_TEXTS.dashboard;
const FOLLOW_THROUGH = { href: "/agents-ia/suivi-rendez-vous", label: TEXTS.followThroughLink };

/**
 * « À faire maintenant » — one panel, one row per kind of human decision.
 * Each row uses the same definition as the screen it links to, so the figure
 * matches what the user finds after the click.
 */
export function TodoSection({ todo }: { todo: DashboardTodo }) {
  return (
    <section aria-labelledby="dashboard-todo-title" data-testid="dashboard-todo">
      <div className="particle-veil w-fit max-w-full">
        <h2 id="dashboard-todo-title" className="text-section font-semibold text-ink">
          {TEXTS.todoTitle}
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">{TEXTS.todoSubtitle}</p>
      </div>

      <div className="stagger mt-5 divide-y divide-line rounded-2xl border border-line bg-surface shadow-subtle">
        <TodoRow
          id="messages"
          glyph="human"
          title={TEXTS.messagesTitle}
          hint={TEXTS.messagesHint}
          list={todo.messagesToValidate}
          unit={TEXTS.messagesUnit}
          emptyText={TEXTS.messagesEmpty}
          getKey={(item) => item.id}
          renderItem={(item) => <MessageItem item={item} />}
          link={{ href: "/agents-ia/a-valider", label: TEXTS.messagesLink }}
        />
        <TodoRow
          id="leads"
          glyph="lea"
          title={TEXTS.leadsTitle}
          list={todo.inboundLeadsToProcess}
          unit={TEXTS.leadsUnit}
          emptyText={TEXTS.leadsEmpty}
          getKey={(item) => item.id}
          renderItem={(item) => <InboundLeadItem item={item} />}
          link={{ href: "/agents-ia/leads-entrants", label: TEXTS.leadsLink }}
        />
        <TodoRow
          id="appointments-to-confirm"
          glyph="louis"
          title={TEXTS.toConfirmTitle}
          list={todo.appointmentsToConfirm}
          unit={TEXTS.toConfirmUnit}
          emptyText={TEXTS.toConfirmEmpty}
          getKey={(item) => item.id}
          renderItem={(item) => <AppointmentItem item={item} />}
          link={FOLLOW_THROUGH}
          sampleLabel={TEXTS.sampleFeminine}
        />
        <TodoRow
          id="appointments-to-close"
          glyph="sarah"
          title={TEXTS.toCloseTitle}
          list={todo.appointmentsToClose}
          unit={TEXTS.toCloseUnit}
          emptyText={TEXTS.toCloseEmpty}
          getKey={(item) => item.id}
          renderItem={(item) => <AppointmentItem item={item} />}
          link={FOLLOW_THROUGH}
        />
        <TodoRow
          id="tasks"
          glyph="tasks"
          title={TEXTS.tasksTitle}
          hint={TEXTS.tasksHint}
          list={todo.openTasks}
          unit={TEXTS.tasksUnit}
          emptyText={TEXTS.tasksEmpty}
          getKey={(item) => item.id}
          renderItem={(item) => <TaskItem item={item} />}
          link={{ href: "/taches", label: TEXTS.tasksLink }}
          sampleLabel={TEXTS.sampleFeminine}
        />
      </div>
    </section>
  );
}
