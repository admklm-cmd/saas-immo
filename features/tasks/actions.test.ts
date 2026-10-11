import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createClient: vi.fn(),
  completeOpenTask: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./data", () => ({ completeOpenTask: mocks.completeOpenTask }));

import { completeTask } from "./actions";

const TASK_ID = "22222222-2222-4222-8222-222222222222";
const CONTACT_ID = "7c0e8a1e-2f4b-4b8e-9a51-3d2f1c0b9e77";
const SESSION_CLIENT = { kind: "session-client" };

beforeEach(() => {
  mocks.revalidatePath.mockReset();
  mocks.createClient.mockReset().mockResolvedValue(SESSION_CLIENT);
  mocks.completeOpenTask.mockReset();
});

describe("completeTask (server action)", () => {
  it("uses the session client and revalidates the linked screens after success", async () => {
    const data = { id: TASK_ID, contactId: CONTACT_ID, status: "done", completedAt: "2026-09-23T10:00:00.000Z" };
    mocks.completeOpenTask.mockResolvedValue({ data, error: null });

    expect(await completeTask(TASK_ID)).toEqual({ data, error: null });
    expect(mocks.completeOpenTask).toHaveBeenCalledWith(SESSION_CLIENT, TASK_ID);
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/taches",
      "/dashboard",
      `/contacts/${CONTACT_ID}`,
    ]);
  });

  it("does not revalidate a contact page for an agency-level task", async () => {
    mocks.completeOpenTask.mockResolvedValue({
      data: { id: TASK_ID, contactId: null, status: "done", completedAt: "2026-09-23T10:00:00.000Z" },
      error: null,
    });
    await completeTask(TASK_ID);
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/taches", "/dashboard"]);
  });

  it.each([undefined, null, 42, "", "not-a-uuid", `${TASK_ID}' or 1=1`, { id: TASK_ID }])(
    "answers « introuvable » for the malformed id %o, before any client is built",
    async (input) => {
      const result = await completeTask(input as never);
      expect(result).toEqual({ data: null, error: { code: "task_not_found", message: "Tâche introuvable." } });
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.completeOpenTask).not.toHaveBeenCalled();
    },
  );

  it("returns the error as is and revalidates nothing", async () => {
    const error = { code: "task_already_done", message: "Cette tâche est déjà terminée." };
    mocks.completeOpenTask.mockResolvedValue({ data: null, error });
    expect(await completeTask(TASK_ID)).toEqual({ data: null, error });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
