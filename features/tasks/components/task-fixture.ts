import type { OpenTaskItem, OpenTasksPage } from "../types";

/** Synthetic open task for component tests (no real person). */
export function openTask(overrides: Partial<OpenTaskItem> = {}): OpenTaskItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Information manquante : motivation et délai de vente",
    type: "missing_information",
    dueAt: "2026-09-25T07:00:00.000Z",
    isOverdue: false,
    contactId: "22222222-2222-4222-8222-222222222222",
    contactName: "Camille Berthier",
    assignedUserId: null,
    createdByAgent: "hugo",
    createdAt: "2026-09-20T08:00:00.000Z",
    ...overrides,
  };
}

export function tasksPage(overrides: Partial<OpenTasksPage> = {}): OpenTasksPage {
  const items = overrides.items ?? [openTask()];
  return {
    items,
    total: items.length,
    limit: 25,
    offset: 0,
    hasMore: false,
    generatedAt: "2026-09-23T10:00:00.000Z",
    scope: "all",
    timeZone: "Europe/Paris",
    ...overrides,
  };
}
