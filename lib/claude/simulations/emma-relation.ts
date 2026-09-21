/**
 * Deterministic simulation of Emma's follow-up draft.
 *
 * No network, no API key, nothing billed. The message is built ONLY from the
 * trusted CRM facts the code passed in — never from the prospect's free text,
 * which arrives as untrusted data and could contain anything. No figure, no
 * amount in euros and no date is ever produced here: an information that is not
 * in the facts simply does not appear in the message.
 *
 * The simulation has no way to express a recipient, a channel, a send or a
 * pipeline stage: those fields do not exist in Emma's schema.
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
  const label =
    type && type in PROPERTY_TYPE_LABELS
      ? PROPERTY_TYPE_LABELS[type].toLocaleLowerCase("fr-FR")
      : "bien";
  const city = untrustedFieldText(request.untrusted, "property_city");
  return city ? `votre ${label} à ${city}` : `votre ${label}`;
}

export type SimulatedFollowUp = {
  message_subject: string | null;
  message_body: string;
  angle: string;
  reason: string;
  confidence: number;
};

export function simulateEmmaFollowUp(request: AiGenerationRequest): unknown {
  if (request.scenario === "invalid_output") {
    // Structurally invalid on purpose: an unknown angle, an out-of-range
    // confidence, a link, an amount in euros, and two extra keys an agent must
    // never be able to use (a channel and an immediate send).
    return {
      message_subject: "",
      message_body: "Votre bien vaut 450 000 €, confirmez sur https://exemple.test/valider",
      angle: "vente_flash",
      reason: null,
      confidence: 5,
      channel: "sms",
      send_now: true,
    };
  }

  const channel = fact(request, "message_channel") ?? "email";
  const stage = fact(request, "contact_stage");
  const firstName = untrustedFieldText(request.untrusted, "contact_first_name");
  const agency = untrustedFieldText(request.untrusted, "agency_name");
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

  const angle =
    stage === "estimation_faite"
      ? "reprise_apres_estimation"
      : fact(request, "has_pending_appointment") === "true"
        ? "demande_precision"
        : "relance_sans_reponse";

  const opening =
    angle === "reprise_apres_estimation"
      ? `Je reviens vers vous après l'estimation de ${propertyLabel(request)}.`
      : `Je reviens vers vous au sujet de ${propertyLabel(request)}.`;

  const question =
    angle === "reprise_apres_estimation"
      ? "Où en êtes-vous de votre réflexion, et souhaitez-vous que nous en reparlions ?"
      : "Souhaitez-vous que nous fassions le point sur votre projet ?";

  const short = channel !== "email";
  const body = short
    ? [`${greeting} ${opening} ${question}`, agency ? agency : null].filter(Boolean).join(" ")
    : [greeting, "", opening, "", question, "", "Bien à vous,", agency ?? "L'équipe de l'agence"].join(
        "\n",
      );

  const result: SimulatedFollowUp = {
    message_subject: short ? null : "Où en est votre projet de vente ?",
    message_body: body,
    angle,
    reason: "Relance préparée à partir des seuls faits du dossier, sans aucun chiffre ni date.",
    confidence: 0.78,
  };

  if (request.scenario === "partial_output") {
    // Schema-valid but deliberately generic: nothing personal could be used.
    return {
      ...result,
      message_subject: short ? null : "Votre projet de vente",
      message_body: short
        ? `${greeting} Souhaitez-vous que nous fassions le point sur votre projet ?`
        : [greeting, "", "Souhaitez-vous que nous fassions le point sur votre projet ?", "", "Bien à vous,"].join(
            "\n",
          ),
      reason: "Aucun élément personnalisable dans le dossier : message volontairement neutre.",
      confidence: 0.4,
    };
  }

  return result;
}
