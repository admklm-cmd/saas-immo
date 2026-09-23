export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          actor_agent: Database["public"]["Enums"]["ai_agent_name"] | null
          actor_type: Database["public"]["Enums"]["activity_actor_type"]
          actor_user_id: string | null
          agency_id: string
          contact_id: string | null
          created_at: string
          id: string
          is_simulation: boolean
          occurred_at: string
          payload: Json
          summary: string
          type: string
        }
        Insert: {
          actor_agent?: Database["public"]["Enums"]["ai_agent_name"] | null
          actor_type: Database["public"]["Enums"]["activity_actor_type"]
          actor_user_id?: string | null
          agency_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          is_simulation: boolean
          occurred_at?: string
          payload?: Json
          summary: string
          type: string
        }
        Update: {
          actor_agent?: Database["public"]["Enums"]["ai_agent_name"] | null
          actor_type?: Database["public"]["Enums"]["activity_actor_type"]
          actor_user_id?: string | null
          agency_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          is_simulation?: boolean
          occurred_at?: string
          payload?: Json
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_fkey"
            columns: ["agency_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      agencies: {
        Row: {
          ai_daily_run_limit: number
          ai_paused: boolean
          city: string | null
          created_at: string
          id: string
          name: string
          sector: string | null
          updated_at: string
        }
        Insert: {
          ai_daily_run_limit?: number
          ai_paused?: boolean
          city?: string | null
          created_at?: string
          id?: string
          name: string
          sector?: string | null
          updated_at?: string
        }
        Update: {
          ai_daily_run_limit?: number
          ai_paused?: boolean
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          sector?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_agent_run_steps: {
        Row: {
          agency_id: string
          created_at: string
          detail: Json
          duration_ms: number
          finished_at: string
          id: string
          label: string
          phase: Database["public"]["Enums"]["ai_agent_run_phase"]
          run_id: string
          started_at: string
          status: Database["public"]["Enums"]["ai_agent_run_step_status"]
          step_index: number
        }
        Insert: {
          agency_id: string
          created_at?: string
          detail?: Json
          duration_ms?: number
          finished_at: string
          id?: string
          label: string
          phase: Database["public"]["Enums"]["ai_agent_run_phase"]
          run_id: string
          started_at: string
          status: Database["public"]["Enums"]["ai_agent_run_step_status"]
          step_index: number
        }
        Update: {
          agency_id?: string
          created_at?: string
          detail?: Json
          duration_ms?: number
          finished_at?: string
          id?: string
          label?: string
          phase?: Database["public"]["Enums"]["ai_agent_run_phase"]
          run_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["ai_agent_run_step_status"]
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_run_steps_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_run_steps_run_fkey"
            columns: ["agency_id", "run_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_runs"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      ai_agent_runs: {
        Row: {
          agency_id: string
          agent: Database["public"]["Enums"]["ai_agent_name"]
          contact_id: string | null
          created_at: string
          decision: string | null
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          input_tokens: number
          is_simulation: boolean
          model: string | null
          output: Json | null
          output_tokens: number
          provider: string
          started_at: string
          status: Database["public"]["Enums"]["ai_agent_run_status"]
          triggered_by_user_id: string | null
        }
        Insert: {
          agency_id: string
          agent: Database["public"]["Enums"]["ai_agent_name"]
          contact_id?: string | null
          created_at?: string
          decision?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          input_tokens?: number
          is_simulation?: boolean
          model?: string | null
          output?: Json | null
          output_tokens?: number
          provider?: string
          started_at?: string
          status?: Database["public"]["Enums"]["ai_agent_run_status"]
          triggered_by_user_id?: string | null
        }
        Update: {
          agency_id?: string
          agent?: Database["public"]["Enums"]["ai_agent_name"]
          contact_id?: string | null
          created_at?: string
          decision?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          input_tokens?: number
          is_simulation?: boolean
          model?: string | null
          output?: Json | null
          output_tokens?: number
          provider?: string
          started_at?: string
          status?: Database["public"]["Enums"]["ai_agent_run_status"]
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_runs_contact_fkey"
            columns: ["agency_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "ai_agent_runs_triggered_by_fkey"
            columns: ["agency_id", "triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["agency_id", "user_id"]
          },
        ]
      }
      appointments: {
        Row: {
          agency_id: string
          assigned_user_id: string
          contact_id: string
          created_at: string
          ends_at: string
          id: string
          is_simulation: boolean
          property_id: string | null
          report_notes: string | null
          report_recorded_at: string | null
          report_recorded_by: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          assigned_user_id: string
          contact_id: string
          created_at?: string
          ends_at: string
          id?: string
          is_simulation?: boolean
          property_id?: string | null
          report_notes?: string | null
          report_recorded_at?: string | null
          report_recorded_by?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_user_id?: string
          contact_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          is_simulation?: boolean
          property_id?: string | null
          report_notes?: string | null
          report_recorded_at?: string | null
          report_recorded_by?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_assigned_user_fkey"
            columns: ["agency_id", "assigned_user_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["agency_id", "user_id"]
          },
          {
            foreignKeyName: "appointments_contact_fkey"
            columns: ["agency_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "appointments_property_fkey"
            columns: ["agency_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      consents: {
        Row: {
          agency_id: string
          channel: Database["public"]["Enums"]["consent_channel"]
          contact_id: string | null
          created_at: string
          id: string
          presented_text: string | null
          proof: Json
          recorded_at: string
          recorded_by: string | null
          source: string
          status: Database["public"]["Enums"]["consent_status"]
          text_version: string | null
        }
        Insert: {
          agency_id: string
          channel: Database["public"]["Enums"]["consent_channel"]
          contact_id?: string | null
          created_at?: string
          id?: string
          presented_text?: string | null
          proof?: Json
          recorded_at?: string
          recorded_by?: string | null
          source: string
          status: Database["public"]["Enums"]["consent_status"]
          text_version?: string | null
        }
        Update: {
          agency_id?: string
          channel?: Database["public"]["Enums"]["consent_channel"]
          contact_id?: string | null
          created_at?: string
          id?: string
          presented_text?: string | null
          proof?: Json
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["consent_status"]
          text_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_contact_fkey"
            columns: ["agency_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      contacts: {
        Row: {
          agency_id: string
          assigned_user_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          human_takeover: boolean
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          sale_motivation: string | null
          sale_timeline: string | null
          source: Database["public"]["Enums"]["contact_source"]
          stage: Database["public"]["Enums"]["pipeline_stage"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          assigned_user_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          human_takeover?: boolean
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          sale_motivation?: string | null
          sale_timeline?: string | null
          source: Database["public"]["Enums"]["contact_source"]
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_user_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          human_takeover?: boolean
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          sale_motivation?: string | null
          sale_timeline?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_assigned_user_fkey"
            columns: ["agency_id", "assigned_user_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["agency_id", "user_id"]
          },
        ]
      }
      inbound_leads: {
        Row: {
          agency_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          processed_run_id: string | null
          raw_text: string | null
          source: Database["public"]["Enums"]["contact_source"]
          status: Database["public"]["Enums"]["inbound_lead_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          processed_run_id?: string | null
          raw_text?: string | null
          source: Database["public"]["Enums"]["contact_source"]
          status?: Database["public"]["Enums"]["inbound_lead_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          processed_run_id?: string | null
          raw_text?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          status?: Database["public"]["Enums"]["inbound_lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_leads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_leads_contact_fkey"
            columns: ["agency_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "inbound_leads_created_by_fkey"
            columns: ["agency_id", "created_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["agency_id", "user_id"]
          },
          {
            foreignKeyName: "inbound_leads_run_fkey"
            columns: ["agency_id", "processed_run_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_runs"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_messages: {
        Row: {
          agency_id: string
          body: string
          channel: Database["public"]["Enums"]["consent_channel"]
          contact_id: string
          created_at: string
          created_by_agent: Database["public"]["Enums"]["ai_agent_name"] | null
          id: string
          idempotency_key: string
          is_simulation: boolean
          rejection_note: string | null
          rejection_reason: string | null
          rejection_reason_label: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["outbound_message_status"]
          subject: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          agency_id: string
          body: string
          channel: Database["public"]["Enums"]["consent_channel"]
          contact_id: string
          created_at?: string
          created_by_agent?: Database["public"]["Enums"]["ai_agent_name"] | null
          id?: string
          idempotency_key: string
          is_simulation?: boolean
          rejection_note?: string | null
          rejection_reason?: string | null
          rejection_reason_label?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_message_status"]
          subject?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          agency_id?: string
          body?: string
          channel?: Database["public"]["Enums"]["consent_channel"]
          contact_id?: string
          created_at?: string
          created_by_agent?: Database["public"]["Enums"]["ai_agent_name"] | null
          id?: string
          idempotency_key?: string
          is_simulation?: boolean
          rejection_note?: string | null
          rejection_reason?: string | null
          rejection_reason_label?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_message_status"]
          subject?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_messages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_contact_fkey"
            columns: ["agency_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "outbound_messages_validated_by_fkey"
            columns: ["agency_id", "validated_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["agency_id", "user_id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          agency_id: string
          city: string | null
          contact_id: string
          created_at: string
          estimated_value_eur: number | null
          estimated_value_recorded_at: string | null
          estimated_value_recorded_by: string | null
          estimated_value_source: string | null
          id: string
          postal_code: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          rooms: number | null
          sector: string | null
          surface_m2: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agency_id: string
          city?: string | null
          contact_id: string
          created_at?: string
          estimated_value_eur?: number | null
          estimated_value_recorded_at?: string | null
          estimated_value_recorded_by?: string | null
          estimated_value_source?: string | null
          id?: string
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rooms?: number | null
          sector?: string | null
          surface_m2?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agency_id?: string
          city?: string | null
          contact_id?: string
          created_at?: string
          estimated_value_eur?: number | null
          estimated_value_recorded_at?: string | null
          estimated_value_recorded_by?: string | null
          estimated_value_source?: string | null
          id?: string
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rooms?: number | null
          sector?: string | null
          surface_m2?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_contact_fkey"
            columns: ["agency_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      tasks: {
        Row: {
          agency_id: string
          assigned_user_id: string | null
          completed_at: string | null
          completed_by: string | null
          contact_id: string | null
          created_at: string
          created_by_agent: Database["public"]["Enums"]["ai_agent_name"] | null
          details: string | null
          due_at: string | null
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          assigned_user_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_agent?: Database["public"]["Enums"]["ai_agent_name"] | null
          details?: string | null
          due_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_user_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_agent?: Database["public"]["Enums"]["ai_agent_name"] | null
          details?: string | null
          due_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_user_fkey"
            columns: ["agency_id", "assigned_user_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["agency_id", "user_id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["agency_id", "completed_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["agency_id", "user_id"]
          },
          {
            foreignKeyName: "tasks_contact_fkey"
            columns: ["agency_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
    }
    Views: {
      current_consents: {
        Row: {
          agency_id: string | null
          channel: Database["public"]["Enums"]["consent_channel"] | null
          contact_id: string | null
          created_at: string | null
          id: string | null
          recorded_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["consent_status"] | null
          text_version: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_contact_fkey"
            columns: ["agency_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
    }
    Functions: {
      agent_activity_summary: {
        Args: { day_start: string; target_agency: string; window_start: string }
        Returns: {
          agent_name: Database["public"]["Enums"]["ai_agent_name"]
          today_blocked: number
          today_failed: number
          today_input_tokens: number
          today_output_tokens: number
          today_running: number
          today_succeeded: number
          today_total: number
          window_blocked: number
          window_failed: number
          window_input_tokens: number
          window_output_tokens: number
          window_running: number
          window_succeeded: number
          window_total: number
        }[]
      }
      change_contact_stage: {
        Args: {
          mandate_confirmed?: boolean
          new_stage: Database["public"]["Enums"]["pipeline_stage"]
          reason?: string
          target_contact: string
        }
        Returns: {
          activity_id: string
          changed_at: string
          contact_id: string
          current_stage: Database["public"]["Enums"]["pipeline_stage"]
          previous_stage: Database["public"]["Enums"]["pipeline_stage"]
        }[]
      }
      set_ai_paused: {
        Args: { paused: boolean; target_agency: string }
        Returns: boolean
      }
      submit_estimation_request: {
        Args: {
          p_city: string
          p_consent_email: boolean
          p_consent_phone: boolean
          p_consent_sms: boolean
          p_consent_whatsapp: boolean
          p_email: string
          p_first_name: string
          p_ip_hash: string
          p_last_name: string
          p_message: string
          p_phone: string
          p_postal_code: string
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_rooms: number
          p_surface_m2: number
          p_user_agent: string
          p_website: string
        }
        Returns: undefined
      }
    }
    Enums: {
      activity_actor_type: "user" | "ai_agent" | "system"
      ai_agent_name: "lea" | "hugo" | "emma" | "louis" | "sarah"
      ai_agent_run_phase:
        | "guardrails"
        | "context_loaded"
        | "prompt_built"
        | "ai_call"
        | "output_validated"
        | "decision"
        | "persisted"
      ai_agent_run_status: "running" | "succeeded" | "failed" | "blocked"
      ai_agent_run_step_status: "ok" | "blocked" | "failed" | "skipped"
      appointment_status: "proposed" | "confirmed" | "cancelled" | "done"
      consent_channel: "email" | "sms" | "whatsapp" | "phone"
      consent_status: "granted" | "withdrawn"
      contact_source:
        | "estimation_form"
        | "website_form"
        | "manual_entry"
        | "inbound_call"
        | "inbound_email"
        | "referral"
        | "partner_api"
        | "software_import"
      inbound_lead_status: "pending" | "processed" | "duplicate" | "rejected"
      membership_role: "agent" | "director"
      outbound_message_status:
        | "pending_validation"
        | "approved"
        | "rejected"
        | "sent_simulated"
      pipeline_stage:
        | "nouveau"
        | "qualifie"
        | "chaud"
        | "rdv_planifie"
        | "estimation_faite"
        | "mandat_signe"
        | "perdu"
      property_type: "apartment" | "house" | "land" | "commercial" | "other"
      task_status: "open" | "done" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_actor_type: ["user", "ai_agent", "system"],
      ai_agent_name: ["lea", "hugo", "emma", "louis", "sarah"],
      ai_agent_run_phase: [
        "guardrails",
        "context_loaded",
        "prompt_built",
        "ai_call",
        "output_validated",
        "decision",
        "persisted",
      ],
      ai_agent_run_status: ["running", "succeeded", "failed", "blocked"],
      ai_agent_run_step_status: ["ok", "blocked", "failed", "skipped"],
      appointment_status: ["proposed", "confirmed", "cancelled", "done"],
      consent_channel: ["email", "sms", "whatsapp", "phone"],
      consent_status: ["granted", "withdrawn"],
      contact_source: [
        "estimation_form",
        "website_form",
        "manual_entry",
        "inbound_call",
        "inbound_email",
        "referral",
        "partner_api",
        "software_import",
      ],
      inbound_lead_status: ["pending", "processed", "duplicate", "rejected"],
      membership_role: ["agent", "director"],
      outbound_message_status: [
        "pending_validation",
        "approved",
        "rejected",
        "sent_simulated",
      ],
      pipeline_stage: [
        "nouveau",
        "qualifie",
        "chaud",
        "rdv_planifie",
        "estimation_faite",
        "mandat_signe",
        "perdu",
      ],
      property_type: ["apartment", "house", "land", "commercial", "other"],
      task_status: ["open", "done", "cancelled"],
    },
  },
} as const

