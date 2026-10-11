import { describe, expect, it } from "vitest";

import type { ContactListItem } from "@/features/contacts/types";

import { groupContactsByStage, LOST_STAGE, PIPELINE_BOARD_STAGES } from "./groupContactsByStage";

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

describe("groupContactsByStage", () => {
  it("puts every active stage and the lost stage in the result, even with no contact", () => {
    const groups = groupContactsByStage([]);

    for (const stage of [...PIPELINE_BOARD_STAGES, LOST_STAGE]) {
      expect(groups[stage]).toEqual([]);
    }
  });

  it("routes each contact to its own stage, inventing nothing else", () => {
    const nouveau = contactOf({ id: "1", stage: "nouveau" });
    const qualifie = contactOf({ id: "2", stage: "qualifie" });
    const perdu = contactOf({ id: "3", stage: "perdu" });

    const groups = groupContactsByStage([nouveau, qualifie, perdu]);

    expect(groups.nouveau).toEqual([nouveau]);
    expect(groups.qualifie).toEqual([qualifie]);
    expect(groups.chaud).toEqual([]);
    expect(groups[LOST_STAGE]).toEqual([perdu]);
  });

  it("orders a column most recently updated first", () => {
    const older = contactOf({ id: "1", stage: "chaud", updatedAt: "2026-09-01T08:00:00.000Z" });
    const newer = contactOf({ id: "2", stage: "chaud", updatedAt: "2026-09-10T08:00:00.000Z" });

    const groups = groupContactsByStage([older, newer]);

    expect(groups.chaud.map((contact) => contact.id)).toEqual(["2", "1"]);
  });

  it("keeps a human takeover flag intact, since a column never hides it", () => {
    const takenOver = contactOf({ id: "1", stage: "nouveau", humanTakeover: true });

    const groups = groupContactsByStage([takenOver]);

    expect(groups.nouveau[0]?.humanTakeover).toBe(true);
  });
});
