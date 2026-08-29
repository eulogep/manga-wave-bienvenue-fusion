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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chapter_snapshots: {
        Row: {
          available: boolean
          chapter_number: string
          expires_at: string | null
          fetched_at: string
          id: number
          language: string | null
          mapping_id: number
          page_urls: string[]
          source_chapter_id: string
          source_url: string | null
          title: string | null
        }
        Insert: {
          available?: boolean
          chapter_number: string
          expires_at?: string | null
          fetched_at?: string
          id?: number
          language?: string | null
          mapping_id: number
          page_urls?: string[]
          source_chapter_id: string
          source_url?: string | null
          title?: string | null
        }
        Update: {
          available?: boolean
          chapter_number?: string
          expires_at?: string | null
          fetched_at?: string
          id?: number
          language?: string | null
          mapping_id?: number
          page_urls?: string[]
          source_chapter_id?: string
          source_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_snapshots_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "manga_source_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          chapter_number: number
          created_at: string
          id: number
          manga_id: number
          pages_count: number | null
          release_date: string | null
          title: string | null
        }
        Insert: {
          chapter_number: number
          created_at?: string
          id?: number
          manga_id: number
          pages_count?: number | null
          release_date?: string | null
          title?: string | null
        }
        Update: {
          chapter_number?: number
          created_at?: string
          id?: number
          manga_id?: number
          pages_count?: number | null
          release_date?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "canonical_manga_catalog"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "chapters_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
        ]
      }
      manga_source_mappings: {
        Row: {
          available: boolean
          created_at: string
          id: number
          language: string
          last_synced_at: string | null
          manga_id: number
          manually_verified: boolean
          match_confidence: number
          metadata: Json
          normalized_source_title: string
          source_id: string
          source_manga_id: string
          source_title: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          id?: number
          language?: string
          last_synced_at?: string | null
          manga_id: number
          manually_verified?: boolean
          match_confidence?: number
          metadata?: Json
          normalized_source_title: string
          source_id: string
          source_manga_id: string
          source_title: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          id?: number
          language?: string
          last_synced_at?: string | null
          manga_id?: number
          manually_verified?: boolean
          match_confidence?: number
          metadata?: Json
          normalized_source_title?: string
          source_id?: string
          source_manga_id?: string
          source_title?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manga_source_mappings_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "canonical_manga_catalog"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "manga_source_mappings_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
        ]
      }
      mangas: {
        Row: {
          aliases: string[]
          artist: string | null
          author: string | null
          content_rating: string | null
          cover_image: string | null
          created_at: string
          description: string | null
          genre: string[]
          id: number
          last_synced_at: string | null
          manga_type: string | null
          mangadex_id: string | null
          normalized_title: string
          rating: number | null
          source_updated_at: string | null
          status: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          aliases?: string[]
          artist?: string | null
          author?: string | null
          content_rating?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          genre?: string[]
          id?: number
          last_synced_at?: string | null
          manga_type?: string | null
          mangadex_id?: string | null
          normalized_title: string
          rating?: number | null
          source_updated_at?: string | null
          status?: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          aliases?: string[]
          artist?: string | null
          author?: string | null
          content_rating?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          genre?: string[]
          id?: number
          last_synced_at?: string | null
          manga_type?: string | null
          mangadex_id?: string | null
          normalized_title?: string
          rating?: number | null
          source_updated_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      pages: {
        Row: {
          chapter_id: number
          created_at: string
          id: number
          image_url: string
          page_number: number
        }
        Insert: {
          chapter_id: number
          created_at?: string
          id?: number
          image_url: string
          page_number: number
        }
        Update: {
          chapter_id?: number
          created_at?: string
          id?: number
          image_url?: string
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "pages_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      source_health: {
        Row: {
          average_latency_ms: number
          circuit_state: string
          consecutive_failures: number
          failure_count: number
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          request_count: number
          retry_at: string | null
          score: number
          source_id: string
          success_count: number
          updated_at: string
        }
        Insert: {
          average_latency_ms?: number
          circuit_state?: string
          consecutive_failures?: number
          failure_count?: number
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          request_count?: number
          retry_at?: string | null
          score?: number
          source_id: string
          success_count?: number
          updated_at?: string
        }
        Update: {
          average_latency_ms?: number
          circuit_state?: string
          consecutive_failures?: number
          failure_count?: number
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          request_count?: number
          retry_at?: string | null
          score?: number
          source_id?: string
          success_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      source_sync_runs: {
        Row: {
          attempt: number
          error_message: string | null
          finished_at: string | null
          id: number
          items_synced: number
          job_type: string
          queue_message_id: number | null
          source_id: string
          started_at: string
          status: string
        }
        Insert: {
          attempt?: number
          error_message?: string | null
          finished_at?: string | null
          id?: number
          items_synced?: number
          job_type: string
          queue_message_id?: number | null
          source_id: string
          started_at?: string
          status?: string
        }
        Update: {
          attempt?: number
          error_message?: string | null
          finished_at?: string | null
          id?: number
          items_synced?: number
          job_type?: string
          queue_message_id?: number | null
          source_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          id: number
          manga_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          manga_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          manga_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "canonical_manga_catalog"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "user_favorites_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_history: {
        Row: {
          chapter_id: number
          id: number
          read_at: string
          user_id: string
        }
        Insert: {
          chapter_id: number
          id?: number
          read_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: number
          id?: number
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_history_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          chapter_id: number
          id: number
          page_number: number
          total_pages: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: number
          id?: number
          page_number?: number
          total_pages?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: number
          id?: number
          page_number?: number
          total_pages?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reader_preferences: {
        Row: {
          background: string
          brightness: number
          fit_mode: string
          page_gap: number
          preload_count: number
          reading_direction: string
          reading_mode: string
          updated_at: string
          user_id: string
          zoom: number
        }
        Insert: {
          background?: string
          brightness?: number
          fit_mode?: string
          page_gap?: number
          preload_count?: number
          reading_direction?: string
          reading_mode?: string
          updated_at?: string
          user_id: string
          zoom?: number
        }
        Update: {
          background?: string
          brightness?: number
          fit_mode?: string
          page_gap?: number
          preload_count?: number
          reading_direction?: string
          reading_mode?: string
          updated_at?: string
          user_id?: string
          zoom?: number
        }
        Relationships: []
      }
      user_reading_progress: {
        Row: {
          chapter_number: string
          chapter_title: string | null
          cover_image: string | null
          manga_author: string | null
          manga_title: string
          page_index: number
          progress_percentage: number
          read_at: string
          source_chapter_id: string
          source_id: string
          source_manga_id: string
          total_pages: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_number: string
          chapter_title?: string | null
          cover_image?: string | null
          manga_author?: string | null
          manga_title: string
          page_index?: number
          progress_percentage?: number
          read_at?: string
          source_chapter_id: string
          source_id: string
          source_manga_id: string
          total_pages?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_number?: string
          chapter_title?: string | null
          cover_image?: string | null
          manga_author?: string | null
          manga_title?: string
          page_index?: number
          progress_percentage?: number
          read_at?: string
          source_chapter_id?: string
          source_id?: string
          source_manga_id?: string
          total_pages?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      canonical_manga_catalog: {
        Row: {
          alternative_titles: string[] | null
          author: string | null
          canonical_id: number | null
          cover: string | null
          description: string | null
          genres: string[] | null
          normalized_title: string | null
          rating: number | null
          source_count: number | null
          sources: Json | null
          status: string | null
          title: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      complete_source_sync: {
        Args: { archive_message?: boolean; message_id: number }
        Returns: boolean
      }
      dequeue_source_sync: {
        Args: { batch_size?: number; visibility_seconds?: number }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          visible_at: string
        }[]
      }
      enqueue_source_sync: {
        Args: { delay_seconds?: number; job: Json }
        Returns: number
      }
      find_canonical_manga: {
        Args: { candidate_title: string }
        Returns: {
          confidence: number
          manga_id: number
          match_reason: string
          title: string
        }[]
      }
      normalize_manga_title: { Args: { value: string }; Returns: string }
      rank_canonical_manga_sources: {
        Args: { preferred_language?: string; requested_canonical_id: number }
        Returns: {
          eligible: boolean
          language: string
          last_successful_request: string
          mapping_id: number
          score_breakdown: Json
          source_id: string
          source_manga_id: string
          source_score: number
          source_url: string
        }[]
      }
      upsert_source_catalog: {
        Args: { items: Json; requested_source_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
