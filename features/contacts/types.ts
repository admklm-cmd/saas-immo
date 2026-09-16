/**
 * Contacts domain — types exposed to the UI.
 *
 * Every read goes through the server Supabase client, so RLS applies: a user
 * only ever sees the contacts of their own agency.
 */

import type { Enums, Tables } from "@/lib/agents/types";

export type PipelineStage = Enums["pipeline_stage"];
export type ContactSource = Enums["contact_source"];
export type PropertyType = Enums["property_type"];
export type ConsentChannel = Enums["consent_channel"];
export type ConsentStatus = Enums["consent_status"];
export type AiAgentName = Enums["ai_agent_name"];

export type ContactProperty = Pick<
  Tables["properties"]["Row"],
  "id" | "property_type" | "address" | "postal_code" | "city" | "sector" | "surface_m2" | "rooms"
>;

export type ContactListItem = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  /** "Prénom Nom", or "Contact sans nom" when both are missing. */
  displayName: string;
  email: string | null;
  phone: string | null;
  source: ContactSource;
  stage: PipelineStage;
  saleMotivation: string | null;
  saleTimeline: string | null;
  humanTakeover: boolean;
  assignedUserId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Main property of the contact, when there is one. */
  property: ContactProperty | null;
  openTasksCount: number;
};

export type ContactConsent = {
  channel: ConsentChannel;
  status: ConsentStatus;
  textVersion: string | null;
  source: string;
  recordedAt: string;
};

export type ContactDetail = ContactListItem & {
  notes: string | null;
  /** Current consent per channel (most recent row), from `current_consents`. */
  consents: ContactConsent[];
};

export type TimelineEntryKind = "activity" | "appointment" | "message" | "task" | "ai_run";

export type TimelineActor = {
  type: Enums["activity_actor_type"];
  agent: AiAgentName | null;
  userId: string | null;
};

export type TimelineEntry = {
  id: string;
  kind: TimelineEntryKind;
  /** ISO timestamp used for the (descending) ordering of the whole timeline. */
  occurredAt: string;
  title: string;
  description: string | null;
  /** Simulated action (prototype): must be badged as such in the UI. */
  isSimulation: boolean;
  actor: TimelineActor;
  /** Status of the underlying row (appointment, message, task, AI run). */
  status: string | null;
  /** Small, UI-oriented extra data (channel, tokens, stage…). */
  meta: Record<string, string | number | boolean | null>;
};

/** French labels of the timeline kinds (UI text stays centralised). */
export const TIMELINE_KIND_LABELS: Readonly<Record<TimelineEntryKind, string>> = {
  activity: "Historique",
  appointment: "Rendez-vous",
  message: "Message",
  task: "Tâche",
  ai_run: "Exécution IA",
};

export const PIPELINE_STAGE_LABELS: Readonly<Record<PipelineStage, string>> = {
  nouveau: "Nouveau",
  qualifie: "Qualifié",
  chaud: "Chaud",
  rdv_planifie: "RDV planifié",
  estimation_faite: "Estimation faite",
  mandat_signe: "Mandat signé",
  perdu: "Perdu",
};

export const CONTACT_SOURCE_LABELS: Readonly<Record<ContactSource, string>> = {
  estimation_form: "Formulaire d'estimation",
  website_form: "Formulaire du site",
  manual_entry: "Saisie manuelle",
  inbound_call: "Appel entrant",
  inbound_email: "Email entrant",
  referral: "Recommandation",
  partner_api: "API partenaire",
  software_import: "Import logiciel métier",
};

export const CONSENT_CHANNEL_LABELS: Readonly<Record<ConsentChannel, string>> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  phone: "Téléphone",
};

export const APPOINTMENT_STATUS_LABELS: Readonly<Record<Enums["appointment_status"], string>> = {
  proposed: "Proposé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  done: "Réalisé",
};

export const MESSAGE_STATUS_LABELS: Readonly<Record<Enums["outbound_message_status"], string>> = {
  pending_validation: "À valider",
  approved: "Validé",
  rejected: "Refusé",
  sent_simulated: "Envoyé (simulation)",
};

export const TASK_STATUS_LABELS: Readonly<Record<Enums["task_status"], string>> = {
  open: "À faire",
  done: "Terminée",
  cancelled: "Annulée",
};

export const AI_RUN_STATUS_LABELS: Readonly<Record<Enums["ai_agent_run_status"], string>> = {
  running: "En cours",
  succeeded: "Réussie",
  failed: "Échec",
  blocked: "Bloquée",
};
