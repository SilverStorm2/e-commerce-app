-- M3-DB-CART
-- Introduce carts and cart_items with owner-scoped RLS and snapshot helpers.

begin;

-- Core carts table scoped to authenticated users (one cart per user).
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  currency_code text not null default 'PLN' check (currency_code = 'PLN'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carts_user_idx on public.carts (user_id);

-- Cart items capture selected products while storing pricing snapshot metadata.
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  currency_code text not null default 'PLN' check (currency_code = 'PLN'),
  metadata jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_unique_product_per_cart unique (cart_id, product_id)
);

alter table public.cart_items
  add constraint cart_items_product_tenant_fk
  foreign key (product_id, tenant_id)
  references public.products (id, tenant_id)
  on delete cascade;

create index if not exists cart_items_cart_idx on public.cart_items (cart_id);
create index if not exists cart_items_tenant_idx on public.cart_items (tenant_id);

-- Ensure cart timestamps stay fresh when items change.
create or replace function app_hidden.bump_cart_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.carts
     set updated_at = now()
   where id = coalesce(new.cart_id, old.cart_id);
  return null;
end;
$$;

-- Align cart item snapshot data with the source product.
create or replace function app_hidden.ensure_cart_item_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_record record;
begin
  select
    p.tenant_id,
    p.price_amount,
    p.currency_code
  into product_record
  from public.products p
  where p.id = new.product_id;

  if product_record is null then
    raise exception 'Product % not found', new.product_id;
  end if;

  if new.tenant_id is null then
    new.tenant_id := product_record.tenant_id;
  elsif new.tenant_id <> product_record.tenant_id then
    raise exception 'Cart item tenant mismatch for product %', new.product_id;
  end if;

  if new.unit_price is null then
    new.unit_price := product_record.price_amount;
  end if;

  if new.currency_code is null then
    new.currency_code := product_record.currency_code;
  end if;

  return new;
end;
$$;

-- Attach timestamp triggers.
drop trigger if exists set_carts_updated_at on public.carts;
create trigger set_carts_updated_at
before update on public.carts
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists set_cart_items_updated_at on public.cart_items;
create trigger set_cart_items_updated_at
before update on public.cart_items
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists set_cart_items_defaults on public.cart_items;
create trigger set_cart_items_defaults
before insert or update on public.cart_items
for each row
execute function app_hidden.ensure_cart_item_defaults();

drop trigger if exists touch_cart_on_item_change on public.cart_items;
create trigger touch_cart_on_item_change
after insert or update or delete on public.cart_items
for each row
execute function app_hidden.bump_cart_updated_at();

-- Enable RLS for carts and cart_items.
alter table public.carts enable row level security;
alter table public.carts force row level security;

alter table public.cart_items enable row level security;
alter table public.cart_items force row level security;

-- Cart policies: only the owner (or platform admin) may access.
create policy carts_select_owner on public.carts
for select
using (
  auth.uid() = user_id
  or app_hidden.is_platform_admin()
);

create policy carts_insert_owner on public.carts
for insert
with check (
  auth.uid() = user_id
  or app_hidden.is_platform_admin()
);

create policy carts_update_owner on public.carts
for update
using (
  auth.uid() = user_id
  or app_hidden.is_platform_admin()
)
with check (
  auth.uid() = user_id
  or app_hidden.is_platform_admin()
);

create policy carts_delete_owner on public.carts
for delete
using (
  auth.uid() = user_id
  or app_hidden.is_platform_admin()
);

-- Cart item policies: require access to the parent cart.
create policy cart_items_select_owner on public.cart_items
for select
using (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
  )
);

create policy cart_items_insert_owner on public.cart_items
for insert
with check (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
  )
);

create policy cart_items_update_owner on public.cart_items
for update
using (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
  )
)
with check (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
  )
);

create policy cart_items_delete_owner on public.cart_items
for delete
using (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and c.user_id = auth.uid()
  )
);

commit;
