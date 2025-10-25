export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Placeholder Supabase schema types derived from the base tenancy migration.
 * Replace with generated types via `supabase gen types typescript` once the
 * schema stabilises.
 */
export type Database = {
  public: {
    Tables: {
      memberships: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
          tenant_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      platform_admins: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string;
          id: string;
          note: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email: string;
          id?: string;
          note?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string;
          id?: string;
          note?: string | null;
          user_id?: string | null;
        };
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          country_code: string | null;
          created_at: string;
          default_locale: string;
          display_name: string | null;
          full_name: string | null;
          handle: string | null;
          metadata: Json;
          time_zone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          country_code?: string | null;
          created_at?: string;
          default_locale?: string;
          display_name?: string | null;
          full_name?: string | null;
          handle?: string | null;
          metadata?: Json;
          time_zone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          country_code?: string | null;
          created_at?: string;
          default_locale?: string;
          display_name?: string | null;
          full_name?: string | null;
          handle?: string | null;
          metadata?: Json;
          time_zone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
      };
      tenants: {
        Row: {
          country_code: string;
          created_at: string;
          created_by: string | null;
          currency_code: string;
          default_locale: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency_code?: string;
          default_locale?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency_code?: string;
          default_locale?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      membership_role: "owner" | "manager" | "staff" | "contractor";
      membership_status: "active" | "invited" | "suspended";
    };
    CompositeTypes: Record<string, never>;
  };
};
