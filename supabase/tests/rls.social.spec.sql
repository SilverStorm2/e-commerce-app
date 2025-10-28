-- Validate RLS for posts, comments, reactions (read path) and follows.
begin;

create extension if not exists pgtap;

select plan(7);

-- Deterministic identifiers.
select
  set_config('app.owner_id', '00000000-0000-9000-a000-000000000001', true),
  set_config('app.staff_id', '00000000-0000-9000-a000-000000000002', true),
  set_config('app.commenter_id', '00000000-0000-9000-a000-000000000003', true),
  set_config('app.other_user_id', '00000000-0000-9000-a000-000000000004', true),
  set_config('app.platform_admin_id', '00000000-0000-9000-a000-0000000000aa', true),
  set_config('app.tenant_id', '10000000-0000-9000-a000-000000000010', true),
  set_config('app.post_published_id', '20000000-0000-9000-a000-000000000020', true),
  set_config('app.post_draft_id', '20000000-0000-9000-a000-000000000021', true);

-- Seed application users.
with upsert_users as (
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  values
    (current_setting('app.owner_id')::uuid, 'owner-social@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.staff_id')::uuid, 'staff-social@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.commenter_id')::uuid, 'commenter-social@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.other_user_id')::uuid, 'other-social@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.platform_admin_id')::uuid, 'admin-social@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now())
  on conflict (id) do update
    set email = excluded.email
  returning 1
)
select coalesce(sum(1), 0) from upsert_users;

-- Ensure platform admin linkage (used implicitly by some policies).
insert into public.platform_admins (email, user_id, note)
values ('admin-social@example.com', current_setting('app.platform_admin_id')::uuid, 'Social test admin')
on conflict (email) do update
  set user_id = excluded.user_id,
      note = excluded.note;

-- Owner provisions tenant (auto creates owner membership).
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.owner_id'), true);
select set_config('request.jwt.claim.email', 'owner-social@example.com', true);

insert into public.tenants (id, slug, name)
values (
  current_setting('app.tenant_id')::uuid,
  'social-test-store',
  'Social Test Store'
)
on conflict (id) do nothing;

reset role;

-- Grant staff membership (executed as privileged role).
insert into public.memberships (tenant_id, user_id, role, status)
values (
  current_setting('app.tenant_id')::uuid,
  current_setting('app.staff_id')::uuid,
  'staff'::public.membership_role,
  'active'::public.membership_status
)
on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      status = excluded.status,
      updated_at = now();

-- Owner creates published and draft posts.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.owner_id'), true);
select set_config('request.jwt.claim.email', 'owner-social@example.com', true);

insert into public.posts (id, tenant_id, author_user_id, title, content, status, published_at, is_pinned)
values
  (
    current_setting('app.post_published_id')::uuid,
    current_setting('app.tenant_id')::uuid,
    current_setting('app.owner_id')::uuid,
    'Public launch',
    'We are live!',
    'published'::public.post_status,
    now(),
    true
  ),
  (
    current_setting('app.post_draft_id')::uuid,
    current_setting('app.tenant_id')::uuid,
    current_setting('app.owner_id')::uuid,
    'Draft update',
    'Still in progress.',
    'draft'::public.post_status,
    null,
    false
  )
on conflict (id) do nothing;

reset role;

-- Anonymous users see only published posts.
set local role anon;
select results_eq(
  $$
    select count(*)::int
    from public.posts
  $$,
  $$ values (1) $$,
  'Public feed exposes only published posts'
);
reset role;

-- Commenter leaves a comment on the published post.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.commenter_id'), true);
select set_config('request.jwt.claim.email', 'commenter-social@example.com', true);

with new_comment as (
  insert into public.comments (post_id, author_user_id, body)
  values (
    current_setting('app.post_published_id')::uuid,
    current_setting('app.commenter_id')::uuid,
    'Świetna wiadomość!'
  )
  returning id
)
select set_config('app.comment_id', (select id::text from new_comment), true);

reset role;

-- Public can see the visible comment.
set local role anon;
select results_eq(
  $$
    select count(*)::int
    from public.comments
    where id = current_setting('app.comment_id')::uuid
  $$,
  $$ values (1) $$,
  'Public can read visible comments on published posts'
);
reset role;

-- Staff hides the comment for moderation.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.staff_id'), true);
select set_config('request.jwt.claim.email', 'staff-social@example.com', true);

select lives_ok(
  $$
    update public.comments
    set status = 'hidden'::public.comment_status
    where id = current_setting('app.comment_id')::uuid
  $$,
  'Staff member can hide a comment for moderation'
);

reset role;

-- Public no longer sees the hidden comment.
set local role anon;
select results_eq(
  $$
    select count(*)::int
    from public.comments
    where id = current_setting('app.comment_id')::uuid
  $$,
  $$ values (0) $$,
  'Hidden comments are not visible publicly'
);
reset role;

-- Staff still sees the moderated comment.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.staff_id'), true);
select set_config('request.jwt.claim.email', 'staff-social@example.com', true);

select results_eq(
  $$
    select count(*)::int
    from public.comments
    where id = current_setting('app.comment_id')::uuid
  $$,
  $$ values (1) $$,
  'Tenant staff can audit hidden comments'
);

reset role;

-- Commenter follows the store.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.commenter_id'), true);
select set_config('request.jwt.claim.email', 'commenter-social@example.com', true);

with new_follow as (
  insert into public.follows (tenant_id, follower_user_id)
  values (
    current_setting('app.tenant_id')::uuid,
    current_setting('app.commenter_id')::uuid
  )
  returning id
)
select set_config('app.follow_id', (select id::text from new_follow), true);

reset role;

-- Unrelated user cannot read follow record.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.other_user_id'), true);
select set_config('request.jwt.claim.email', 'other-social@example.com', true);

select results_eq(
  $$
    select count(*)::int
    from public.follows
    where id = current_setting('app.follow_id')::uuid
  $$,
  $$ values (0) $$,
  'Non-followers cannot read another user''s follow record'
);

reset role;

-- Staff can view follower list.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.staff_id'), true);
select set_config('request.jwt.claim.email', 'staff-social@example.com', true);

select results_eq(
  $$
    select count(*)::int
    from public.follows
    where id = current_setting('app.follow_id')::uuid
  $$,
  $$ values (1) $$,
  'Tenant staff can view store followers'
);

reset role;

select finish();

rollback;
