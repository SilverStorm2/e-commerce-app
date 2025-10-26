import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeClient } from "@/lib/stripe/client";
import { siteUrl } from "@/lib/env";
import { createSupabaseServerClientWithHeaders } from "@/lib/supabaseServer";
import { locales, type Locale, defaultLocale } from "@/lib/i18n/config";
import type { Database, Json } from "@/types/supabase";

const SUPPORTED_LOCALES = new Set<Locale>(locales);
const MAX_NOTE_LENGTH = 800;
const MAX_PHONE_LENGTH = 32;
const DEFAULT_CURRENCY = "PLN";

type CheckoutPayload = {
  locale?: string;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  contactPhone?: string;
  buyerNote?: string;
};

type CartItemRow = Database["public"]["Tables"]["cart_items"]["Row"] & {
  product: {
    id: string;
    tenant_id: string;
    name: string;
    slug: string | null;
    sku: string | null;
    vat_rate: string | null;
    currency_code: string;
  } | null;
};

type NormalizedItem = {
  cartItemId: string;
  tenantId: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  productSku: string | null;
  quantity: number;
  unitNet: number;
  unitTax: number;
  unitGross: number;
  subtotalNet: number;
  taxAmount: number;
  totalGross: number;
  vatRate: number;
  currencyCode: string;
  metadata: Json;
};

type SellerAggregation = {
  items: NormalizedItem[];
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
};

type GroupAggregation = {
  sellers: Map<string, SellerAggregation>;
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
};

function sanitizeLocale(value: unknown, fallback: Locale = defaultLocale): Locale {
  if (typeof value !== "string") {
    return fallback;
  }

  const candidate = value.trim().toLowerCase() as Locale;
  return SUPPORTED_LOCALES.has(candidate) ? candidate : fallback;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatAmount(value: number): string {
  return roundCurrency(value).toFixed(2);
}

function toMinorUnits(value: number): number {
  return Math.round(roundCurrency(value) * 100);
}

function sanitizeNote(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_NOTE_LENGTH);
}

function sanitizePhone(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_PHONE_LENGTH);
}

const ADDRESS_FIELDS = [
  "fullName",
  "company",
  "line1",
  "line2",
  "postalCode",
  "city",
  "region",
  "country",
  "taxId",
] as const;

type AddressField = (typeof ADDRESS_FIELDS)[number];

function sanitizeAddress(value: unknown): Record<AddressField, string> | Record<string, never> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: Partial<Record<AddressField, string>> = {};
  for (const field of ADDRESS_FIELDS) {
    const raw = (value as Record<string, unknown>)[field];
    if (typeof raw !== "string") {
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    result[field] = trimmed.slice(0, 160);
  }

  return Object.keys(result).length > 0 ? (result as Record<AddressField, string>) : {};
}

function normalizeCartItems(items: CartItemRow[]): NormalizedItem[] {
  return items.map((row) => {
    if (!row.tenant_id) {
      throw new Error("Cart item is missing tenant context.");
    }

    if (!row.product_id) {
      throw new Error("Cart item is missing product reference.");
    }

    if (!row.product) {
      throw new Error("Cart item product snapshot is unavailable.");
    }

    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Cart item quantity is invalid.");
    }

    const unitPriceRaw = toNumber(row.unit_price);
    if (!Number.isFinite(unitPriceRaw) || unitPriceRaw <= 0) {
      throw new Error("Cart item price is invalid.");
    }

    const vatRateRaw = toNumber(row.product.vat_rate);
    const vatRate = Number.isFinite(vatRateRaw) && vatRateRaw >= 0 ? vatRateRaw : 0;

    const unitNet = roundCurrency(unitPriceRaw);
    const unitTax = roundCurrency(unitNet * (vatRate / 100));
    const unitGross = roundCurrency(unitNet + unitTax);
    const subtotalNet = roundCurrency(unitNet * quantity);
    const taxAmount = roundCurrency(unitTax * quantity);
    const totalGross = roundCurrency(subtotalNet + taxAmount);

    return {
      cartItemId: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      productName: row.product.name,
      productSlug: row.product.slug,
      productSku: row.product.sku,
      quantity,
      unitNet,
      unitTax,
      unitGross,
      subtotalNet,
      taxAmount,
      totalGross,
      vatRate,
      currencyCode: row.currency_code,
      metadata: row.metadata as Json,
    };
  });
}

function aggregateByTenant(items: NormalizedItem[]): GroupAggregation {
  const sellers = new Map<string, SellerAggregation>();

  for (const item of items) {
    const existing = sellers.get(item.tenantId);
    if (!existing) {
      sellers.set(item.tenantId, {
        items: [item],
        subtotal: item.subtotalNet,
        tax: item.taxAmount,
        total: item.totalGross,
        itemCount: item.quantity,
      });
      continue;
    }

    existing.items.push(item);
    existing.subtotal += item.subtotalNet;
    existing.tax += item.taxAmount;
    existing.total += item.totalGross;
    existing.itemCount += item.quantity;
  }

  let subtotal = 0;
  let tax = 0;
  let total = 0;
  let itemCount = 0;

  for (const [tenantId, aggregation] of sellers.entries()) {
    aggregation.subtotal = roundCurrency(aggregation.subtotal);
    aggregation.tax = roundCurrency(aggregation.tax);
    aggregation.total = roundCurrency(aggregation.total);

    subtotal += aggregation.subtotal;
    tax += aggregation.tax;
    total += aggregation.total;
    itemCount += aggregation.itemCount;

    sellers.set(tenantId, aggregation);
  }

  return {
    sellers,
    subtotal: roundCurrency(subtotal),
    tax: roundCurrency(tax),
    total: roundCurrency(total),
    itemCount,
  };
}

function buildStripeLineItems(
  items: NormalizedItem[],
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: item.currencyCode.toLowerCase(),
      unit_amount: toMinorUnits(item.unitGross),
      product_data: {
        name: item.productName,
        metadata: {
          product_id: item.productId,
          tenant_id: item.tenantId,
          vat_rate: item.vatRate.toFixed(2),
        },
      },
    },
  }));
}

function ensureCartCurrency(cartCurrency: string, items: NormalizedItem[]): void {
  for (const item of items) {
    if (item.currencyCode !== cartCurrency) {
      throw new Error("Cart contains items with different currencies.");
    }
  }
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClientWithHeaders() as any;
  const stripe = getStripeClient();

  let payload: CheckoutPayload | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, default_locale")
    .eq("user_id", user.id)
    .maybeSingle();

  const locale = sanitizeLocale(payload?.locale ?? profile?.default_locale ?? defaultLocale);

  const { data: cart, error: cartError } = await supabase
    .from("carts")
    .select("id, currency_code, metadata")
    .eq("user_id", user.id)
    .maybeSingle();

  if (cartError) {
    console.error("[checkout.session] Failed to load cart", cartError);
    return NextResponse.json({ error: "Unable to load cart." }, { status: 500 });
  }

  if (!cart) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }

  if (cart.currency_code !== DEFAULT_CURRENCY) {
    return NextResponse.json({ error: "Unsupported currency for checkout." }, { status: 400 });
  }

  const { data: cartItems, error: cartItemsError } = (await supabase
    .from("cart_items")
    .select(
      `
        id,
        cart_id,
        tenant_id,
        product_id,
        quantity,
        unit_price,
        currency_code,
        metadata,
        product:products (
          id,
          tenant_id,
          name,
          slug,
          sku,
          vat_rate,
          currency_code
        )
      `,
    )
    .eq("cart_id", cart.id)) as {
    data: CartItemRow[] | null;
    error: { message: string } | null;
  };

  if (cartItemsError) {
    console.error("[checkout.session] Failed to load cart items", cartItemsError);
    return NextResponse.json({ error: "Unable to load cart items." }, { status: 500 });
  }

  if (!cartItems || cartItems.length === 0) {
    return NextResponse.json({ error: "Cart does not contain any items." }, { status: 400 });
  }

  let normalizedItems: NormalizedItem[];

  try {
    normalizedItems = normalizeCartItems(cartItems);
    ensureCartCurrency(cart.currency_code, normalizedItems);
  } catch (error) {
    console.error("[checkout.session] Cart validation failed", error);
    return NextResponse.json({ error: "Cart is invalid or stale." }, { status: 400 });
  }

  const aggregation = aggregateByTenant(normalizedItems);
  if (aggregation.sellers.size === 0) {
    return NextResponse.json(
      { error: "Unable to create order without seller data." },
      { status: 400 },
    );
  }

  const shippingAddress = sanitizeAddress(payload?.shippingAddress);
  const billingAddress = sanitizeAddress(payload?.billingAddress);
  const contactPhone = sanitizePhone(payload?.contactPhone);
  const buyerNote = sanitizeNote(payload?.buyerNote);

  const cartSnapshot: Json = {
    cart_id: cart.id,
    currency_code: cart.currency_code,
    metadata: cart.metadata,
    items: normalizedItems.map((item) => ({
      cart_item_id: item.cartItemId,
      tenant_id: item.tenantId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_net: item.unitNet,
      vat_rate: item.vatRate,
      subtotal_net: item.subtotalNet,
      tax_amount: item.taxAmount,
      total_gross: item.totalGross,
    })),
  };

  const groupMetadata: Json = {
    locale,
    seller_count: aggregation.sellers.size,
    item_count: aggregation.itemCount,
    currency_code: cart.currency_code,
    source: "stripe_checkout_session",
  };

  const orderGroupInsert: Database["public"]["Tables"]["order_groups"]["Insert"] = {
    buyer_user_id: user.id,
    buyer_email: user.email ?? null,
    buyer_full_name:
      profile?.full_name ?? (user.user_metadata.full_name as string | undefined) ?? null,
    currency_code: cart.currency_code,
    billing_address: Object.keys(billingAddress).length > 0 ? (billingAddress as Json) : {},
    shipping_address: Object.keys(shippingAddress).length > 0 ? (shippingAddress as Json) : {},
    contact_phone: contactPhone,
    notes: buyerNote ? ({ buyer_note: buyerNote } satisfies Json) : {},
    metadata: groupMetadata,
    cart_snapshot: cartSnapshot,
    items_subtotal_amount: formatAmount(aggregation.subtotal),
    items_tax_amount: formatAmount(aggregation.tax),
    shipping_amount: formatAmount(0),
    discount_amount: formatAmount(0),
    total_amount: formatAmount(aggregation.total),
    items_count: aggregation.itemCount,
    seller_count: aggregation.sellers.size,
    status: "pending",
  };

  const { data: insertedGroup, error: groupError } = await supabase
    .from("order_groups")
    .insert(orderGroupInsert)
    .select("id, metadata")
    .single();

  if (groupError || !insertedGroup) {
    console.error("[checkout.session] Failed to insert order_group", groupError);
    return NextResponse.json({ error: "Unable to create order group." }, { status: 500 });
  }

  const orderGroupId = insertedGroup.id;

  const orderInserts: Database["public"]["Tables"]["orders"]["Insert"][] = [];
  for (const [tenantId, seller] of aggregation.sellers.entries()) {
    orderInserts.push({
      order_group_id: orderGroupId,
      tenant_id: tenantId,
      buyer_user_id: user.id,
      buyer_email: user.email ?? null,
      buyer_full_name:
        profile?.full_name ?? (user.user_metadata.full_name as string | undefined) ?? null,
      buyer_note: buyerNote,
      currency_code: cart.currency_code,
      billing_address: Object.keys(billingAddress).length > 0 ? (billingAddress as Json) : {},
      shipping_address: Object.keys(shippingAddress).length > 0 ? (shippingAddress as Json) : {},
      metadata: {
        cart_item_ids: seller.items.map((item) => item.cartItemId),
      } satisfies Json,
      items_subtotal_amount: formatAmount(seller.subtotal),
      items_tax_amount: formatAmount(seller.tax),
      shipping_amount: formatAmount(0),
      discount_amount: formatAmount(0),
      total_amount: formatAmount(seller.total),
      items_count: seller.itemCount,
      status: "pending",
    });
  }

  const { data: insertedOrders, error: orderError } = await supabase
    .from("orders")
    .insert(orderInserts)
    .select("id, tenant_id");

  if (orderError || !insertedOrders) {
    console.error("[checkout.session] Failed to insert orders", orderError);
    await supabase
      .from("order_groups")
      .update({
        status: "cancelled",
        metadata: {
          ...groupMetadata,
          error: "orders_insert_failed",
        } satisfies Json,
      })
      .eq("id", orderGroupId);

    return NextResponse.json({ error: "Unable to create seller orders." }, { status: 500 });
  }

  const orderIdByTenant = new Map<string, string>();
  for (const order of insertedOrders) {
    orderIdByTenant.set(order.tenant_id, order.id);
  }

  const orderItemsPayload: Database["public"]["Tables"]["order_items"]["Insert"][] =
    normalizedItems.map((item) => {
      const orderId = orderIdByTenant.get(item.tenantId);
      if (!orderId) {
        throw new Error(`Missing order reference for tenant ${item.tenantId}`);
      }

      const metadata: Json = {
        cart_item_id: item.cartItemId,
        original_metadata: item.metadata,
      };

      return {
        order_id: orderId,
        tenant_id: item.tenantId,
        product_id: item.productId,
        product_name: item.productName,
        product_slug: item.productSlug,
        product_sku: item.productSku,
        quantity: item.quantity,
        unit_price: formatAmount(item.unitNet),
        vat_rate: item.vatRate.toFixed(2),
        currency_code: item.currencyCode,
        metadata,
      };
    });

  try {
    const { error: orderItemsError } = await supabase.from("order_items").insert(orderItemsPayload);
    if (orderItemsError) {
      throw orderItemsError;
    }
  } catch (error) {
    console.error("[checkout.session] Failed to insert order_items", error);
    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("order_group_id", orderGroupId);
    await supabase
      .from("order_groups")
      .update({
        status: "cancelled",
        metadata: {
          ...groupMetadata,
          error: "order_items_insert_failed",
        } satisfies Json,
      })
      .eq("id", orderGroupId);

    return NextResponse.json({ error: "Unable to finalise order items." }, { status: 500 });
  }

  const origin = siteUrl?.trim()
    ? siteUrl.replace(/\/$/, "")
    : `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const successUrl = `${origin}/${locale}/checkout/success?order=${orderGroupId}`;
  const cancelUrl = `${origin}/${locale}/checkout/cancel?order=${orderGroupId}`;

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      line_items: buildStripeLineItems(normalizedItems),
      customer_email: user.email ?? undefined,
      locale,
      client_reference_id: orderGroupId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        order_group_id: orderGroupId,
        seller_count: String(aggregation.sellers.size),
        item_count: String(aggregation.itemCount),
        currency_code: cart.currency_code,
      },
    });
  } catch (error) {
    console.error("[checkout.session] Failed to create Stripe session", error);
    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("order_group_id", orderGroupId);
    await supabase
      .from("order_groups")
      .update({
        status: "cancelled",
        metadata: {
          ...groupMetadata,
          error: "stripe_session_failed",
        } satisfies Json,
      })
      .eq("id", orderGroupId);

    return NextResponse.json({ error: "Unable to create checkout session." }, { status: 502 });
  }

  const updatedMetadata: Json = {
    ...groupMetadata,
    stripe_session_id: session.id,
    stripe_checkout_url: session.url ?? null,
    stripe_payment_intent:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  };

  await supabase
    .from("order_groups")
    .update({
      status: "awaiting_payment",
      metadata: updatedMetadata,
    })
    .eq("id", orderGroupId);

  await supabase
    .from("orders")
    .update({ status: "awaiting_payment" })
    .eq("order_group_id", orderGroupId);

  return NextResponse.json({
    sessionId: session.id,
    url: session.url,
    orderGroupId,
  });
}
