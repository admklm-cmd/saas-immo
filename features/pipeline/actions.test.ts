import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createClient: vi.fn(),
  changeStage: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./stage-change", () => ({ changeStage: mocks.changeStage }));

import { changeContactStage } from "./actions";

const CONTACT_ID = "7c0e8a1e-2f4b-4b8e-9a51-3d2f1c0b9e77";
const SESSION_CLIENT = { kind: "session-client" };

beforeEach(() => {
  mocks.revalidatePath.mockReset();
  mocks.createClient.mockReset().mockResolvedValue(SESSION_CLIENT);
  mocks.changeStage.mockReset();
});

describe("changeContactStage (server action)", () => {
  it("utilise le client de session et revalide les écrans concernés après succès", async () => {
    const data = {
      contactId: CONTACT_ID,
      previousStage: "chaud",
      stage: "rdv_planifie",
      activityId: "a1b2c3d4-0000-4000-8000-000000000001",
      changedAt: "2026-09-23T10:00:00Z",
    };
    mocks.changeStage.mockResolvedValue({ data, error: null });
    const input = { contactId: CONTACT_ID, stage: "rdv_planifie" as const, mandateConfirmed: false };

    const result = await changeContactStage(input);

    expect(result).toEqual({ data, error: null });
    expect(mocks.changeStage).toHaveBeenCalledWith(SESSION_CLIENT, input);
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/pipeline",
      "/contacts",
      `/contacts/${CONTACT_ID}`,
      "/dashboard",
    ]);
  });

  it("en cas d'erreur : renvoie l'erreur telle quelle et ne revalide rien", async () => {
    const error = { code: "stage_mandate_exit_director_only", message: "Seul un directeur…" };
    mocks.changeStage.mockResolvedValue({ data: null, error });

    const result = await changeContactStage({ contactId: CONTACT_ID, stage: "perdu", mandateConfirmed: true });

    expect(result).toEqual({ data: null, error });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
