const requiredServerEnv = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type ServerEnvKey = (typeof requiredServerEnv)[number];

const cache: Partial<Record<ServerEnvKey, string>> = {};

export function getServerEnv(key: ServerEnvKey): string {
  const cached = cache[key];
  if (cached) {
    return cached;
  }

  const value = process.env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required server environment variable: ${key}`);
  }

  cache[key] = value;
  return value;
}
