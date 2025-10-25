import { getEnv } from "@/lib/env";

export type SupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function getSupabaseConfig(): SupabaseConfig {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return { supabaseUrl, supabaseAnonKey };
}
