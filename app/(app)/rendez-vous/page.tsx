import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { ListTotal } from "@/components/ui/ListTotal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { appointmentsHref } from "@/features/appointments/components/appointment-urls";
import { AppointmentList } from "@/features/appointments/components/AppointmentList";
import { getAppointments } from "@/features/appointments/queries";
import {
  APPOINTMENT_VIEWS,
  type AppointmentsInput,
  type AppointmentsPage,
  type AppointmentView,
} from "@/features/appointments/types";

const TEXTS = APP_TEXTS.appointments;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** URL parameters as sent: an unknown view or offset is refused by the server schema. */
function toInput(view: string, offset: string): AppointmentsInput {
  const input: Record<string, string> = {};
  if (view) input.view = view;
  if (offset) input.offset = offset;
  return input as unknown as AppointmentsInput;
}

function isView(value: string): value is AppointmentView {
  return (APPOINTMENT_VIEWS as readonly string[]).includes(value);
}

/**
 * `/rendez-vous` — the agency's estimation appointments, « À venir » or
 * « Passés », with the EXACT total of the view. « À venir » is the same
 * definition as the dashboard's « Prochains rendez-vous ». Confirming and
 * closing stay on `/agents-ia/suivi-rendez-vous`: this screen links there only
 * when an action is really possible.
 */
export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rawView = first(params.view);
  const { data: page, error } = await getAppointments(toInput(rawView, first(params.offset)));
  const selected: AppointmentView | null = rawView === "" ? "upcoming" : isView(rawView) ? rawView : null;

  return (
    <div className="page-frame page-frame-reading">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={<SimulationBadge />}
        actions={
          <ButtonLink href="/agents-ia/suivi-rendez-vous" variant="primary" arrow="forward" data-testid="appointments-primary-action">
            {TEXTS.primaryAction}
          </ButtonLink>
        }
      />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        {page ? (
          <ListTotal
            testId="appointments-total"
            total={page.total}
            unit={TEXTS.unit}
            scope={TEXTS.scopes[page.view]}
          />
        ) : null}
        <LinkTabs
          label={TEXTS.viewsLabel}
          testId="appointments-views"
          tabs={APPOINTMENT_VIEWS.map((view) => ({
            key: view,
            href: appointmentsHref(view),
            label: TEXTS.views[view],
            current: view === (page?.view ?? selected),
          }))}
        />
      </div>

      <div className="mt-6">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            testId="appointments-error"
            action={
              <ButtonLink href="/rendez-vous" variant="secondary" size="sm">
                {selected === "upcoming" ? APP_TEXTS.states.retry : TEXTS.resetFilters}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : (
          <AppointmentsContent page={page} />
        )}
      </div>
    </div>
  );
}

/** Read once per request, outside any render, so every row compares with the same instant. */
function requestTime(): number {
  return Date.now();
}

function AppointmentsContent({ page }: { page: AppointmentsPage }) {
  if (page.items.length > 0) return <AppointmentList page={page} now={requestTime()} />;

  if (page.total > 0) {
    return (
      <EmptyState
        title={TEXTS.pastEndTitle}
        description={TEXTS.pastEndBody}
        action={
          <ButtonLink href={appointmentsHref(page.view)} variant="secondary">
            {TEXTS.pastEndAction}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <EmptyState
      title={TEXTS.emptyTitles[page.view]}
      description={TEXTS.emptyBodies[page.view]}
      action={
        <ButtonLink href="/contacts" variant="secondary">
          {TEXTS.emptyAction}
        </ButtonLink>
      }
    />
  );
}
