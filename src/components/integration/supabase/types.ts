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
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          created_at: string
          customer_id: string | null
          customer_latitude: number | null
          customer_longitude: number | null
          declined_mechanic_ids: string[]
          customer_name: string
          customer_phone: string | null
          id: string
          mechanic_id: string
          message: string
          requested_trade: string | null
          status: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          created_at?: string
          customer_id?: string | null
          customer_latitude?: number | null
          customer_longitude?: number | null
          declined_mechanic_ids?: string[]
          customer_name: string
          customer_phone?: string | null
          id?: string
          mechanic_id: string
          message: string
          requested_trade?: string | null
          status?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          created_at?: string
          customer_id?: string | null
          customer_latitude?: number | null
          customer_longitude?: number | null
          declined_mechanic_ids?: string[]
          customer_name?: string
          customer_phone?: string | null
          id?: string
          mechanic_id?: string
          message?: string
          requested_trade?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "mechanics"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanic_gallery: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          mechanic_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          mechanic_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          mechanic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mechanic_gallery_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "mechanics"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanics: {
        Row: {
          address: string
          area: string | null
          availability: Database["public"]["Enums"]["availability_status"]
          bio: string | null
          brands: string[]
          business_name: string | null
          city: string
          created_at: string
          email: string
          featured: boolean
          full_name: string
          id: string
          id_document_url: string | null
          latitude: number | null
          longitude: number | null
          paid: boolean
          phone: string
          profile_picture_url: string | null
          rating_avg: number
          rating_count: number
          services: string[]
          state: string
          status: Database["public"]["Enums"]["mechanic_status"]
          trade: string
          updated_at: string
          user_id: string
          verified: boolean
          whatsapp: string
          years_experience: number
        }
        Insert: {
          address: string
          area?: string | null
          availability?: Database["public"]["Enums"]["availability_status"]
          bio?: string | null
          brands?: string[]
          business_name?: string | null
          city: string
          created_at?: string
          email: string
          featured?: boolean
          full_name: string
          id?: string
          id_document_url?: string | null
          latitude?: number | null
          longitude?: number | null
          paid?: boolean
          phone: string
          profile_picture_url?: string | null
          rating_avg?: number
          rating_count?: number
          services?: string[]
          state: string
          status?: Database["public"]["Enums"]["mechanic_status"]
          trade?: string
          updated_at?: string
          user_id: string
          verified?: boolean
          whatsapp: string
          years_experience?: number
        }
        Update: {
          address?: string
          area?: string | null
          availability?: Database["public"]["Enums"]["availability_status"]
          bio?: string | null
          brands?: string[]
          business_name?: string | null
          city?: string
          created_at?: string
          email?: string
          featured?: boolean
          full_name?: string
          id?: string
          id_document_url?: string | null
          latitude?: number | null
          longitude?: number | null
          paid?: boolean
          phone?: string
          profile_picture_url?: string | null
          rating_avg?: number
          rating_count?: number
          services?: string[]
          state?: string
          status?: Database["public"]["Enums"]["mechanic_status"]
          trade?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
          whatsapp?: string
          years_experience?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          provider: string
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          provider?: string
          reference: string
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          provider?: string
          reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          mechanic_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          mechanic_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          mechanic_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "mechanics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_service_request: {
        Args: { _request_id: string }
        Returns: unknown
      }
      admin_set_mechanic_status: {
        Args: { _mechanic_id: string; _status: Database["public"]["Enums"]["mechanic_status"] }
        Returns: unknown
      }
      cancel_own_service_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      complete_service_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      decline_service_request: {
        Args: { _request_id: string }
        Returns: string
      }
      get_admin_mechanics: {
        Args: Record<PropertyKey, never>
        Returns: unknown[]
      }
      get_mechanic_id_document: {
        Args: { _mechanic_id: string }
        Returns: string
      }
      get_my_mechanic: {
        Args: Record<PropertyKey, never>
        Returns: unknown[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "mechanic" | "customer"
      availability_status: "available" | "busy" | "offline"
      mechanic_status: "pending" | "approved" | "rejected" | "suspended"
      payment_status: "pending" | "success" | "failed"
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
    Enums: {
      app_role: ["admin", "mechanic", "customer"],
      availability_status: ["available", "busy", "offline"],
      mechanic_status: ["pending", "approved", "rejected", "suspended"],
      payment_status: ["pending", "success", "failed"],
    },
  },
} as const
