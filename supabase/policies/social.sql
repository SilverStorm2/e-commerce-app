-- M4-DB-SOCIAL policy snapshot.
-- Policies applied in supabase/migrations/0008_social.sql.
-- This file documents the expected RLS configuration for social tables (reference only).

-- posts
--   posts_select_public       -- Public read of published posts; authors, staff, and platform admins see drafts.
--   posts_insert_authorized   -- Store owner/manager/staff (or platform admin) may publish posts.
--   posts_update_authorized   -- Authors or store staff (and platform admins) can edit posts.
--   posts_delete_authorized   -- Authors, store owner/manager, or platform admins can delete posts.

-- comments
--   comments_select_public    -- Public read for visible comments on published posts; staff/admins see all.
--   comments_insert_authenticated -- Authenticated users may comment on published posts; staff can comment on drafts.
--   comments_update_moderation -- Authors or staff/admins may edit/hide comments.
--   comments_delete_allowed   -- Comment authors or store staff/admins can remove comments.

-- reactions
--   reactions_select_public   -- Public read for reactions on published/visible content; staff/admins see all.
--   reactions_insert_authenticated -- Authenticated users add reactions to accessible posts/comments.
--   reactions_delete_allowed  -- Reaction owners or store staff/admins may remove reactions.

-- follows
--   follows_select_allowed    -- Followers and store owner/manager/staff (plus admins) can view follow records.
--   follows_insert_allowed    -- Authenticated user creates follow records (or platform admin).
--   follows_update_allowed    -- Followers or store staff/admins can adjust notification preferences.
--   follows_delete_allowed    -- Followers or store staff/admins can remove follow relationships.
