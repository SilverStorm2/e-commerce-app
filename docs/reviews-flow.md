# Reviews & Responses Flow

## Goals

- **Verified-first**: only buyers with a delivered/fulfilled order can submit a review. We keep a snapshot of the product name + slug and stamp `is_verified = true` when a matching `order_item` exists.
- **Moderated visibility**: reviews enter `pending` status; sellers (owner/manager/staff) moderate to `approved`/`rejected`. Public visitors only see approved rows.
- **Seller response**: one official reply per review, authored by seller staff. Responses inherit the same visibility rules as the parent review.

## Schema highlights

- `supabase/migrations/0011_reviews.sql` introduces:
  - `public.reviews` with unique `(product_id, reviewer_user_id)` constraint, moderation timestamps, verified flag, and tenant/product snapshots.
  - `public.review_responses` with `review_id` FK and tenant scope; one response per review.
  - Helper function `app_hidden.has_delivered_order_for_product` plus triggers that set tenant defaults and verification metadata.
  - RLS policies that:
    - limit inserts to delivered-order buyers,
    - expose pending reviews only to the author or seller staff,
    - restrict responses to tenant staff / platform admins.
- Policy reference lives in `supabase/policies/reviews.sql`.

## Lifecycle

1. **Buyer checkout** → once their order hits `delivered` (or fulfilled/shipped), `app_hidden.has_delivered_order_for_product` returns true.
2. **Submit review** (client hits `/api/reviews` in a future task): insert succeeds only if the user is the buyer and the helper finds a delivered `order_item`. Trigger copies product metadata, links the `order_item`, and sets `is_verified`.
3. **Moderation**:
   - Seller staff fetch pending reviews through RLS and update `status` to `approved`/`rejected`. Public queries continue seeing only `status = 'approved'`.
   - Platform admins maintain override powers via `app_hidden.is_platform_admin()`.
4. **Seller response**: once satisfied, staff can insert a single row in `review_responses`. Authors and staff can read it immediately; the public sees it whenever the review is approved.

## Testing & compliance

- `supabase/tests/rls.reviews.spec.sql` covers buyer posting, unique constraint enforcement, public/staff visibility, verified flag calculation, and seller responses.
- Acceptance checklist from `codex_tasks.yaml` is met:
  - unique index prevents duplicates,
  - verified badge derives directly from delivered `order_items`.

Future tasks (M5-MOD-QUEUE, profanity filters) can hook into the same tables or extend metadata / status fields without changing RLS foundations.
