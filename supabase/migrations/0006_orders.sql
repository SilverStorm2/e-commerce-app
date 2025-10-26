-- M3-DB-ORDERS
-- Parent order groups with per-tenant orders and order items including RLS and totals triggers.

begin;

-- Enumerations for order lifecycle states.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_group_status') then
    create type public.order_group_status as enum (
      'pending',
      'awaiting_payment',
      'paid',
      'cancelled',
      'refunded'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'pending',
      'awaiting_payment',
      'paid',
      'fulfilled',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    );
  end if;
end
$$;

-- Parent order group for a single payment/checkout session.
create table if not exists public.order_groups (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references auth.users (id) on delete restrict,
  buyer_email text,
  buyer_full_name text,
  currency_code text not null default 'PLN' check (currency_code = 'PLN'),
  status public.order_group_status not null default 'pending',
  billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  contact_phone text,
  notes jsonb not null default '{}'::jsonb,
  items_subtotal_amount numeric(12, 2) not null default 0 check (items_subtotal_amount >= 0),
  items_tax_amount numeric(12, 2) not null default 0 check (items_tax_amount >= 0),
  shipping_amount numeric(12, 2) not null default 0 check (shipping_amount >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  items_count integer not null default 0 check (items_count >= 0),
  seller_count integer not null default 0 check (seller_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  cart_snapshot jsonb not null default '{}'::jsonb,
  placed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_groups_buyer_idx on public.order_groups (buyer_user_id);

-- Per-tenant seller orders derived from a parent order group.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_group_id uuid not null references public.order_groups (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  buyer_user_id uuid not null references auth.users (id) on delete restrict,
  buyer_email text,
  buyer_full_name text,
  buyer_note text,
  seller_note text,
  status public.order_status not null default 'pending',
  currency_code text not null default 'PLN' check (currency_code = 'PLN'),
  billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  items_subtotal_amount numeric(12, 2) not null default 0 check (items_subtotal_amount >= 0),
  items_tax_amount numeric(12, 2) not null default 0 check (items_tax_amount >= 0),
  shipping_amount numeric(12, 2) not null default 0 check (shipping_amount >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  items_count integer not null default 0 check (items_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  placed_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_id_tenant_unique unique (id, tenant_id),
  constraint orders_group_tenant_unique unique (order_group_id, tenant_id)
);

create index if not exists orders_group_idx on public.orders (order_group_id);
create index if not exists orders_tenant_idx on public.orders (tenant_id, status);
create index if not exists orders_buyer_idx on public.orders (buyer_user_id);

-- Order line items capture seller/product snapshots.
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_slug text,
  product_sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  vat_rate numeric(5, 2) not null default 0 check (vat_rate >= 0),
  subtotal_amount numeric(12, 2) not null default 0 check (subtotal_amount >= 0),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  currency_code text not null default 'PLN' check (currency_code = 'PLN'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_items
  add constraint order_items_order_tenant_fk
  foreign key (order_id, tenant_id)
  references public.orders (id, tenant_id)
  on delete cascade;

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_tenant_idx on public.order_items (tenant_id);

-- Ensure order defaults (buyer, currency, addresses) align with parent order group.
create or replace function app_hidden.ensure_order_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  group_row public.order_groups%rowtype;
begin
  select *
    into group_row
  from public.order_groups
  where id = new.order_group_id;

  if group_row is null then
    raise exception 'Order group % does not exist', new.order_group_id;
  end if;

  if new.buyer_user_id is null then
    new.buyer_user_id := group_row.buyer_user_id;
  elsif new.buyer_user_id <> group_row.buyer_user_id then
    raise exception 'Order buyer must match order_group buyer';
  end if;

  if new.currency_code is null then
    new.currency_code := group_row.currency_code;
  elsif new.currency_code <> group_row.currency_code then
    raise exception 'Order currency must match order_group currency';
  end if;

  if new.buyer_email is null then
    new.buyer_email := group_row.buyer_email;
  end if;

  if new.buyer_full_name is null then
    new.buyer_full_name := group_row.buyer_full_name;
  end if;

  if new.billing_address is null or new.billing_address = '{}'::jsonb then
    new.billing_address := group_row.billing_address;
  end if;

  if new.shipping_address is null or new.shipping_address = '{}'::jsonb then
    new.shipping_address := group_row.shipping_address;
  end if;

  return new;
end;
$$;

-- Normalize order item snapshots and compute monetary totals.
create or replace function app_hidden.prepare_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  product_row public.products%rowtype;
  subtotal numeric(12, 2);
  tax numeric(12, 2);
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  select *
    into order_row
  from public.orders
  where id = new.order_id;

  if order_row is null then
    raise exception 'Order % does not exist for order item', new.order_id;
  end if;

  if new.tenant_id is null then
    new.tenant_id := order_row.tenant_id;
  elsif new.tenant_id <> order_row.tenant_id then
    raise exception 'Order item tenant mismatch with parent order';
  end if;

  if new.currency_code is null then
    new.currency_code := order_row.currency_code;
  elsif new.currency_code <> order_row.currency_code then
    raise exception 'Order item currency must match parent order currency';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Order item quantity must be positive';
  end if;

  select
    p.tenant_id,
    p.name,
    p.slug,
    p.sku,
    p.price_amount,
    p.currency_code,
    p.vat_rate
  into product_row
  from public.products p
  where p.id = new.product_id;

  if product_row is not null then
    if product_row.tenant_id <> new.tenant_id then
      raise exception 'Product % does not belong to tenant %', new.product_id, new.tenant_id;
    end if;

    if new.product_name is null then
      new.product_name := product_row.name;
    end if;

    if new.product_slug is null then
      new.product_slug := product_row.slug;
    end if;

    if new.product_sku is null then
      new.product_sku := product_row.sku;
    end if;

    if new.unit_price is null then
      new.unit_price := product_row.price_amount;
    end if;

    if new.vat_rate is null then
      new.vat_rate := coalesce(product_row.vat_rate, 0);
    end if;
  else
    if new.product_name is null then
      raise exception 'Order item requires product_name when product snapshot missing';
    end if;

    if new.unit_price is null then
      raise exception 'Order item requires unit_price when product snapshot missing';
    end if;

    if new.vat_rate is null then
      new.vat_rate := 0;
    end if;
  end if;

  subtotal := round(new.unit_price * new.quantity, 2);
  tax := round(subtotal * new.vat_rate / 100, 2);

  new.subtotal_amount := subtotal;
  new.tax_amount := tax;
  new.total_amount := subtotal + tax;

  return new;
end;
$$;

-- Refresh per-order totals after item changes.
create or replace function app_hidden.refresh_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order_id uuid;
  totals record;
begin
  target_order_id := coalesce(new.order_id, old.order_id);

  if target_order_id is null then
    return null;
  end if;

  select
    coalesce(sum(subtotal_amount), 0) as subtotal,
    coalesce(sum(tax_amount), 0) as tax,
    coalesce(sum(quantity), 0) as quantity
  into totals
  from public.order_items
  where order_id = target_order_id;

  update public.orders o
  set
    items_subtotal_amount = totals.subtotal,
    items_tax_amount = totals.tax,
    items_count = totals.quantity::integer
  where o.id = target_order_id;

  return null;
end;
$$;

-- Refresh order_group aggregates when child orders change.
create or replace function app_hidden.refresh_order_group_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
  totals record;
begin
  target_group_id := coalesce(new.order_group_id, old.order_group_id);

  if target_group_id is null then
    return null;
  end if;

  select
    coalesce(sum(items_subtotal_amount), 0) as subtotal,
    coalesce(sum(items_tax_amount), 0) as tax,
    coalesce(sum(shipping_amount), 0) as shipping,
    coalesce(sum(discount_amount), 0) as discount,
    coalesce(sum(items_count), 0) as item_count,
    coalesce(count(*), 0) as seller_count
  into totals
  from public.orders
  where order_group_id = target_group_id;

  update public.order_groups og
  set
    items_subtotal_amount = totals.subtotal,
    items_tax_amount = totals.tax,
    shipping_amount = totals.shipping,
    discount_amount = totals.discount,
    total_amount = round(totals.subtotal + totals.tax + totals.shipping - totals.discount, 2),
    items_count = totals.item_count::integer,
    seller_count = totals.seller_count::integer
  where og.id = target_group_id;

  return null;
end;
$$;

-- Compute final order total from component fields.
create or replace function app_hidden.compute_order_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.total_amount := round(
    coalesce(new.items_subtotal_amount, 0)
    + coalesce(new.items_tax_amount, 0)
    + coalesce(new.shipping_amount, 0)
    - coalesce(new.discount_amount, 0),
    2
  );

  if new.total_amount < 0 then
    raise exception 'Order total cannot be negative';
  end if;

  return new;
end;
$$;

-- Attach triggers for defaults, timestamp management, and aggregate refreshes.
drop trigger if exists ensure_order_defaults on public.orders;
create trigger ensure_order_defaults
before insert or update on public.orders
for each row
execute function app_hidden.ensure_order_defaults();

drop trigger if exists compute_order_total_before_write on public.orders;
create trigger compute_order_total_before_write
before insert or update on public.orders
for each row
execute function app_hidden.compute_order_total();

drop trigger if exists touch_orders_updated_at on public.orders;
create trigger touch_orders_updated_at
before update on public.orders
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists touch_order_groups_updated_at on public.order_groups;
create trigger touch_order_groups_updated_at
before update on public.order_groups
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists prepare_order_item_before_write on public.order_items;
create trigger prepare_order_item_before_write
before insert or update on public.order_items
for each row
execute function app_hidden.prepare_order_item();

drop trigger if exists touch_order_items_updated_at on public.order_items;
create trigger touch_order_items_updated_at
before update on public.order_items
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists refresh_order_totals_after_item on public.order_items;
create trigger refresh_order_totals_after_item
after insert or update or delete on public.order_items
for each row
execute function app_hidden.refresh_order_totals();

drop trigger if exists refresh_order_group_totals_after_order on public.orders;
create trigger refresh_order_group_totals_after_order
after insert or update or delete on public.orders
for each row
execute function app_hidden.refresh_order_group_totals();

-- Enable RLS and define buyer/seller scoped policies.
alter table public.order_groups enable row level security;
alter table public.order_groups force row level security;

alter table public.orders enable row level security;
alter table public.orders force row level security;

alter table public.order_items enable row level security;
alter table public.order_items force row level security;

create policy order_groups_select_allowed on public.order_groups
for select
using (
  auth.uid() = buyer_user_id
  or app_hidden.is_platform_admin()
);

create policy order_groups_insert_allowed on public.order_groups
for insert
with check (
  auth.uid() = buyer_user_id
  or app_hidden.is_platform_admin()
);

create policy order_groups_update_allowed on public.order_groups
for update
using (
  auth.uid() = buyer_user_id
  or app_hidden.is_platform_admin()
)
with check (
  auth.uid() = buyer_user_id
  or app_hidden.is_platform_admin()
);

create policy order_groups_delete_allowed on public.order_groups
for delete
using (
  auth.uid() = buyer_user_id
  or app_hidden.is_platform_admin()
);

create policy orders_select_allowed on public.orders
for select
using (
  auth.uid() = buyer_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
  )
);

create policy orders_insert_allowed on public.orders
for insert
with check (
  auth.uid() = buyer_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy orders_update_allowed on public.orders
for update
using (
  auth.uid() = buyer_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
  )
)
with check (
  auth.uid() = buyer_user_id
  or app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy orders_delete_restricted on public.orders
for delete
using (app_hidden.is_platform_admin());

create policy order_items_select_allowed on public.order_items
for select
using (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.buyer_user_id = auth.uid()
        or app_hidden.is_tenant_member(
          o.tenant_id,
          array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
        )
      )
  )
);

create policy order_items_insert_allowed on public.order_items
for insert
with check (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.buyer_user_id = auth.uid()
        or app_hidden.is_tenant_member(
          o.tenant_id,
          array['owner', 'manager', 'staff']::public.membership_role[]
        )
      )
  )
);

create policy order_items_update_allowed on public.order_items
for update
using (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.buyer_user_id = auth.uid()
        or app_hidden.is_tenant_member(
          o.tenant_id,
          array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
        )
      )
  )
)
with check (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.buyer_user_id = auth.uid()
        or app_hidden.is_tenant_member(
          o.tenant_id,
          array['owner', 'manager', 'staff']::public.membership_role[]
        )
      )
  )
);

create policy order_items_delete_allowed on public.order_items
for delete
using (
  app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.buyer_user_id = auth.uid()
        or app_hidden.is_tenant_member(
          o.tenant_id,
          array['owner', 'manager', 'staff']::public.membership_role[]
        )
      )
  )
);

commit;
