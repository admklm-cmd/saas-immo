// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import type { ContactListItem } from "@/features/contacts/types";

import { ContactsTable } from "./ContactsTable";
import { propertyParts } from "./property-summary";

const TEXTS = APP_TEXTS.contacts;
const NBSP = String.fromCharCode(0xa0);

function contactOf(overrides: Partial<ContactListItem> & Pick<ContactListItem, "id">): ContactListItem {
  return {
    firstName: "Nadia",
    lastName: "Perrin",
    displayName: "Nadia Perrin",
    email: "nadia.perrin@example.test",
    phone: "06 39 98 10 09",
    source: "website_form",
    stage: "qualifie",
    saleMotivation: null,
    saleTimeline: null,
    humanTakeover: false,
    assignedUserId: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:00:00.000Z",
    property: {
      id: "p1",
      property_type: "apartment",
      address: null,
      postal_code: null,
      city: "Saint-Cyr-sur-Mer",
      sector: "Saint-Cyr-sur-Mer — Les Lecques",
      surface_m2: 72,
      rooms: null,
    },
    openTasksCount: 0,
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("propertyParts", () => {
  it("keeps a surface and its unit together, and prefers the sector to the city", () => {
    const parts = propertyParts(contactOf({ id: "1" }));
    expect(parts?.what).toContain(`72${NBSP}m²`);
    expect(parts?.where).toBe("Saint-Cyr-sur-Mer — Les Lecques");
  });

  it("invents nothing when no property is attached", () => {
    expect(propertyParts(contactOf({ id: "1", property: null }))).toBeNull();
  });
});

describe("ContactsTable", () => {
  it("renders one table row per contact, each leading to its file", () => {
    render(<ContactsTable contacts={[contactOf({ id: "1" }), contactOf({ id: "2", displayName: "Marc Aubert" })]} />);

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[1]!).getByRole("link", { name: /Marc Aubert/ }).getAttribute("href")).toBe("/contacts/2");
  });

  it("uses the same stage badge as the pipeline", () => {
    render(<ContactsTable contacts={[contactOf({ id: "1", stage: "mandat_signe" })]} />);
    const row = within(screen.getByRole("table")).getAllByRole("row")[1]!;
    expect(row.querySelector("[data-stage]")?.getAttribute("data-stage")).toBe("mandat_signe");
  });

  it("shows the real states as shapes, with their words for screen readers", () => {
    render(<ContactsTable contacts={[contactOf({ id: "1", humanTakeover: true, openTasksCount: 2 })]} />);
    const row = within(screen.getByRole("table")).getAllByRole("row")[1]!;

    const takeover = row.querySelector('[data-mark="human-takeover"]');
    expect(takeover?.textContent).toBe(TEXTS.humanTakeover);
    expect(takeover?.getAttribute("title")).toBe(TEXTS.humanTakeover);
    const tasks = row.querySelector('[data-mark="open-tasks"]');
    expect(tasks?.textContent).toContain(TEXTS.openTasks(2));
  });

  it("draws no state mark when there is none", () => {
    render(<ContactsTable contacts={[contactOf({ id: "1" })]} />);
    const row = within(screen.getByRole("table")).getAllByRole("row")[1]!;
    expect(row.querySelector("[data-mark]")).toBeNull();
  });

  it("offers a readable list for phones, with the same contacts", () => {
    render(<ContactsTable contacts={[contactOf({ id: "1" }), contactOf({ id: "2", property: null })]} />);
    const list = screen.getByRole("list", { name: TEXTS.listLabel });
    const items = within(list).getAllByTestId("contact-list-item");
    expect(items).toHaveLength(2);
    expect(within(items[1]!).getByText(TEXTS.noProperty)).toBeDefined();
  });
});
