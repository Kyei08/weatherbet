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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge_icon: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          points_reward: number
          requirement_type: string
          requirement_value: number
          title: string
        }
        Insert: {
          badge_icon: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          points_reward?: number
          requirement_type: string
          requirement_value: number
          title: string
        }
        Update: {
          badge_icon?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          points_reward?: number
          requirement_type?: string
          requirement_value?: number
          title?: string
        }
        Relationships: []
      }
      bets: {
        Row: {
          bet_duration_days: number | null
          cashed_out_at: string | null
          cashout_amount: number | null
          city: string
          created_at: string
          expires_at: string | null
          has_insurance: boolean
          id: string
          insurance_cost: number | null
          insurance_payout_percentage: number | null
          odds: number
          prediction_type: string
          prediction_value: string
          result: string
          stake: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bet_duration_days?: number | null
          cashed_out_at?: string | null
          cashout_amount?: number | null
          city: string
          created_at?: string
          expires_at?: string | null
          has_insurance?: boolean
          id?: string
          insurance_cost?: number | null
          insurance_payout_percentage?: number | null
          odds: number
          prediction_type: string
          prediction_value: string
          result?: string
          stake: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bet_duration_days?: number | null
          cashed_out_at?: string | null
          cashout_amount?: number | null
          city?: string
          created_at?: string
          expires_at?: string | null
          has_insurance?: boolean
          id?: string
          insurance_cost?: number | null
          insurance_payout_percentage?: number | null
          odds?: number
          prediction_type?: string
          prediction_value?: string
          result?: string
          stake?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          challenge_type: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          reward_points: number
          target_value: number
          title: string
        }
        Insert: {
          challenge_type: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          reward_points: number
          target_value: number
          title: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          reward_points?: number
          target_value?: number
          title?: string
        }
        Relationships: []
      }
      parlay_legs: {
        Row: {
          city: string
          created_at: string
          id: string
          odds: number
          parlay_id: string
          prediction_type: string
          prediction_value: string
          result: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          odds: number
          parlay_id: string
          prediction_type: string
          prediction_value: string
          result?: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          odds?: number
          parlay_id?: string
          prediction_type?: string
          prediction_value?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "parlay_legs_parlay_id_fkey"
            columns: ["parlay_id"]
            isOneToOne: false
            referencedRelation: "parlays"
            referencedColumns: ["id"]
          },
        ]
      }
      parlays: {
        Row: {
          cashed_out_at: string | null
          cashout_amount: number | null
          combined_odds: number
          created_at: string
          expires_at: string | null
          has_insurance: boolean
          id: string
          insurance_cost: number | null
          insurance_payout_percentage: number | null
          result: string
          total_stake: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cashed_out_at?: string | null
          cashout_amount?: number | null
          combined_odds: number
          created_at?: string
          expires_at?: string | null
          has_insurance?: boolean
          id?: string
          insurance_cost?: number | null
          insurance_payout_percentage?: number | null
          result?: string
          total_stake: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cashed_out_at?: string | null
          cashout_amount?: number | null
          combined_odds?: number
          created_at?: string
          expires_at?: string | null
          has_insurance?: boolean
          id?: string
          insurance_cost?: number | null
          insurance_payout_percentage?: number | null
          result?: string
          total_stake?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      perks: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          perk_icon: string
          perk_type: string
          perk_value: number
          title: string
          unlock_level: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          perk_icon: string
          perk_type: string
          perk_value: number
          title: string
          unlock_level: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          perk_icon?: string
          perk_type?: string
          perk_value?: number
          title?: string
          unlock_level?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          created_at: string
          description: string
          duration_hours: number | null
          id: string
          is_active: boolean
          item_icon: string
          item_type: string
          item_value: number
          price: number
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          item_icon: string
          item_type: string
          item_value: number
          price: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          item_icon?: string
          item_type?: string
          item_value?: number
          price?: number
          title?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          created_at: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenges: {
        Row: {
          challenge_date: string
          challenge_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_date?: string
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_date?: string
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_perks: {
        Row: {
          created_at: string
          id: string
          perk_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          perk_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          perk_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_purchases: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          item_id: string
          purchased_at: string
          used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          item_id: string
          purchased_at?: string
          used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          item_id?: string
          purchased_at?: string
          used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          level: number
          points: number
          updated_at: string
          username: string
          xp: number
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          points?: number
          updated_at?: string
          username: string
          xp?: number
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          points?: number
          updated_at?: string
          username?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_user_points: {
        Args: { points_change: number; user_uuid: string }
        Returns: undefined
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
