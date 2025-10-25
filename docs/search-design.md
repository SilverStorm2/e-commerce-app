# Search & Filtering Design

## Goals

- Deliver unified product and contractor discovery with PL/EN friendly full-text search.
- Normalise queries and content with `unaccent` so diacritics do not block matches.
- Provide weighted ranking that favours titles/headlines while still incorporating metadata and fuzzy matches.
- Expose a server RPC that Next.js route handlers can call without bypassing RLS.

## Data preparation

- Products already carry a `search_vector` column; we now compute it with `app_hidden.compute_product_search_vector`, pulling from `name`, `*_i18n`, descriptions, SKU, barcode, and a lightweight tag string from `metadata->>'tags'`. Weighted tiers are `A` for titles, `B` for summaries, `C` for long-form copy/tags, `D` for identifiers.
- Contractors will live in `public.contractor_profiles`. The helper `app_hidden.ensure_contractor_search_support()` adds `search_vector`, installs triggers/indexes, and backfills data once the table exists. Until the dedicated migration ships, the helper exits quietly; tests create a temporary table to exercise the behaviour.
- Utility functions in `app_hidden` (`normalize_search_text`, `jsonb_array_to_text`, `concat_jsonb_text`) keep sanitisation logic single sourced.

## Indexing

- Products use `products_search_vector_idx` (GIN on `search_vector`) and `products_name_trgm_idx` (GIN with `gin_trgm_ops` on `unaccent(name)`) to cover FTS and fuzzy fallback.
- Contractors mirror this via helper-created indexes: `contractor_profiles_search_vector_idx`, `contractor_profiles_name_trgm_idx`, and `contractor_profiles_slug_trgm_idx`.
- The helper can be rerun safely (idempotent DDL). Downstream migrations should call `select app_hidden.ensure_contractor_search_support();` after creating/updating `contractor_profiles`.

## Search RPC

- `public.search_entities(search_term, locale, include_products, include_contractors, limit_count)` returns ranked rows with a `payload` blob per entity. It runs as `SECURITY DEFINER`, but strictly filters to published products and visible contractor profiles.
- Queries are normalised through `unaccent + lower + whitespace squeeze`, converted to `websearch_to_tsquery('simple', …)`, and paired with trigram `similarity` for fuzzy tolerance.
- Dynamic SQL only includes contractor UNION blocks when `contractor_profiles` exists, so migrations can safely run before that table appears.

## API surface

- `app/api/search/route.ts` exposes a GET endpoint accepting:
  - `q` (required) search term.
  - `locale` (`pl` default, `en` fallback).
  - `limit` (1–50, clamped; default 20).
  - `type=product|contractor` filters (multi-valued).
- Responses include query metadata and a normalised `results` array with `type`, `id`, `tenantId`, `slug`, `title`, `subtitle`, `rank`, and passthrough `payload`.
- Errors propagate as HTTP 400 (missing query) or 500 (RPC failure) without leaking internal messages.

## Testing

- `supabase/tests/search.ranking.spec.sql` seeds representative Polish content, ensures search vectors populate, and asserts ranking for unaccented queries plus combined results.
- `__tests__/search/api.spec.ts` mocks Supabase, checking RPC parameters, limit/type handling, JSON mapping, and error paths.

## Follow-ups

- When `public.contractor_profiles` is finalised, ensure the migration ends with `select app_hidden.ensure_contractor_search_support();`.
- Future work may add additional filters (tenant/category facets) and expose snippets; the RPC design leaves space for JSON payload expansion.
