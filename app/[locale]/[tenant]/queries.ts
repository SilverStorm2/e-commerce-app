import { normalizeSlug } from "@/lib/storefront";
import type { SupabaseServerClient } from "@/lib/supabaseServer";
import type { Database } from "@/types/supabase";

type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductMediaRow = Database["public"]["Tables"]["product_media"]["Row"];

export type StorefrontProduct = ProductRow & {
  media: ProductMediaRow[];
};

function buildSlugFilters(rawSlug: string): string[] {
  const trimmed = rawSlug.trim().toLowerCase();
  const normalized = normalizeSlug(rawSlug);

  const variants = new Set<string>();
  if (trimmed) {
    variants.add(trimmed);
  }
  if (normalized && normalized !== trimmed) {
    variants.add(normalized);
  }

  return Array.from(variants);
}

export async function getTenantBySlug(
  client: SupabaseServerClient,
  rawSlug: string,
): Promise<TenantRow | null> {
  const slugFilters = buildSlugFilters(rawSlug);

  let query = client
    .from("tenants")
    .select(
      "id, name, slug, description, country_code, currency_code, default_locale, created_at, updated_at",
    )
    .limit(1);

  if (slugFilters.length === 1) {
    query = query.eq("slug", slugFilters[0]);
  } else if (slugFilters.length > 1) {
    query = query.or(slugFilters.map((value) => `slug.eq.${value}`).join(","));
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getPublishedProductsForTenant(
  client: SupabaseServerClient,
  tenantId: string,
): Promise<StorefrontProduct[]> {
  const { data: productsData, error } = await client
    .from("products")
    .select(
      "id, tenant_id, slug, name, short_description, price_amount, currency_code, status, is_published, published_at, metadata, stock_quantity, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("is_published", true)
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  const products = (productsData ?? []) as ProductRow[];

  if (products.length === 0) {
    return [];
  }

  const productIds = products.map((product) => product.id);
  const { data: mediaData, error: mediaError } = await client
    .from("product_media")
    .select(
      "id, product_id, storage_path, alt_text, is_primary, position, width, height, mime_type",
    )
    .in("product_id", productIds)
    .order("is_primary", { ascending: false })
    .order("position", { ascending: true });

  if (mediaError) {
    throw mediaError;
  }

  const mediaByProduct = new Map<string, ProductMediaRow[]>();
  (mediaData ?? []).forEach((item) => {
    const media = item as ProductMediaRow;
    const current = mediaByProduct.get(media.product_id) ?? [];
    current.push(media);
    mediaByProduct.set(media.product_id, current);
  });

  return products.map((product) => ({
    ...product,
    media: mediaByProduct.get(product.id) ?? [],
  }));
}

export async function getProductBySlug(
  client: SupabaseServerClient,
  tenantId: string,
  rawSlug: string,
): Promise<StorefrontProduct | null> {
  const slugFilters = buildSlugFilters(rawSlug);

  let productQuery = client
    .from("products")
    .select(
      "id, tenant_id, slug, name, short_description, description, price_amount, currency_code, vat_rate, status, is_published, published_at, seo_title, seo_description, metadata, stock_quantity, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("is_published", true)
    .eq("status", "active")
    .limit(1);

  if (slugFilters.length === 1) {
    productQuery = productQuery.eq("slug", slugFilters[0]);
  } else if (slugFilters.length > 1) {
    productQuery = productQuery.or(slugFilters.map((value) => `slug.eq.${value}`).join(","));
  }

  const { data: productData, error } = await productQuery.maybeSingle();
  if (error) {
    throw error;
  }

  if (!productData) {
    return null;
  }

  const product = productData as ProductRow;

  const { data: mediaData, error: mediaError } = await client
    .from("product_media")
    .select(
      "id, product_id, storage_path, alt_text, is_primary, position, width, height, mime_type",
    )
    .eq("product_id", product.id)
    .order("is_primary", { ascending: false })
    .order("position", { ascending: true });

  if (mediaError) {
    throw mediaError;
  }

  return {
    ...product,
    media: (mediaData ?? []) as ProductMediaRow[],
  };
}
