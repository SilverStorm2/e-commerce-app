-- Validate FTS ranking behaviour for products and contractors.
begin;

create extension if not exists pgtap;

select plan(7);

-- Deterministic identities.
with upsert_users as (
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  values
    ('00000000-0000-6000-a000-000000000001', 'owner-search@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-6000-a000-000000000002', 'contractor@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now())
  on conflict (id) do update
    set email = excluded.email
  returning 1
)
select coalesce(sum(1), 0) from upsert_users;

-- Create tenant and published product.
with new_tenant as (
  insert into public.tenants (slug, name, created_by)
  values ('fts-test-tenant', 'FTS Test Tenant', '00000000-0000-6000-a000-000000000001')
  on conflict (slug) do update set name = excluded.name
  returning id
), ensure_product as (
  insert into public.products (
    tenant_id,
    slug,
    name,
    name_i18n,
    short_description,
    short_description_i18n,
    description,
    description_i18n,
    price_amount,
    stock_quantity,
    status,
    is_published,
    published_at,
    metadata
  )
  values (
    (select id from new_tenant),
    'recznie-robiona-ceramika',
    'Ręcznie robiona ceramika',
    jsonb_build_object('pl', 'Ręcznie robiona ceramika', 'en', 'Handmade ceramics'),
    'Kubek wypalany w małej pracowni.',
    jsonb_build_object('pl', 'Kubek wypalany w małej pracowni.', 'en', 'Small batch pottery mug.'),
    'Idealny kubek na herbatę, szkliwiony na niebiesko.',
    jsonb_build_object('pl', 'Idealny kubek na herbatę, szkliwiony na niebiesko.', 'en', 'Perfect tea mug with blue glaze.'),
    129.00,
    15,
    'active'::public.product_status,
    true,
    now(),
    jsonb_build_object('tags', 'ceramika rękodzieło kubek')
  )
  on conflict (tenant_id, slug) do update
    set name = excluded.name,
        name_i18n = excluded.name_i18n,
        short_description = excluded.short_description,
        short_description_i18n = excluded.short_description_i18n,
        description = excluded.description,
        description_i18n = excluded.description_i18n,
        price_amount = excluded.price_amount,
        status = excluded.status,
        is_published = excluded.is_published,
        published_at = excluded.published_at,
        metadata = excluded.metadata
  returning id
)
select set_config('app.product_id', (select id::text from ensure_product), true);

-- Temporary contractor profile table (until dedicated migration lands).
create table if not exists public.contractor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  slug text unique,
  display_name text not null,
  headline text,
  short_bio text,
  skills text[] default '{}'::text[],
  service_areas text[] default '{}'::text[],
  languages text[] default '{}'::text[],
  is_visible boolean default true,
  search_vector tsvector not null default ''::tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select ok(app_hidden.ensure_contractor_search_support(), 'Contractor search support prepared');

with upsert_contractor as (
  insert into public.contractor_profiles (
    user_id,
    slug,
    display_name,
    headline,
    short_bio,
    skills,
    service_areas,
    languages
  )
  values (
    '00000000-0000-6000-a000-000000000002',
    'wsparcie-logistyczne-wroclaw',
    'Wsparcie logistyczne Wrocław',
    'Fulfillment i logistyka dla e-commerce',
    'Pomagam sklepom w integracji magazynu, pakowaniu i wysyłkach w regionie Dolnego Śląska.',
    array['logistyka', 'fulfillment', 'magazynowanie'],
    array['Wrocław', 'Dolny Śląsk'],
    array['pl', 'en']
  )
  on conflict (user_id) do update
    set slug = excluded.slug,
        display_name = excluded.display_name,
        headline = excluded.headline,
        short_bio = excluded.short_bio,
        skills = excluded.skills,
        service_areas = excluded.service_areas,
        languages = excluded.languages
  returning id
)
select set_config('app.contractor_id', (select id::text from upsert_contractor), true);

-- Assertions ---------------------------------------------------------------

select ok(
  (
    select search_vector <> ''::tsvector
    from public.products
    where id = current_setting('app.product_id')::uuid
  ),
  'Product search vector populated'
);

select ok(
  (
    select search_vector <> ''::tsvector
    from public.contractor_profiles
    where id = current_setting('app.contractor_id')::uuid
  ),
  'Contractor search vector populated'
);

select results_eq(
  $$
    select entity_type, title
    from public.search_entities('recznie ceramika kubek', 'pl', true, false, 5)
    limit 1
  $$,
  $$
    values ('product', 'Ręcznie robiona ceramika')
  $$,
  'Unaccented Polish query matches published product'
);

select is(
  (
    select count(*)
    from public.search_entities('ceramika', 'pl', true, false, 1)
  ),
  1::bigint,
  'Search respects limit parameter'
);

select results_eq(
  $$
    select entity_type, title
    from public.search_entities('fulfillment Wroclaw', 'pl', false, true, 5)
    limit 1
  $$,
  $$
    values ('contractor', 'Wsparcie logistyczne Wrocław')
  $$,
  'Logistics query returns contractor profile'
);

select results_eq(
  $$
    select entity_type
    from public.search_entities('ceramika fulfillment Wrocław', 'pl', true, true, 10)
    limit 2
  $$,
  $$
    values ('product'), ('contractor')
  $$,
  'Combined query returns ranked entities'
);

select is(
  (
    select count(*)
    from public.search_entities('    ', 'pl')
  ),
  0::bigint,
  'Blank query yields no results'
);

select finish();

rollback;
