export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
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
      academic_periods: {
        Row: {
          created_at: string
          ends_on: string
          exam_session: string | null
          id: string
          kind: string
          starts_on: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          exam_session?: string | null
          id?: string
          kind: string
          starts_on: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          exam_session?: string | null
          id?: string
          kind?: string
          starts_on?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_runs: {
        Row: {
          cached_tokens: number | null
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          input_tokens: number | null
          model: string
          ok: boolean
          output_tokens: number | null
          provider: string
          task: Database["public"]["Enums"]["ai_task"]
          user_id: string
        }
        Insert: {
          cached_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          model: string
          ok: boolean
          output_tokens?: number | null
          provider: string
          task: Database["public"]["Enums"]["ai_task"]
          user_id?: string
        }
        Update: {
          cached_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          model?: string
          ok?: boolean
          output_tokens?: number | null
          provider?: string
          task?: Database["public"]["Enums"]["ai_task"]
          user_id?: string
        }
        Relationships: []
      }
      assessment_units: {
        Row: {
          assessment_id: string
          assigned_by: Database["public"]["Enums"]["assigned_by"]
          included: boolean
          unit_id: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          assigned_by?: Database["public"]["Enums"]["assigned_by"]
          included?: boolean
          unit_id: string
          user_id?: string
        }
        Update: {
          assessment_id?: string
          assigned_by?: Database["public"]["Enums"]["assigned_by"]
          included?: boolean
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_units_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          at: string
          at_latest: string | null
          contingent: boolean
          created_at: string
          date_tentative: boolean
          entry_min_points: number | null
          exam_period_id: string | null
          format: Database["public"]["Enums"]["exam_format"]
          id: string
          kind: Database["public"]["Enums"]["assessment_kind"]
          pass_min_pct: number | null
          passed: boolean
          points_max: number | null
          points_unit: string
          readiness_before: number | null
          result_annulled: boolean
          result_max: number | null
          result_points: number | null
          retake_of: string | null
          scope_all: boolean
          subject_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          at: string
          at_latest?: string | null
          contingent?: boolean
          created_at?: string
          date_tentative?: boolean
          entry_min_points?: number | null
          exam_period_id?: string | null
          format?: Database["public"]["Enums"]["exam_format"]
          id?: string
          kind?: Database["public"]["Enums"]["assessment_kind"]
          pass_min_pct?: number | null
          passed?: boolean
          points_max?: number | null
          points_unit?: string
          readiness_before?: number | null
          result_annulled?: boolean
          result_max?: number | null
          result_points?: number | null
          retake_of?: string | null
          scope_all?: boolean
          subject_id: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          at?: string
          at_latest?: string | null
          contingent?: boolean
          created_at?: string
          date_tentative?: boolean
          entry_min_points?: number | null
          exam_period_id?: string | null
          format?: Database["public"]["Enums"]["exam_format"]
          id?: string
          kind?: Database["public"]["Enums"]["assessment_kind"]
          pass_min_pct?: number | null
          passed?: boolean
          points_max?: number | null
          points_unit?: string
          readiness_before?: number | null
          result_annulled?: boolean
          result_max?: number | null
          result_points?: number | null
          retake_of?: string | null
          scope_all?: boolean
          subject_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_exam_period_id_fkey"
            columns: ["exam_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_retake_of_fkey"
            columns: ["retake_of"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_days: {
        Row: {
          cap_min: number | null
          created_at: string
          id: string
          on_date: string
          slots: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cap_min?: number | null
          created_at?: string
          id?: string
          on_date: string
          slots?: Json | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          cap_min?: number | null
          created_at?: string
          id?: string
          on_date?: string
          slots?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      availability_exceptions: {
        Row: {
          end_min: number | null
          id: string
          is_busy: boolean
          lecture_log_id: string | null
          on_date: string
          start_min: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          end_min?: number | null
          id?: string
          is_busy?: boolean
          lecture_log_id?: string | null
          on_date: string
          start_min?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          end_min?: number | null
          id?: string
          is_busy?: boolean
          lecture_log_id?: string | null
          on_date?: string
          start_min?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_lecture_log_id_fkey"
            columns: ["lecture_log_id"]
            isOneToOne: false
            referencedRelation: "lecture_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          end_min: number
          id: string
          over_classes: boolean
          start_min: number
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          end_min: number
          id?: string
          over_classes?: boolean
          start_min: number
          updated_at?: string
          user_id?: string
          weekday: number
        }
        Update: {
          end_min?: number
          id?: string
          over_classes?: boolean
          start_min?: number
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      calendar_feeds: {
        Row: {
          all_day_busy: boolean
          busy_only: boolean
          color: string | null
          created_at: string
          id: string
          kind: string
          last_error: string | null
          last_synced_at: string | null
          title: string
          updated_at: string
          url: string
          url_hint: string | null
          user_id: string
        }
        Insert: {
          all_day_busy?: boolean
          busy_only?: boolean
          color?: string | null
          created_at?: string
          id?: string
          kind: string
          last_error?: string | null
          last_synced_at?: string | null
          title: string
          updated_at?: string
          url: string
          url_hint?: string | null
          user_id?: string
        }
        Update: {
          all_day_busy?: boolean
          busy_only?: boolean
          color?: string | null
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          last_synced_at?: string | null
          title?: string
          updated_at?: string
          url?: string
          url_hint?: string | null
          user_id?: string
        }
        Relationships: []
      }
      card_embeddings: {
        Row: {
          card_id: string
          embedding: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          embedding: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          card_id?: string
          embedding?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_embeddings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          back: string
          created_at: string
          front: string
          fsrs_difficulty: number | null
          fsrs_lapses: number
          fsrs_reps: number
          fsrs_stability: number | null
          fsrs_state: number | null
          id: string
          last_review_at: string | null
          next_review_on: string | null
          origin: Database["public"]["Enums"]["assigned_by"]
          review_streak: number
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          front: string
          fsrs_difficulty?: number | null
          fsrs_lapses?: number
          fsrs_reps?: number
          fsrs_stability?: number | null
          fsrs_state?: number | null
          id?: string
          last_review_at?: string | null
          next_review_on?: string | null
          origin?: Database["public"]["Enums"]["assigned_by"]
          review_streak?: number
          unit_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          back?: string
          created_at?: string
          front?: string
          fsrs_difficulty?: number | null
          fsrs_lapses?: number
          fsrs_reps?: number
          fsrs_stability?: number | null
          fsrs_state?: number | null
          id?: string
          last_review_at?: string | null
          next_review_on?: string | null
          origin?: Database["public"]["Enums"]["assigned_by"]
          review_streak?: number
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      deadlines: {
        Row: {
          created_at: string
          done: boolean
          done_minutes: number
          due_at: string
          est_minutes: number | null
          id: string
          kind: Database["public"]["Enums"]["deadline_kind"]
          notes: string | null
          pass_min_pct: number | null
          points_max: number | null
          points_unit: string
          result_max: number | null
          result_points: number | null
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_minutes?: number
          due_at: string
          est_minutes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["deadline_kind"]
          notes?: string | null
          pass_min_pct?: number | null
          points_max?: number | null
          points_unit?: string
          result_max?: number | null
          result_points?: number | null
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_minutes?: number
          due_at?: string
          est_minutes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["deadline_kind"]
          notes?: string | null
          pass_min_pct?: number | null
          points_max?: number | null
          points_unit?: string
          result_max?: number | null
          result_points?: number | null
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          page: number | null
          position: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          page?: number | null
          position: number
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          page?: number | null
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          id: string
          kind: string
          media_type: string | null
          pages: number | null
          storage_path: string | null
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          media_type?: string | null
          pages?: number | null
          storage_path?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          media_type?: string | null
          pages?: number | null
          storage_path?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      external_events: {
        Row: {
          all_day: boolean
          category: string | null
          deadline_id: string | null
          ends_at: string
          feed_id: string
          id: string
          ignored: boolean
          location: string | null
          starts_at: string
          title: string | null
          uid: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          category?: string | null
          deadline_id?: string | null
          ends_at: string
          feed_id: string
          id?: string
          ignored?: boolean
          location?: string | null
          starts_at: string
          title?: string | null
          uid: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          all_day?: boolean
          category?: string | null
          deadline_id?: string | null
          ends_at?: string
          feed_id?: string
          id?: string
          ignored?: boolean
          location?: string | null
          starts_at?: string
          title?: string | null
          uid?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_events_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_events_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "calendar_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_logs: {
        Row: {
          cancelled: boolean
          created_at: string
          id: string
          note: string | null
          on_date: string
          source_id: string | null
          subject_id: string
          timetable_entry_id: string | null
          up_to_unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled?: boolean
          created_at?: string
          id?: string
          note?: string | null
          on_date: string
          source_id?: string | null
          subject_id: string
          timetable_entry_id?: string | null
          up_to_unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          cancelled?: boolean
          created_at?: string
          id?: string
          note?: string | null
          on_date?: string
          source_id?: string | null
          subject_id?: string
          timetable_entry_id?: string | null
          up_to_unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecture_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_logs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_logs_timetable_entry_id_fkey"
            columns: ["timetable_entry_id"]
            isOneToOne: false
            referencedRelation: "timetable_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_logs_up_to_unit_id_fkey"
            columns: ["up_to_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      owl_conversations: {
        Row: {
          cache_expires_at: string | null
          cache_key: string | null
          cache_name: string | null
          created_at: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cache_expires_at?: string | null
          cache_key?: string | null
          cache_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          cache_expires_at?: string | null
          cache_key?: string | null
          cache_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      owl_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          payload: Json
          role: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          payload: Json
          role: string
          type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          payload?: Json
          role?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owl_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "owl_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_block_units: {
        Row: {
          block_id: string
          page_from: number | null
          page_to: number | null
          planned_minutes: number
          unit_id: string
          user_id: string
        }
        Insert: {
          block_id: string
          page_from?: number | null
          page_to?: number | null
          planned_minutes: number
          unit_id: string
          user_id?: string
        }
        Update: {
          block_id?: string
          page_from?: number | null
          page_to?: number | null
          planned_minutes?: number
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_block_units_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "plan_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_block_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_blocks: {
        Row: {
          assessment_id: string | null
          created_at: string
          deadline_id: string | null
          id: string
          kind: Database["public"]["Enums"]["block_kind"]
          on_date: string
          origin: Database["public"]["Enums"]["assigned_by"]
          plan_run_id: string | null
          planned_minutes: number
          planned_start: string | null
          reason: string | null
          start_min: number | null
          status: Database["public"]["Enums"]["block_status"]
          subject_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          deadline_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["block_kind"]
          on_date: string
          origin?: Database["public"]["Enums"]["assigned_by"]
          plan_run_id?: string | null
          planned_minutes: number
          planned_start?: string | null
          reason?: string | null
          start_min?: number | null
          status?: Database["public"]["Enums"]["block_status"]
          subject_id: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          deadline_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["block_kind"]
          on_date?: string
          origin?: Database["public"]["Enums"]["assigned_by"]
          plan_run_id?: string | null
          planned_minutes?: number
          planned_start?: string | null
          reason?: string | null
          start_min?: number | null
          status?: Database["public"]["Enums"]["block_status"]
          subject_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_blocks_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_blocks_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_blocks_plan_run_id_fkey"
            columns: ["plan_run_id"]
            isOneToOne: false
            referencedRelation: "plan_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_blocks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_runs: {
        Row: {
          created_at: string
          deficit: Json | null
          id: string
          input_hash: string
          today_slots: string | null
          user_id: string
          with_times: boolean
        }
        Insert: {
          created_at?: string
          deficit?: Json | null
          id?: string
          input_hash: string
          today_slots?: string | null
          user_id?: string
          with_times?: boolean
        }
        Update: {
          created_at?: string
          deficit?: Json | null
          id?: string
          input_hash?: string
          today_slots?: string | null
          user_id?: string
          with_times?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          buffer_days: number
          created_at: string
          daily_cap_min: number[]
          day_start_min: number
          default_preset: string
          display_name: string | null
          exam_eve_end_min: number
          fsrs_params: Json | null
          grade_scale: Json | null
          ics_token: string | null
          id: string
          lecture_pace_days: number
          locale: string
          max_subjects_per_day: number
          min_block_minutes: number
          name_confirmed_at: string | null
          notify_break_end: boolean
          notify_first_block: boolean
          onboarded_at: string | null
          onboarding_step: number
          points_total: number
          preferred_slots: string[]
          recap_after_lecture: boolean
          review_cap_pct: number
          session_presets: Json
          sleep_min: number[] | null
          theme: string
          timer_mode: string
          timezone: string
          updated_at: string
          wake_min: number[] | null
        }
        Insert: {
          buffer_days?: number
          created_at?: string
          daily_cap_min?: number[]
          day_start_min?: number
          default_preset?: string
          display_name?: string | null
          exam_eve_end_min?: number
          fsrs_params?: Json | null
          grade_scale?: Json | null
          ics_token?: string | null
          id: string
          lecture_pace_days?: number
          locale?: string
          max_subjects_per_day?: number
          min_block_minutes?: number
          name_confirmed_at?: string | null
          notify_break_end?: boolean
          notify_first_block?: boolean
          onboarded_at?: string | null
          onboarding_step?: number
          points_total?: number
          preferred_slots?: string[]
          recap_after_lecture?: boolean
          review_cap_pct?: number
          session_presets?: Json
          sleep_min?: number[] | null
          theme?: string
          timer_mode?: string
          timezone?: string
          updated_at?: string
          wake_min?: number[] | null
        }
        Update: {
          buffer_days?: number
          created_at?: string
          daily_cap_min?: number[]
          day_start_min?: number
          default_preset?: string
          display_name?: string | null
          exam_eve_end_min?: number
          fsrs_params?: Json | null
          grade_scale?: Json | null
          ics_token?: string | null
          id?: string
          lecture_pace_days?: number
          locale?: string
          max_subjects_per_day?: number
          min_block_minutes?: number
          name_confirmed_at?: string | null
          notify_break_end?: boolean
          notify_first_block?: boolean
          onboarded_at?: string | null
          onboarding_step?: number
          points_total?: number
          preferred_slots?: string[]
          recap_after_lecture?: boolean
          review_cap_pct?: number
          session_presets?: Json
          sleep_min?: number[] | null
          theme?: string
          timer_mode?: string
          timezone?: string
          updated_at?: string
          wake_min?: number[] | null
        }
        Relationships: []
      }
      push_jobs: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          ref: string
          send_at: string
          sent_at: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          ref: string
          send_at: string
          sent_at?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          ref?: string
          send_at?: string
          sent_at?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      question_links: {
        Row: {
          assigned_by: Database["public"]["Enums"]["assigned_by"]
          created_at: string
          linked: boolean
          question_id: string
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: Database["public"]["Enums"]["assigned_by"]
          created_at?: string
          linked?: boolean
          question_id: string
          unit_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          assigned_by?: Database["public"]["Enums"]["assigned_by"]
          created_at?: string
          linked?: boolean
          question_id?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_links_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      review_logs: {
        Row: {
          card_id: string | null
          elapsed_days: number | null
          id: string
          interval_after: number | null
          interval_before: number | null
          recall: number
          reviewed_at: string
          source: Database["public"]["Enums"]["recall_source"]
          stability_after: number | null
          stability_before: number | null
          unit_id: string
          user_id: string
          was_scheduled: boolean
        }
        Insert: {
          card_id?: string | null
          elapsed_days?: number | null
          id?: string
          interval_after?: number | null
          interval_before?: number | null
          recall: number
          reviewed_at?: string
          source: Database["public"]["Enums"]["recall_source"]
          stability_after?: number | null
          stability_before?: number | null
          unit_id: string
          user_id?: string
          was_scheduled?: boolean
        }
        Update: {
          card_id?: string | null
          elapsed_days?: number | null
          id?: string
          interval_after?: number | null
          interval_before?: number | null
          recall?: number
          reviewed_at?: string
          source?: Database["public"]["Enums"]["recall_source"]
          stability_after?: number | null
          stability_before?: number | null
          unit_id?: string
          user_id?: string
          was_scheduled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      session_units: {
        Row: {
          amount_done: number | null
          difficulty: number | null
          level_after: number | null
          level_before: number | null
          minutes: number
          recall_skipped: boolean
          session_id: string
          unit_id: string
          user_id: string
        }
        Insert: {
          amount_done?: number | null
          difficulty?: number | null
          level_after?: number | null
          level_before?: number | null
          minutes: number
          recall_skipped?: boolean
          session_id: string
          unit_id: string
          user_id?: string
        }
        Update: {
          amount_done?: number | null
          difficulty?: number | null
          level_after?: number | null
          level_before?: number | null
          minutes?: number
          recall_skipped?: boolean
          session_id?: string
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_units_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      source_mode_rates: {
        Row: {
          min_per_unit: number
          mode: Database["public"]["Enums"]["study_mode"]
          samples: number
          source_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          min_per_unit: number
          mode: Database["public"]["Enums"]["study_mode"]
          samples?: number
          source_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          min_per_unit?: number
          mode?: Database["public"]["Enums"]["study_mode"]
          samples?: number
          source_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_mode_rates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          archived_at: string | null
          author: string | null
          base_min_per_unit: number
          created_at: string
          id: string
          is_rough: boolean
          kind: Database["public"]["Enums"]["source_kind"]
          learned_min_per_unit: number | null
          learned_samples: number
          measure: string
          measured_sessions: number
          subject_id: string
          title: string
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          archived_at?: string | null
          author?: string | null
          base_min_per_unit: number
          created_at?: string
          id?: string
          is_rough?: boolean
          kind: Database["public"]["Enums"]["source_kind"]
          learned_min_per_unit?: number | null
          learned_samples?: number
          measure?: string
          measured_sessions?: number
          subject_id: string
          title: string
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Update: {
          archived_at?: string | null
          author?: string | null
          base_min_per_unit?: number
          created_at?: string
          id?: string
          is_rough?: boolean
          kind?: Database["public"]["Enums"]["source_kind"]
          learned_min_per_unit?: number | null
          learned_samples?: number
          measure?: string
          measured_sessions?: number
          subject_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_segments: {
        Row: {
          ended_at: string | null
          id: string
          session_id: string
          started_at: string
          unit_id: string | null
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          session_id: string
          started_at: string
          unit_id?: string | null
          user_id?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          session_id?: string
          started_at?: string
          unit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_segments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          block_id: string | null
          break_ends_at: string | null
          created_at: string
          distractions: number
          ended_at: string | null
          focus: number | null
          focus_reasons: string[] | null
          id: string
          mode: Database["public"]["Enums"]["study_mode"] | null
          origin: string
          planned_minutes: number | null
          reflection: string | null
          started_at: string
          subject_id: string
          timer_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_id?: string | null
          break_ends_at?: string | null
          created_at?: string
          distractions?: number
          ended_at?: string | null
          focus?: number | null
          focus_reasons?: string[] | null
          id?: string
          mode?: Database["public"]["Enums"]["study_mode"] | null
          origin?: string
          planned_minutes?: number | null
          reflection?: string | null
          started_at: string
          subject_id: string
          timer_mode?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          block_id?: string | null
          break_ends_at?: string | null
          created_at?: string
          distractions?: number
          ended_at?: string | null
          focus?: number | null
          focus_reasons?: string[] | null
          id?: string
          mode?: Database["public"]["Enums"]["study_mode"] | null
          origin?: string
          planned_minutes?: number | null
          reflection?: string | null
          started_at?: string
          subject_id?: string
          timer_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "plan_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          archived: boolean
          campaign_start_on: string | null
          color: string | null
          created_at: string
          custom_scale: boolean
          grade_scale: Json | null
          id: string
          name: string
          points_total: number
          priority: number
          priority_boost_until: string | null
          study_mode: string
          target_grade: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          campaign_start_on?: string | null
          color?: string | null
          created_at?: string
          custom_scale?: boolean
          grade_scale?: Json | null
          id?: string
          name: string
          points_total?: number
          priority?: number
          priority_boost_until?: string | null
          study_mode?: string
          target_grade?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          campaign_start_on?: string | null
          color?: string | null
          created_at?: string
          custom_scale?: boolean
          grade_scale?: Json | null
          id?: string
          name?: string
          points_total?: number
          priority?: number
          priority_boost_until?: string | null
          study_mode?: string
          target_grade?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      timetable_entries: {
        Row: {
          end_min: number
          id: string
          kind: Database["public"]["Enums"]["class_kind"]
          location: string | null
          note: string | null
          period_id: string | null
          start_min: number
          subject_id: string | null
          updated_at: string
          user_id: string
          valid_from: string
          valid_to: string
          week_parity: string | null
          weekday: number
        }
        Insert: {
          end_min: number
          id?: string
          kind: Database["public"]["Enums"]["class_kind"]
          location?: string | null
          note?: string | null
          period_id?: string | null
          start_min: number
          subject_id?: string | null
          updated_at?: string
          user_id?: string
          valid_from: string
          valid_to: string
          week_parity?: string | null
          weekday: number
        }
        Update: {
          end_min?: number
          id?: string
          kind?: Database["public"]["Enums"]["class_kind"]
          location?: string | null
          note?: string | null
          period_id?: string | null
          start_min?: number
          subject_id?: string | null
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_to?: string
          week_parity?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "timetable_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_embeddings: {
        Row: {
          embedding: string
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          embedding: string
          topic_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          embedding?: string
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_embeddings_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          id: string
          name: string
          subject_id: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          subject_id: string
          user_id?: string
        }
        Update: {
          id?: string
          name?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_embeddings: {
        Row: {
          embedding: string
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          embedding: string
          unit_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          embedding?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_embeddings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_topics: {
        Row: {
          assigned_by: Database["public"]["Enums"]["assigned_by"]
          topic_id: string
          unit_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: Database["public"]["Enums"]["assigned_by"]
          topic_id: string
          unit_id: string
          user_id?: string
        }
        Update: {
          assigned_by?: Database["public"]["Enums"]["assigned_by"]
          topic_id?: string
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_topics_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          ai_difficulty: number | null
          amount: number
          answer: string | null
          answer_origin: Database["public"]["Enums"]["assigned_by"] | null
          archived_at: string | null
          completed_at: string | null
          confidence: number | null
          created_at: string
          est_minutes: number | null
          fsrs_difficulty: number | null
          fsrs_lapses: number
          fsrs_reps: number
          fsrs_stability: number | null
          fsrs_state: number | null
          id: string
          kind: Database["public"]["Enums"]["unit_kind"]
          label: string | null
          last_review_at: string | null
          level: number
          next_review_on: string | null
          notes: string | null
          page_end: number | null
          page_start: number | null
          parent_id: string | null
          position: number
          review_streak: number
          source_id: string
          title: string
          updated_at: string
          user_difficulty: number | null
          user_id: string
        }
        Insert: {
          ai_difficulty?: number | null
          amount?: number
          answer?: string | null
          answer_origin?: Database["public"]["Enums"]["assigned_by"] | null
          archived_at?: string | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          est_minutes?: number | null
          fsrs_difficulty?: number | null
          fsrs_lapses?: number
          fsrs_reps?: number
          fsrs_stability?: number | null
          fsrs_state?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["unit_kind"]
          label?: string | null
          last_review_at?: string | null
          level?: number
          next_review_on?: string | null
          notes?: string | null
          page_end?: number | null
          page_start?: number | null
          parent_id?: string | null
          position: number
          review_streak?: number
          source_id: string
          title: string
          updated_at?: string
          user_difficulty?: number | null
          user_id?: string
        }
        Update: {
          ai_difficulty?: number | null
          amount?: number
          answer?: string | null
          answer_origin?: Database["public"]["Enums"]["assigned_by"] | null
          archived_at?: string | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          est_minutes?: number | null
          fsrs_difficulty?: number | null
          fsrs_lapses?: number
          fsrs_reps?: number
          fsrs_stability?: number | null
          fsrs_state?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["unit_kind"]
          label?: string | null
          last_review_at?: string | null
          level?: number
          next_review_on?: string | null
          notes?: string | null
          page_end?: number | null
          page_start?: number | null
          parent_id?: string | null
          position?: number
          review_streak?: number
          source_id?: string
          title?: string
          updated_at?: string
          user_difficulty?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      keepalive: { Args: never; Returns: string }
      match_document_chunks: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          content: string
          document_id: string
          id: string
          page: number
          similarity: number
          title: string
        }[]
      }
      match_notes: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          id: string
          kind: string
          similarity: number
          unit_id: string
        }[]
      }
      question_candidates: {
        Args: { match_count?: number; question_ids: string[] }
        Returns: {
          question_id: string
          similarity: number
          unit_id: string
        }[]
      }
      replace_plan: {
        Args: {
          p_blocks: Json
          p_deficit: Json
          p_from: string
          p_input_hash: string
          p_run_id: string
          p_today: string
          p_units: Json
        }
        Returns: undefined
      }
      unembedded: {
        Args: { max_rows?: number }
        Returns: {
          id: string
          kind: string
        }[]
      }
    }
    Enums: {
      ai_task:
        | "parse_toc"
        | "parse_questions"
        | "parse_timetable"
        | "recall_questions"
        | "propose_answer"
        | "quiz"
        | "strategist"
        | "parse_academic_calendar"
        | "parse_exam_schedule"
        | "parse_document"
        | "answer"
        | "link_questions"
      assessment_kind: "partial" | "final" | "integral" | "makeup" | "other"
      assigned_by: "ai" | "user"
      block_kind: "learn" | "review" | "questions" | "recap" | "deadline"
      block_status: "planned" | "in_progress" | "done" | "missed" | "skipped"
      class_kind: "lecture" | "exercise" | "lab" | "other"
      deadline_kind: "assignment" | "custom"
      exam_format: "written" | "oral" | "combined" | "project" | "other"
      recall_source:
        | "exam_question"
        | "notes"
        | "outline"
        | "blurt"
        | "card"
        | "page_photo"
        | "general"
      source_kind: "book" | "script" | "questions" | "slides" | "other"
      study_mode: "reading" | "problems" | "review" | "questions"
      unit_kind: "chapter" | "question"
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
      ai_task: [
        "parse_toc",
        "parse_questions",
        "parse_timetable",
        "recall_questions",
        "propose_answer",
        "quiz",
        "strategist",
        "parse_academic_calendar",
        "parse_exam_schedule",
        "parse_document",
        "answer",
        "link_questions",
      ],
      assessment_kind: ["partial", "final", "integral", "makeup", "other"],
      assigned_by: ["ai", "user"],
      block_kind: ["learn", "review", "questions", "recap", "deadline"],
      block_status: ["planned", "in_progress", "done", "missed", "skipped"],
      class_kind: ["lecture", "exercise", "lab", "other"],
      deadline_kind: ["assignment", "custom"],
      exam_format: ["written", "oral", "combined", "project", "other"],
      recall_source: [
        "exam_question",
        "notes",
        "outline",
        "blurt",
        "card",
        "page_photo",
        "general",
      ],
      source_kind: ["book", "script", "questions", "slides", "other"],
      study_mode: ["reading", "problems", "review", "questions"],
      unit_kind: ["chapter", "question"],
    },
  },
} as const
