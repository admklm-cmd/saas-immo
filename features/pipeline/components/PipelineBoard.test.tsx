// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { PIPELINE_STAGE_LABELS, type ContactListItem } from "@/features/contacts/types";

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

/** The figure and its unit, as read in the column header (« 2 dossiers »). */
function countOf(column: HTMLElement): string | null {
  return within(column).getByTestId("pipeline-column-count").textContent;
}

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
    expect(countOf(qualifie)).toBe(TEXTS.columnCount(1));

    const nouveau = screen.getByRole("region", { name: "Nouveau" });
    expect(countOf(nouveau)).toBe(TEXTS.columnCount(0));
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
    expect(screen.getAllByTestId(/^pipeline-column-(?!count$)/)).toHaveLength(7);
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

describe("PipelineBoard — one line, left to right", () => {
  const STAGES = ["nouveau", "qualifie", "chaud", "rdv_planifie", "estimation_faite", "mandat_signe"] as const;

  it("puts the six active stages in ONE focusable, named scroller, in the order of the journey", () => {
    render(<PipelineBoard contacts={[]} />);

    const scroller = screen.getByRole("region", { name: TEXTS.boardLabel });
    expect(scroller.getAttribute("tabindex")).toBe("0");
    const columns = Array.from(scroller.querySelectorAll("[data-pipeline-column]"));
    expect(columns.map((column) => column.getAttribute("data-pipeline-column"))).toEqual([...STAGES]);
    // All six are siblings of the same track: one row, never a wrapped grid.
    expect(new Set(columns.map((column) => column.parentElement)).size).toBe(1);
    // The board name never contains a stage label (Playwright matches names by substring).
    for (const stage of STAGES) expect(TEXTS.boardLabel).not.toContain(PIPELINE_STAGE_LABELS[stage]);
  });

  it("keeps « Perdu » out of the line", () => {
    render(<PipelineBoard contacts={[contactOf({ id: "1", stage: "perdu", displayName: "Damien Pons" })]} />);

    const scroller = screen.getByRole("region", { name: TEXTS.boardLabel });
    const lost = screen.getByRole("region", { name: "Perdu" });
    expect(scroller.contains(lost)).toBe(false);
  });

  it("writes each column's exact count, and the map of the stages says the same", () => {
    render(
      <PipelineBoard
        contacts={[
          contactOf({ id: "1", stage: "chaud" }),
          contactOf({ id: "2", stage: "chaud" }),
          contactOf({ id: "3", stage: "mandat_signe" }),
        ]}
      />,
    );

    expect(countOf(screen.getByRole("region", { name: "Chaud" }))).toBe(TEXTS.columnCount(2));
    expect(countOf(screen.getByRole("region", { name: "Mandat signé" }))).toBe(TEXTS.columnCount(1));
    expect(countOf(screen.getByRole("region", { name: "Qualifié" }))).toBe(TEXTS.columnCount(0));

    const map = screen.getByRole("navigation", { name: TEXTS.stageNavLabel });
    const links = within(map).getAllByRole("link");
    expect(links).toHaveLength(7);
    expect(links[2]?.textContent).toContain(TEXTS.columnCount(2));
    expect(links[2]?.getAttribute("href")).toBe("#etape-chaud");
    expect(links[5]?.textContent).toContain(TEXTS.columnCount(1));
  });

  it("ends the line with the mandate, confirmed by a human", () => {
    render(<PipelineBoard contacts={[]} />);
    const mandate = screen.getByRole("region", { name: "Mandat signé" });
    expect(within(mandate).getByText(APP_TEXTS.dashboard.friezeMandateNote)).toBeDefined();
  });

  it("puts every word of a column header, and every label of the stage map, under a TIGHT veil", () => {
    render(<PipelineBoard contacts={[]} />);
    const tight = (element: Element | null) =>
      element?.closest(".particle-veil")?.classList.contains("particle-veil-tight") ?? false;

    // The six active columns (« Perdu » is its own opaque lane: nothing to veil).
    const active = screen
      .getAllByRole("region")
      .filter((region) => region.hasAttribute("data-pipeline-column") && region.dataset.pipelineColumn !== "perdu");
    expect(active).toHaveLength(6);
    for (const column of active) {
      const heading = within(column).getByRole("heading", { level: 2 });
      expect(tight(heading), heading.textContent ?? "").toBe(true);
      expect(tight(within(column).getByTestId("pipeline-column-count"))).toBe(true);
      // The veil is sized to the words, never to the whole column.
      expect(heading.closest(".particle-veil")?.classList.contains("w-fit")).toBe(true);
    }
    const mandate = screen.getByRole("region", { name: "Mandat signé" });
    expect(tight(within(mandate).getByText(APP_TEXTS.dashboard.friezeMandateNote))).toBe(true);

    const map = screen.getByRole("navigation", { name: TEXTS.stageNavLabel });
    for (const link of within(map).getAllByRole("link")) {
      const veil = link.querySelector(".particle-veil");
      expect(veil?.classList.contains("particle-veil-tight"), link.textContent ?? "").toBe(true);
      // The veil holds the visible words and count (the sr-only suffix follows it),
      // never the decorative bar.
      expect(veil?.textContent).toBeTruthy();
      expect(link.textContent?.startsWith(veil?.textContent ?? "∅")).toBe(true);
      expect(veil?.querySelector(".sr-only")).toBeNull();
    }
  });

  it("gives every card a discreet « Changer d'étape » control, named after the contact", () => {
    render(<PipelineBoard contacts={[contactOf({ id: "1", stage: "chaud", displayName: "Olivier Sanchez" })]} />);

    const trigger = screen.getByRole("button", {
      name: `${TEXTS.stageChange.trigger} ${TEXTS.stageChange.triggerFor("Olivier Sanchez")}`,
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the open tasks and the human takeover written on the card", () => {
    render(
      <PipelineBoard
        contacts={[contactOf({ id: "1", stage: "nouveau", humanTakeover: true, openTasksCount: 1 })]}
      />,
    );
    const card = screen.getByTestId("pipeline-contact");
    expect(within(card).getByText(CONTACT_TEXTS.openTasks(1))).toBeDefined();
    expect(within(card).getByText(CONTACT_TEXTS.humanTakeover)).toBeDefined();
  });
});
