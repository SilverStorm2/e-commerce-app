# ADR-0002: Multi-Tenancy and RLS Bootstrap

## Status

Accepted - 2025-10-25

## Context

The marketplace must keep Supabase/Postgres as the single source of truth while enforcing strict tenant boundaries for stores, staff, contractors, and buyers. We also need a path for platform administrators to intervene (moderation, support) without weakening row-level security. The MVP scope already depends on tenant-aware operations (catalog, messaging, moderation) and assumes that new stores can be created self-serve without losing the ownership trail.

## Decision

1. **Tenants + memberships as the tenancy spine** - `public.tenants` carries store metadata and a `created_by` audit field. `public.memberships` ties `auth.users` to tenants with enumerated roles (`owner`, `manager`, `staff`, `contractor`) and lifecycle status (`active`, `invited`, `suspended`). An `AFTER INSERT` trigger auto-creates an owner membership for the user who creates a tenant, keeping RLS simple for first-run onboarding.
2. **Platform admin override table** - `public.platform_admins` records privileged users by email and UUID. Security-definer helpers (`app_hidden.is_platform_admin`, `app_hidden.current_user_email`) give policies a consistent check without exposing the table directly.
3. **Security helper schema** - `app_hidden` holds security-definer functions and triggers, `app_public` exposes read-only views (`my_memberships`, `my_active_tenants`). RLS policies call `app_hidden.is_tenant_member` to gate access by role/status, while views provide ergonomics for the frontend without leaking cross-tenant data.
4. **Extensions + audit conveniences** - `pgcrypto` backs UUID generation and password hashing in tests, while `pg_trgm` and `unaccent` are enabled early for later FTS work. Timestamp triggers (`touch_updated_at`) keep `updated_at` reliable for syncing.

## Consequences

- Tenancy-aware features can rely on the helper views/functions instead of duplicating RLS predicates on the client.
- Owner creation flow works with regular authenticated credentials; deeper membership management stays behind server routes or the service role.
- Platform administrators can inspect or repair tenants without bespoke bypass logic, satisfying compliance requirements.
- Further schema work (catalog, orders, messaging) can reuse `tenant_id` + `app_hidden.is_tenant_member` for consistent RLS checks.
