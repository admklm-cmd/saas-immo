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
  "ai_run_not_found",
  // --- product guard rails (enforced by code and/or by the database) ---
  "ai_paused",
  "ai_daily_run_limit_reached",
  "human_takeover",
  "consent_not_granted",
  "first_contact_requires_human_validation",
  "automatic_follow_up_not_allowed",
  "only_director_can_resume_ai",
  // --- inbound leads (Léa) ---
  "lead_not_found",
  "lead_already_processed",
  "lead_incomplete",
  // --- follow-up rules (Emma) ---
  "follow_up_stage_not_eligible",
  "follow_up_already_drafted",
  // --- appointment rules (Louis) ---
  "appointment_stage_not_ready",
  "appointment_already_scheduled",
  "appointment_slot_taken",
  "appointment_no_available_slot",
  "appointment_no_reachable_channel",
  // --- follow-through rules (Sarah) ---
  "appointment_not_found",
  "appointment_report_missing",
  // --- human validation of a draft (file d'attente « à valider ») ---
  // One vocabulary only for this queue: `outbound_message_*`. A parallel set of
  // `message_*` codes existed for a while and said exactly the same things; it
  // was removed rather than kept as an alias, so there is a single code per
  // situation in the logs and in the tests.
  "outbound_message_not_found",
  "outbound_message_not_pending",
  "outbound_message_not_approved",
  "outbound_message_invalid_content",
  // --- AI provider ---
  "ai_provider_not_configured",
  "ai_provider_unavailable",
  "ai_response_invalid",
  // --- generic ---
  "invalid_filters",
  "invalid_reason",
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
  // Same reasoning: identical answer for "unknown run" and "run of another
  // agency".
  ai_run_not_found: "Exécution d'agent introuvable.",
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
  // Deliberately identical for "does not exist" and "belongs to another agency".
  lead_not_found: "Lead introuvable.",
  lead_already_processed:
    "Ce lead a déjà été traité : aucune seconde fiche contact n'a été créée.",
  lead_incomplete:
    "Informations insuffisantes pour créer une fiche contact : rien n'a été inventé, une tâche a été créée pour un conseiller.",
  follow_up_stage_not_eligible:
    "Ce contact n'est pas éligible à une relance automatique : son dossier est clos ou son mandat est déjà signé.",
  follow_up_already_drafted:
    "Une relance est déjà en attente de validation pour ce contact : aucun second brouillon n'a été créé.",
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
  // Same reasoning as `contact_not_found`: identical answer for "unknown" and
  // "belongs to another agency".
  appointment_not_found: "Rendez-vous introuvable.",
  appointment_report_missing:
    "Aucun compte-rendu n'a encore été saisi pour ce rendez-vous : Sarah n'en déduit rien et n'invente rien. Une tâche a été créée pour le conseiller qui l'a réalisé.",
  // Same reasoning as `contact_not_found`: identical answer for "unknown" and
  // "belongs to another agency".
  outbound_message_not_found: "Message introuvable.",
  outbound_message_not_pending:
    "Ce message n'est plus en attente de validation : il a déjà été traité par un membre de l'agence.",
  outbound_message_not_approved:
    "Ce message doit d'abord être validé par un membre de l'agence avant tout envoi.",
  outbound_message_invalid_content:
    "Le texte du message est vide ou trop long : il n'a pas été enregistré.",
  ai_provider_not_configured:
    "Fournisseur d'IA non configuré : aucun appel payant n'est possible. Les agents IA fonctionnent uniquement avec le simulateur (AI_PROVIDER=simulator).",
  ai_provider_unavailable:
    "Le fournisseur d'IA n'a pas répondu. Aucune action n'a été effectuée.",
  ai_response_invalid:
    "La réponse de l'agent IA n'a pas pu être validée. Aucune action n'a été effectuée : une tâche a été créée pour un conseiller.",
  invalid_filters:
    "Les filtres demandés ne sont pas valides. L'historique n'a pas été chargé.",
  invalid_reason:
    "Motif de refus invalide : choisissez un motif dans la liste. Le message n'a pas été refusé.",
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

/**
 * Mission of each agent, in one sentence, as the "Agents IA" screen shows it.
 * Deliberately phrased in terms of what the agent DOES and does NOT decide:
 * the screen is where an agency understands the limits of what it bought.
 */
export const AGENT_MISSIONS = {
  lea: "Vérifie la source d'un lead entrant, le dédoublonne et crée la fiche contact. Ne recueille aucun consentement.",
  hugo: "Identifie le bien, le secteur, la motivation et le délai du projet. N'invente jamais une information absente.",
  emma: "Prépare les brouillons de relance, uniquement si le consentement du canal est valide. N'envoie rien.",
  louis:
    "Propose un créneau d'estimation parmi ceux que le code a calculés et prépare le message. Ne confirme aucun rendez-vous.",
  sarah:
    "Exploite le compte-rendu rédigé par un conseiller et ouvre les actions de suivi. Ne déclare jamais un mandat signé.",
} as const satisfies Record<keyof typeof AGENT_LABELS, string>;

/** Display order of the agents: the order of the seller's journey. */
export const AGENT_ORDER = ["lea", "hugo", "emma", "louis", "sarah"] as const;

/** French labels of the four outcomes of a run, as the history displays them. */
export const AGENT_RUN_STATUS_LABELS = {
  running: "En cours",
  succeeded: "Réussie",
  failed: "Échec",
  blocked: "Bloquée",
} as const;

export type AgentRunStatus = keyof typeof AGENT_RUN_STATUS_LABELS;

/**
 * Texts of the activity figures of the "Agents IA" screen.
 *
 * The two time windows are named here because the screen MUST say which one it
 * is showing: "3 exécutions" alone is a number without a meaning, and a number
 * without a meaning is the first step towards a wrong one.
 */
export const AGENT_ACTIVITY_TEXTS = {
  /** Current Europe/Paris calendar day — the unit the daily limit counts in. */
  todayWindow: "aujourd'hui",
  /** Rolling window: the current Paris day and the six days before it. */
  last7DaysWindow: "sur 7 jours",
  /** Shown instead of a date when an agent has never been launched. */
  neverRan: "Jamais exécuté",
  /** Shown when a figure could not be read. NEVER display a zero instead. */
  unknownFigure: "Indisponible",
} as const;

/** How many Paris days the wider activity window covers (today included). */
export const AGENT_ACTIVITY_WINDOW_DAYS = 7;

/**
 * Labels of the steps journaled in `ai_agent_run_steps` (see lib/agents/steps.ts).
 *
 * They are displayed as-is in the "l'agent au travail" replay, so they are
 * centralised here like every other user-facing text, and kept short (the
 * column is bounded at 200 characters). Agent-specific labels live in the
 * agent's own folder.
 */
export const AGENT_STEP_LABELS = {
  guardrails_ok:
    "Garde-fous vérifiés : appartenance du contact, coupe-circuit, volume quotidien, reprise humaine.",
  context_loaded: "Dossier CRM chargé.",
  prompt_built:
    "Prompt construit : faits CRM d'un côté, texte du prospect isolé comme donnée non fiable.",
  ai_call_ok: "Réponse reçue du fournisseur IA.",
  ai_call_unavailable: "Fournisseur IA indisponible : aucune action.",
  output_valid: "Sortie conforme au schéma de l'agent.",
  output_invalid: "Sortie refusée par le schéma : elle ne sera pas utilisée.",
  no_write: "Repli sûr : aucune écriture métier, une tâche est ouverte pour un conseiller.",
  persisted: "Écritures effectuées et historique CRM mis à jour.",
} as const;

/** Why a run was stopped before it started, in one displayable sentence. */
export const AGENT_STEP_BLOCK_LABELS = {
  ai_paused: "Arrêt : le coupe-circuit de l'agence est actif.",
  ai_daily_run_limit_reached: "Arrêt : la limite quotidienne d'exécutions de l'agence est atteinte.",
  human_takeover: "Arrêt : le dossier est repris en main par un conseiller.",
} as const satisfies Partial<Record<AgentErrorCode, string>>;

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
  // --- Léa (acquisition) -----------------------------------------------------
  lead_incomplete: {
    title: "Lead entrant incomplet : fiche à compléter manuellement",
    details:
      "Un lead entrant ne contient pas assez d'éléments pour créer une fiche contact (il faut au minimum " +
      "un nom et une adresse email ou un numéro de téléphone). Éléments manquants : {fields}. " +
      "Rien n'a été inventé et aucune fiche n'a été créée : à compléter par un conseiller.",
  },
  lead_duplicate: {
    title: "Doublon détecté : lead rattaché à une fiche existante",
    details:
      "Un lead entrant correspond exactement à une fiche déjà présente ({match}). Aucune seconde fiche n'a été " +
      "créée : le lead a été rattaché au contact existant. À relire par un conseiller pour reprendre, s'il y a " +
      "lieu, les éléments nouveaux du message.",
  },
  collect_consent: {
    title: "Recueillir le consentement avant tout contact",
    details:
      "Une fiche contact vient d'être créée à partir d'un lead entrant. Un lead n'est PAS un consentement : " +
      "aucun email, SMS, message WhatsApp ni appel n'est autorisé tant qu'un consentement prouvable n'a pas " +
      "été recueilli et enregistré.",
  },
  // --- Emma (relation) -------------------------------------------------------
  follow_up_consent_missing: {
    title: "Consentement manquant : relance impossible",
    details:
      "Aucun consentement valide (accordé et non retiré) n'a été trouvé pour joindre ce contact par email, " +
      "SMS ou WhatsApp. Aucun brouillon de relance n'a été préparé : à traiter par un conseiller, en " +
      "recueillant d'abord un consentement prouvable.",
  },
  follow_up_channel_missing: {
    title: "Coordonnées manquantes : relance impossible",
    details:
      "Ce contact n'a ni adresse email ni numéro de téléphone exploitable : aucun brouillon de relance n'a pu " +
      "être préparé. À compléter par un conseiller.",
  },
  // --- Sarah (suivi) ---------------------------------------------------------
  appointment_report_missing: {
    title: "Compte-rendu de rendez-vous à saisir",
    details:
      "Le rendez-vous d'estimation n'a pas de compte-rendu : Sarah ne peut rien en déduire et n'invente rien. " +
      "À saisir par le conseiller qui a réalisé le rendez-vous.",
  },
  follow_through_next_steps: {
    title: "Suite du rendez-vous d'estimation : prochaines actions",
    details:
      "À partir du compte-rendu rédigé par le conseiller, Sarah a préparé les prochaines actions du dossier. " +
      "Aucune n'est exécutée automatiquement : {steps}",
  },
  missing_documents: {
    title: "Documents manquants au dossier",
    details:
      "Le compte-rendu du rendez-vous mentionne des documents encore absents du dossier : {documents}. " +
      "À demander au vendeur.",
  },
  follow_through_to_review: {
    title: "Suivi de rendez-vous à vérifier",
    details:
      "Le compte-rendu n'a pas permis un suivi fiable (éléments trop partiels ou contradictoires). " +
      "Aucune étape du pipeline n'a été modifiée : à relire par un conseiller.",
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

/** Identity fields Léa can extract from a lead. */
export const LEAD_FIELD_LABELS = {
  first_name: "prénom",
  last_name: "nom",
  email: "adresse email",
  phone: "numéro de téléphone",
} as const;

export type LeadField = keyof typeof LEAD_FIELD_LABELS;

export function listLeadFieldLabels(fields: readonly LeadField[]): string {
  if (fields.length === 0) return "aucun";
  return fields.map((field) => LEAD_FIELD_LABELS[field]).join(", ");
}

/** Joins short items for a task body, or says plainly that there are none. */
export function listOrNone(items: readonly string[]): string {
  const cleaned = items.map((item) => item.trim()).filter((item) => item.length > 0);
  return cleaned.length === 0 ? "aucun élément précisé" : cleaned.join(" ; ");
}
