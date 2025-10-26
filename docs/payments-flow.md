# Stripe Checkout Session Flow

This document outlines how the `/api/checkout/session` handler prepares multi-seller orders, creates a Stripe Checkout session, and stores the necessary metadata for webhook reconciliation.

## Sequence Overview

1. **Authenticate & load context**
   - Require an authenticated Supabase session (SSR cookies).
   - Fetch the buyer profile to prefill name / locale fallbacks.
2. **Snapshot the cart**
   - Read the latest cart rows and associated product snapshots (tenant, name, VAT rate).
   - Normalise quantities and pricing, derive net/tax/gross totals for each item.
   - Reject stale carts (missing items, mismatched currency, unsupported PLN currency).
3. **Materialise SSOT orders**
   - Create a parent `order_group` row with the buyer, addresses, cart snapshot, and aggregate totals.
   - Insert one child `orders` row per tenant, preserving seller-specific totals and cart item ids.
   - Insert immutable `order_items` rows (unit net price, VAT, snapshot metadata) to trigger RLS-safe totals.
4. **Create Stripe Checkout session**
   - Build line items per product with gross unit pricing (net + VAT).
   - Pass metadata (`order_group_id`, seller/item counts, PLN currency) and set success/cancel URLs pointing to `/[locale]/checkout/*`.
   - Persist the Stripe session id and payment intent reference back onto the `order_group` metadata.
5. **Transition to awaiting payment**
   - Update `order_group` + all `orders` statuses to `awaiting_payment`.
   - The Stripe webhook (`M3-WEBHOOKS-STRIPE`) will promote them to `paid` once the session completes.

## Error Handling

- Fail fast with `400` for invalid or empty carts to avoid orphaned order groups.
- If inserting orders/items fails, the handler marks the parent/group as `cancelled` and stops before creating a Checkout session.
- Stripe creation errors bubble up as `502`, and affected orders are cancelled while preserving the cart for re-attempt.

## Metadata Highlights

- `order_groups.metadata` stores `locale`, seller/item counts, Stripe session id/url, and payment intent references.
- `order_groups.cart_snapshot` captures the cart state (items, quantities, unit pricing) for auditing/webhook reconciliation.
- `order_items.metadata` links back to the original `cart_item_id` and embeds the cart metadata for audit trails.

## Buyer Experience

- Success and cancel redirects resolve to `/[locale]/checkout/success|cancel`, translated in PL/EN with order reference echoes.
- The front-end receives `{ sessionId, url, orderGroupId }` and should redirect the shopper to the hosted Stripe Checkout.

## Manual Follow-ups

- Refunds remain manual in MVP—operators can use the stored Stripe references.
- Inventory adjustments and paid status transitions are handled by the upcoming Stripe webhook task (`M3-WEBHOOKS-STRIPE`).
