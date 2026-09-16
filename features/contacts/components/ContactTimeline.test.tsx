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
