// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { APPOINTMENT_LIST_ERROR_MESSAGES, type AppointmentListItem, type AppointmentsPage } from "@/features/appointments/types";

/**
 * The `/rendez-vous` screen, assembled from `getAppointments()`: URL tabs,
 * exact total with its scope, list, pagination, empty and error states.
 */

vi.mock("@/features/appointments/queries", () => ({ getAppointments: vi.fn() }));

const { getAppointments } = await import("@/features/appointments/queries");
const AppointmentsPage = (await import("./page")).default;

const TEXTS = APP_TEXTS.appointments;

afterEach(() => cleanup());

function item(index: number, overrides: Partial<AppointmentListItem> = {}): AppointmentListItem {
  return {
    id: `00000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`,
    contactId: `10000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`,
    contactName: `Contact ${index}`,
    status: "proposed",
    startsAt: "2026-09-29T08:00:00.000Z",
    endsAt: "2026-09-29T09:00:00.000Z",
    isSimulation: true,
    canBeConfirmed: false,
    canBeCompleted: false,
    ...overrides,
  };
}

function page(overrides: Partial<AppointmentsPage> = {}): AppointmentsPage {
  const items = overrides.items ?? [item(0)];
  return {
    items,
    total: items.length,
    limit: 25,
    offset: 0,
    hasMore: false,
    generatedAt: "2026-09-23T10:00:00.000Z",
    view: "upcoming",
    timeZone: "Europe/Paris",
    ...overrides,
  };
}

async function renderPage(params: Record<string, string> = {}) {
  render(await AppointmentsPage({ searchParams: Promise.resolve(params) }));
}

function tabs() {
  return screen.getByRole("navigation", { name: TEXTS.viewsLabel });
}

describe("Écran Rendez-vous d'estimation", () => {
  it("affiche « À venir » par défaut, le total exact avec son périmètre et la pagination", async () => {
    const items = Array.from({ length: 25 }, (_, index) => item(index));
    vi.mocked(getAppointments).mockResolvedValue({ data: page({ items, total: 30, hasMore: true }), error: null });

    await renderPage();

    expect(getAppointments).toHaveBeenCalledWith({});
    expect(screen.getByRole("heading", { level: 1, name: TEXTS.title })).toBeDefined();
    expect(within(tabs()).getByRole("link", { current: "page" }).textContent).toBe(TEXTS.views.upcoming);
    expect(within(tabs()).getByRole("link", { name: TEXTS.views.past }).getAttribute("href")).toBe(
      "/rendez-vous?view=past",
    );
    expect(screen.getByTestId("appointments-total-value").textContent).toBe("30");
    expect(screen.getByTestId("appointments-total").textContent).toContain(TEXTS.scopes.upcoming);
    expect(screen.getAllByTestId("appointment-row")).toHaveLength(25);
    expect(screen.getByTestId("appointments-pagination").textContent).toContain("1–25 sur 30");
    expect(
      within(screen.getByTestId("appointments-pagination"))
        .getByRole("link", { name: new RegExp(APP_TEXTS.pagination.next) })
        .getAttribute("href"),
    ).toBe("/rendez-vous?offset=25");
  });

  it("onglet « Passés » : périmètre annoncé et lien de suivi seulement si une action est possible", async () => {
    vi.mocked(getAppointments).mockResolvedValue({
      data: page({
        view: "past",
        items: [item(1, { status: "done" }), item(2, { status: "confirmed", canBeCompleted: true })],
      }),
      error: null,
    });

    await renderPage({ view: "past" });

    expect(getAppointments).toHaveBeenCalledWith({ view: "past" });
    expect(within(tabs()).getByRole("link", { current: "page" }).textContent).toBe(TEXTS.views.past);
    expect(screen.getByTestId("appointments-total").textContent).toContain(TEXTS.scopes.past);
    expect(screen.getAllByTestId("appointment-follow-through")).toHaveLength(1);
  });

  it("propose une action utile quand il n'y a aucun rendez-vous", async () => {
    vi.mocked(getAppointments).mockResolvedValue({ data: page({ items: [], total: 0 }), error: null });

    await renderPage();

    expect(screen.getByText(TEXTS.emptyTitles.upcoming)).toBeDefined();
    expect(screen.getByRole("link", { name: TEXTS.emptyAction }).getAttribute("href")).toBe("/contacts");
  });

  it("affiche l'erreur du serveur telle quelle, avec un retour à la vue par défaut", async () => {
    vi.mocked(getAppointments).mockResolvedValue({
      data: null,
      error: {
        code: "invalid_appointment_filter",
        message: APPOINTMENT_LIST_ERROR_MESSAGES.invalid_appointment_filter,
      },
    });

    await renderPage({ view: "demain" });

    const alert = screen.getByTestId("appointments-error");
    expect(alert.textContent).toContain(APPOINTMENT_LIST_ERROR_MESSAGES.invalid_appointment_filter);
    expect(within(alert).getByRole("link", { name: TEXTS.resetFilters }).getAttribute("href")).toBe("/rendez-vous");
    expect(within(tabs()).queryByRole("link", { current: "page" })).toBeNull();
  });
});
