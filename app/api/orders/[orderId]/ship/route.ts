import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClientWithHeaders } from "@/lib/supabaseServer";
import {
  buildTrackingUrl,
  getCarrier,
  isKnownCarrier,
  resolveShippingMethod,
  sanitizeTrackingNumber,
  type CarrierId,
} from "@/lib/shipping/track";

export const runtime = "nodejs";

type ShipOrderPayload = {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  shippingMethod?: string | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseBody(body: unknown): ShipOrderPayload | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const carrier = typeof (body as ShipOrderPayload).carrier === "string" ? body.carrier.trim() : "";
  const trackingNumber =
    typeof (body as ShipOrderPayload).trackingNumber === "string" ? body.trackingNumber : "";
  const trackingUrl =
    typeof (body as ShipOrderPayload).trackingUrl === "string" ? body.trackingUrl : null;
  const shippingMethod =
    typeof (body as ShipOrderPayload).shippingMethod === "string" ? body.shippingMethod : null;

  if (!carrier) {
    return null;
  }

  return { carrier, trackingNumber, trackingUrl, shippingMethod };
}

function normalizeUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      throw new Error("Tracking URL must use HTTPS.");
    }

    return url.toString();
  } catch (error) {
    throw new Error("Invalid tracking URL.");
  }
}

export async function POST(request: NextRequest, { params }: { params: { orderId: string } }) {
  const orderId = params.orderId;
  if (!orderId || !isUuid(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  let payload: ShipOrderPayload | null = null;
  try {
    const body = await request.json();
    payload = parseBody(body);
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload) {
    return NextResponse.json({ error: "Missing shipping payload." }, { status: 400 });
  }

  if (!isKnownCarrier(payload.carrier)) {
    return NextResponse.json({ error: "Unsupported carrier." }, { status: 400 });
  }

  const carrierId = payload.carrier as CarrierId;
  const sanitizedTrackingNumber = sanitizeTrackingNumber(payload.trackingNumber);

  if (!sanitizedTrackingNumber) {
    return NextResponse.json({ error: "Tracking number is required." }, { status: 400 });
  }

  let normalizedTrackingUrl: string | null = null;
  try {
    normalizedTrackingUrl = normalizeUrl(payload.trackingUrl ?? null);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const trackingUrl = buildTrackingUrl(carrierId, sanitizedTrackingNumber, {
    customUrl: normalizedTrackingUrl,
  });

  if (!trackingUrl) {
    return NextResponse.json({ error: "Carrier requires a manual tracking URL." }, { status: 400 });
  }

  const shippingMethod = resolveShippingMethod(carrierId, payload.shippingMethod);

  const supabase = createSupabaseServerClientWithHeaders();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, order_group_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found or inaccessible." }, { status: 404 });
  }

  if (order.status !== "paid" && order.status !== "shipped") {
    return NextResponse.json(
      { error: "Order must be paid before it can be marked as shipped." },
      { status: 409 },
    );
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({
      status: "shipped",
      shipping_method: shippingMethod,
      tracking_number: sanitizedTrackingNumber,
      tracking_url: trackingUrl,
    })
    .eq("id", orderId)
    .select(
      "id, status, shipping_method, tracking_number, tracking_url, updated_at, order_group_id",
    )
    .single();

  if (updateError || !updatedOrder) {
    return NextResponse.json({ error: "Failed to update order." }, { status: 500 });
  }

  return NextResponse.json({
    order: {
      id: updatedOrder.id,
      status: updatedOrder.status,
      shippingMethod: updatedOrder.shipping_method,
      trackingNumber: updatedOrder.tracking_number,
      trackingUrl: updatedOrder.tracking_url,
      updatedAt: updatedOrder.updated_at,
      orderGroupId: updatedOrder.order_group_id,
    },
  });
}
