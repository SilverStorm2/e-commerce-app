-- M2-CONTRACTOR-DIR policy snapshot.
-- Policies applied in supabase/migrations/0004_contractors.sql.
-- This file documents the expected RLS state for contractor profiles.

-- contractor_profiles
--   contractor_profiles_public_select   -- Guests can read visible profiles (is_visible = true).
--   contractor_profiles_self_select     -- Owners or platform admins can read their own profile regardless of visibility.
--   contractor_profiles_self_insert     -- Only the owning user (or platform admin) can create their profile row.
--   contractor_profiles_self_update     -- Only the owning user (or platform admin) can update their profile.
--   contractor_profiles_self_delete     -- Only the owning user (or platform admin) can delete their profile.
