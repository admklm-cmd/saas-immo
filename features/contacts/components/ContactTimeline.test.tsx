// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import type { TimelineEntry } from "@/features/contacts/types";

import { ContactTimeline } from "./ContactTimeline";

afterEach(() => {
  cleanup();
});

function entry(overrides: Partial<TimelineEntry> & Pick<TimelineEntry, "id">): TimelineEntry {
  return {
    kind: "activity",
    occurredAt: "2026-09-14T08:30:00.000Z",
    title: "Événement",
    description: null,
    isSimulation: false,
    actor: { type: "system", agent: null, userId: null },
    status: null,
    meta: {},
    ...overrides,
  };
}

describe("ContactTimeline", () => {
  it("offers an empty state instead of a blank area", () => {
    render(<ContactTimeline entries={[]} />);
    expect(screen.getByText(APP_TEXTS.contact.timelineEmpty)).toBeDefined();
  });

  it("badges simulated entries, and only those", () => {
    render(
      <ContactTimeline
        entries={[
          entry({
            id: "1",
            kind: "message",
            title: "Email — À valider",
            isSimulation: true,
            actor: { type: "ai_agent", agent: "louis", userId: null },
          }),
          entry({ id: "2", kind: "task", title: "Tâche — À faire", isSimulation: false }),
        ]}
      />,
    );

    // Product guard rail: a simulated action must never look like a real send.
    expect(screen.getAllByText(APP_TEXTS.states.simulation)).toHaveLength(1);
    expect(screen.getByText("Louis")).toBeDefined();
  });

  it("renders one list item per entry, with a machine-readable date", () => {
    const { container } = render(
      <ContactTimeline
        entries={[
          entry({ id: "1", occurredAt: "2026-09-14T08:30:00.000Z" }),
          entry({ id: "2", occurredAt: "2026-09-13T08:30:00.000Z" }),
          entry({ id: "3", occurredAt: "2026-09-12T08:30:00.000Z" }),
        ]}
      />,
    );

    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-14T08:30:00.000Z");
  });
});

describe("ContactTimeline — human stage change", () => {
  it("reads « Étape : X → Y », shows the motive as plain text and never a simulation badge", () => {
    render(
      <ContactTimeline
        entries={[
          entry({
            id: "1",
            title: "Dossier sorti de « Mandat signé » par un directeur (→ Estimation faite). Motif : <b>annulé</b>",
            actor: { type: "user", agent: null, userId: "u1" },
            meta: {
              type: "contact_stage_changed",
              previous_stage: "mandat_signe",
              stage: "estimation_faite",
              reason: "<b>annulé</b> par le vendeur",
            },
          }),
          entry({
            id: "2",
            actor: { type: "user", agent: null, userId: "u1" },
            meta: { type: "contact_stage_changed", previous_stage: "chaud", stage: "mandat_signe", reason: null },
          }),
        ]}
      />,
    );

    const changes = screen.getAllByTestId("timeline-stage-change");
    expect(changes.map((node) => node.textContent)).toEqual([
      APP_TEXTS.contact.timelineStageChange("Mandat signé", "Estimation faite"),
      APP_TEXTS.contact.timelineStageChange("Chaud", "Mandat signé"),
    ]);
    // Rendered as text, never as markup.
    expect(screen.getByText(/<b>annulé<\/b> par le vendeur/)).toBeDefined();
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getAllByText(new RegExp(`^${APP_TEXTS.contact.timelineStageReason}`))).toHaveLength(1);
    expect(screen.queryByText(APP_TEXTS.states.simulation)).toBeNull();
  });

  it("falls back to the stored summary when the stages are unreadable", () => {
    render(
      <ContactTimeline
        entries={[
          entry({
            id: "1",
            title: "Résumé enregistré",
            meta: { type: "contact_stage_changed", previous_stage: "inconnue", stage: null, reason: null },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Résumé enregistré")).toBeDefined();
    expect(screen.queryByTestId("timeline-stage-change")).toBeNull();
  });
});

describe("ContactTimeline — author of a human stage change", () => {
  const change = { type: "contact_stage_changed", previous_stage: "mandat_signe", stage: "chaud", reason: "Annulé" };

  it("reads « Directeur » when the stage change records a director", () => {
    render(
      <ContactTimeline
        entries={[
          entry({
            id: "1",
            actor: { type: "user", agent: null, userId: "u1" },
            meta: { ...change, actor_role: "director" },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Directeur")).toBeDefined();
    expect(screen.queryByText("Conseiller")).toBeNull();
  });

  it("keeps « Conseiller » for an agent, a missing role, or any other human entry", () => {
    render(
      <ContactTimeline
        entries={[
          entry({ id: "1", actor: { type: "user", agent: null, userId: "u1" }, meta: { ...change, actor_role: "agent" } }),
          entry({ id: "2", actor: { type: "user", agent: null, userId: "u1" }, meta: { ...change, actor_role: null } }),
          // A role on another kind of entry is not trusted as a stage-change author.
          entry({ id: "3", actor: { type: "user", agent: null, userId: "u1" }, meta: { actor_role: "director" } }),
        ]}
      />,
    );
    expect(screen.getAllByText("Conseiller")).toHaveLength(3);
    expect(screen.queryByText("Directeur")).toBeNull();
  });
});
