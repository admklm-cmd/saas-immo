import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { generateValidated } from "@/lib/agents/ai-task";
import type { AiGenerationRequest } from "@/lib/claude/provider";
import { fail, ok } from "@/lib/utils/result";

import { createPrivacyGatewayProvider } from "./gateway";
import type { ExternalAiTransport, SanitizedAiRequest } from "./types";

/**
 * Lifecycle of the gateway provider with a stub transport: refusal before any
 * call, re-identification after validation, destruction at the end, a table
 * that differs from one execution to the next.
 */

const REQUEST: AiGenerationRequest = {
  task: "emma_follow_up",
  systemPrompt: "Tu es Emma. Réponds en JSON.",
  promptVersion: "test-v1",
  facts: { contact_stage: "qualifie", message_channel: "email", days_since_last_message: 6, has_pending_appointment: false },
  untrusted: [
    { label: "agency_name", content: "Calanques Immobilier" },
    { label: "contact_first_name", content: "Camille" },
    { label: "contact_notes", content: "Camille Berthier, camille.berthier@example.test, 06 39 98 10 01." },
  ],
  privacy: {
    persons: [{ firstName: "Camille", lastName: "Berthier" }],
    emails: ["camille.berthier@example.test"],
    phones: ["06 39 98 10 01"],
    agencyName: "Calanques Immobilier",
  },
};

const draftSchema = z.strictObject({ body: z.string().max(300).refine((value) => !/https?:\/\//.test(value), "no link") });

function recordingTransport(answer: (request: SanitizedAiRequest) => unknown) {
  const received: SanitizedAiRequest[] = [];
  const transport: ExternalAiTransport = {
    name: "stub",
    model: "stub-1",
    async complete(request) {
      received.push(request);
      return ok({ raw: answer(request), usage: { provider: "stub", model: "stub-1", inputTokens: 10, outputTokens: 5 } });
    },
  };
  return { transport, received };
}

const tokenOf = (user: string, type: string) => new RegExp(`\\[${type}_\\d+_[0-9a-f]{8}\\]`).exec(user)?.[0] ?? "";

describe("createPrivacyGatewayProvider", () => {
  it("appelle le transport avec la requête assainie, puis ré-identifie la sortie validée", async () => {
    const { transport, received } = recordingTransport((request) => ({
      body: `Bonjour ${tokenOf(request.user, "PRENOM")}, ici ${tokenOf(request.user, "AGENCE")}. Joignable : ${tokenOf(request.user, "TEL")}`,
    }));
    const provider = createPrivacyGatewayProvider(transport, { onAudit: () => {} });

    const outcome = await generateValidated(provider, REQUEST, draftSchema);

    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.output.body).toBe("Bonjour Camille, ici Calanques Immobilier. Joignable : 06 39 98 10 01");
    expect(received).toHaveLength(1);
    expect(JSON.stringify(received)).not.toContain("Camille");
    expect(JSON.stringify(received)).not.toContain("example.test");
    expect(provider.isSimulation).toBe(false);
  });

  it("refuse avant tout appel quand la politique ne sait pas traiter un champ", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { transport, received } = recordingTransport(() => ({ body: "x" }));
    const provider = createPrivacyGatewayProvider(transport, { onAudit: () => {} });

    const outcome = await generateValidated(
      provider,
      { ...REQUEST, facts: { ...REQUEST.facts, contact_email: "camille.berthier@example.test" } },
      draftSchema,
    );

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.error.code).toBe("privacy_gateway_refused");
    expect(received).toHaveLength(0);
    // A refusal is final: no retry loop towards an external service.
    expect(outcome.attempts).toBe(1);
  });

  it("n'écrit dans le journal technique que des compteurs", async () => {
    const audits: unknown[] = [];
    const { transport } = recordingTransport(() => ({ body: "ok" }));
    const provider = createPrivacyGatewayProvider(transport, { onAudit: (audit) => audits.push(audit) });
    await generateValidated(provider, REQUEST, draftSchema);

    const journal = JSON.stringify(audits);
    expect(journal).toContain('"outcome":"sent"');
    for (const forbidden of ["Camille", "Berthier", "example.test", "06 39 98 10 01", "Calanques"]) {
      expect(journal, forbidden).not.toContain(forbidden);
    }
  });

  it("par défaut, l'audit part dans le log serveur sans aucune valeur", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { transport } = recordingTransport(() => ({ body: "ok" }));
    await generateValidated(createPrivacyGatewayProvider(transport), REQUEST, draftSchema);
    expect(info).toHaveBeenCalled();
    expect(String(info.mock.calls[0]?.[0])).not.toContain("Camille");
  });

  it("rejette un pseudonyme inventé : sortie invalide, nouvelle tentative, puis repli sûr", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { transport, received } = recordingTransport(() => ({ body: "Bonjour [PRENOM_7_deadbeef]" }));
    const provider = createPrivacyGatewayProvider(transport, { onAudit: () => {} });

    const outcome = await generateValidated(provider, REQUEST, draftSchema);

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.error.code).toBe("ai_response_invalid");
    expect(outcome.attempts).toBe(2);
    expect(received).toHaveLength(2);
  });

  it("rejette une sortie dont la valeur ré-identifiée viole le schéma (lien)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { transport } = recordingTransport((request) => ({ body: `Voir ${tokenOf(request.user, "URL")}` }));
    const provider = createPrivacyGatewayProvider(transport, { onAudit: () => {} });

    const outcome = await generateValidated(
      provider,
      { ...REQUEST, untrusted: [{ label: "contact_notes", content: "Mon annonce : https://www.example.test/annonce/42" }] },
      draftSchema,
    );

    // The pseudonymised output passed the schema, the restored one (a link) does not.
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.error.code).toBe("ai_response_invalid");
  });

  it("détruit la table à la fin de l'exécution", async () => {
    const { transport } = recordingTransport((request) => ({ body: `Bonjour ${tokenOf(request.user, "PRENOM")}` }));
    const provider = createPrivacyGatewayProvider(transport, { onAudit: () => {} });
    await generateValidated(provider, REQUEST, draftSchema);

    // generateValidated already called endRun(): nothing can be restored any more.
    const late = provider.restoreOutput?.({ body: "[PRENOM_1_00000000]" });
    expect(late?.error?.code).toBe("pseudonym_session_destroyed");
  });

  it("utilise des pseudonymes différents à chaque exécution", async () => {
    const seen: string[] = [];
    const { transport } = recordingTransport((request) => {
      seen.push(tokenOf(request.user, "EMAIL"));
      return { body: "ok" };
    });
    for (let index = 0; index < 20; index += 1) {
      await generateValidated(createPrivacyGatewayProvider(transport, { onAudit: () => {} }), REQUEST, draftSchema);
    }
    expect(seen.every((token) => token.length > 0)).toBe(true);
    expect(new Set(seen).size).toBe(20);
  });

  it("garde la même table entre la première tentative et la reprise de la même exécution", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const emailTokens: string[] = [];
    let call = 0;
    const { transport } = recordingTransport((request) => {
      emailTokens.push(tokenOf(request.user, "EMAIL"));
      call += 1;
      return call === 1 ? { wrong: true } : { body: "ok" };
    });
    const outcome = await generateValidated(createPrivacyGatewayProvider(transport, { onAudit: () => {} }), REQUEST, draftSchema);
    expect(outcome.ok).toBe(true);
    expect(emailTokens).toHaveLength(2);
    expect(emailTokens[0]).toBe(emailTokens[1]);
  });

  it("traduit une panne du transport en erreur sans détail, sans nouvelle tentative", async () => {
    const transport: ExternalAiTransport = {
      name: "stub",
      model: "stub-1",
      complete: async () => fail("ai_provider_unavailable", "Le fournisseur d'IA n'a pas répondu. Aucune action n'a été effectuée."),
    };
    const outcome = await generateValidated(createPrivacyGatewayProvider(transport, { onAudit: () => {} }), REQUEST, draftSchema);
    expect(!outcome.ok && outcome.error.code).toBe("ai_provider_unavailable");
    expect(outcome.attempts).toBe(1);
  });
});
