// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formatSlotWithYear } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";

import type { AppointmentListItem } from "../types";
import { AppointmentRow } from "./AppointmentRow";

const TEXTS = APP_TEXTS.appointments;

afterEach(() => cleanup());

function appointment(overrides: Partial<AppointmentListItem> = {}): AppointmentListItem {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    contactId: "44444444-4444-4444-8444-444444444444",
    contactName: "Frederic Masson",
    status: "confirmed",
    startsAt: "2026-09-29T08:00:00.000Z",
    endsAt: "2026-09-29T09:00:00.000Z",
    isSimulation: true,
    canBeConfirmed: false,
    canBeCompleted: false,
    ...overrides,
  };
}

describe("AppointmentRow", () => {
  it("affiche le créneau en heure de Paris, le contact lié, le statut lisible et le badge Simulation", () => {
    const item = appointment();
    render(<AppointmentRow appointment={item} />);

    const row = screen.getByTestId("appointment-row");
    expect(row.textContent).toContain(formatSlotWithYear(item.startsAt, item.endsAt));
    // 08:00 UTC is 10:00 in Paris (summer time).
    expect(row.textContent).toContain("10:00 – 11:00");
    expect(within(row).getByRole("link", { name: "Frederic Masson" }).getAttribute("href")).toBe(
      `/contacts/${item.contactId}`,
    );
    expect(row.textContent).toContain(`${TEXTS.statusPrefix} Confirmé`);
    expect(within(row).getByText(APP_TEXTS.states.simulation)).toBeDefined();
  });

  it("n'affiche pas le badge Simulation sur un rendez-vous réel", () => {
    render(<AppointmentRow appointment={appointment({ isSimulation: false })} />);

    expect(screen.queryByText(APP_TEXTS.states.simulation)).toBeNull();
  });

  it("ne propose aucun lien vers le suivi quand aucune action n'est possible", () => {
    render(<AppointmentRow appointment={appointment({ status: "done" })} />);

    expect(screen.queryByTestId("appointment-follow-through")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("propose « Confirmer dans le suivi » quand le rendez-vous peut être confirmé", () => {
    render(<AppointmentRow appointment={appointment({ status: "proposed", canBeConfirmed: true })} />);

    const link = screen.getByTestId("appointment-follow-through");
    expect(link.getAttribute("href")).toBe("/agents-ia/suivi-rendez-vous");
    expect(link.textContent).toContain(TEXTS.confirmInFollowThrough);
    // Distinct accessible name per row.
    expect(link.textContent).toContain("Frederic Masson");
  });

  it("propose « Clôturer dans le suivi » quand le rendez-vous peut être clôturé", () => {
    render(<AppointmentRow appointment={appointment({ canBeCompleted: true })} />);

    expect(screen.getByTestId("appointment-follow-through").textContent).toContain(TEXTS.closeInFollowThrough);
  });
});
