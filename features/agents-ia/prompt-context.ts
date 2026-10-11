import type { AiFacts, AiUntrustedField } from "@/lib/claude/provider";
import type { Database } from "@/types/database";

type ContactSource = Database["public"]["Enums"]["contact_source"];
type PipelineStage = Database["public"]["Enums"]["pipeline_stage"];
type PropertyType = Database["public"]["Enums"]["property_type"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
type MessageChannel = Exclude<Database["public"]["Enums"]["consent_channel"], "phone">;

export type AgentPromptContext = {
  facts: AiFacts;
  untrusted: readonly AiUntrustedField[];
};

type PropertyPromptInput = {
  known: boolean;
  type: PropertyType | null;
  city: string | null;
  sector: string | null;
  surfaceM2: number | null;
  rooms: number | null;
  postalCode?: string | null;
};

type ContactTextInput = {
  notes: string | null;
  historySummaries: readonly string[];
};

function propertyFacts(property: PropertyPromptInput): AiFacts {
  return {
    property_known: property.known,
    property_type: property.type,
    property_postal_code: property.postalCode ?? null,
    property_surface_m2: property.surfaceM2,
    property_rooms: property.rooms,
  };
}

function propertyText(property: PropertyPromptInput): AiUntrustedField[] {
  return [
    { label: "property_city", content: property.city ?? "" },
    { label: "property_sector", content: property.sector ?? "" },
  ];
}

function contactText(input: ContactTextInput): AiUntrustedField[] {
  return [
    { label: "contact_notes", content: input.notes ?? "" },
    { label: "historique_recent", content: input.historySummaries.join("\n") },
  ];
}

/** Keep persisted business strings out of the trusted facts section. */
export function buildHugoPromptContext(input: {
  stage: PipelineStage;
  source: ContactSource;
  hasEmail: boolean;
  hasPhone: boolean;
  saleMotivation: string | null;
  saleTimeline: string | null;
  property: PropertyPromptInput;
  contactText: ContactTextInput;
}): AgentPromptContext {
  return {
    facts: {
      contact_stage: input.stage,
      contact_source: input.source,
      contact_has_email: input.hasEmail,
      contact_has_phone: input.hasPhone,
      ...propertyFacts(input.property),
    },
    untrusted: [
      { label: "contact_sale_motivation", content: input.saleMotivation ?? "" },
      { label: "contact_sale_timeline", content: input.saleTimeline ?? "" },
      ...propertyText(input.property),
      ...contactText(input.contactText),
    ],
  };
}

type MessagePromptInput = {
  agencyName: string;
  contactFirstName: string | null;
  contactStage: PipelineStage;
  contactSource?: ContactSource;
  saleMotivation: string | null;
  saleTimeline: string | null;
  property: PropertyPromptInput;
  channel: MessageChannel;
  contactText: ContactTextInput;
};

function messageContext(input: MessagePromptInput): AgentPromptContext {
  return {
    facts: {
      contact_stage: input.contactStage,
      ...(input.contactSource === undefined ? {} : { contact_source: input.contactSource }),
      ...propertyFacts(input.property),
      message_channel: input.channel,
    },
    untrusted: [
      { label: "agency_name", content: input.agencyName },
      { label: "contact_first_name", content: input.contactFirstName ?? "" },
      { label: "contact_sale_motivation", content: input.saleMotivation ?? "" },
      { label: "contact_sale_timeline", content: input.saleTimeline ?? "" },
      ...propertyText(input.property),
      ...contactText(input.contactText),
    ],
  };
}

export function buildEmmaPromptContext(
  input: MessagePromptInput & {
    daysSinceLastMessage: number | null;
    hasPendingAppointment: boolean;
  },
): AgentPromptContext {
  const context = messageContext(input);
  return {
    ...context,
    facts: {
      ...context.facts,
      days_since_last_message: input.daysSinceLastMessage,
      has_pending_appointment: input.hasPendingAppointment,
    },
  };
}

export function buildLouisPromptContext(
  input: MessagePromptInput & { appointmentDurationMinutes: number },
): AgentPromptContext {
  const context = messageContext(input);
  return {
    ...context,
    facts: {
      ...context.facts,
      appointment_duration_minutes: input.appointmentDurationMinutes,
    },
  };
}

export function buildSarahPromptContext(input: {
  stage: PipelineStage;
  appointmentStatus: AppointmentStatus;
  daysSinceAppointment: number;
  report: string;
  property: PropertyPromptInput;
  contactText: ContactTextInput;
}): AgentPromptContext {
  return {
    facts: {
      contact_stage: input.stage,
      appointment_status: input.appointmentStatus,
      days_since_appointment: input.daysSinceAppointment,
      report_chars: input.report.length,
      ...propertyFacts(input.property),
    },
    untrusted: [
      { label: "compte_rendu_rendez_vous", content: input.report },
      ...propertyText(input.property),
      ...contactText(input.contactText),
    ],
  };
}
