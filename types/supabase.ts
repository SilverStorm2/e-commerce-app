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
      product_categories: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          description_i18n: Json;
          id: string;
          is_visible: boolean;
          metadata: Json;
          name: string;
          name_i18n: Json;
          slug: string;
          sort_order: number;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          description_i18n?: Json;
          id?: string;
          is_visible?: boolean;
          metadata?: Json;
          name: string;
          name_i18n?: Json;
          slug: string;
          sort_order?: number;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          description_i18n?: Json;
          id?: string;
          is_visible?: boolean;
          metadata?: Json;
          name?: string;
          name_i18n?: Json;
          slug?: string;
          sort_order?: number;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      product_media: {
        Row: {
          alt_text: string | null;
          created_at: string;
          created_by: string | null;
          height: number | null;
          id: string;
          is_primary: boolean;
          mime_type: string | null;
          position: number;
          product_id: string;
          size_bytes: number | null;
          storage_path: string;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          height?: number | null;
          id?: string;
          is_primary?: boolean;
          mime_type?: string | null;
          position?: number;
          product_id: string;
          size_bytes?: number | null;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          height?: number | null;
          id?: string;
          is_primary?: boolean;
          mime_type?: string | null;
          position?: number;
          product_id?: string;
          size_bytes?: number | null;
          storage_path?: string;
          width?: number | null;
        };
      };
      products: {
        Row: {
          barcode: string | null;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          currency_code: string;
          depth_cm: number | null;
          description: string | null;
          description_i18n: Json;
          height_cm: number | null;
          id: string;
          is_published: boolean;
          metadata: Json;
          name: string;
          name_i18n: Json;
          options: Json;
          price_amount: string;
          published_at: string | null;
          publication_note: string | null;
          safety_stock: number;
          search_vector: unknown;
          seo_description: string | null;
          seo_title: string | null;
          short_description: string | null;
          short_description_i18n: Json;
          sku: string | null;
          slug: string;
          status: Database["public"]["Enums"]["product_status"];
          stock_quantity: number;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
          vat_rate: string | null;
          weight_grams: number | null;
          width_cm: number | null;
        };
        Insert: {
          barcode?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency_code?: string;
          depth_cm?: number | null;
          description?: string | null;
          description_i18n?: Json;
          height_cm?: number | null;
          id?: string;
          is_published?: boolean;
          metadata?: Json;
          name: string;
          name_i18n?: Json;
          options?: Json;
          price_amount: string;
          published_at?: string | null;
          publication_note?: string | null;
          safety_stock?: number;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          short_description_i18n?: Json;
          sku?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["product_status"];
          stock_quantity?: number;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
          vat_rate?: string | null;
          weight_grams?: number | null;
          width_cm?: number | null;
        };
        Update: {
          barcode?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency_code?: string;
          depth_cm?: number | null;
          description?: string | null;
          description_i18n?: Json;
          height_cm?: number | null;
          id?: string;
          is_published?: boolean;
          metadata?: Json;
          name?: string;
          name_i18n?: Json;
          options?: Json;
          price_amount?: string;
          published_at?: string | null;
          publication_note?: string | null;
          safety_stock?: number;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          short_description_i18n?: Json;
          sku?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["product_status"];
          stock_quantity?: number;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          vat_rate?: string | null;
          weight_grams?: number | null;
          width_cm?: number | null;
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
      inventory_event_type:
        | "manual_adjustment"
        | "order_reservation"
        | "order_commit"
        | "order_release"
        | "return"
        | "correction";
      membership_role: "owner" | "manager" | "staff" | "contractor";
      membership_status: "active" | "invited" | "suspended";
      product_status: "draft" | "active" | "archived";
    };
    CompositeTypes: Record<string, never>;
  };
};
