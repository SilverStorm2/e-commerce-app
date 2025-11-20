-- M5-DB-REVIEWS
-- Product reviews with verified-purchase flag and seller response support.

begin;

-- Enumerations for review lifecycle.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('pending', 'approved', 'rejected');
  end if;
end
$$;

-- Helper: determine if a user has a delivered/fulfilled order for a product.
create or replace function app_hidden.has_delivered_order_for_product(
  check_product_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = check_product_id
      and o.buyer_user_id = coalesce(check_user_id, auth.uid())
      and o.status in ('fulfilled', 'shipped', 'delivered')
  );
$$;

-- Reviews table with verified-purchase flag and moderation fields.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete set null,
  reviewer_user_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null check (char_length(body) > 0 and char_length(body) <= 4000),
  product_name text not null,
  product_slug text,
  status public.review_status not null default 'pending',
  is_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  moderated_at timestamptz,
  moderated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_unique_product_reviewer unique (product_id, reviewer_user_id)
);

create index if not exists reviews_product_status_idx on public.reviews (product_id, status);
create index if not exists reviews_tenant_status_idx on public.reviews (tenant_id, status);
create index if not exists reviews_public_idx on public.reviews (product_id) where status = 'approved';

alter table public.reviews enable row level security;

-- Seller responses (one per review).
create table if not exists public.review_responses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  responder_user_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_responses_unique unique (review_id)
);

alter table public.review_responses enable row level security;

-- Ensure tenant/product snapshot defaults and verified flag.
create or replace function app_hidden.ensure_review_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  matched_order_item_id uuid;
begin
  select *
    into product_row
  from public.products
  where id = new.product_id;

  if product_row is null then
    raise exception 'Product % not found for review', new.product_id;
  end if;

  new.tenant_id := product_row.tenant_id;

  if new.product_name is null then
    new.product_name := product_row.name;
  end if;

  if new.product_slug is null then
    new.product_slug := product_row.slug;
  end if;

  select oi.id
    into matched_order_item_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.product_id = new.product_id
    and o.buyer_user_id = new.reviewer_user_id
    and o.status in ('fulfilled', 'shipped', 'delivered')
  order by coalesce(o.updated_at, o.created_at) desc
  limit 1;

  new.order_item_id := matched_order_item_id;
  new.is_verified := matched_order_item_id is not null;

  if new.status is null then
    new.status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_review_defaults on public.reviews;
create trigger ensure_review_defaults
before insert or update on public.reviews
for each row
execute function app_hidden.ensure_review_defaults();

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
before update on public.reviews
for each row
execute function app_hidden.touch_updated_at();

-- Ensure review responses inherit tenant scope so seller replies stay within RLS boundaries.
create or replace function app_hidden.ensure_review_response_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_row public.reviews%rowtype;
begin
  select *
    into review_row
  from public.reviews
  where id = new.review_id;

  if review_row is null then
    raise exception 'Review % not found for response', new.review_id;
  end if;

  new.tenant_id := review_row.tenant_id;
  return new;
end;
$$;

drop trigger if exists ensure_review_response_defaults on public.review_responses;
create trigger ensure_review_response_defaults
before insert or update on public.review_responses
for each row
execute function app_hidden.ensure_review_response_defaults();

drop trigger if exists set_review_responses_updated_at on public.review_responses;
create trigger set_review_responses_updated_at
before update on public.review_responses
for each row
execute function app_hidden.touch_updated_at();

-- RLS policies for reviews.
create policy reviews_public_select on public.reviews
for select
using (
  status = 'approved'
  or reviewer_user_id = auth.uid()
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy reviews_insert_allowed on public.reviews
for insert
with check (
  auth.uid() = reviewer_user_id
  and app_hidden.has_delivered_order_for_product(product_id, auth.uid())
);

create policy reviews_update_allowed on public.reviews
for update
using (
  auth.uid() = reviewer_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
)
with check (
  auth.uid() = reviewer_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy reviews_delete_allowed on public.reviews
for delete
using (
  auth.uid() = reviewer_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager']::public.membership_role[]
  )
);

-- Review responses policies.
create policy review_responses_select_allowed on public.review_responses
for select
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_responses.review_id
      and (
        r.status = 'approved'
        or r.reviewer_user_id = auth.uid()
        or app_hidden.is_platform_admin()
        or app_hidden.is_tenant_member(
          r.tenant_id,
          array['owner', 'manager', 'staff']::public.membership_role[]
        )
      )
  )
);

create policy review_responses_insert_allowed on public.review_responses
for insert
with check (
  exists (
    select 1
    from public.reviews r
    where r.id = review_responses.review_id
      and (
        app_hidden.is_platform_admin()
        or app_hidden.is_tenant_member(
          r.tenant_id,
          array['owner', 'manager', 'staff']::public.membership_role[]
        )
      )
  )
);

create policy review_responses_update_allowed on public.review_responses
for update
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_responses.review_id
      and (
        app_hidden.is_platform_admin()
        or app_hidden.is_tenant_member(
          r.tenant_id,
          array['owner', 'manager', 'staff']::public.membership_role[]
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.reviews r
    where r.id = review_responses.review_id
      and (
        app_hidden.is_platform_admin()
        or app_hidden.is_tenant_member(
          r.tenant_id,
          array['owner', 'manager', 'staff']::public.membership_role[]
        )
      )
  )
);

create policy review_responses_delete_allowed on public.review_responses
for delete
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_responses.review_id
      and (
        app_hidden.is_platform_admin()
        or app_hidden.is_tenant_member(
          r.tenant_id,
          array['owner', 'manager']::public.membership_role[]
        )
      )
  )
);

commit;
