# Order Splitting & Aggregation

This MVP supports multi-seller checkout by creating a parent `order_group` per payment attempt and child `orders` for each participating tenant (seller). The schema introduced in migration `0006_orders.sql` is the single source of truth for post-checkout state and is designed to satisfy the non-negotiable requirement of splitting a cart across multiple sellers while maintaining consistent totals and RLS boundaries.

## Entities

- **order_groups** – one row per checkout/payment. Captures buyer identity, snapshot addresses, cart metadata, and aggregate monetary fields. A group owns the cross-seller lifecycle (`pending → paid → cancelled/refunded`) and tracks how many sellers (`seller_count`) and items (`items_count`) are included.
- **orders** – one row per seller/tenant per `order_group`. Stores seller/buyer notes, shipping & billing payloads, monetary subtotals, and per-seller status (`pending`, `awaiting_payment`, `paid`, `fulfilled`, `shipped`, `delivered`, `cancelled`, `refunded`).
- **order_items** – immutable snapshot of the purchased products for a single seller order. The trigger `app_hidden.prepare_order_item` copies product name/slug/SKU, enforces tenant alignment, and derives `subtotal_amount`, `tax_amount`, and `total_amount` (using the product VAT rate, defaulting to 0).

## Totals & Triggers

- `app_hidden.refresh_order_totals` recalculates per-order `items_subtotal_amount`, `items_tax_amount`, and `items_count` whenever line items change.
- `app_hidden.compute_order_total` runs on every insert/update of `orders`, guaranteeing `total_amount = round(items_subtotal + items_tax + shipping - discount, 2)` and preventing negative totals.
- `app_hidden.refresh_order_group_totals` aggregates seller orders to keep `order_groups` in sync (items, shipping, discounts, seller count, and rounded total).
- Shipping defaults to `0` but can be updated by seller staff later; the compute/refresh triggers ensure group totals stay consistent after such updates.

## RLS Model

- `order_groups`: buyer (`auth.uid() = buyer_user_id`) or platform admins can read/mutate; everyone else denied.
- `orders`: accessible to the buyer, platform admins, and tenant members with roles `owner|manager|staff` (plus `contractor` for read access). Mutations require buyer or staff-level membership.
- `order_items`: inherit access through the parent order. Buyers and allowed tenant members can read, staff can mutate, and platform admins retain full access for support.

The RLS design ensures:

1. Buyers always see the full order history for their purchases.
2. Sellers (and their support contractors) only see data scoped to their tenant.
3. Platform admins retain oversight for compliance, refunds, and dispute handling.

## Downstream Expectations

- Checkout/session creation (M3-CHECKOUT-STRIPE) will create an `order_group`, vendor `orders`, and per-item rows before redirecting to Stripe.
- Stripe webhooks (M3-WEBHOOKS-STRIPE) will use the stored totals to mark `order_group` + `orders` as `paid` and adjust inventory.
- Shipping enhancements (M3-SHIPPING) will reuse `orders.shipping_amount` and extend the table with tracking data without touching `order_group` aggregates.

This schema keeps Supabase/Postgres as SSOT, aligns with RLS-first principles, and enables deterministic Playwright & SQL tests around multi-seller checkout flows.
