import { cookies, headers as nextHeaders } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabaseConfig";
import type { Database } from "@/types/supabase";

export type SupabaseServerClient = SupabaseClient<Database>;

type CookieAdapter = {
  getAll: () =>
    | {
        name: string;
        value: string;
      }[]
    | null;
  setAll?: (
    cookies: {
      name: string;
      value: string;
      options: CookieOptions;
    }[],
  ) => void;
};

function adaptCookies(): CookieAdapter {
  const cookieStore = cookies();
  const mutableStore = cookieStore as unknown as {
    set?: (options: { name: string; value: string } & CookieOptions) => void;
  };

  return {
    getAll() {
      return cookieStore.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value }));
    },
    setAll(cookiesToSet) {
      if (typeof mutableStore.set !== "function") {
        return;
      }

      cookiesToSet.forEach(({ name, value, options }) => {
        const cookieOptions = { ...options, path: options.path ?? "/" };
        mutableStore.set?.({ name, value, ...cookieOptions });
      });
    },
  };
}

export function createSupabaseServerClient(): SupabaseServerClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: adaptCookies(),
  });
}

export function createSupabaseServerClientWithHeaders(): SupabaseServerClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const cookieAdapter = adaptCookies();
  const requestHeaders = nextHeaders();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: cookieAdapter,
    global: {
      headers: Object.fromEntries(requestHeaders.entries()),
    },
  });
}
