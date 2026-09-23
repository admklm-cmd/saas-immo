import { APP_TEXTS } from "@/components/texts";

import type { DashboardTodo } from "../types";
import { ActionListCard } from "./ActionListCard";
import { AppointmentItem } from "./AppointmentItem";
import { InboundLeadItem } from "./InboundLeadItem";
import { MessageItem } from "./MessageItem";
import { TaskItem } from "./TaskItem";

const TEXTS = APP_TEXTS.dashboard;
const FOLLOW_THROUGH = { href: "/agents-ia/suivi-rendez-vous", label: TEXTS.followThroughLink };

/**
 * « À faire maintenant » — first block of the screen. Each card uses the same
 * definition as the screen it links to, so the figure matches what the user
 * finds after the click.
 */
export function TodoSection({ todo }: { todo: DashboardTodo }) {
  return (
    <section aria-labelledby="dashboard-todo-title" data-testid="dashboard-todo">
      <h2 id="dashboard-todo-title" className="text-heading font-semibold text-ink">
        {TEXTS.todoTitle}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{TEXTS.todoSubtitle}</p>

      {/* Row gap carried by each card (mb-6) so the subgrid tracks stay tight. */}
      <div className="stagger mt-5 -mb-6 grid gap-x-6 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
        <ActionListCard
          layout="subgrid"
          id="messages"
          title={TEXTS.messagesTitle}
          hint={TEXTS.messagesHint}
          list={todo.messagesToValidate}
          unit={TEXTS.messagesUnit}
          emptyText={TEXTS.messagesEmpty}
          getKey={(item) => item.id}
          renderItem={(item) => <MessageItem item={item} />}
          link={{ href: "/agents-ia/a-valider", label: TEXTS.messagesLink }}
        />
        <ActionListCard
          layout="subgrid"
          id="leads"
          title={TEXTS.leadsTitle}
          list={todo.inboundLeadsToProcess}
          unit={TEXTS.leadsUnit}
          emptyText={TEXTS.leadsEmpty}
          getKey={(item) => item.id}
          renderItem={(item) => <InboundLeadItem item={item} />}
          link={{ href: "/agents-ia/leads-entrants", label: TEXTS.leadsLink }}
        />
        <ActionListCard
          layout="subgrid"
          id="tasks"
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
        <ActionListCard
          layout="subgrid"
          id="appointments-to-confirm"
          title={TEXTS.toConfirmTitle}
          list={todo.appointmentsToConfirm}
          unit={TEXTS.toConfirmUnit}
          emptyText={TEXTS.toConfirmEmpty}
          getKey={(item) => item.id}
          renderItem={(item) => <AppointmentItem item={item} />}
          link={FOLLOW_THROUGH}
          sampleLabel={TEXTS.sampleFeminine}
        />
        <ActionListCard
          layout="subgrid"
          id="appointments-to-close"
          title={TEXTS.toCloseTitle}
          list={todo.appointmentsToClose}
          unit={TEXTS.toCloseUnit}
          emptyText={TEXTS.toCloseEmpty}
          getKey={(item) => item.id}
          renderItem={(item) => <AppointmentItem item={item} />}
          link={FOLLOW_THROUGH}
        />
      </div>
    </section>
  );
}
