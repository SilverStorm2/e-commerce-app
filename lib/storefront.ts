import type { SupabaseServerClient } from "@/lib/supabaseServer";

type StorageLocation = {
  bucket: string;
  path: string;
} | null;

const POLISH_CHAR_MAP: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
  Ą: "a",
  Ć: "c",
  Ę: "e",
  Ł: "l",
  Ń: "n",
  Ó: "o",
  Ś: "s",
  Ź: "z",
  Ż: "z",
};

function stripDiacritics(input: string): string {
  const normalized = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized
    .split("")
    .map((char) => POLISH_CHAR_MAP[char] ?? char)
    .join("");
}

export function normalizeSlug(input: string): string {
  if (!input) {
    return "";
  }

  return stripDiacritics(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

export function formatPrice(amount: string | number, locale: string, currency: string): string {
  const numeric = typeof amount === "number" ? amount : parseFloat(amount);
  const safeAmount = Number.isFinite(numeric) ? numeric : 0;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

function parseStorageLocation(storagePath: string | null | undefined): StorageLocation {
  if (!storagePath) {
    return null;
  }

  const [bucket, ...rest] = storagePath.split("/").filter(Boolean);
  if (!bucket || rest.length === 0) {
    return null;
  }

  return { bucket, path: rest.join("/") };
}

export function resolvePublicStorageUrl(
  client: SupabaseServerClient,
  storagePath: string | null | undefined,
): string | null {
  const location = parseStorageLocation(storagePath);
  if (!location) {
    return null;
  }

  const result = client.storage.from(location.bucket).getPublicUrl(location.path);
  return result.data?.publicUrl ?? null;
}
