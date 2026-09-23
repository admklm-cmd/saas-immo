import { describe, expect, it, vi } from "vitest";

import type { TypedClient } from "@/lib/agents/types";

import { changeStage, resolvePipelineViewer } from "./stage-change";
import { STAGE_CHANGE_ERROR_MESSAGES } from "./types";

const CONTACT_ID = "7c0e8a1e-2f4b-4b8e-9a51-3d2f1c0b9e77";
const USER_ID = "0d6f7a52-8b61-4f0e-a7a3-5c2e1b9d4f10";
const AGENCY_ID = "5b1c7e0a-3d2f-4c9b-8e6a-1f0d2c3b4a59";

type RpcOutcome = { data: unknown; error: { message: string; code?: string } | null };

function fakeClient(options: {
  user?: { id: string } | null;
  membership?: { agency_id: string; role: "agent" | "director" } | null;
  rpc?: RpcOutcome;
}) {
  const rpc = vi.fn(() => ({
    single: async () => options.rpc ?? { data: null, error: null },
  }));
  const membershipQuery = {
    select: () => membershipQuery,
    eq: () => membershipQuery,
    order: () => membershipQuery,
    limit: () => membershipQuery,
    maybeSingle: async () => ({ data: options.membership ?? null, error: null }),
  };
  const client = {
    auth: {
      getUser: async () =>
        options.user === null
          ? { data: { user: null }, error: { message: "no session" } }
          : { data: { user: options.user ?? { id: USER_ID } }, error: null },
    },
    from: vi.fn(() => membershipQuery),
    rpc,
  };
  return { client: client as unknown as TypedClient, rpc };
}

const MEMBER = { agency_id: AGENCY_ID, role: "agent" as const };

describe("changeStage — validation avant tout appel à la base", () => {
  it("entrée malformée : aucun appel RPC", async () => {
    const { client, rpc } = fakeClient({ membership: MEMBER });
    const result = await changeStage(client, { contactId: CONTACT_ID, stage: "signe", mandateConfirmed: false });
    expect(result.error?.code).toBe("stage_invalid_input");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("identifiant malformé : même réponse qu'un contact inconnu", async () => {
    const { client, rpc } = fakeClient({ membership: MEMBER });
    const result = await changeStage(client, { contactId: "1 or 1=1", stage: "chaud", mandateConfirmed: false });
    expect(result.error).toEqual({ code: "contact_not_found", message: STAGE_CHANGE_ERROR_MESSAGES.contact_not_found });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("motif invalide : code dédié", async () => {
    const { client, rpc } = fakeClient({ membership: MEMBER });
    const result = await changeStage(client, {
      contactId: CONTACT_ID,
      stage: "perdu",
      mandateConfirmed: true,
      reason: "\u001b",
    });
    expect(result.error?.code).toBe("stage_reason_invalid");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sans session : refus, aucun appel RPC", async () => {
    const { client, rpc } = fakeClient({ user: null });
    const result = await changeStage(client, { contactId: CONTACT_ID, stage: "chaud", mandateConfirmed: false });
    expect(result.error?.code).toBe("not_authenticated");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sans agence : refus, aucun appel RPC", async () => {
    const { client, rpc } = fakeClient({ membership: null });
    const result = await changeStage(client, { contactId: CONTACT_ID, stage: "chaud", mandateConfirmed: false });
    expect(result.error?.code).toBe("no_agency");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("changeStage — appel de la RPC et traduction des erreurs", () => {
  it("transmet exactement les paramètres validés (motif omis s'il est vide)", async () => {
    const { client, rpc } = fakeClient({
      membership: MEMBER,
      rpc: {
        data: {
          contact_id: CONTACT_ID,
          previous_stage: "estimation_faite",
          current_stage: "mandat_signe",
          activity_id: "a1b2c3d4-0000-4000-8000-000000000001",
          changed_at: "2026-09-23T10:00:00Z",
        },
        error: null,
      },
    });
    const result = await changeStage(client, {
      contactId: CONTACT_ID,
      stage: "mandat_signe",
      mandateConfirmed: true,
      reason: "   ",
    });
    expect(rpc).toHaveBeenCalledWith("change_contact_stage", {
      target_contact: CONTACT_ID,
      new_stage: "mandat_signe",
      mandate_confirmed: true,
    });
    expect(result).toEqual({
      data: {
        contactId: CONTACT_ID,
        previousStage: "estimation_faite",
        stage: "mandat_signe",
        activityId: "a1b2c3d4-0000-4000-8000-000000000001",
        changedAt: "2026-09-23T10:00:00Z",
      },
      error: null,
    });
  });

  it("transmet le motif nettoyé", async () => {
    const { client, rpc } = fakeClient({ membership: MEMBER, rpc: { data: null, error: { message: "stage_unchanged" } } });
    await changeStage(client, { contactId: CONTACT_ID, stage: "perdu", mandateConfirmed: true, reason: "  Annulé  " });
    expect(rpc).toHaveBeenCalledWith("change_contact_stage", {
      target_contact: CONTACT_ID,
      new_stage: "perdu",
      mandate_confirmed: true,
      reason: "Annulé",
    });
  });

  it.each([
    "stage_mandate_confirmation_required",
    "stage_mandate_exit_director_only",
    "stage_mandate_exit_confirmation_required",
    "stage_reason_required",
    "stage_unchanged",
    "contact_not_found",
  ] as const)("erreur base %s => message français dédié", async (code) => {
    const { client } = fakeClient({ membership: MEMBER, rpc: { data: null, error: { message: code, code: "P0001" } } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await changeStage(client, { contactId: CONTACT_ID, stage: "chaud", mandateConfirmed: false });
    expect(result.error).toEqual({ code, message: STAGE_CHANGE_ERROR_MESSAGES[code] });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("erreur technique : message générique, jamais le texte Postgres", async () => {
    const { client } = fakeClient({
      membership: MEMBER,
      rpc: { data: null, error: { message: 'relation "private.secret" does not exist', code: "42P01" } },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await changeStage(client, { contactId: CONTACT_ID, stage: "chaud", mandateConfirmed: false });
    expect(result.error?.code).toBe("unexpected_error");
    expect(result.error?.message).not.toContain("private");
  });

  it("exception inattendue : résultat d'erreur, pas d'exception", async () => {
    const { client } = fakeClient({ membership: MEMBER });
    (client as unknown as { rpc: () => never }).rpc = () => {
      throw new Error("boom");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await changeStage(client, { contactId: CONTACT_ID, stage: "chaud", mandateConfirmed: false });
    expect(result.error?.code).toBe("unexpected_error");
  });
});

describe("resolvePipelineViewer", () => {
  it("directeur : peut sortir un mandat signé", async () => {
    const { client } = fakeClient({ membership: { agency_id: AGENCY_ID, role: "director" } });
    expect((await resolvePipelineViewer(client)).data).toEqual({
      userId: USER_ID,
      role: "director",
      canExitSignedMandate: true,
    });
  });

  it("agent : ne peut pas sortir un mandat signé", async () => {
    const { client } = fakeClient({ membership: MEMBER });
    expect((await resolvePipelineViewer(client)).data?.canExitSignedMandate).toBe(false);
  });

  it("sans session : erreur", async () => {
    const { client } = fakeClient({ user: null });
    expect((await resolvePipelineViewer(client)).error?.code).toBe("not_authenticated");
  });
});
