import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeClient } from "@/lib/stripe/client";
import { getServerEnv } from "@/lib/env.server";
import { getSupabaseServiceRoleClient } from "@/lib/supabaseServiceRole";
import type { Json } from "@/types/supabase";

export const runtime = "nodejs";

const stripe = getStripeClient();

const RECONCILIATION_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

type ReconcileResult = {
  order_group_id: string;
  applied: boolean;
  orders_updated?: number;
  inventory_committed?: number;
};

function toMajorUnits(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value) / 100;
}

function deepCompact(value: unknown): unknown {
  if (Array.isArray(value)) {
    const compacted = value.map((item) => deepCompact(item)).filter((item) => item !== undefined);
    return compacted.length > 0 ? compacted : undefined;
  }

  if (value && typeof value === "object") {
    const entries: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const compacted = deepCompact(val);
      if (compacted !== undefined) {
        entries[key] = compacted;
      }
    }

    return Object.keys(entries).length > 0 ? entries : undefined;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  return value;
}

function buildEventMetadata(session: Stripe.Checkout.Session): Json | null {
  const metadata = deepCompact({
    stripeSessionId: session.id,
    clientReferenceId: session.client_reference_id,
    metadata: session.metadata,
    mode: session.mode,
    paymentStatus: session.payment_status,
    locale: session.locale,
    customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
  });

  if (!metadata) {
    return null;
  }

  return metadata as Json;
}

function resolveOrderGroupId(session: Stripe.Checkout.Session): string | null {
  if (session.metadata && typeof session.metadata.order_group_id === "string") {
    return session.metadata.order_group_id;
  }

  if (typeof session.client_reference_id === "string") {
    return session.client_reference_id;
  }

  return null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getServerEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch (error) {
    console.error("[stripe.webhook] Signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!RECONCILIATION_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderGroupId = resolveOrderGroupId(session);

  if (!orderGroupId) {
    console.error("[stripe.webhook] Missing order group reference", {
      eventId: event.id,
      sessionId: session.id,
    });
    return NextResponse.json({ received: true });
  }

  const supabase = getSupabaseServiceRoleClient();
  const amountTotal = toMajorUnits(session.amount_total);
  const eventCreated =
    typeof event.created === "number" ? new Date(event.created * 1000).toISOString() : null;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const currency = session.currency ? session.currency.toUpperCase() : null;
  const eventMetadata = buildEventMetadata(session);

  try {
    const { data, error } = await supabase.rpc<ReconcileResult>("reconcile_order_group_payment", {
      p_order_group_id: orderGroupId,
      p_payment_intent: paymentIntent,
      p_webhook_event_id: event.id,
      p_webhook_created: eventCreated,
      p_amount_total: amountTotal,
      p_currency_code: currency,
      p_event_type: event.type,
      p_event_metadata: eventMetadata,
    });

    if (error) {
      console.error("[stripe.webhook] Reconciliation RPC failed", {
        orderGroupId,
        eventId: event.id,
        error,
      });
      return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
    }

    return NextResponse.json({
      received: true,
      orderGroupId,
      applied: data?.applied ?? null,
    });
  } catch (error) {
    console.error("[stripe.webhook] Unexpected reconciliation error", {
      orderGroupId,
      eventId: event.id,
      error,
    });

    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
