-- M2-DB-CATALOG policy snapshot.
-- Policies applied in supabase/migrations/0002_catalog.sql.
-- This file documents the expected RLS state for catalog tables and is NOT executed automatically.

-- product_categories
--   product_categories_public_select      -- Public read for visible categories.
--   product_categories_member_select      -- Tenant members (owner/manager/staff/contractor) or platform admins can read.
--   product_categories_manage_members     -- Owner/manager/staff (or platform admin) can insert/update/delete.

-- products
--   products_public_select                -- Public read for published products (published_at gate).
--   products_member_select                -- Tenant members (owner/manager/staff/contractor) or platform admins can read drafts.
--   products_member_insert                -- Owner/manager/staff or platform admin can create products.
--   products_member_update                -- Owner/manager/staff or platform admin can update products.
--   products_member_delete                -- Owner/manager/staff or platform admin can delete products.

-- product_media
--   product_media_public_select           -- Public read for media belonging to published products.
--   product_media_member_select           -- Tenant members (owner/manager/staff/contractor) or platform admins can read any media.
--   product_media_member_manage           -- Owner/manager/staff or platform admin can manage media.

-- inventory_ledger
--   inventory_ledger_member_select        -- Owner/manager/staff or platform admin can audit stock movements.
--   inventory_ledger_member_insert        -- Owner/manager/staff or platform admin can record stock deltas.
