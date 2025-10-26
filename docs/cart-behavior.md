# Cart Behaviour & Merge Flow

## Schema Highlights

- `public.carts` keeps a single active cart per authenticated user (`user_id` unique, default currency PLN).
- `public.cart_items` stores product selections with quantity and price snapshot; triggers fill `tenant_id`, `unit_price`, and bump parent `updated_at`.
- Composite FK `(product_id, tenant_id)` guarantees multi-seller integrity; each cart item row tracks currency and arbitrary metadata (`jsonb`).
- RLS is deny-by-default. Access granted to the cart owner or platform admin; cart items inherit access via parent cart lookup.

## RLS & Security Notes

- Owner policies cover `select/insert/update/delete`, mirroring `auth.uid = user_id`.
- Platform admins retain read/write coverage for support flows (`app_hidden.is_platform_admin()`).
- Item policies execute sub-select on carts, preventing cross-user leakage while keeping queries index-friendly (`cart_id` indexed).
- Triggers:
  - `app_hidden.ensure_cart_item_defaults` copies `tenant_id`, `currency_code`, `unit_price` from `products`.
  - `app_hidden.bump_cart_updated_at` keeps parent `updated_at` fresh on item mutations.
  - Standard `touch_updated_at` handles per-row timestamps.

## Guest Cart Merge Helper (`lib/cart/merge.ts`)

- Normalises guest line items, clamps quantity (`maxQuantity` default 99), aggregates by `productId`.
- Ensures/creates server cart via Supabase (`carts` upsert) scoped to supplied `userId`.
- Reads existing `cart_items`, merges quantities, preserves metadata unless guest override provided.
- Uses single `upsert` (`onConflict: cart_id,product_id`) to add/update rows; relies on DB triggers for tenant + price defaults.
- Returns `{ cartId, merged, skipped }` so callers can clear local storage or handle leftovers.
- Skips invalid guest entries (missing product, non-positive quantity); collects them for caller awareness.

## Edge Cases & Limits

- Quantity is clamped to `maxQuantity` (default 99) per product after combining existing + guest counts.
- If Supabase returns an error during load/upsert, helper throws with descriptive message for upstream handling.
- Currency is fixed to PLN; future multi-currency support requires dedicated field strategy.
- Metadata merge prefers guest payload when provided; otherwise retains stored metadata.

## Testing

- SQL: `supabase/tests/rls.cart.spec.sql` covers owner access, default snapshots, and cross-user denial.
- Vitest: `__tests__/cart/merge.spec.ts` exercises merge aggregation, skip logic, and error propagation.
