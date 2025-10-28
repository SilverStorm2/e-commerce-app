# Social Tables & RLS Summary

## Tables

- `posts` – store announcements. Tracks `tenant_id`, `author_user_id`, optional `slug`, `status` (`draft|published|archived`), and metadata.
- `comments` – user replies tied to a post (supports nesting via `parent_comment_id`) with `comment_status` (`visible|hidden|removed`).
- `reactions` – emoji-like feedback for posts or comments; one reaction per user per target/type.
- `follows` – relationship between a user and a tenant for updates/notifications.

## Business Rules

- Published posts are public; drafts/archived visible only to store teams (owner/manager/staff/contractor) and the original author.
- Any authenticated user may comment on a published post; store staff can respond even pre-publication.
- Store staff (owner/manager/staff) can hide or delete comments/reactions for moderation; authors may edit/delete their own content.
- Follows list is private: only the follower, store staff, or platform admins can view/update entries.

## RLS Overview

- Policies defined in `supabase/migrations/0008_social.sql` (documented in `supabase/policies/social.sql`).
- Helpers:
  - `app_hidden.ensure_comment_defaults()` copies the post tenant and validates parent comment/post relationship.
  - `app_hidden.ensure_reaction_defaults()` enforces exactly one target and inherits tenant context.
- Access highlights:
  - `posts_select_public` allows anonymous/public read when `status = 'published'`.
  - `comments_insert_authenticated` requires `auth.uid()` to match `author_user_id` and ensures post visibility.
  - `comments_update_moderation` / `comments_delete_allowed` grant moderation to store staff + platform admins.
  - `follows_*` policies restrict read/write to follower and staff roles; platform admin retains oversight.

## Testing

- `supabase/tests/rls.social.spec.sql` covers:
  1. Public visibility for published posts.
  2. Authenticated commenting.
  3. Staff moderation (hiding comments).
  4. Follow privacy (non-followers blocked; staff permitted).
- Tests use deterministic IDs and pgTAP assertions, matching existing RLS suites.
