const requiredClientEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
] as const;

type EnvKey = (typeof requiredClientEnv)[number];

const clientEnv: Record<EnvKey, string> = requiredClientEnv.reduce(
  (acc, key) => {
    const value = process.env[key];
    if (!value) {
      acc[key] = "";
      return acc;
    }

    acc[key] = value;
    return acc;
  },
  {} as Record<EnvKey, string>,
);

export function getEnv(key: EnvKey): string {
  return clientEnv[key];
}

export const siteUrl = getEnv("NEXT_PUBLIC_SITE_URL");
