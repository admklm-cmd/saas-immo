import { APP_TEXTS } from "@/components/texts";
import { Pagination } from "@/components/ui/Pagination";

import type { AppointmentsPage } from "../types";
import { appointmentsHref } from "./appointment-urls";
import { AppointmentRow } from "./AppointmentRow";

const TEXTS = APP_TEXTS.appointments;

/**
 * One page of estimation appointments, then the pagination. `now` (ms since
 * epoch, read once per request) decides « Clôturer » vs « Ouvrir dans le suivi ».
 */
export function AppointmentList({ page, now }: { page: AppointmentsPage; now: number }) {
  return (
    <>
      <section
        aria-labelledby="appointments-list-title"
        className="overflow-hidden rounded-xl border border-line bg-surface shadow-subtle"
      >
        <h2 id="appointments-list-title" className="sr-only">
          {TEXTS.listLabel[page.view]}
        </h2>
        <ul className="stagger divide-y divide-line" data-testid="appointment-list">
          {page.items.map((appointment) => (
            <li key={appointment.id}>
              <AppointmentRow appointment={appointment} now={now} />
            </li>
          ))}
        </ul>
      </section>
      <Pagination
        className="mt-5"
        testId="appointments-pagination"
        offset={page.offset}
        limit={page.limit}
        count={page.items.length}
        total={page.total}
        hasMore={page.hasMore}
        hrefFor={(offset) => appointmentsHref(page.view, offset)}
      />
    </>
  );
}
