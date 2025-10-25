import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClientWithHeaders } from "@/lib/supabaseServer";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type SupportedType = "product" | "contractor";

type SearchEntity = {
  entity_type: SupportedType;
  entity_id: string;
  tenant_id: string | null;
  slug: string | null;
  title: string | null;
  subtitle: string | null;
  snippet: string | null;
  rank: number;
  payload: Record<string, unknown> | null;
};

function parseLimit(value: string | null): number {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function parseTypes(params: URLSearchParams): {
  includeProducts: boolean;
  includeContractors: boolean;
} {
  const requested = params.getAll("type").map((entry) => entry.toLowerCase());
  if (requested.length === 0) {
    return { includeProducts: true, includeContractors: true };
  }

  const includeProducts = requested.includes("product");
  const includeContractors = requested.includes("contractor");

  if (!includeProducts && !includeContractors) {
    return { includeProducts: true, includeContractors: true };
  }

  return { includeProducts, includeContractors };
}

function sanitizeLocale(rawLocale: string | null): string {
  if (!rawLocale) {
    return "pl";
  }

  const normalized = rawLocale.trim().toLowerCase();
  if (normalized === "pl" || normalized === "en") {
    return normalized;
  }

  return "pl";
}

function mapResultRow(row: SearchEntity) {
  return {
    type: row.entity_type,
    id: row.entity_id,
    tenantId: row.tenant_id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    snippet: row.snippet,
    rank: row.rank,
    payload: row.payload ?? {},
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (query.length === 0) {
    return NextResponse.json({ error: "Missing query parameter `q`." }, { status: 400 });
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  const { includeProducts, includeContractors } = parseTypes(url.searchParams);
  const locale = sanitizeLocale(url.searchParams.get("locale"));

  const supabase = createSupabaseServerClientWithHeaders();
  const { data, error } = await supabase.rpc("search_entities", {
    search_term: query,
    locale,
    include_products: includeProducts,
    include_contractors: includeContractors,
    limit_count: limit,
  });

  if (error) {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }

  const results = Array.isArray(data) ? data.map(mapResultRow) : [];

  return NextResponse.json({
    query,
    locale,
    limit,
    include: {
      products: includeProducts,
      contractors: includeContractors,
    },
    results,
  });
}
