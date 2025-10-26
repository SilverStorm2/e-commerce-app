import type { SupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Database, Json } from "@/types/supabase";

type CartRow = Database["public"]["Tables"]["carts"]["Row"];
type CartItemsRow = Database["public"]["Tables"]["cart_items"]["Row"];
type CartItemInsert = Database["public"]["Tables"]["cart_items"]["Insert"];
type CartSupabaseClient = Pick<SupabaseBrowserClient, "from">;

type SupabaseSingleResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type SupabaseListResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type SupabaseActionResult = {
  error: { message: string } | null;
};

export type GuestCartItem = {
  productId: string;
  tenantId?: string;
  quantity: number;
  unitPrice?: number;
  metadata?: Record<string, unknown>;
};

export type MergeGuestCartArgs = {
  client: CartSupabaseClient;
  userId: string;
  items: GuestCartItem[];
  maxQuantity?: number;
  currencyCode?: string;
};

export type MergeGuestCartResult = {
  cartId: string;
  merged: number;
  skipped: GuestCartItem[];
};

type AggregatedGuestItem = {
  quantity: number;
  tenantId?: string;
  unitPrice?: number;
  metadata?: Record<string, unknown>;
};

const DEFAULT_MAX_QUANTITY = 99;
const DEFAULT_CURRENCY_CODE = "PLN";

function normaliseQuantity(quantity: number, max: number): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }

  const floored = Math.floor(quantity);
  if (floored < 1) {
    return 0;
  }

  return Math.min(floored, max);
}

async function getOrCreateCart(client: CartSupabaseClient, userId: string): Promise<CartRow> {
  const existingResult = (await (client.from("carts") as any)
    .select("id, user_id, currency_code, metadata, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle()) as SupabaseSingleResult<CartRow>;

  if (existingResult.error) {
    throw new Error(`Unable to load existing cart: ${existingResult.error.message}`);
  }

  if (existingResult.data) {
    return existingResult.data;
  }

  const cartInsertPayload: Database["public"]["Tables"]["carts"]["Insert"] = {
    user_id: userId,
  };

  const createResult = (await (client.from("carts") as any)
    .insert(cartInsertPayload)
    .select("id, user_id, currency_code, metadata, created_at, updated_at")
    .single()) as SupabaseSingleResult<CartRow>;

  if (createResult.error || !createResult.data) {
    throw new Error(
      `Unable to create cart for user ${userId}: ${createResult.error?.message ?? "unknown error"}`,
    );
  }

  return createResult.data;
}

function aggregateGuestItems(
  items: GuestCartItem[],
  maxQuantity: number,
  skipped: GuestCartItem[],
): Map<string, AggregatedGuestItem> {
  const aggregated = new Map<string, AggregatedGuestItem>();

  for (const item of items) {
    if (!item || typeof item.productId !== "string") {
      skipped.push(item);
      continue;
    }

    const productId = item.productId.trim();
    if (!productId) {
      skipped.push(item);
      continue;
    }

    const quantity = normaliseQuantity(item.quantity, maxQuantity);
    if (quantity <= 0) {
      skipped.push(item);
      continue;
    }

    const current = aggregated.get(productId);
    const nextQuantity = Math.min(quantity + (current?.quantity ?? 0), maxQuantity);

    aggregated.set(productId, {
      quantity: nextQuantity,
      tenantId: item.tenantId ?? current?.tenantId,
      unitPrice: item.unitPrice ?? current?.unitPrice,
      metadata: item.metadata ?? current?.metadata,
    });
  }

  return aggregated;
}

type ExistingItemSubset = Pick<
  CartItemsRow,
  "product_id" | "quantity" | "metadata" | "tenant_id" | "unit_price"
>;

function buildUpsertPayload(
  cartId: string,
  aggregated: Map<string, AggregatedGuestItem>,
  existingItems: ExistingItemSubset[],
  currencyCode: string,
  maxQuantity: number,
): CartItemInsert[] {
  const existingMap = new Map<string, ExistingItemSubset>();
  for (const row of existingItems) {
    existingMap.set(row.product_id, row);
  }

  const payload: CartItemInsert[] = [];

  for (const [productId, guestItem] of aggregated.entries()) {
    const existing = existingMap.get(productId);
    const existingQuantity = normaliseQuantity(existing?.quantity ?? 0, maxQuantity);
    const quantity = Math.min(existingQuantity + guestItem.quantity, maxQuantity);

    const metadata: Json =
      (guestItem.metadata as Json | undefined) ?? (existing?.metadata as Json | undefined) ?? {};

    const insert: CartItemInsert = {
      cart_id: cartId,
      product_id: productId,
      quantity,
      metadata,
      currency_code: currencyCode,
    };

    if (guestItem.tenantId ?? existing?.tenant_id) {
      insert.tenant_id = guestItem.tenantId ?? existing?.tenant_id ?? undefined;
    }

    if (guestItem.unitPrice !== undefined && guestItem.unitPrice !== null) {
      insert.unit_price = guestItem.unitPrice;
    } else if (existing?.unit_price !== undefined && existing?.unit_price !== null) {
      insert.unit_price = existing.unit_price;
    }

    payload.push(insert);
  }

  return payload;
}

export async function mergeGuestCart({
  client,
  userId,
  items,
  maxQuantity = DEFAULT_MAX_QUANTITY,
  currencyCode = DEFAULT_CURRENCY_CODE,
}: MergeGuestCartArgs): Promise<MergeGuestCartResult> {
  if (!userId) {
    throw new Error("mergeGuestCart requires a userId");
  }

  const skipped: GuestCartItem[] = [];
  const aggregated = aggregateGuestItems(items, maxQuantity, skipped);

  const cart = await getOrCreateCart(client, userId);

  if (aggregated.size === 0) {
    return {
      cartId: cart.id,
      merged: 0,
      skipped,
    };
  }

  const existingItemsResult = (await (client.from("cart_items") as any)
    .select("product_id, quantity, metadata, tenant_id, unit_price")
    .eq("cart_id", cart.id)) as SupabaseListResult<CartItemsRow>;

  if (existingItemsResult.error) {
    throw new Error(`Unable to read existing cart items: ${existingItemsResult.error.message}`);
  }

  const existingItems = (existingItemsResult.data as ExistingItemSubset[] | null | undefined) ?? [];

  const upsertPayload = buildUpsertPayload(
    cart.id,
    aggregated,
    existingItems,
    currencyCode,
    maxQuantity,
  );

  if (upsertPayload.length === 0) {
    return {
      cartId: cart.id,
      merged: 0,
      skipped,
    };
  }

  const upsertResult = (await (client.from("cart_items") as any).upsert(upsertPayload, {
    onConflict: "cart_id,product_id",
  })) as SupabaseActionResult;

  if (upsertResult.error) {
    throw new Error(`Unable to upsert cart items: ${upsertResult.error.message}`);
  }

  return {
    cartId: cart.id,
    merged: upsertPayload.length,
    skipped,
  };
}
