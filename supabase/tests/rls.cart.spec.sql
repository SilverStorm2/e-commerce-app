-- Validate RLS behaviour for carts and cart_items, including owner-only access.
begin;

create extension if not exists pgtap;

select plan(5);

-- Deterministic identifiers for repeatable tests.
select
  set_config('app.user_owner_id', '00000000-0000-7000-a000-000000000001', true),
  set_config('app.user_other_id', '00000000-0000-7000-a000-000000000002', true),
  set_config('app.user_admin_id', '00000000-0000-7000-a000-0000000000aa', true),
  set_config('app.tenant_id', '10000000-0000-7000-a000-000000000010', true),
  set_config('app.product_id', '20000000-0000-7000-a000-000000000020', true),
  set_config('app.cart_id', '30000000-0000-7000-a000-000000000030', true),
  set_config('app.cart_item_id', '40000000-0000-7000-a000-000000000040', true);

-- Seed users required for the scenario.
with upsert_users as (
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  values
    (current_setting('app.user_owner_id')::uuid, 'buyer@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.user_other_id')::uuid, 'other@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.user_admin_id')::uuid, 'admin@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now())
  on conflict (id) do update
    set email = excluded.email
  returning 1
)
select coalesce(sum(1), 0) from upsert_users;

-- Ensure platform admin linkage.
insert into public.platform_admins (email, user_id, note)
values ('admin@example.com', current_setting('app.user_admin_id')::uuid, 'Test support admin')
on conflict (email) do update
  set user_id = excluded.user_id,
      note = excluded.note;

-- Owner creates a tenant and product.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.user_owner_id'), true);
select set_config('request.jwt.claim.email', 'buyer@example.com', true);

insert into public.tenants (id, slug, name)
values (current_setting('app.tenant_id')::uuid, 'cart-test-store', 'Cart Test Store')
on conflict (id) do nothing;

insert into public.products (
  id,
  tenant_id,
  slug,
  name,
  price_amount,
  currency_code,
  stock_quantity,
  status,
  is_published,
  published_at
)
values (
  current_setting('app.product_id')::uuid,
  current_setting('app.tenant_id')::uuid,
  'polish-mug',
  'Polish Mug',
  25.00,
  'PLN',
  10,
  'active',
  true,
  now()
)
on conflict (id) do nothing;

reset role;

-- Owner creates a cart and adds an item without providing tenant_id/unit_price.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.user_owner_id'), true);
select set_config('request.jwt.claim.email', 'buyer@example.com', true);

insert into public.carts (id, user_id)
values (
  current_setting('app.cart_id')::uuid,
  current_setting('app.user_owner_id')::uuid
)
on conflict (id) do nothing;

insert into public.cart_items (id, cart_id, product_id, quantity)
values (
  current_setting('app.cart_item_id')::uuid,
  current_setting('app.cart_id')::uuid,
  current_setting('app.product_id')::uuid,
  2
);

select isnt_empty(
  $$
    select 1
    from public.carts
    where id = current_setting('app.cart_id')::uuid
  $$,
  'Owner can read their cart'
);

update public.cart_items
set quantity = 5
where id = current_setting('app.cart_item_id')::uuid;

select results_eq(
  $$
    select tenant_id, unit_price, currency_code, quantity
    from public.cart_items
    where id = current_setting('app.cart_item_id')::uuid
  $$,
  $$
    values (
      current_setting('app.tenant_id')::uuid,
      25.00::numeric,
      'PLN'::text,
      5::integer
    )
  $$,
  'Cart item snapshot matches product defaults and owner updates quantity'
);

reset role;

-- Non-owner cannot read or mutate another user's cart.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.user_other_id'), true);
select set_config('request.jwt.claim.email', 'other@example.com', true);

select is_empty(
  $$
    select 1
    from public.carts
    where id = current_setting('app.cart_id')::uuid
  $$,
  'Non-owner cannot read another user cart'
);

select throws_like(
  $$
    insert into public.cart_items (cart_id, product_id, quantity)
    values (
      current_setting('app.cart_id')::uuid,
      current_setting('app.product_id')::uuid,
      1
    )
  $$,
  'permission denied%',
  'Non-owner insert blocked by RLS'
);

reset role;

-- Platform admin may access carts for support duties.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.user_admin_id'), true);
select set_config('request.jwt.claim.email', 'admin@example.com', true);

select isnt_empty(
  $$
    select 1
    from public.carts
    where id = current_setting('app.cart_id')::uuid
  $$,
  'Platform admin can view any cart'
);

reset role;

select finish();

rollback;
