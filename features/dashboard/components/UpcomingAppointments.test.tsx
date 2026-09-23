// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formatSlot } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";

import { appointment, okList, SCOPES } from "./summary-fixture";
import { UpcomingAppointments } from "./UpcomingAppointments";

const TEXTS = APP_TEXTS.dashboard;

afterEach(() => cleanup());

describe("UpcomingAppointments", () => {
  it("affiche le total à venir, les prochains rendez-vous en heure de Paris, le contact et le statut", () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      appointment({ id: `a-${index}`, contactId: `c-${index}`, contactName: `Contact ${index}` }),
    );
    render(<UpcomingAppointments list={okList(SCOPES.upcoming, items, 8)} />);

    const card = screen.getByTestId("dashboard-upcoming");
    expect(within(card).getByRole("heading", { level: 2, name: TEXTS.upcomingTitle })).toBeDefined();
    expect(within(card).getByTestId("dashboard-figure").textContent).toContain("8");
    expect(card.textContent).toContain(TEXTS.scopes.upcoming);
    const first = items[0];
    if (!first) throw new Error("fixture");
    expect(card.textContent).toContain(formatSlot(first.startsAt, first.endsAt));
    expect(card.textContent).toContain("Confirmé");
    expect(within(card).getAllByText(APP_TEXTS.states.simulation)).toHaveLength(5);

    expect(within(card).getByRole("link", { name: /Contact 0/ }).getAttribute("href")).toBe("/contacts/c-0");
    expect(within(card).getByRole("link", { name: new RegExp(TEXTS.viewAll) }).getAttribute("href")).toBe(
      "/agents-ia/suivi-rendez-vous",
    );
  });

  it("affiche « Indisponible » si le calcul a échoué", () => {
    render(<UpcomingAppointments list={{ status: "unavailable", scope: SCOPES.upcoming }} />);

    const card = screen.getByTestId("dashboard-upcoming");
    expect(card.textContent).toContain(TEXTS.unavailable);
    expect(card.textContent).toContain(TEXTS.scopes.upcoming);
    expect(card.textContent).not.toContain(TEXTS.upcomingEmpty);
  });
});
