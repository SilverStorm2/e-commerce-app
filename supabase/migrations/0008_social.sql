-- M4-DB-SOCIAL
-- Social graph: posts, comments, reactions, follows with RLS enforcement.

begin;

-- Enumerations for social entities.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type public.post_status as enum ('draft', 'published', 'archived');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'comment_status') then
    create type public.comment_status as enum ('visible', 'hidden', 'removed');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reaction_type') then
    create type public.reaction_type as enum ('like', 'love', 'insightful', 'support', 'celebrate');
  end if;
end
$$;

-- Tenant-authored posts (store updates, announcements).
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete restrict,
  title text,
  slug text,
  excerpt text,
  content text not null check (char_length(content) <= 20000),
  status public.post_status not null default 'draft',
  is_pinned boolean not null default false,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_slug_unique_per_tenant unique (tenant_id, slug)
);

create index if not exists posts_tenant_status_idx on public.posts (tenant_id, status);
create index if not exists posts_published_at_idx on public.posts (status, published_at desc);

-- Comments on posts (top-level or replies).
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete restrict,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) <= 8000),
  status public.comment_status not null default 'visible',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_edited_at timestamptz
);

create index if not exists comments_post_idx on public.comments (post_id);
create index if not exists comments_tenant_idx on public.comments (tenant_id);
create index if not exists comments_parent_idx on public.comments (parent_comment_id);

-- Reactions for posts and comments (per user).
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reaction reaction_type not null default 'like',
  created_at timestamptz not null default now(),
  constraint reactions_target_check check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

create index if not exists reactions_post_idx on public.reactions (post_id);
create index if not exists reactions_comment_idx on public.reactions (comment_id);
create index if not exists reactions_user_idx on public.reactions (user_id);
create unique index if not exists reactions_unique_post on public.reactions (post_id, user_id, reaction) where post_id is not null;
create unique index if not exists reactions_unique_comment on public.reactions (comment_id, user_id, reaction) where comment_id is not null;

-- Followers of stores (tenants).
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  follower_user_id uuid not null references auth.users (id) on delete cascade,
  is_notifications_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, follower_user_id)
);

create index if not exists follows_follower_idx on public.follows (follower_user_id);

-- Ensure comments inherit tenant context and parent linkage stays within the same post.
create or replace function app_hidden.ensure_comment_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_record public.posts%rowtype;
begin
  if tg_op = 'UPDATE' and new.post_id <> old.post_id then
    raise exception 'post_id cannot change for existing comments';
  end if;

  select *
    into post_record
  from public.posts
  where id = new.post_id;

  if post_record is null then
    raise exception 'Post % not found for comment', new.post_id;
  end if;

  if new.tenant_id is null then
    new.tenant_id := post_record.tenant_id;
  elsif new.tenant_id <> post_record.tenant_id then
    raise exception 'Comment tenant mismatch for post %', new.post_id;
  end if;

  if new.parent_comment_id is not null then
    perform 1
    from public.comments c
    where c.id = new.parent_comment_id
      and c.post_id = new.post_id;

    if not found then
      raise exception 'Parent comment % does not belong to post %', new.parent_comment_id, new.post_id;
    end if;
  end if;

  return new;
end;
$$;

-- Ensure reactions derive tenant context and only target published/visible entities.
create or replace function app_hidden.ensure_reaction_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant uuid;
begin
  if tg_op = 'UPDATE' then
    if new.post_id <> coalesce(old.post_id, new.post_id) or new.comment_id <> coalesce(old.comment_id, new.comment_id) then
      raise exception 'Target cannot change for an existing reaction';
    end if;
  end if;

  if new.post_id is not null then
    select tenant_id
      into target_tenant
    from public.posts
    where id = new.post_id;

    if target_tenant is null then
      raise exception 'Post % not found for reaction', new.post_id;
    end if;

    if new.comment_id is not null then
      raise exception 'Reaction cannot target both post and comment';
    end if;

    new.tenant_id := target_tenant;

  elsif new.comment_id is not null then
    select c.tenant_id
      into target_tenant
    from public.comments c
    where c.id = new.comment_id;

    if target_tenant is null then
      raise exception 'Comment % not found for reaction', new.comment_id;
    end if;

    if new.post_id is not null then
      raise exception 'Reaction cannot target both post and comment';
    end if;

    new.tenant_id := target_tenant;

  else
    raise exception 'Reaction must target a post or comment';
  end if;

  return new;
end;
$$;

-- Attach triggers for defaults and timestamps.
drop trigger if exists ensure_comment_defaults_before_write on public.comments;
create trigger ensure_comment_defaults_before_write
before insert or update on public.comments
for each row
execute function app_hidden.ensure_comment_defaults();

drop trigger if exists ensure_reaction_defaults_before_write on public.reactions;
create trigger ensure_reaction_defaults_before_write
before insert or update on public.reactions
for each row
execute function app_hidden.ensure_reaction_defaults();

drop trigger if exists touch_posts_updated_at on public.posts;
create trigger touch_posts_updated_at
before update on public.posts
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists touch_comments_updated_at on public.comments;
create trigger touch_comments_updated_at
before update on public.comments
for each row
execute function app_hidden.touch_updated_at();

-- Enable RLS.
alter table public.posts enable row level security;
alter table public.posts force row level security;

alter table public.comments enable row level security;
alter table public.comments force row level security;

alter table public.reactions enable row level security;
alter table public.reactions force row level security;

alter table public.follows enable row level security;
alter table public.follows force row level security;

-- Posts policies.
create policy posts_select_public on public.posts
for select
using (
  status = 'published'
  or auth.uid() = author_user_id
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
  )
  or app_hidden.is_platform_admin()
);

create policy posts_insert_authorized on public.posts
for insert
with check (
  app_hidden.is_platform_admin()
  or (
    auth.uid() = author_user_id
    and app_hidden.is_tenant_member(
      tenant_id,
      array['owner', 'manager', 'staff']::public.membership_role[]
    )
  )
);

create policy posts_update_authorized on public.posts
for update
using (
  app_hidden.is_platform_admin()
  or auth.uid() = author_user_id
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
)
with check (
  app_hidden.is_platform_admin()
  or auth.uid() = author_user_id
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy posts_delete_authorized on public.posts
for delete
using (
  app_hidden.is_platform_admin()
  or auth.uid() = author_user_id
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager']::public.membership_role[]
  )
);

-- Comments policies.
create policy comments_select_public on public.comments
for select
using (
  status = 'visible'
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.status = 'published'
  )
  or auth.uid() = author_user_id
  or app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and app_hidden.is_tenant_member(
        p.tenant_id,
        array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
      )
  )
);

create policy comments_insert_authenticated on public.comments
for insert
with check (
  auth.uid() = author_user_id
  and exists (
    select 1
    from public.posts p
    where p.id = post_id
      and (
        p.status = 'published'
        or app_hidden.is_tenant_member(
          p.tenant_id,
          array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
        )
        or app_hidden.is_platform_admin()
      )
  )
);

create policy comments_update_moderation on public.comments
for update
using (
  auth.uid() = author_user_id
  or app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and app_hidden.is_tenant_member(
        p.tenant_id,
        array['owner', 'manager', 'staff']::public.membership_role[]
      )
  )
)
with check (
  auth.uid() = author_user_id
  or app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and app_hidden.is_tenant_member(
        p.tenant_id,
        array['owner', 'manager', 'staff']::public.membership_role[]
      )
  )
);

create policy comments_delete_allowed on public.comments
for delete
using (
  auth.uid() = author_user_id
  or app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and app_hidden.is_tenant_member(
        p.tenant_id,
        array['owner', 'manager', 'staff']::public.membership_role[]
      )
  )
);

-- Reactions policies.
create policy reactions_select_public on public.reactions
for select
using (
  exists (
    select 1
    from public.posts p
    where p.id = reactions.post_id
      and p.status = 'published'
  )
  or exists (
    select 1
    from public.comments c
    join public.posts p on p.id = c.post_id
    where c.id = reactions.comment_id
      and (
        c.status = 'visible' and p.status = 'published'
        or app_hidden.is_tenant_member(
          p.tenant_id,
          array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
        )
      )
  )
  or auth.uid() = user_id
  or app_hidden.is_platform_admin()
);

create policy reactions_insert_authenticated on public.reactions
for insert
with check (
  auth.uid() = user_id
  and (
    (
      post_id is not null
      and exists (
        select 1
        from public.posts p
        where p.id = post_id
          and (
            p.status = 'published'
            or app_hidden.is_tenant_member(
              p.tenant_id,
              array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
            )
            or app_hidden.is_platform_admin()
          )
      )
    )
    or (
      comment_id is not null
      and exists (
        select 1
        from public.comments c
        join public.posts p on p.id = c.post_id
        where c.id = comment_id
          and (
            (c.status = 'visible' and p.status = 'published')
            or app_hidden.is_tenant_member(
              p.tenant_id,
              array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
            )
            or app_hidden.is_platform_admin()
          )
      )
    )
  )
);

create policy reactions_delete_allowed on public.reactions
for delete
using (
  auth.uid() = user_id
  or app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.posts p
    where p.id = reactions.post_id
      and app_hidden.is_tenant_member(
        p.tenant_id,
        array['owner', 'manager', 'staff']::public.membership_role[]
      )
  )
  or exists (
    select 1
    from public.comments c
    join public.posts p on p.id = c.post_id
    where c.id = reactions.comment_id
      and app_hidden.is_tenant_member(
        p.tenant_id,
        array['owner', 'manager', 'staff']::public.membership_role[]
      )
  )
);

-- Follows policies.
create policy follows_select_allowed on public.follows
for select
using (
  auth.uid() = follower_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy follows_insert_allowed on public.follows
for insert
with check (
  auth.uid() = follower_user_id
  or app_hidden.is_platform_admin()
);

create policy follows_update_allowed on public.follows
for update
using (
  auth.uid() = follower_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
)
with check (
  auth.uid() = follower_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy follows_delete_allowed on public.follows
for delete
using (
  auth.uid() = follower_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

commit;
