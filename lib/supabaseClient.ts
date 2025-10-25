import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabaseConfig";
import type { Database } from "@/types/supabase";

export type SupabaseBrowserClient = SupabaseClient<Database>;

export function createSupabaseBrowserClient(): SupabaseBrowserClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    isSingleton: false,
  });
}
