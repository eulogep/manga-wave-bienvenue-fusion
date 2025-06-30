export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
          id: number
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
        Relationships: []
      }
      mangas: {
        Row: {
          author: string | null
          cover_image: string | null
          created_at: string
          description: string | null
          genre: string[] | null
          id: number
          manga_type: string | null
          rating: number | null
          status: string | null
          title: string
          views: number | null
        }
        Insert: {
          author?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          genre?: string[] | null
          id: number
          manga_type?: string | null
          rating?: number | null
          status?: string | null
          title: string
          views?: number | null
        }
        Update: {
          author?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          genre?: string[] | null
          id?: number
          manga_type?: string | null
          rating?: number | null
          status?: string | null
          title?: string
          views?: number | null
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
        Relationships: []
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
        Relationships: []
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
          page_number: number
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
