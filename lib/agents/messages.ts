/**
 * Centralised French messages for the product AI agents (Lea, Hugo, Emma,
 * Louis, Sarah) and for the database error codes they can hit.
 *
 * CLAUDE.md: user-facing text is centralised, never scattered across business
 * logic. Every `Result` error returned by an agent carries a stable English
 * `code` (for tests and logs) and one of the French messages below (for the UI).
 *
 * Technical details (Postgres messages, stack traces) are logged server-side
 * and never exposed to the client: a non-member must not learn anything about
 * another agency from an error message.
 */

export const AGENT_ERROR_CODES = [
  // --- session / access ---
  "not_authenticated",
  "forbidden",
  "no_agency",
  "contact_not_found",
  // --- product guard rails (enforced by code and/or by the database) ---
  "ai_paused",
  "ai_daily_run_limit_reached",
  "human_takeover",
  "consent_not_granted",
  "first_contact_requires_human_validation",
  "automatic_follow_up_not_allowed",
  "only_director_can_resume_ai",
  // --- appointment rules (Louis) ---
  "appointment_stage_not_ready",
  "appointment_already_scheduled",
  "appointment_slot_taken",
  "appointment_no_available_slot",
  "appointment_no_reachable_channel",
  // --- AI provider ---
  "ai_provider_not_configured",
  "ai_provider_unavailable",
  "ai_response_invalid",
  // --- generic ---
  "duplicate",
  "unexpected_error",
] as const;

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];

export const AGENT_ERROR_MESSAGES: Record<AgentErrorCode, string> = {
  not_authenticated: "Votre session a expiré. Reconnectez-vous pour continuer.",
  forbidden: "Action refusée : vous n'avez pas accès à cet élément.",
  no_agency: "Votre compte n'est rattaché à aucune agence.",
  // Deliberately identical for "does not exist" and "belongs to another agency":
  // an error message must never reveal the existence of another agency's data.
  contact_not_found: "Contact introuvable.",
  ai_paused:
    "Les agents IA sont suspendus par le coupe-circuit de l'agence. Réactivez-les dans « Agents IA » pour relancer une action.",
  ai_daily_run_limit_reached:
    "La limite quotidienne d'exécutions des agents IA est atteinte pour votre agence. Réessayez demain ou augmentez la limite dans les réglages.",
  human_takeover:
    "Ce dossier est repris en main par un conseiller : aucune action automatique n'est possible.",
  consent_not_granted:
    "Aucun consentement valide pour ce canal : l'envoi est refusé.",
  first_contact_requires_human_validation:
    "Premier contact : le message doit être validé par un membre de l'agence avant tout envoi.",
  automatic_follow_up_not_allowed:
    "Relance automatique impossible : le coupe-circuit est actif ou le dossier est repris par un conseiller.",
  only_director_can_resume_ai: "Seul un directeur peut réactiver les agents IA.",
  appointment_stage_not_ready:
    "Ce contact n'est pas encore prêt pour un rendez-vous d'estimation : il doit d'abord être qualifié par un conseiller ou par Hugo.",
  appointment_already_scheduled:
    "Un rendez-vous est déjà proposé ou confirmé pour ce contact : aucun second créneau n'a été réservé.",
  appointment_slot_taken:
    "Le créneau vient d'être pris par un autre rendez-vous : rien n'a été réservé. Relancez Louis pour obtenir une autre proposition.",
  appointment_no_available_slot:
    "Aucun créneau libre sur les prochains jours ouvrés : rien n'a été réservé, une tâche a été créée pour qu'un conseiller propose une date.",
  appointment_no_reachable_channel:
    "Aucun canal de contact utilisable pour ce contact (adresse email ou numéro manquant) : aucun message n'a été préparé.",
  ai_provider_not_configured:
    "Fournisseur d'IA non configuré : aucun appel payant n'est possible. Les agents IA fonctionnent uniquement avec le simulateur (AI_PROVIDER=simulator).",
  ai_provider_unavailable:
    "Le fournisseur d'IA n'a pas répondu. Aucune action n'a été effectuée.",
  ai_response_invalid:
    "La réponse de l'agent IA n'a pas pu être validée. Aucune action n'a été effectuée : une tâche a été créée pour un conseiller.",
  duplicate: "Cet élément existe déjà.",
  unexpected_error:
    "Une erreur technique est survenue. Aucune action n'a été effectuée.",
};

export function agentMessage(code: AgentErrorCode): string {
  return AGENT_ERROR_MESSAGES[code];
}

/**
 * Human-readable labels of the agents, used in activities and tasks.
 * Lea/Hugo/Emma/Louis/Sarah are product-facing first names (see CLAUDE.md).
 */
export const AGENT_LABELS = {
  lea: "Léa",
  hugo: "Hugo",
  emma: "Emma",
  louis: "Louis",
  sarah: "Sarah",
} as const;

/** Titles and details of the tasks an agent can open for a human. */
export const AGENT_TASK_TEXTS = {
  missing_information: {
    title: "Information manquante : qualification à compléter",
    details:
      "L'agent IA n'a pas trouvé toutes les informations nécessaires dans le dossier et n'a rien inventé. " +
      "Éléments manquants : {fields}. À demander au vendeur lors du prochain échange.",
  },
  qualification_to_review: {
    title: "Qualification à vérifier",
    details:
      "L'agent IA a proposé une qualification peu fiable à partir des éléments du dossier. " +
      "Aucune étape du pipeline n'a été modifiée : à vérifier par un conseiller.",
  },
  ai_response_invalid: {
    title: "Réponse IA invalide : reprise humaine nécessaire",
    details:
      "La sortie de l'agent IA n'a pas passé la validation du schéma après plusieurs tentatives. " +
      "Aucune action n'a été déclenchée (repli sûr). À traiter manuellement.",
  },
  appointment_no_slot: {
    title: "Rendez-vous à proposer manuellement : aucun créneau libre",
    details:
      "Aucun créneau d'estimation libre n'a été trouvé sur les prochains jours ouvrés (jours fériés et " +
      "rendez-vous existants exclus). Aucun rendez-vous n'a été réservé : à caler manuellement avec le vendeur.",
  },
  appointment_consent_missing: {
    title: "Consentement manquant : rendez-vous à proposer autrement",
    details:
      "Aucun consentement valide n'a été enregistré pour joindre ce contact par email, SMS ou WhatsApp. " +
      "Aucun message n'a été préparé et aucun créneau n'a été réservé : à traiter par un conseiller, " +
      "en recueillant d'abord un consentement prouvable.",
  },
  appointment_channel_missing: {
    title: "Coordonnées manquantes : rendez-vous à proposer autrement",
    details:
      "Ce contact n'a ni adresse email ni numéro de téléphone exploitable : aucun message n'a pu être préparé. " +
      "À compléter par un conseiller.",
  },
} as const;

export type AgentTaskType = keyof typeof AGENT_TASK_TEXTS;

/** Field labels used in tasks and in the UI to name a missing information. */
export const QUALIFICATION_FIELD_LABELS = {
  property_type: "type de bien",
  city: "ville",
  sector: "secteur",
  sale_motivation: "motivation de vente",
  sale_timeline: "délai du projet",
} as const;

export type QualificationField = keyof typeof QUALIFICATION_FIELD_LABELS;

export function listFieldLabels(fields: readonly QualificationField[]): string {
  if (fields.length === 0) return "aucun";
  return fields.map((field) => QUALIFICATION_FIELD_LABELS[field]).join(", ");
}
