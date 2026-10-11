import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runEmmaFollowUp } from "@/features/agents-ia/emma-relation/emma";
import { runHugoQualification } from "@/features/agents-ia/hugo-qualification/hugo";
import { runLeaAcquisition } from "@/features/agents-ia/lea-acquisition/lea";
import { runLouisAppointment } from "@/features/agents-ia/louis-rendez-vous/louis";
import { runSarahFollowThrough } from "@/features/agents-ia/sarah-suivi/sarah";
import { buildContactTimeline } from "@/features/contacts/data";
import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { approveOutboundMessage, sendApprovedMessage } from "./validation";

/**
 * **Le parcours complet, de bout en bout, sur le Supabase local.**
 *
 * CLAUDE.md demande de faire fonctionner un parcours simple en entier avant
 * d'élargir. Le voici, avec les cinq agents et les humains à leur place :
 *
 *   lead entrant
 *     → Léa    : dédoublonne (par le code) et crée la fiche, SANS consentement
 *     → HUMAIN : recueille le consentement (Léa ne peut pas le faire)
 *     → Hugo   : qualifie le projet à partir du texte du vendeur
 *     → Louis  : propose un créneau calculé par le code, message « à valider »
 *     → HUMAIN : valide le message, puis l'envoie (en simulation)
 *     → HUMAIN : réalise le rendez-vous et écrit le compte-rendu
 *     → Sarah  : exploite le compte-rendu, passe à « estimation faite »
 *     → Emma   : prépare une relance, consentement revérifié
 *     → HUMAIN : seul lui peut signer le mandat
 *
 * Ce test vérifie surtout ce que la chaîne NE fait PAS : aucun envoi sans
 * validation humaine, aucun mandat signé par un agent, et une trace complète
 * dans l'historique CRM.
 */

const LEAD_TEXT =
  "Bonjour, je m'appelle Camille Fournier, je vends mon appartement T3 de 68 m² à La Ciotat, " +
  "quartier de la gare. Mutation professionnelle à Lyon, je souhaite vendre d'ici 2 mois. " +
  "Vous pouvez me joindre à camille.fournier.parcours@example.test ou au 06 39 98 40 01.";

const REPORT =
  "Estimation réalisée sur place. Appartement T3 de 68 m² en bon état, balcon, ascenseur. " +
  "La vendeuse part à Lyon et vise une vente sous 2 mois. Elle hésite encore sur le prix de " +
  "présentation et compare avec une autre agence. Diagnostics à fournir.";

let env: TestEnv;
let agentA: TypedClient;

async function readContact(contactId: string) {
  const { data, error } = await env.admin
    .from("contacts")
    .select("stage, first_name, last_name, email, phone, sale_motivation, sale_timeline")
    .eq("id", contactId)
    .single();
  if (error || !data) throw new Error(`readContact: ${error?.message ?? "no row"}`);
  return data;
}

beforeAll(async () => {
  env = await setupTestEnv();
  agentA = env.users.agentA.client;
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("Parcours complet : lead → Léa → Hugo → Louis → humain → Sarah → Emma", () => {
  it("traverse toute la chaîne sans jamais rien envoyer ni signer automatiquement", async () => {
    // --- 0. Un membre de l'agence saisit un lead entrant --------------------
    const leadInsert = await env.admin
      .from("inbound_leads")
      .insert({
        agency_id: env.agencyA.agencyId,
        source: "estimation_form",
        raw_text: LEAD_TEXT,
        payload: { form_id: `parcours-${env.runId}` },
        status: "pending",
      })
      .select("id")
      .single();
    expect(leadInsert.error).toBeNull();
    const leadId = leadInsert.data!.id;

    // --- 1. Léa : crée la fiche, et SURTOUT pas le consentement -------------
    const lea = await runLeaAcquisition(agentA, leadId);
    expect(lea.error).toBeNull();
    expect(lea.data!.outcome).toBe("contact_created");
    const contactId = lea.data!.contactId!;

    const created = await readContact(contactId);
    expect(created.stage).toBe("nouveau");
    expect(created.first_name).toBe("Camille");
    expect(created.email).toBe("camille.fournier.parcours@example.test");

    // Un lead n'est pas un consentement : rien n'est enregistré, une tâche l'exige.
    const { data: consentsAfterLea } = await env.admin
      .from("consents")
      .select("id")
      .eq("contact_id", contactId);
    expect(consentsAfterLea).toEqual([]);
    const { data: leaTasks } = await env.admin
      .from("tasks")
      .select("type")
      .eq("contact_id", contactId);
    expect(leaTasks!.map((task) => task.type)).toContain("collect_consent");

    // À ce stade, Emma ne PEUT PAS préparer de relance : pas de consentement.
    const emmaTooEarly = await runEmmaFollowUp(agentA, contactId);
    expect(emmaTooEarly.data).toBeNull();
    expect(emmaTooEarly.error?.code).toBe("consent_not_granted");

    // --- 2. HUMAIN : recueille le consentement ------------------------------
    const consent = await env.admin.from("consents").insert({
      agency_id: env.agencyA.agencyId,
      contact_id: contactId,
      channel: "email",
      status: "granted",
      presented_text: "J'accepte d'être recontacté(e) par l'agence au sujet de mon projet de vente.",
      text_version: "consentement-2026-09-v1",
      source: "estimation_form",
      proof: { form_id: `parcours-${env.runId}`, ip: "203.0.113.42" },
      recorded_by: env.agencyA.directorUserId,
    });
    expect(consent.error).toBeNull();

    // --- 3. Hugo : qualifie à partir du texte du vendeur --------------------
    const hugo = await runHugoQualification(agentA, contactId);
    expect(hugo.error).toBeNull();
    // Délai « sous 2 mois » : le dossier devient chaud.
    expect(hugo.data!.stage).toBe("chaud");
    const qualified = await readContact(contactId);
    expect(qualified.stage).toBe("chaud");
    expect(qualified.sale_motivation).toBe("Mutation professionnelle");

    // --- 4. Louis : créneau calculé par le code, message « à valider » ------
    const louis = await runLouisAppointment(agentA, contactId);
    expect(louis.error).toBeNull();
    expect(louis.data!.appointmentStatus).toBe("proposed");
    expect(louis.data!.messageStatus).toBe("pending_validation");
    expect(louis.data!.channel).toBe("email");
    // L'étape NE passe PAS à `rdv_planifie` : cela demande une confirmation humaine.
    expect((await readContact(contactId)).stage).toBe("chaud");

    const appointmentId = louis.data!.appointmentId;
    const messageId = louis.data!.messageId;

    // --- 5. HUMAIN : valide puis envoie (en simulation) ---------------------
    // Avant validation, l'envoi est refusé : règle du premier contact.
    const sendTooEarly = await sendApprovedMessage(agentA, messageId);
    expect(sendTooEarly.data).toBeNull();
    expect(sendTooEarly.error?.code).toBe("outbound_message_not_approved");

    const approved = await approveOutboundMessage(agentA, messageId);
    expect(approved.error).toBeNull();
    const sent = await sendApprovedMessage(agentA, messageId);
    expect(sent.error).toBeNull();
    expect(sent.data!.status).toBe("sent_simulated");
    expect(sent.data!.isSimulation).toBe(true);

    // --- 6. HUMAIN : réalise le rendez-vous et écrit le compte-rendu --------
    // Sarah ne peut rien en tirer tant qu'il n'existe pas.
    const sarahTooEarly = await runSarahFollowThrough(agentA, appointmentId);
    expect(sarahTooEarly.data).toBeNull();
    expect(sarahTooEarly.error?.code).toBe("appointment_report_missing");

    const held = await env.admin
      .from("appointments")
      .update({
        status: "done",
        report_notes: REPORT,
        report_recorded_by: env.agencyA.directorUserId,
      })
      .eq("id", appointmentId);
    expect(held.error).toBeNull();

    // --- 7. Sarah : exploite le compte-rendu --------------------------------
    const sarah = await runSarahFollowThrough(agentA, appointmentId);
    expect(sarah.error).toBeNull();
    expect(sarah.data!.stage).toBe("estimation_faite");
    // Elle ne va jamais plus loin, quoi que dise le compte-rendu.
    expect(sarah.data!.stage).not.toBe("mandat_signe");
    expect((await readContact(contactId)).stage).toBe("estimation_faite");

    // --- 8. Emma : relance, consentement revérifié --------------------------
    const emma = await runEmmaFollowUp(agentA, contactId);
    expect(emma.error).toBeNull();
    expect(emma.data!.messageStatus).toBe("pending_validation");
    expect(emma.data!.channel).toBe("email");
    // Elle ne bouge pas l'étape.
    expect((await readContact(contactId)).stage).toBe("estimation_faite");

    // --- Ce que la chaîne n'a JAMAIS fait -----------------------------------
    // Aucun contact de l'agence n'a été passé en « mandat signé » par un agent.
    const { data: signed } = await env.admin
      .from("contacts")
      .select("id")
      .eq("agency_id", env.agencyA.agencyId)
      .eq("stage", "mandat_signe");
    expect(signed).toEqual([]);

    // Un seul message est parti, et seulement après validation humaine.
    const { data: messages } = await env.admin
      .from("outbound_messages")
      .select("id, status, is_simulation, validated_by, created_by_agent")
      .eq("contact_id", contactId);
    const sentMessages = messages!.filter((message) => message.status === "sent_simulated");
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]!.validated_by).toBe(env.users.agentA.id);
    expect(sentMessages[0]!.is_simulation).toBe(true);
    // Le brouillon d'Emma attend toujours un humain.
    expect(messages!.filter((message) => message.status === "pending_validation")).toHaveLength(1);

    // --- La trace : quatre agents, chacun journalisé ------------------------
    const { data: runs } = await env.admin
      .from("ai_agent_runs")
      .select("agent, status, contact_id, is_simulation, input_tokens")
      .eq("agency_id", env.agencyA.agencyId)
      .neq("status", "running");
    const succeeded = runs!.filter((run) => run.status === "succeeded").map((run) => run.agent);
    for (const agent of ["lea", "hugo", "louis", "sarah", "emma"] as const) {
      expect(succeeded, agent).toContain(agent);
    }
    // Tout est marqué simulation, et le coût est compté.
    expect(runs!.every((run) => run.is_simulation)).toBe(true);
    expect(runs!.every((run) => run.input_tokens >= 0)).toBe(true);

    // --- L'historique CRM raconte le parcours, dans l'ordre -----------------
    const timeline = await buildContactTimeline(agentA, contactId);
    expect(timeline.error).toBeNull();
    const entries = timeline.data ?? [];
    expect(entries.length).toBeGreaterThan(0);

    // Descending order, as the UI displays it.
    const timestamps = entries.map((entry) => Date.parse(entry.occurredAt));
    expect([...timestamps].sort((left, right) => right - left)).toEqual(timestamps);

    // Les quatre agents qui ont touché CE contact y apparaissent.
    const agentsInTimeline = new Set(
      entries
        .map((entry) => entry.actor.agent)
        .filter((agent): agent is NonNullable<typeof agent> => agent !== null),
    );
    for (const agent of ["hugo", "louis", "sarah", "emma"] as const) {
      expect([...agentsInTimeline], agent).toContain(agent);
    }
    // Toute ACTION produite par un agent est badgée « simulation ».
    // Les tâches sont exclues à dessein : une tâche est du vrai travail à faire
    // par un humain, pas une action simulée — elle porte donc `isSimulation:
    // false`, et c'est voulu.
    const agentActions = entries.filter(
      (entry) => entry.actor.agent !== null && entry.kind !== "task",
    );
    expect(agentActions.length).toBeGreaterThan(0);
    expect(agentActions.every((entry) => entry.isSimulation)).toBe(true);

    // --- Le lead est clos et pointe la fiche --------------------------------
    const { data: lead } = await env.admin
      .from("inbound_leads")
      .select("status, contact_id, processed_run_id")
      .eq("id", leadId)
      .single();
    expect(lead).toMatchObject({ status: "processed", contact_id: contactId });
    expect(lead!.processed_run_id).toBe(lea.data!.runId);
  }, 60_000);
});
