-- Validate RLS and totals for order_groups, orders, and order_items.
begin;

create extension if not exists pgtap;

select plan(11);

-- Deterministic identifiers across runs.
select
  set_config('app.buyer_id', '00000000-0000-8000-a000-0000000000b1', true),
  set_config('app.seller_owner_id', '00000000-0000-8000-a000-0000000000c1', true),
  set_config('app.seller_staff_id', '00000000-0000-8000-a000-0000000000c2', true),
  set_config('app.other_user_id', '00000000-0000-8000-a000-0000000000d1', true),
  set_config('app.platform_admin_id', '00000000-0000-8000-a000-0000000000ea', true),
  set_config('app.tenant_id', '10000000-0000-8000-a000-000000000010', true),
  set_config('app.membership_owner_id', '20000000-0000-8000-a000-000000000020', true),
  set_config('app.membership_staff_id', '20000000-0000-8000-a000-000000000021', true),
  set_config('app.product_id', '30000000-0000-8000-a000-000000000030', true),
  set_config('app.order_group_id', '40000000-0000-8000-a000-000000000040', true),
  set_config('app.order_id', '50000000-0000-8000-a000-000000000050', true),
  set_config('app.order_item_id', '60000000-0000-8000-a000-000000000060', true);

-- Seed auth.users required for the scenarios.
with upsert_users as (
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  values
    (current_setting('app.buyer_id')::uuid, 'buyer-orders@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.seller_owner_id')::uuid, 'owner-orders@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.seller_staff_id')::uuid, 'staff-orders@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.other_user_id')::uuid, 'other-orders@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.platform_admin_id')::uuid, 'admin-orders@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now())
  on conflict (id) do update
    set email = excluded.email
  returning 1
)
select coalesce(sum(1), 0) from upsert_users;

-- Ensure platform admin mapping exists.
insert into public.platform_admins (email, user_id, note)
values ('admin-orders@example.com', current_setting('app.platform_admin_id')::uuid, 'Orders test admin')
on conflict (email) do update
  set user_id = excluded.user_id,
      note = excluded.note;

-- Seller owner provisions a tenant.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.seller_owner_id'), true);
select set_config('request.jwt.claim.email', 'owner-orders@example.com', true);

insert into public.tenants (id, slug, name, created_by)
values (
  current_setting('app.tenant_id')::uuid,
  'orders-test-store',
  'Orders Test Store',
  current_setting('app.seller_owner_id')::uuid
)
on conflict (id) do nothing;

insert into public.memberships (id, tenant_id, user_id, role, status)
values
  (
    current_setting('app.membership_owner_id')::uuid,
    current_setting('app.tenant_id')::uuid,
    current_setting('app.seller_owner_id')::uuid,
    'owner',
    'active'
  ),
  (
    current_setting('app.membership_staff_id')::uuid,
    current_setting('app.tenant_id')::uuid,
    current_setting('app.seller_staff_id')::uuid,
    'staff',
    'active'
  )
on conflict (id) do nothing;

-- Create a product to snapshot within the order.
insert into public.products (
  id,
  tenant_id,
  slug,
  name,
  price_amount,
  currency_code,
  vat_rate,
  stock_quantity,
  status,
  is_published,
  published_at
)
values (
  current_setting('app.product_id')::uuid,
  current_setting('app.tenant_id')::uuid,
  'artisan-mug',
  'Artisan Mug',
  25.00,
  'PLN',
  23.0,
  10,
  'active',
  true,
  now()
)
on conflict (id) do nothing;

reset role;

-- Buyer creates an order group under RLS.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.buyer_id'), true);
select set_config('request.jwt.claim.email', 'buyer-orders@example.com', true);

insert into public.order_groups (id, buyer_user_id, buyer_email, buyer_full_name, billing_address, shipping_address)
values (
  current_setting('app.order_group_id')::uuid,
  current_setting('app.buyer_id')::uuid,
  'buyer-orders@example.com',
  'Buyer Orders',
  jsonb_build_object('line1', 'Testowa 1', 'city', 'Warszawa'),
  jsonb_build_object('line1', 'Testowa 1', 'city', 'Warszawa')
);

reset role;

-- Seller owner inserts a per-tenant order and items.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.seller_owner_id'), true);
select set_config('request.jwt.claim.email', 'owner-orders@example.com', true);

insert into public.orders (id, order_group_id, tenant_id, metadata)
values (
  current_setting('app.order_id')::uuid,
  current_setting('app.order_group_id')::uuid,
  current_setting('app.tenant_id')::uuid,
  '{}'::jsonb
);

insert into public.order_items (id, order_id, tenant_id, product_id, quantity)
values (
  current_setting('app.order_item_id')::uuid,
  current_setting('app.order_id')::uuid,
  current_setting('app.tenant_id')::uuid,
  current_setting('app.product_id')::uuid,
  2
);

reset role;

-- Order totals computed from line items (25 PLN * 2, VAT 23%).
select results_eq(
  $$
    select items_count, items_subtotal_amount, items_tax_amount, total_amount
    from public.orders
    where id = current_setting('app.order_id')::uuid
  $$,
  $$
    values (
      2::integer,
      50.00::numeric,
      11.50::numeric,
      61.50::numeric
    )
  $$,
  'Order totals snapshot matches summed order items'
);

-- Order group aggregates derived order totals.
select results_eq(
  $$
    select items_count, seller_count, total_amount
    from public.order_groups
    where id = current_setting('app.order_group_id')::uuid
  $$,
  $$
    values (
      2::integer,
      1::integer,
      61.50::numeric
    )
  $$,
  'Order group aggregates seller count, item count, and totals'
);

-- Buyer can view their order group and per-seller order.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.buyer_id'), true);
select set_config('request.jwt.claim.email', 'buyer-orders@example.com', true);

select isnt_empty(
  $$
    select 1
    from public.order_groups
    where id = current_setting('app.order_group_id')::uuid
  $$,
  'Buyer can view their order group'
);

select isnt_empty(
  $$
    select 1
    from public.orders
    where id = current_setting('app.order_id')::uuid
  $$,
  'Buyer can view their seller order'
);

select isnt_empty(
  $$
    select 1
    from public.order_items
    where order_id = current_setting('app.order_id')::uuid
  $$,
  'Buyer can view order line items'
);

reset role;

-- Seller staff members can read and update their tenant order.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.seller_staff_id'), true);
select set_config('request.jwt.claim.email', 'staff-orders@example.com', true);

select isnt_empty(
  $$
    select 1
    from public.orders
    where id = current_setting('app.order_id')::uuid
  $$,
  'Seller staff can view tenant order'
);

update public.orders
set shipping_amount = 12.00
where id = current_setting('app.order_id')::uuid;

reset role;

-- Shipping update recalculates totals for order and group.
select results_eq(
  $$
    select shipping_amount, total_amount
    from public.orders
    where id = current_setting('app.order_id')::uuid
  $$,
  $$
    values (12.00::numeric, 73.50::numeric)
  $$,
  'Updating shipping amount recalculates order total'
);

select results_eq(
  $$
    select shipping_amount, total_amount
    from public.order_groups
    where id = current_setting('app.order_group_id')::uuid
  $$,
  $$
    values (12.00::numeric, 73.50::numeric)
  $$,
  'Order group total tracks updated shipping'
);

-- Unrelated user cannot see order data.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.other_user_id'), true);
select set_config('request.jwt.claim.email', 'other-orders@example.com', true);

select is_empty(
  $$
    select 1
    from public.orders
    where id = current_setting('app.order_id')::uuid
  $$,
  'Unrelated user cannot view seller order'
);

select is_empty(
  $$
    select 1
    from public.order_items
    where order_id = current_setting('app.order_id')::uuid
  $$,
  'Unrelated user cannot view order items'
);

reset role;

-- Platform admin has read access for support.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.platform_admin_id'), true);
select set_config('request.jwt.claim.email', 'admin-orders@example.com', true);

select isnt_empty(
  $$
    select 1
    from public.order_items
    where order_id = current_setting('app.order_id')::uuid
  $$,
  'Platform admin can view order items for support'
);

reset role;

select finish();

rollback;
