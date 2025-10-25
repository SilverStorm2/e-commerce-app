# Contractor Directory (M2)

## Overview

The contractor directory exposes verified specialists to the public storefront in both Polish and English. Profiles are stored in Postgres (`public.contractor_profiles`) and surfaced via the Next.js App Router. Guests can browse and filter without authentication, while contractors manage their own profile data through RLS-guarded operations.

Key goals for this milestone:

- Store contractor profile metadata with a precomputed search vector.
- Allow anonymous browsing with search, skill, and service-area filters.
- Reuse the global search RPC so contractors appear beside product results.
- Provide a detail view and a “My Tasks” placeholder that will host collaboration tools in M3.

## Database

- **Table**: `public.contractor_profiles` (see `supabase/migrations/0004_contractors.sql`).
  - Core fields: `display_name`, `headline`, `short_bio`, `bio`, `skills[]`, `service_areas[]`, `languages[]`, `availability`, `hourly_rate`, visibility flags, contact channels, and `search_vector`.
  - Canonical enum-like values for skills and service areas are stored as text arrays to enable `contains` filters and GIN indexes.
- **Indexes**: GIN on `search_vector`, `skills`, `service_areas`, `languages`, plus visibility helpers.
- **Search vector**: `app_hidden.compute_contractor_search_vector` normalises text and array fields for weighted ranking.
- **RLS policies** (`supabase/policies/contractors.sql`):
  - `contractor_profiles_public_select` exposes visible rows to `anon` and `authenticated` roles.
  - Self-service policies limit insert/update/delete to the owning `user_id` or platform admins.

The shared `public.search_entities` RPC now includes contractor rows when the table exists, returning enriched payload data for downstream consumers.

## Frontend

- **Directory page**: `app/[locale]/contractors/page.tsx`
  - Server component fetches translation dictionaries, reads Supabase directly via `searchContractorProfiles`, and renders cards with filters.
  - Filters support keyword search (`textSearch` on the `search_vector`), skill tags, and service areas. Invalid query params are ignored by type guards in `lib/contractors/constants.ts`.
  - UI strings live under `contractors.*` in `locales/{pl,en}.json`, covering hero copy, filters, badges, cards, and error/empty states.
- **Detail page**: `app/[locale]/contractors/[id]/page.tsx`
  - Accepts either `slug` or raw UUID, resolves to visible profiles, and surfaces contact information, hourly rates, and biographies.
  - Uses shared label dictionaries to render skill and service-area chips.
- **My Tasks placeholder**: `app/[locale]/contractors/tasks/page.tsx` keeps the roadmap CTA discoverable until collaboration tooling ships.
- **Components**: `components/contractors/contractor-card.tsx` renders a lightweight contractor summary with localisation-aware badges and pricing.

## Tests

- `__tests__/contractors/search-visible.spec.ts` verifies that the search API returns contractor payloads when requested and preserves metadata in the response.

## Open Items / Next Steps

- Add authenticated CRUD flows for contractors to edit their profiles once dashboard work begins.
- Extend directory filters with pagination and language toggles if the roster grows beyond the current limit.
- Wire the “My Tasks” workspace to Playwright smoke tests when collaboration routing is implemented (M3).
