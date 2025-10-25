# Catalog Schema (M2-DB-CATALOG)

## Overview

The catalog module introduces tenant-scoped products with optional categories, media galleries, and an append-only inventory ledger. Each table is protected by row-level security aligned to marketplace requirements: published products are globally readable, while draft management and stock records remain restricted to store teams (owner/manager/staff) or platform admins.

Supabase migration: `supabase/migrations/0002_catalog.sql`  
Primary entities: `product_categories`, `products`, `product_media`, `inventory_ledger`

## Tables

### `product_categories`

- `tenant_id` foreign key (`tenants.id`) with cascading deletes.
- Slug/name stored as PL-first text plus `name_i18n`/`description_i18n` JSON for translations.
- `is_visible` toggles public exposure; `sort_order` drives storefront ordering.
- Unique constraints: `(id, tenant_id)` and `(tenant_id, lower(slug))`.

### `products`

- Tenant-bound product rows with optional `category_id` (enforced to same tenant).
- Pricing captured via `price_amount NUMERIC(12,2)` and hard-coded `currency_code = 'PLN'`.
- Inventory fields: `stock_quantity`, `safety_stock`; an external ledger records adjustments.
- Publication lifecycle: `status ENUM('draft','active','archived')`, `is_published`, `published_at`.
- Search prep: `search_vector TSVECTOR` placeholder for future PL/EN FTS indexing.
- Unique constraints: `(tenant_id, lower(slug))`, `(id, tenant_id)` for composite references.

### `product_media`

- References a product (cascade on delete) with Supabase Storage path metadata.
- Flags: `is_primary`, ordered via `position`; optional dimensions and MIME details.
- Partial unique index ensures a single primary asset per product.

### `inventory_ledger`

- Append-only stock adjustments linked to `(product_id, tenant_id)` composite FK.
- `quantity_delta` must be non-zero; `event_type ENUM` captures reason codes.
- Optional `reference_type`/`reference_id` fields allow linkage to orders or tasks.

## Row-Level Security (RLS)

- **Public read**:
  - `product_categories_public_select` exposes rows where `is_visible = true`.
  - `products_public_select` and `product_media_public_select` allow access once `is_published` is true and `published_at` is not in the future.
- **Tenant members / admins**:
  - `owner|manager|staff` manage products, categories, media, and ledger entries.
  - `contractor` members receive read-only access to product metadata/media.
  - `inventory_ledger` is restricted to `owner|manager|staff` plus platform admins; no public access.
- **Deny by default**: tables rely on Supabase RLS with insert/update/delete blocked unless policies match.

## Indices & FTS Planning

- Tenant-aware indexes on slugs, status, and publication flags support storefront queries.
- `search_vector` remains empty placeholder; later tasks will populate/update and attach GIN indexes (per `M2-SEARCH-FTS`).

## Testing

- PGTap spec `supabase/tests/rls.products.spec.sql` covers:
  - Draft visibility blocked for non-members.
  - Staff update permissions.
  - Anonymous access gated by publication status.
  - Inventory ledger remains private to store teams.

## Notes & Follow-ups

- Trigger hooks for `updated_at` reuse existing helpers (`app_hidden.touch_updated_at`) can be added when write traffic increases.
- Future migrations should populate `search_vector` and add translation helpers for consistent PL/EN search weighting.
