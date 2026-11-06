
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "answers": {
                  Row: {
                    "answer_text": string,"id": string,"member_id": string,"question_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_text": string,"id"?: string,"member_id": string,"question_id": number,"updated_at"?: string
                  }
                  Update: {
                    "answer_text"?: string,"id"?: string,"member_id"?: string,"question_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "answers_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"app_state": {
                  Row: {
                    "draw_at": string | null,"id": number,"phase": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "draw_at"?: string | null,"id"?: number,"phase"?: string,"updated_at"?: string
                  }
                  Update: {
                    "draw_at"?: string | null,"id"?: number,"phase"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"exclusions": {
                  Row: {
                    "created_at": string,"excluded_id": string,"id": string,"member_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"excluded_id": string,"id"?: string,"member_id": string
                  }
                  Update: {
                    "created_at"?: string,"excluded_id"?: string,"id"?: string,"member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exclusions_excluded_id_fkey"
      columns: ["excluded_id"]
isOneToOne: false
      referencedRelation: "roster"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exclusions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"flavour_owner": {
                  Row: {
                    "assigned_at": string,"encrypted_member_id": string,"flavour_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"encrypted_member_id": string,"flavour_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"encrypted_member_id"?: string,"flavour_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "flavour_owner_flavour_id_fkey"
      columns: ["flavour_id"]
isOneToOne: true
      referencedRelation: "flavours"
      referencedColumns: ["id"]
    }
                  ]
                },"flavours": {
                  Row: {
                    "hero_hex": string,"id": string,"ink_hex": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "hero_hex": string,"id": string,"ink_hex": string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "hero_hex"?: string,"id"?: string,"ink_hex"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [

                  ]
                },"members": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"email": string | null,"id": string,"is_admin": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"email"?: string | null,"id": string,"is_admin"?: boolean
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"email"?: string | null,"id"?: string,"is_admin"?: boolean
                  }
                  Relationships: [

                  ]
                },"messages": {
                  Row: {
                    "body": string,"created_at": string,"direction": string,"flavour_id": string,"id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"direction": string,"flavour_id": string,"id"?: string,"week_start": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"direction"?: string,"flavour_id"?: string,"id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_flavour_id_fkey"
      columns: ["flavour_id"]
isOneToOne: false
      referencedRelation: "flavours"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subs": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"member_id": string,"p256dh": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"member_id": string,"p256dh": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"member_id"?: string,"p256dh"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "id": number,"prompt": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": number,"prompt": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: number,"prompt"?: string,"sort_order"?: number
                  }
                  Relationships: [

                  ]
                },"roster": {
                  Row: {
                    "claimed_at": string | null,"claimed_by": string | null,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "claimed_at"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roster_claimed_by_fkey"
      columns: ["claimed_by"]
isOneToOne: true
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"santa": {
                  Row: {
                    "assigned_at": string,"flavour_id": string,"santa_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"flavour_id": string,"santa_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"flavour_id"?: string,"santa_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "santa_flavour_id_fkey"
      columns: ["flavour_id"]
isOneToOne: true
      referencedRelation: "flavours"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "santa_santa_id_fkey"
      columns: ["santa_id"]
isOneToOne: true
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "chat_with_flavour":
{ Args: Record<PropertyKey, never>; Returns: {
              "body": string,"created_at": string,"direction": string,"id": string
            }[]
                           },
"chat_with_santa":
{ Args: Record<PropertyKey, never>; Returns: {
              "body": string,"created_at": string,"direction": string,"id": string
            }[]
                           },
"claim_membership":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"claim_roster_name":
{ Args: { "p_roster_id": string }; Returns: boolean
                           },
"commit_draw":
{ Args: { "p_pairs": Json }; Returns: undefined
                           },
"insert_message":
{ Args: { "p_body": string,"p_direction": string,"p_member_id": string,"p_week_start": string }; Returns: string
                           },
"kringle_key":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"list_exclusion_options":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"name": string
            }[]
                           },
"list_roster":
{ Args: Record<PropertyKey, never>; Returns: {
              "claimed": boolean,"id": string,"name": string
            }[]
                           },
"my_flavour":
{ Args: Record<PropertyKey, never>; Returns: {
              "flavour_id": string,"hero_hex": string,"ink_hex": string,"name": string
            }[]
                           },
"my_flavour_survey":
{ Args: Record<PropertyKey, never>; Returns: {
              "answer_text": string,"prompt": string,"question_id": number
            }[]
                           },
"owner_of":
{ Args: { "p_flavour_id": string }; Returns: string
                           },
"push_targets_for_message":
{ Args: { "p_message_id": string }; Returns: {
              "auth": string,"endpoint": string,"p256dh": string
            }[]
                           },
"quota_used":
{ Args: { "p_direction": string,"p_member_id": string,"p_week_start": string }; Returns: boolean
                           },
"thread_for":
{ Args: { "p_direction": string,"p_member_id": string }; Returns: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {

          }
        }
} as const
