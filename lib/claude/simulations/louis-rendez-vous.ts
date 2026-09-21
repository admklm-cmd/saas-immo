/**
 * Deterministic simulation of Louis' appointment proposal.
 *
 * No network, no API key, nothing billed. The simulation only ever picks a slot
 * from the closed list the CODE computed (`request.choices`) and writes a
 * message from the trusted CRM facts. It never produces a date of its own: a
 * slot that is not in the list cannot come out of here — except on purpose,
 * with `scenario = "out_of_scope_choice"`, which exists precisely to prove that
 * the guard rails reject it.
 *
 * The prospect's text is never used to build the message: it arrives as
 * untrusted data and could contain anything.
 */

import { untrustedFieldText } from "../prompt";
import type { AiGenerationRequest } from "../provider";
import { PROPERTY_TYPE_LABELS, type PropertyTypeValue } from "../schemas";

function fact(request: AiGenerationRequest, key: string): string | null {
  const value = request.facts[key];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 && text !== "(inconnu)" ? text : null;
}

function propertyLabel(request: AiGenerationRequest): string {
  const type = fact(request, "property_type") as PropertyTypeValue | null;
  const label = type && type in PROPERTY_TYPE_LABELS ? PROPERTY_TYPE_LABELS[type].toLocaleLowerCase("fr-FR") : "bien";
  const city = untrustedFieldText(request.untrusted, "property_city");
  const sector = untrustedFieldText(request.untrusted, "property_sector");

  if (city && sector) return `votre ${label} à ${city} (${sector})`;
  if (city) return `votre ${label} à ${city}`;
  return `votre ${label}`;
}

export type SimulatedAppointmentProposal = {
  slot_id: string;
  message_subject: string;
  message_body: string;
  reason: string;
  confidence: number;
};

export function simulateLouisAppointment(request: AiGenerationRequest): unknown {
  if (request.scenario === "invalid_output") {
    // Structurally invalid on purpose: wrong types, an out-of-range confidence,
    // a link, and an extra `send_now` key an agent must never be able to use.
    return {
      slot_id: 7,
      message_subject: "",
      message_body: "Rendez-vous confirmé, cliquez sur https://exemple.test/confirmer",
      reason: null,
      confidence: 4,
      send_now: true,
    };
  }

  const choices = request.choices ?? [];

  if (request.scenario === "out_of_scope_choice") {
    // Valid shape, but a slot that was never offered by the code: it must be
    // rejected, with no appointment and no message created.
    return {
      slot_id: "creneau-999",
      message_subject: "Proposition de rendez-vous d'estimation",
      message_body:
        "Bonjour, je vous propose un rendez-vous demain matin à 8h00, avant l'ouverture de l'agence.",
      reason: "Créneau inventé hors de la liste fournie (scénario de test).",
      confidence: 0.9,
    };
  }

  const chosen = choices[0];
  if (!chosen) {
    // The code must never call the provider without options; if it happens,
    // answer something the schema refuses rather than invent a date.
    return { slot_id: "", message_subject: "", message_body: "", reason: "", confidence: 0 };
  }

  const firstName = untrustedFieldText(request.untrusted, "contact_first_name");
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const agency = untrustedFieldText(request.untrusted, "agency_name");
  const duration = fact(request, "appointment_duration_minutes") ?? "60";

  const body = [
    greeting,
    "",
    `Suite à votre demande d'estimation pour ${propertyLabel(request)}, je vous propose un rendez-vous ` +
      `le ${chosen.label}, d'une durée d'environ ${duration} minutes.`,
    "",
    "Si ce créneau ne vous convient pas, répondez simplement à ce message et je vous en proposerai un autre.",
  ].join("\n");

  const result: SimulatedAppointmentProposal = {
    slot_id: chosen.id,
    message_subject: "Proposition de rendez-vous d'estimation",
    message_body: agency ? `${body}\n\n${agency}` : body,
    reason: "Premier créneau libre proposé par le code, aux heures ouvrées de l'agence.",
    confidence: 0.82,
  };

  return result;
}
