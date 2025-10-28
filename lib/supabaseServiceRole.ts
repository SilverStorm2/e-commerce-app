import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabaseConfig";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/supabase";

let cachedClient: SupabaseClient<Database> | null = null;

export type SupabaseServiceRoleClient = SupabaseClient<Database>;

export function getSupabaseServiceRoleClient(): SupabaseServiceRoleClient {
  if (cachedClient) {
    return cachedClient;
  }

  const { supabaseUrl } = getSupabaseConfig();
  const serviceRoleKey = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  cachedClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
