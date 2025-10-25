-- Verify catalog RLS behaviour for products, categories, media, and inventory ledger.
begin;

create extension if not exists pgtap;

select plan(10);

-- Deterministic test identities.
with upsert_users as (
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  values
    ('00000000-0000-5000-a000-000000000001', 'owner@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-5000-a000-000000000002', 'staff@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-5000-a000-000000000003', 'viewer@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-5000-a000-0000000000aa', 'admin-catalog@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now())
  on conflict (id) do update
    set email = excluded.email
  returning 1
)
select coalesce(sum(1), 0) from upsert_users;

-- Ensure platform admin linkage.
insert into public.platform_admins (email, user_id, note)
values ('admin-catalog@example.com', '00000000-0000-5000-a000-0000000000aa', 'Catalog test admin')
on conflict (email) do update
  set user_id = excluded.user_id,
      note = excluded.note;

-- Owner creates tenant (auto-creates owner membership).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-5000-a000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner@example.com', true);

with new_tenant as (
  insert into public.tenants (slug, name)
  values ('test-catalog-tenant', 'Test Catalog Tenant')
  returning id
)
select set_config('app.tenant_id', (select id::text from new_tenant), true);

reset role;

-- Grant staff membership (setup executed as privileged role).
insert into public.memberships (tenant_id, user_id, role, status)
values (
  current_setting('app.tenant_id')::uuid,
  '00000000-0000-5000-a000-000000000002',
  'staff'::public.membership_role,
  'active'::public.membership_status
)
on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      status = excluded.status,
      updated_at = now();

-- Owner creates category within tenant scope.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-5000-a000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner@example.com', true);

with new_category as (
  insert into public.product_categories (tenant_id, slug, name, name_i18n)
  values (
    current_setting('app.tenant_id')::uuid,
    'akcesoria',
    'Akcesoria',
    jsonb_build_object('pl', 'Akcesoria', 'en', 'Accessories')
  )
  returning id
)
select set_config('app.category_id', (select id::text from new_category), true);

reset role;

-- Owner creates draft product.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-5000-a000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner@example.com', true);

with new_product as (
  insert into public.products (
    tenant_id,
    category_id,
    slug,
    name,
    name_i18n,
    price_amount,
    stock_quantity,
    status,
    is_published
  )
  values (
    current_setting('app.tenant_id')::uuid,
    current_setting('app.category_id')::uuid,
    'produkt-testowy',
    'Produkt testowy',
    jsonb_build_object('pl', 'Produkt testowy', 'en', 'Test product'),
    199.99,
    12,
    'draft'::public.product_status,
    false
  )
  returning id
)
select set_config('app.product_id', (select id::text from new_product), true);

reset role;

-- Staff adds product media and inventory record while product is draft.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-5000-a000-000000000002', true);
select set_config('request.jwt.claim.email', 'staff@example.com', true);

insert into public.product_media (product_id, storage_path, position, is_primary, alt_text)
values (
  current_setting('app.product_id')::uuid,
  'products/test-catalog-tenant/produkt-testowy/hero.jpg',
  0,
  true,
  'Zdjęcie produktu'
);

insert into public.inventory_ledger (product_id, tenant_id, quantity_delta, event_type, reason)
values (
  current_setting('app.product_id')::uuid,
  current_setting('app.tenant_id')::uuid,
  5,
  'manual_adjustment'::public.inventory_event_type,
  'Initial stock'
);

reset role;

-- Non-member cannot read draft product.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-5000-a000-000000000003', true);
select set_config('request.jwt.claim.email', 'viewer@example.com', true);

select is_empty(
  $$
    select 1
    from public.products
    where id = current_setting('app.product_id')::uuid
  $$,
  'Non-member cannot read draft product'
);

reset role;

-- Non-member cannot update draft product.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-5000-a000-000000000003', true);
select set_config('request.jwt.claim.email', 'viewer@example.com', true);

select throws_like(
  $$
    update public.products
    set price_amount = 149.99
    where id = current_setting('app.product_id')::uuid
  $$,
  'permission denied%',
  'Non-member update blocked by RLS'
);

reset role;

-- Staff member can read and update draft product.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-5000-a000-000000000002', true);
select set_config('request.jwt.claim.email', 'staff@example.com', true);

select isnt_empty(
  $$
    select 1
    from public.products
    where id = current_setting('app.product_id')::uuid
  $$,
  'Staff can read draft product'
);

update public.products
set price_amount = 219.50
where id = current_setting('app.product_id')::uuid;

select ok(
  (
    select price_amount
    from public.products
    where id = current_setting('app.product_id')::uuid
  ) = 219.50,
  'Staff can update product price'
);

reset role;

-- Anonymous users cannot see media while product is draft.
set local role anon;
select set_config('request.jwt.claim.sub', null, true);
select set_config('request.jwt.claim.email', null, true);

select is_empty(
  $$
    select 1
    from public.product_media
    where product_id = current_setting('app.product_id')::uuid
  $$,
  'Anon cannot read media while product is draft'
);

reset role;

-- Staff publishes product and media becomes accessible.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-5000-a000-000000000002', true);
select set_config('request.jwt.claim.email', 'staff@example.com', true);

update public.products
set status = 'active',
    is_published = true,
    published_at = now()
where id = current_setting('app.product_id')::uuid;

reset role;

-- Non-member still cannot see inventory ledger.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-5000-a000-000000000003', true);
select set_config('request.jwt.claim.email', 'viewer@example.com', true);

select is_empty(
  $$
    select 1
    from public.inventory_ledger
    where product_id = current_setting('app.product_id')::uuid
  $$,
  'Non-member cannot read inventory ledger entries'
);

reset role;

-- Anonymous users can now see published product and media.
set local role anon;
select set_config('request.jwt.claim.sub', null, true);
select set_config('request.jwt.claim.email', null, true);

select isnt_empty(
  $$
    select 1
    from public.products
    where id = current_setting('app.product_id')::uuid
  $$,
  'Anon can read published product'
);

select isnt_empty(
  $$
    select 1
    from public.product_media
    where product_id = current_setting('app.product_id')::uuid
  $$,
  'Anon can read product media for published product'
);

reset role;

select finish();

rollback;
