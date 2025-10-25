-- M2-DB-CATALOG
-- Catalog schema: products, categories, media assets, and inventory ledger with RLS.

begin;

-- Enumerations to capture product lifecycle and inventory event types.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_status') then
    create type public.product_status as enum ('draft', 'active', 'archived');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_event_type') then
    create type public.inventory_event_type as enum (
      'manual_adjustment',
      'order_reservation',
      'order_commit',
      'order_release',
      'return',
      'correction'
    );
  end if;
end
$$;

-- Categories provide tenant-scoped taxonomy for storefront navigation.
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null,
  name text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  description text,
  description_i18n jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_slug_not_blank check (char_length(trim(slug)) > 0),
  constraint product_categories_name_not_blank check (char_length(trim(name)) > 0)
);

alter table public.product_categories
  add constraint product_categories_id_tenant_unique unique (id, tenant_id);

create unique index if not exists product_categories_tenant_slug_unique
  on public.product_categories (tenant_id, lower(slug));

create index if not exists product_categories_tenant_visible_idx
  on public.product_categories (tenant_id)
  where is_visible;

-- Products represent sellable items under a tenant, with PL-first metadata.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category_id uuid,
  slug text not null,
  name text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  short_description text,
  short_description_i18n jsonb not null default '{}'::jsonb,
  description text,
  description_i18n jsonb not null default '{}'::jsonb,
  sku text,
  barcode text,
  price_amount numeric(12, 2) not null check (price_amount >= 0),
  currency_code text not null default 'PLN',
  vat_rate numeric(5, 2) default 0 check (vat_rate >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  safety_stock integer not null default 0 check (safety_stock >= 0),
  status public.product_status not null default 'draft',
  is_published boolean not null default false,
  published_at timestamptz,
  publication_note text,
  seo_title text,
  seo_description text,
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  width_cm numeric(8, 2),
  height_cm numeric(8, 2),
  depth_cm numeric(8, 2),
  options jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector not null default ''::tsvector,
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_not_blank check (char_length(trim(slug)) > 0),
  constraint products_name_not_blank check (char_length(trim(name)) > 0),
  constraint products_currency_pln check (currency_code = 'PLN'),
  constraint products_publication_flow check (
    (is_published = false and published_at is null)
    or (is_published = true and status = 'active'::public.product_status and published_at is not null)
  )
);

alter table public.products
  add constraint products_id_tenant_unique unique (id, tenant_id);

alter table public.products
  add constraint products_category_fk
  foreign key (category_id, tenant_id)
  references public.product_categories (id, tenant_id)
  on delete set null;

comment on column public.products.search_vector is
  'Precomputed TSVECTOR placeholder for FTS (populated by future search task).';

create unique index if not exists products_tenant_slug_unique
  on public.products (tenant_id, lower(slug));

create index if not exists products_tenant_status_idx
  on public.products (tenant_id, status, is_published);

create index if not exists products_public_listing_idx
  on public.products (tenant_id)
  where is_published;

-- Product media references Supabase Storage objects for gallery and cover images.
create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt_text text,
  width integer,
  height integer,
  mime_type text,
  size_bytes integer,
  position integer not null default 0,
  is_primary boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint product_media_storage_path_not_blank check (char_length(trim(storage_path)) > 0),
  constraint product_media_position_non_negative check (position >= 0),
  constraint product_media_size_non_negative check (size_bytes is null or size_bytes >= 0)
);

create index if not exists product_media_product_position_idx
  on public.product_media (product_id, position);

create unique index if not exists product_media_primary_unique
  on public.product_media (product_id)
  where is_primary;

-- Inventory ledger captures stock deltas for auditing.
create table if not exists public.inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  quantity_delta integer not null,
  event_type public.inventory_event_type not null default 'manual_adjustment',
  reason text,
  reference_type text,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint inventory_ledger_quantity_non_zero check (quantity_delta <> 0)
);

alter table public.inventory_ledger
  add constraint inventory_ledger_product_fk
  foreign key (product_id, tenant_id)
  references public.products (id, tenant_id)
  on delete cascade;

create index if not exists inventory_ledger_product_created_idx
  on public.inventory_ledger (product_id, created_at desc);

create index if not exists inventory_ledger_tenant_idx
  on public.inventory_ledger (tenant_id, created_at desc);

-- RLS enforcement.
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.inventory_ledger enable row level security;

-- Product categories RLS policies.
create policy product_categories_public_select on public.product_categories
for select
using (
  is_visible
);

create policy product_categories_member_select on public.product_categories
for select
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
  )
);

create policy product_categories_manage_members on public.product_categories
for all
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
)
with check (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

-- Products RLS policies.
create policy products_public_select on public.products
for select
using (
  is_published
  and (published_at is null or published_at <= now())
);

create policy products_member_select on public.products
for select
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
  )
);

create policy products_member_insert on public.products
for insert
with check (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy products_member_update on public.products
for update
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
)
with check (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy products_member_delete on public.products
for delete
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

-- Product media RLS policies.
create policy product_media_public_select on public.product_media
for select
using (
  exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and p.is_published
      and (p.published_at is null or p.published_at <= now())
  )
);

create policy product_media_member_select on public.product_media
for select
using (
  exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and (
        app_hidden.is_platform_admin()
        or app_hidden.is_tenant_member(
          p.tenant_id,
          array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
        )
      )
  )
);

create policy product_media_member_manage on public.product_media
for all
using (
  exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and (
        app_hidden.is_platform_admin()
        or app_hidden.is_tenant_member(
          p.tenant_id,
          array['owner', 'manager', 'staff']::public.membership_role[]
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and (
        app_hidden.is_platform_admin()
        or app_hidden.is_tenant_member(
          p.tenant_id,
          array['owner', 'manager', 'staff']::public.membership_role[]
        )
      )
  )
);

-- Inventory ledger RLS policies (no public access).
create policy inventory_ledger_member_select on public.inventory_ledger
for select
using (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

create policy inventory_ledger_member_insert on public.inventory_ledger
for insert
with check (
  app_hidden.is_platform_admin()
  or app_hidden.is_tenant_member(
    tenant_id,
    array['owner', 'manager', 'staff']::public.membership_role[]
  )
);

commit;
