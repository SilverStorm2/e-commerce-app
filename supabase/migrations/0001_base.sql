-- M1-SUPABASE-BOOT
-- Bootstrap core tenancy schema, security helpers, and baseline policies.

begin;

-- Required extensions for search, text normalization, and UUID generation.
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- Namespaced helper schemas.
create schema if not exists app_public;
comment on schema app_public is 'Safe, RLS-aware views that can be granted to supabase_auth users.';

create schema if not exists app_hidden;
comment on schema app_hidden is 'Security-definer helpers and triggers (not directly exposed to clients).';

-- Enumerations for membership roles and lifecycle.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_role') then
    create type public.membership_role as enum ('owner', 'manager', 'staff', 'contractor');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type public.membership_status as enum ('active', 'invited', 'suspended');
  end if;
end
$$;

-- Tenants (stores) are the primary multi-tenant boundary.
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  default_locale text not null default 'pl',
  country_code text not null default 'PL',
  currency_code text not null default 'PLN',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_not_empty check (char_length(trim(slug)) > 0),
  constraint tenants_name_not_empty check (char_length(trim(name)) > 0),
  constraint tenants_default_locale check (default_locale in ('pl', 'en')),
  constraint tenants_country_code check (char_length(country_code) = 2),
  constraint tenants_currency_code check (currency_code = 'PLN')
);

create unique index if not exists tenants_slug_unique_idx on public.tenants (lower(slug));

-- Profiles extend auth.users with app-specific metadata.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  display_name text,
  handle text,
  default_locale text not null default 'pl',
  country_code text,
  time_zone text,
  avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_lowercase check (handle is null or handle = lower(handle)),
  constraint profiles_default_locale check (default_locale in ('pl', 'en'))
);

create unique index if not exists profiles_handle_unique_idx on public.profiles (handle) where handle is not null;

-- Memberships link users to tenants with scoped roles.
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'active',
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_unique_tenant_user unique (tenant_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_tenant_idx on public.memberships (tenant_id);

-- Explicit list of platform administrators (superset of tenant members).
create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  email text not null unique,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint platform_admins_email_lowercase check (email = lower(email))
);

create index if not exists platform_admins_user_idx on public.platform_admins (user_id);

-- Helper: capture the caller email from JWT claims (if available).
create or replace function app_hidden.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    nullif(auth.jwt() ->> 'email', '')
  );
$$;

-- Helper: determine if the current user is a platform admin.
create or replace function app_hidden.is_platform_admin(check_user_id uuid default auth.uid(), check_email text default app_hidden.current_user_email())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where (
      check_user_id is not null and pa.user_id = check_user_id
    ) or (
      check_email is not null and lower(pa.email) = lower(check_email)
    )
  );
$$;

-- Helper: check tenant membership for the current user with optional role/status gating.
create or replace function app_hidden.is_tenant_member(target_tenant_id uuid, allowed_roles public.membership_role[] default null, allowed_status public.membership_status[] default array['active']::public.membership_status[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when auth.uid() is null then false
      else exists (
        select 1
        from public.memberships m
        where m.tenant_id = target_tenant_id
          and m.user_id = auth.uid()
          and (
            allowed_status is null
            or array_length(allowed_status, 1) is null
            or m.status = any(allowed_status)
          )
          and (
            allowed_roles is null
            or array_length(allowed_roles, 1) is null
            or m.role = any(allowed_roles)
          )
      )
    end;
$$;

-- Trigger helpers for timestamps and authored metadata.
create or replace function app_hidden.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function app_hidden.set_tenant_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function app_hidden.ensure_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  insert into public.memberships (tenant_id, user_id, role, status)
  values (new.id, auth.uid(), 'owner', 'active')
  on conflict (tenant_id, user_id) do update
    set
      role = excluded.role,
      status = excluded.status,
      updated_at = now();

  return new;
end;
$$;

-- Attach triggers.
drop trigger if exists set_tenants_updated_at on public.tenants;
create trigger set_tenants_updated_at
before update on public.tenants
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists set_tenants_created_by on public.tenants;
create trigger set_tenants_created_by
before insert on public.tenants
for each row
execute function app_hidden.set_tenant_created_by();

drop trigger if exists ensure_tenant_owner_membership on public.tenants;
create trigger ensure_tenant_owner_membership
after insert on public.tenants
for each row
execute function app_hidden.ensure_owner_membership();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists set_memberships_updated_at on public.memberships;
create trigger set_memberships_updated_at
before update on public.memberships
for each row
execute function app_hidden.touch_updated_at();

-- Row level security: deny by default.
alter table public.tenants enable row level security;
alter table public.tenants force row level security;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.memberships enable row level security;
alter table public.memberships force row level security;

alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;

-- Tenants policies.
create policy tenants_select_members on public.tenants
for select
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(id)
);

create policy tenants_insert_self on public.tenants
for insert
with check (auth.uid() is not null);

create policy tenants_update_admins on public.tenants
for update
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(id, array['owner', 'manager']::public.membership_role[])
)
with check (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(id, array['owner', 'manager']::public.membership_role[])
);

create policy tenants_delete_owner on public.tenants
for delete
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(id, array['owner']::public.membership_role[])
);

-- Profiles policies.
create policy profiles_select_self on public.profiles
for select
using (auth.uid() = user_id or app_hidden.is_platform_admin());

create policy profiles_insert_self on public.profiles
for insert
with check (auth.uid() = user_id or app_hidden.is_platform_admin());

create policy profiles_update_self on public.profiles
for update
using (auth.uid() = user_id or app_hidden.is_platform_admin())
with check (auth.uid() = user_id or app_hidden.is_platform_admin());

-- Membership policies.
create policy memberships_select_scope on public.memberships
for select
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(tenant_id)
  or auth.uid() = user_id
);

create policy memberships_insert_new_owner on public.memberships
for insert
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and role = 'owner'::public.membership_role
  and status = 'active'::public.membership_status
  and exists (
    select 1
    from public.tenants t
    where t.id = memberships.tenant_id
      and coalesce(t.created_by, auth.uid()) = auth.uid()
  )
);

create policy memberships_manage_tenant_admins on public.memberships
for update
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(tenant_id, array['owner', 'manager']::public.membership_role[])
)
with check (
  app_hidden.is_platform_admin()
  or (
    app_hidden.is_tenant_member(tenant_id, array['owner', 'manager']::public.membership_role[])
    and (
      role <> 'owner'::public.membership_role
      or app_hidden.is_tenant_member(tenant_id, array['owner']::public.membership_role[])
    )
  )
);

create policy memberships_delete_tenant_admins on public.memberships
for delete
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(tenant_id, array['owner']::public.membership_role[])
);

-- Platform admin policies (self-managing).
create policy platform_admins_select on public.platform_admins
for select
using (
  app_hidden.is_platform_admin()
  or (
    auth.uid() is not null
    and user_id = auth.uid()
  ) or (
    app_hidden.current_user_email() is not null
    and lower(email) = lower(app_hidden.current_user_email())
  )
);

create policy platform_admins_mutate on public.platform_admins
for all
using (app_hidden.is_platform_admin())
with check (
  app_hidden.is_platform_admin()
  or (
    app_hidden.current_user_email() is not null
    and lower(email) = lower(app_hidden.current_user_email())
  )
);

-- Read-only helper views exposed to authenticated clients.
create or replace view app_public.my_memberships as
select
  m.id,
  m.tenant_id,
  t.slug,
  t.name,
  m.role,
  m.status,
  m.created_at,
  m.updated_at
from public.memberships m
join public.tenants t on t.id = m.tenant_id
where m.user_id = auth.uid();

comment on view app_public.my_memberships is 'Memberships for the current user, joined with tenant metadata.';

create or replace view app_public.my_active_tenants as
select
  t.id,
  t.slug,
  t.name,
  t.default_locale,
  t.country_code,
  t.currency_code,
  m.role,
  m.status,
  t.created_at,
  t.updated_at
from public.tenants t
join public.memberships m on m.tenant_id = t.id
where m.user_id = auth.uid()
  and m.status = 'active';

comment on view app_public.my_active_tenants is 'Active tenant memberships for the current user.';

-- Permissions for exposed schemas and helpers.
grant usage on schema app_public to authenticated, anon;
revoke all on schema app_hidden from public;

grant select on app_public.my_memberships to authenticated;
grant select on app_public.my_active_tenants to authenticated;

grant execute on function app_hidden.current_user_email() to authenticated, anon;
grant execute on function app_hidden.is_platform_admin(uuid, text) to authenticated, anon;
grant execute on function app_hidden.is_tenant_member(uuid, public.membership_role[], public.membership_status[]) to authenticated, anon;

-- Seed platform admin email for local environments (no-op if already present).
insert into public.platform_admins (email, note)
values ('admin@example.com', 'Seed admin account for local development. Replace before launch.')
on conflict (email) do nothing;

commit;
