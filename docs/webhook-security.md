# Stripe Webhook Security & Reconciliation

## Overview

- Webhook endpoint lives at `app/api/stripe/webhook/route.ts`.
- Requests must include the `Stripe-Signature` header; bodies are read raw to avoid JSON tampering before verification.
- Signature verification uses `stripe.webhooks.constructEvent` with the shared secret `STRIPE_WEBHOOK_SECRET`.
- Only `checkout.session.completed` and `checkout.session.async_payment_succeeded` events trigger reconciliation.

## Secrets & Runtime

- Required server-side env vars:
  - `STRIPE_SECRET_KEY` - used by the reusable Stripe SDK client.
  - `STRIPE_WEBHOOK_SECRET` - signature verification.
  - `SUPABASE_SERVICE_ROLE_KEY` - privileged Postgres access for reconciliation.
- Route executes on the Node.js runtime to keep access to raw request bodies and Node crypto primitives.

## Reconciliation Flow

- Extract `order_group_id` from session metadata or `client_reference_id`.
- Normalize amounts (convert Stripe minor units to major) and capture payment intent, currency, and minimal session metadata.
- Call the security-definer function `public.reconcile_order_group_payment` via the Supabase service role client:
  - Locks the `order_groups` row, verifies currency/amount parity, and marks the group + child orders as `paid`.
  - Commits inventory deltas via `inventory_ledger` with `order_commit` entries, guarded against duplicates.
  - Stores webhook event metadata (`stripe_webhook_event_id`, timestamps, payment intent) for idempotency.
- The function is idempotent: replayed events with the same Stripe event ID short-circuit without mutating data.

## Failure Behaviour

- Missing/invalid signatures return `400` without touching the database.
- Reconciliation errors return `500`, prompting Stripe to retry; the logs include order group and event IDs.
- Unknown event types return `200` immediately to avoid unnecessary retries.

## Audit & RLS Guarantees

- All mutations happen inside Postgres with a security-definer function, preserving RLS boundaries for regular clients.
- Inventory adjustments reference `order_items` to maintain the ledger trail required for stock audits.
