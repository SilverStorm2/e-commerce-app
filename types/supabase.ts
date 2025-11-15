export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Placeholder Supabase schema types derived from the base tenancy migration.
 * Replace with generated types via `supabase gen types typescript` once the
 * schema stabilises.
 */
export type Database = {
  public: {
    Tables: {
      carts: {
        Row: {
          created_at: string;
          currency_code: string;
          id: string;
          metadata: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          currency_code?: string;
          id?: string;
          metadata?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency_code?: string;
          id?: string;
          metadata?: Json;
          updated_at?: string;
          user_id?: string;
        };
      };
      notifications: {
        Row: {
          action_url: string | null;
          actor_user_id: string | null;
          body: string;
          created_at: string;
          delivered_at: string | null;
          event_type: Database["public"]["Enums"]["notification_event"];
          id: string;
          metadata: Json;
          read_at: string | null;
          recipient_user_id: string;
          status: Database["public"]["Enums"]["notification_status"];
          tenant_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          action_url?: string | null;
          actor_user_id?: string | null;
          body: string;
          created_at?: string;
          delivered_at?: string | null;
          event_type: Database["public"]["Enums"]["notification_event"];
          id?: string;
          metadata?: Json;
          read_at?: string | null;
          recipient_user_id: string;
          status?: Database["public"]["Enums"]["notification_status"];
          tenant_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          action_url?: string | null;
          actor_user_id?: string | null;
          body?: string;
          created_at?: string;
          delivered_at?: string | null;
          event_type?: Database["public"]["Enums"]["notification_event"];
          id?: string;
          metadata?: Json;
          read_at?: string | null;
          recipient_user_id?: string;
          status?: Database["public"]["Enums"]["notification_status"];
          tenant_id?: string | null;
          title?: string;
          updated_at?: string;
        };
      };
      cart_items: {
        Row: {
          added_at: string;
          cart_id: string;
          currency_code: string;
          id: string;
          metadata: Json;
          product_id: string;
          quantity: number;
          tenant_id: string;
          unit_price: string;
          updated_at: string;
        };
        Insert: {
          added_at?: string;
          cart_id: string;
          currency_code?: string;
          id?: string;
          metadata?: Json;
          product_id: string;
          quantity: number;
          tenant_id?: string;
          unit_price?: string | number;
          updated_at?: string;
        };
        Update: {
          added_at?: string;
          cart_id?: string;
          currency_code?: string;
          id?: string;
          metadata?: Json;
          product_id?: string;
          quantity?: number;
          tenant_id?: string;
          unit_price?: string | number;
          updated_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          auth_key: string;
          created_at: string;
          endpoint: string;
          expiration_time: string | null;
          id: string;
          p256dh_key: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth_key: string;
          created_at?: string;
          endpoint: string;
          expiration_time?: string | null;
          id?: string;
          p256dh_key: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth_key?: string;
          created_at?: string;
          endpoint?: string;
          expiration_time?: string | null;
          id?: string;
          p256dh_key?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
      };
      order_groups: {
        Row: {
          billing_address: Json;
          buyer_email: string | null;
          buyer_full_name: string | null;
          buyer_user_id: string;
          cancelled_at: string | null;
          cart_snapshot: Json;
          contact_phone: string | null;
          created_at: string;
          currency_code: string;
          discount_amount: string;
          id: string;
          items_count: number;
          items_subtotal_amount: string;
          items_tax_amount: string;
          metadata: Json;
          notes: Json;
          paid_at: string | null;
          placed_at: string | null;
          seller_count: number;
          shipping_address: Json;
          shipping_amount: string;
          status: Database["public"]["Enums"]["order_group_status"];
          total_amount: string;
          updated_at: string;
        };
        Insert: {
          billing_address?: Json;
          buyer_email?: string | null;
          buyer_full_name?: string | null;
          buyer_user_id: string;
          cancelled_at?: string | null;
          cart_snapshot?: Json;
          contact_phone?: string | null;
          created_at?: string;
          currency_code?: string;
          discount_amount?: string | number;
          id?: string;
          items_count?: number;
          items_subtotal_amount?: string | number;
          items_tax_amount?: string | number;
          metadata?: Json;
          notes?: Json;
          paid_at?: string | null;
          placed_at?: string | null;
          seller_count?: number;
          shipping_address?: Json;
          shipping_amount?: string | number;
          status?: Database["public"]["Enums"]["order_group_status"];
          total_amount?: string | number;
          updated_at?: string;
        };
        Update: {
          billing_address?: Json;
          buyer_email?: string | null;
          buyer_full_name?: string | null;
          buyer_user_id?: string;
          cancelled_at?: string | null;
          cart_snapshot?: Json;
          contact_phone?: string | null;
          created_at?: string;
          currency_code?: string;
          discount_amount?: string | number;
          id?: string;
          items_count?: number;
          items_subtotal_amount?: string | number;
          items_tax_amount?: string | number;
          metadata?: Json;
          notes?: Json;
          paid_at?: string | null;
          placed_at?: string | null;
          seller_count?: number;
          shipping_address?: Json;
          shipping_amount?: string | number;
          status?: Database["public"]["Enums"]["order_group_status"];
          total_amount?: string | number;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          billing_address: Json;
          buyer_email: string | null;
          buyer_full_name: string | null;
          buyer_note: string | null;
          buyer_user_id: string;
          cancelled_at: string | null;
          created_at: string;
          currency_code: string;
          discount_amount: string;
          fulfilled_at: string | null;
          id: string;
          items_count: number;
          items_subtotal_amount: string;
          items_tax_amount: string;
          metadata: Json;
          order_group_id: string;
          paid_at: string | null;
          placed_at: string | null;
          seller_note: string | null;
          shipping_address: Json;
          shipping_amount: string;
          shipping_method: string | null;
          status: Database["public"]["Enums"]["order_status"];
          tenant_id: string;
          tracking_number: string | null;
          tracking_url: string | null;
          total_amount: string;
          updated_at: string;
        };
        Insert: {
          billing_address?: Json;
          buyer_email?: string | null;
          buyer_full_name?: string | null;
          buyer_note?: string | null;
          buyer_user_id?: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency_code?: string;
          discount_amount?: string | number;
          fulfilled_at?: string | null;
          id?: string;
          items_count?: number;
          items_subtotal_amount?: string | number;
          items_tax_amount?: string | number;
          metadata?: Json;
          order_group_id: string;
          paid_at?: string | null;
          placed_at?: string | null;
          seller_note?: string | null;
          shipping_address?: Json;
          shipping_amount?: string | number;
          shipping_method?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          tenant_id: string;
          tracking_number?: string | null;
          tracking_url?: string | null;
          total_amount?: string | number;
          updated_at?: string;
        };
        Update: {
          billing_address?: Json;
          buyer_email?: string | null;
          buyer_full_name?: string | null;
          buyer_note?: string | null;
          buyer_user_id?: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency_code?: string;
          discount_amount?: string | number;
          fulfilled_at?: string | null;
          id?: string;
          items_count?: number;
          items_subtotal_amount?: string | number;
          items_tax_amount?: string | number;
          metadata?: Json;
          order_group_id?: string;
          paid_at?: string | null;
          placed_at?: string | null;
          seller_note?: string | null;
          shipping_address?: Json;
          shipping_amount?: string | number;
          shipping_method?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          tenant_id?: string;
          tracking_number?: string | null;
          tracking_url?: string | null;
          total_amount?: string | number;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          created_at: string;
          currency_code: string;
          id: string;
          metadata: Json;
          order_id: string;
          product_id: string | null;
          product_name: string;
          product_slug: string | null;
          product_sku: string | null;
          quantity: number;
          subtotal_amount: string;
          tax_amount: string;
          tenant_id: string;
          total_amount: string;
          unit_price: string;
          updated_at: string;
          vat_rate: string;
        };
        Insert: {
          created_at?: string;
          currency_code?: string;
          id?: string;
          metadata?: Json;
          order_id: string;
          product_id?: string | null;
          product_name?: string;
          product_slug?: string | null;
          product_sku?: string | null;
          quantity: number;
          subtotal_amount?: string | number;
          tax_amount?: string | number;
          tenant_id?: string;
          total_amount?: string | number;
          unit_price?: string | number;
          updated_at?: string;
          vat_rate?: string | number;
        };
        Update: {
          created_at?: string;
          currency_code?: string;
          id?: string;
          metadata?: Json;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          product_slug?: string | null;
          product_sku?: string | null;
          quantity?: number;
          subtotal_amount?: string | number;
          tax_amount?: string | number;
          tenant_id?: string;
          total_amount?: string | number;
          unit_price?: string | number;
          updated_at?: string;
          vat_rate?: string | number;
        };
      };
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
      contractor_profiles: {
        Row: {
          availability: string | null;
          avatar_url: string | null;
          bio: string | null;
          certifications: Json;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string | null;
          currency_code: string;
          display_name: string;
          featured: boolean;
          headline: string | null;
          hourly_rate: string | null;
          id: string;
          is_visible: boolean;
          languages: string[];
          portfolio_urls: Json;
          preferred_collaboration: string | null;
          search_vector: unknown;
          service_areas: string[];
          short_bio: string | null;
          skills: string[];
          slug: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          availability?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          certifications?: Json;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency_code?: string;
          display_name: string;
          featured?: boolean;
          headline?: string | null;
          hourly_rate?: string | null;
          id?: string;
          is_visible?: boolean;
          languages?: string[];
          portfolio_urls?: Json;
          preferred_collaboration?: string | null;
          search_vector?: unknown;
          service_areas?: string[];
          short_bio?: string | null;
          skills?: string[];
          slug: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          availability?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          certifications?: Json;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency_code?: string;
          display_name?: string;
          featured?: boolean;
          headline?: string | null;
          hourly_rate?: string | null;
          id?: string;
          is_visible?: boolean;
          languages?: string[];
          portfolio_urls?: Json;
          preferred_collaboration?: string | null;
          search_vector?: unknown;
          service_areas?: string[];
          short_bio?: string | null;
          skills?: string[];
          slug?: string;
          updated_at?: string;
          updated_by?: string | null;
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
      follows: {
        Row: {
          created_at: string;
          follower_user_id: string;
          id: string;
          is_notifications_enabled: boolean;
          metadata: Json;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          follower_user_id: string;
          id?: string;
          is_notifications_enabled?: boolean;
          metadata?: Json;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          follower_user_id?: string;
          id?: string;
          is_notifications_enabled?: boolean;
          metadata?: Json;
          tenant_id?: string;
        };
      };
      posts: {
        Row: {
          author_user_id: string;
          content: string;
          created_at: string;
          excerpt: string | null;
          id: string;
          is_pinned: boolean;
          metadata: Json;
          published_at: string | null;
          slug: string | null;
          status: Database["public"]["Enums"]["post_status"];
          tenant_id: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          author_user_id: string;
          content: string;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          is_pinned?: boolean;
          metadata?: Json;
          published_at?: string | null;
          slug?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          tenant_id: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          author_user_id?: string;
          content?: string;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          is_pinned?: boolean;
          metadata?: Json;
          published_at?: string | null;
          slug?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          tenant_id?: string;
          title?: string | null;
          updated_at?: string;
        };
      };
      comments: {
        Row: {
          author_user_id: string;
          body: string;
          created_at: string;
          id: string;
          last_edited_at: string | null;
          metadata: Json;
          parent_comment_id: string | null;
          post_id: string;
          status: Database["public"]["Enums"]["comment_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          author_user_id: string;
          body: string;
          created_at?: string;
          id?: string;
          last_edited_at?: string | null;
          metadata?: Json;
          parent_comment_id?: string | null;
          post_id: string;
          status?: Database["public"]["Enums"]["comment_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          author_user_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          last_edited_at?: string | null;
          metadata?: Json;
          parent_comment_id?: string | null;
          post_id?: string;
          status?: Database["public"]["Enums"]["comment_status"];
          tenant_id?: string;
          updated_at?: string;
        };
      };
      reactions: {
        Row: {
          comment_id: string | null;
          created_at: string;
          id: string;
          post_id: string | null;
          reaction: Database["public"]["Enums"]["reaction_type"];
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          reaction?: Database["public"]["Enums"]["reaction_type"];
          tenant_id?: string;
          user_id: string;
        };
        Update: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          reaction?: Database["public"]["Enums"]["reaction_type"];
          tenant_id?: string;
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
    Functions: {
      search_entities: {
        Args: {
          search_term: string;
          locale?: string;
          include_products?: boolean;
          include_contractors?: boolean;
          limit_count?: number;
        };
        Returns: {
          entity_type: string;
          entity_id: string;
          tenant_id: string | null;
          slug: string | null;
          title: string | null;
          subtitle: string | null;
          snippet: string | null;
          rank: number;
          payload: Json | null;
        }[];
      };
    };
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
      post_status: "draft" | "published" | "archived";
      comment_status: "visible" | "hidden" | "removed";
      reaction_type: "like" | "love" | "insightful" | "support" | "celebrate";
      notification_event: "message_new" | "order_status_update";
      notification_status: "pending" | "sent" | "failed";
      order_group_status: "pending" | "awaiting_payment" | "paid" | "cancelled" | "refunded";
      order_status:
        | "pending"
        | "awaiting_payment"
        | "paid"
        | "fulfilled"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded";
    };
    CompositeTypes: Record<string, never>;
  };
};
