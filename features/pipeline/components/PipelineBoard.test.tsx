// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import type { ContactListItem } from "@/features/contacts/types";

import { PipelineBoard } from "./PipelineBoard";

vi.mock("@/features/pipeline/actions", () => ({ changeContactStage: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const TEXTS = APP_TEXTS.pipeline;
const CONTACT_TEXTS = APP_TEXTS.contacts;

function contactOf(overrides: Partial<ContactListItem> & Pick<ContactListItem, "id" | "stage">): ContactListItem {
  return {
    firstName: "Camille",
    lastName: "Berthier",
    displayName: "Camille Berthier",
    email: null,
    phone: null,
    source: "estimation_form",
    saleMotivation: null,
    saleTimeline: null,
    humanTakeover: false,
    assignedUserId: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:00:00.000Z",
    property: null,
    openTasksCount: 0,
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("PipelineBoard", () => {
  it("shows every active stage as a labelled column, even without a contact", () => {
    render(<PipelineBoard contacts={[]} />);

    expect(screen.getByRole("region", { name: "Nouveau" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Qualifié" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Chaud" })).toBeDefined();
    expect(screen.getByRole("region", { name: "RDV planifié" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Estimation faite" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Mandat signé" })).toBeDefined();
  });

  it("shows the suggested-empty message on a column with no contact", () => {
    render(<PipelineBoard contacts={[contactOf({ id: "1", stage: "nouveau" })]} />);

    const chaud = screen.getByRole("region", { name: "Chaud" });
    expect(within(chaud).getByText(TEXTS.columnEmpty)).toBeDefined();
  });

  it("routes a contact to its stage column and never invents a count elsewhere", () => {
    render(<PipelineBoard contacts={[contactOf({ id: "1", stage: "qualifie", displayName: "Marc Aubert" })]} />);

    const qualifie = screen.getByRole("region", { name: "Qualifié" });
    expect(within(qualifie).getByText("Marc Aubert")).toBeDefined();
    expect(within(qualifie).getByText(TEXTS.columnCount(1))).toBeDefined();

    const nouveau = screen.getByRole("region", { name: "Nouveau" });
    expect(within(nouveau).getByText(TEXTS.columnCount(0))).toBeDefined();
  });

  it("makes a human takeover visually identifiable on its card", () => {
    render(
      <PipelineBoard
        contacts={[contactOf({ id: "1", stage: "nouveau", displayName: "Amandine Roux", humanTakeover: true })]}
      />,
    );

    const card = screen.getByTestId("pipeline-contact");
    expect(within(card).getByText(CONTACT_TEXTS.humanTakeover)).toBeDefined();
  });

  it("shows the lost stage as its own, less prominent column, separate from the active ones", () => {
    render(<PipelineBoard contacts={[contactOf({ id: "1", stage: "perdu", displayName: "Damien Pons" })]} />);

    const lost = screen.getByRole("region", { name: "Perdu" });
    expect(within(lost).getByText("Damien Pons")).toBeDefined();
    expect(screen.getByText(TEXTS.lostSubtitle)).toBeDefined();
    // The lost column never joins the active grid of six.
    expect(screen.getAllByTestId(/^pipeline-column-/)).toHaveLength(7);
  });
});

describe("PipelineBoard — stage change entry point", () => {
  it("gives every card a link to the file AND a separate « Changer d'étape » button, never nested", () => {
    render(<PipelineBoard contacts={[contactOf({ id: "1", stage: "chaud", displayName: "Olivier Sanchez" })]} />);

    const card = screen.getByTestId("pipeline-contact");
    const link = within(card).getByRole("link", { name: /Olivier Sanchez/ });
    const trigger = within(card).getByRole("button", { name: new RegExp(TEXTS.stageChange.trigger) });
    expect(link.contains(trigger)).toBe(false);
    expect(link.getAttribute("href")).toBe("/contacts/1");
  });
});
