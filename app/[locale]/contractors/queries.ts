import { normalizeSlug } from "@/lib/storefront";
import type { SupabaseServerClient } from "@/lib/supabaseServer";
import type { Database } from "@/types/supabase";
import {
  CONTRACTOR_DIRECTORY_LIMIT,
  type ContractorServiceArea,
  type ContractorSkill,
} from "@/lib/contractors/constants";

type ContractorProfileRow = Database["public"]["Tables"]["contractor_profiles"]["Row"];

const DIRECTORY_SELECT =
  "id, slug, display_name, headline, short_bio, skills, service_areas, languages, availability, hourly_rate, currency_code, featured, avatar_url";

const DETAIL_SELECT =
  "id, slug, display_name, headline, short_bio, bio, skills, service_areas, languages, availability, hourly_rate, currency_code, featured, avatar_url, preferred_collaboration, contact_email, contact_phone";

function sanitizeStringArray(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value): value is string => value.length > 0);
}

function resolveDirectoryLimit(requested?: number): number {
  if (typeof requested !== "number" || Number.isNaN(requested) || requested <= 0) {
    return CONTRACTOR_DIRECTORY_LIMIT;
  }

  return Math.min(requested, CONTRACTOR_DIRECTORY_LIMIT);
}

export type ContractorDirectoryProfile = Pick<
  ContractorProfileRow,
  | "id"
  | "slug"
  | "display_name"
  | "headline"
  | "short_bio"
  | "availability"
  | "hourly_rate"
  | "currency_code"
  | "featured"
  | "avatar_url"
> & {
  skills: string[];
  service_areas: string[];
  languages: string[];
};

export type ContractorDirectoryFilters = {
  searchTerm?: string;
  skill?: ContractorSkill;
  serviceArea?: ContractorServiceArea;
  limit?: number;
};

export async function searchContractorProfiles(
  client: SupabaseServerClient,
  filters: ContractorDirectoryFilters = {},
): Promise<ContractorDirectoryProfile[]> {
  const limit = resolveDirectoryLimit(filters.limit);

  let query = client.from("contractor_profiles").select(DIRECTORY_SELECT).eq("is_visible", true);

  if (filters.searchTerm) {
    const trimmedQuery = filters.searchTerm.trim();
    if (trimmedQuery.length > 0) {
      query = query.textSearch("search_vector", trimmedQuery, { type: "websearch" });
    }
  }

  if (filters.skill) {
    query = query.contains("skills", [filters.skill]);
  }

  if (filters.serviceArea) {
    query = query.contains("service_areas", [filters.serviceArea]);
  }

  const { data, error } = await query
    .order("featured", { ascending: false })
    .order("display_name", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const profile = row as unknown as ContractorProfileRow;
    return {
      id: profile.id,
      slug: profile.slug,
      display_name: profile.display_name,
      headline: profile.headline,
      short_bio: profile.short_bio,
      availability: profile.availability,
      hourly_rate: profile.hourly_rate,
      currency_code: profile.currency_code,
      featured: profile.featured,
      avatar_url: profile.avatar_url,
      skills: sanitizeStringArray(profile.skills),
      service_areas: sanitizeStringArray(profile.service_areas),
      languages: sanitizeStringArray(profile.languages),
    };
  });
}

export type ContractorDetailProfile = Pick<
  ContractorProfileRow,
  | "id"
  | "slug"
  | "display_name"
  | "headline"
  | "short_bio"
  | "bio"
  | "availability"
  | "hourly_rate"
  | "currency_code"
  | "featured"
  | "avatar_url"
  | "preferred_collaboration"
  | "contact_email"
  | "contact_phone"
> & {
  skills: string[];
  service_areas: string[];
  languages: string[];
};

export async function getContractorProfileByIdentifier(
  client: SupabaseServerClient,
  rawIdentifier: string,
): Promise<ContractorDetailProfile | null> {
  const identifier = rawIdentifier?.trim();
  if (!identifier) {
    return null;
  }

  const slugCandidates = new Set<string>();
  slugCandidates.add(identifier.toLowerCase());

  const normalized = normalizeSlug(identifier);
  if (normalized) {
    slugCandidates.add(normalized);
  }

  let query = client
    .from("contractor_profiles")
    .select(DETAIL_SELECT)
    .eq("is_visible", true)
    .limit(1);

  const filters = new Set<string>();
  filters.add(`id.eq.${identifier}`);
  slugCandidates.forEach((slug) => {
    if (slug) {
      filters.add(`slug.eq.${slug}`);
    }
  });

  if (filters.size > 0) {
    query = query.or(Array.from(filters).join(","));
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const profile = data as unknown as ContractorProfileRow;

  return {
    id: profile.id,
    slug: profile.slug,
    display_name: profile.display_name,
    headline: profile.headline,
    short_bio: profile.short_bio,
    bio: profile.bio,
    availability: profile.availability,
    hourly_rate: profile.hourly_rate,
    currency_code: profile.currency_code,
    featured: profile.featured,
    avatar_url: profile.avatar_url,
    preferred_collaboration: profile.preferred_collaboration,
    contact_email: profile.contact_email,
    contact_phone: profile.contact_phone,
    skills: sanitizeStringArray(profile.skills),
    service_areas: sanitizeStringArray(profile.service_areas),
    languages: sanitizeStringArray(profile.languages),
  };
}
