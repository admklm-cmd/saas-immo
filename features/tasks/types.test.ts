import { describe, expect, it } from "vitest";

import { openTasksInputSchema, TASK_ERROR_MESSAGES } from "./types";

describe("openTasksInputSchema", () => {
  it("defaults to every open task, first page", () => {
    expect(openTasksInputSchema.parse({})).toEqual({ scope: "all", limit: 25, offset: 0 });
  });

  it.each(["all", "overdue", "mine"] as const)("accepts the scope %s", (scope) => {
    expect(openTasksInputSchema.parse({ scope, limit: 100, offset: 5000 })).toEqual({
      scope,
      limit: 100,
      offset: 5000,
    });
  });

  it.each([
    { scope: "done" },
    { scope: "ALL" },
    { scope: "mine", assignedUserId: "11111111-1111-4111-8111-111111111111" },
    { agencyId: "11111111-1111-4111-8111-111111111111" },
    { limit: 101 },
    { offset: 5001 },
    { limit: "10; drop table tasks" },
  ])("refuses %o", (input) => {
    expect(openTasksInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("TASK_ERROR_MESSAGES", () => {
  it("are French sentences without technical detail", () => {
    for (const message of Object.values(TASK_ERROR_MESSAGES)) {
      expect(message).toMatch(/[.!]$/);
      expect(message).not.toMatch(/sql|postgres|uuid|pgrst|exception/i);
    }
    expect(TASK_ERROR_MESSAGES.task_already_done).toBe("Cette tâche est déjà terminée.");
  });
});
