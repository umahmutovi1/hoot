// TEMPORARY stub until `npm run db:types` generates the real file from the linked project.
// Do not extend by hand.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          locale: string
          timezone: string
          day_start_min: number
          buffer_days: number
          max_subjects_per_day: number
          min_block_minutes: number
          timer_mode: string
          recap_after_lecture: boolean
          srs_multiplier: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { keepalive: { Args: never; Returns: string } }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
