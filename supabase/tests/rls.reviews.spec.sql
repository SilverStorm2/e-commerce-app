-- Validate RLS for reviews and review responses.
begin;

create extension if not exists pgtap;

select plan(14);

-- Deterministic identifiers.
select
  set_config('app.owner_id', '00000000-0000-8000-b000-000000000001', true),
  set_config('app.staff_id', '00000000-0000-8000-b000-000000000002', true),
  set_config('app.buyer_id', '00000000-0000-8000-b000-000000000003', true),
  set_config('app.other_user_id', '00000000-0000-8000-b000-000000000004', true),
  set_config('app.tenant_id', '50000000-0000-8000-b000-000000000005', true),
  set_config('app.product_id', '60000000-0000-8000-b000-000000000006', true),
  set_config('app.review_id', '70000000-0000-8000-b000-000000000007', true),
  set_config('app.review_response_id', '71000000-0000-8000-b000-000000000008', true),
  set_config('app.order_group_id', '80000000-0000-8000-b000-000000000009', true),
  set_config('app.order_id', '80000000-0000-8000-b000-000000000010', true),
  set_config('app.order_item_id', '80000000-0000-8000-b000-000000000011', true);

-- Seed auth users.
with upsert_users as (
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  values
    (current_setting('app.owner_id')::uuid, 'owner-reviews@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.staff_id')::uuid, 'staff-reviews@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.buyer_id')::uuid, 'buyer-reviews@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.other_user_id')::uuid, 'other-reviews@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now())
  on conflict (id) do update
    set email = excluded.email
  returning 1
)
select coalesce(sum(1), 0) from upsert_users;

-- Tenant + membership.
insert into public.tenants (id, slug, name, created_by)
values (
  current_setting('app.tenant_id')::uuid,
  'reviews-store',
  'Reviews Test Store',
  current_setting('app.owner_id')::uuid
)
on conflict (id) do nothing;

insert into public.memberships (tenant_id, user_id, role, status)
values
  (current_setting('app.tenant_id')::uuid, current_setting('app.owner_id')::uuid, 'owner', 'active'),
  (current_setting('app.tenant_id')::uuid, current_setting('app.staff_id')::uuid, 'staff', 'active')
on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      status = excluded.status;

-- Product snapshot.
insert into public.products (id, tenant_id, slug, name, price_amount, currency_code, vat_rate, stock_quantity, status, is_published)
values (
  current_setting('app.product_id')::uuid,
  current_setting('app.tenant_id')::uuid,
  'reviewed-product',
  'Reviewed Product',
  100,
  'PLN',
  23,
  10,
  'active',
  true
)
on conflict (id) do nothing;

-- Delivered order + line item for buyer/product pairing.
insert into public.order_groups (id, buyer_user_id, buyer_email, buyer_full_name, currency_code, status, items_count, seller_count)
values (
  current_setting('app.order_group_id')::uuid,
  current_setting('app.buyer_id')::uuid,
  'buyer-reviews@example.com',
  'Buyer Reviews',
  'PLN',
  'paid',
  1,
  1
)
on conflict (id) do nothing;

insert into public.orders (id, order_group_id, tenant_id, buyer_user_id, status, currency_code, items_count, total_amount, shipping_amount)
values (
  current_setting('app.order_id')::uuid,
  current_setting('app.order_group_id')::uuid,
  current_setting('app.tenant_id')::uuid,
  current_setting('app.buyer_id')::uuid,
  'delivered',
  'PLN',
  1,
  100,
  0
)
on conflict (id) do update
  set status = excluded.status;

insert into public.order_items (id, order_id, tenant_id, product_id, product_name, product_slug, quantity, unit_price, subtotal_amount, total_amount, currency_code)
values (
  current_setting('app.order_item_id')::uuid,
  current_setting('app.order_id')::uuid,
  current_setting('app.tenant_id')::uuid,
  current_setting('app.product_id')::uuid,
  'Reviewed Product',
  'reviewed-product',
  1,
  100,
  100,
  100,
  'PLN'
)
on conflict (id) do nothing;

-- Buyer posts first review.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.buyer_id'), true);
select set_config('request.jwt.claim.email', 'buyer-reviews@example.com', true);

select lives_ok(
  $$
    insert into public.reviews (id, product_id, reviewer_user_id, rating, body)
    values (
      current_setting('app.review_id')::uuid,
      current_setting('app.product_id')::uuid,
      current_setting('app.buyer_id')::uuid,
      5,
      'Świetny produkt!'
    )
  $$,
  'Buyer can submit a review for delivered order'
);

select ok(
  (
    select is_verified
    from public.reviews
    where id = current_setting('app.review_id')::uuid
  ),
  'Review flagged as verified when matching order item exists'
);

-- Duplicate review blocked.
select throws_like(
  $$
    insert into public.reviews (product_id, reviewer_user_id, rating, body)
    values (
      current_setting('app.product_id')::uuid,
      current_setting('app.buyer_id')::uuid,
      4,
      'Druga opinia'
    )
  $$,
  'duplicate key%',
  'Unique constraint prevents duplicate reviews per product/user'
);

reset role;

-- Random user without purchase cannot insert.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.other_user_id'), true);
select set_config('request.jwt.claim.email', 'other-reviews@example.com', true);

select throws_like(
  $$
    insert into public.reviews (product_id, reviewer_user_id, rating, body)
    values (
      current_setting('app.product_id')::uuid,
      current_setting('app.other_user_id')::uuid,
      3,
      'Nie kupiłem, ale piszę'
    )
  $$,
  'permission denied%',
  'Non-buyers blocked from reviewing'
);

reset role;

-- Tenant staff can read pending review.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.staff_id'), true);
select set_config('request.jwt.claim.email', 'staff-reviews@example.com', true);

select isnt_empty(
  $$
    select 1 from public.reviews
    where id = current_setting('app.review_id')::uuid
  $$,
  'Store staff can see pending reviews'
);

reset role;

-- Outsider cannot read pending review.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.other_user_id'), true);
select set_config('request.jwt.claim.email', 'other-reviews@example.com', true);

select is_empty(
  $$
    select 1 from public.reviews
    where id = current_setting('app.review_id')::uuid
  $$,
  'Public cannot see pending reviews'
);

reset role;

-- Staff approves review.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.staff_id'), true);
select set_config('request.jwt.claim.email', 'staff-reviews@example.com', true);

select lives_ok(
  $$
    update public.reviews
    set status = 'approved'
    where id = current_setting('app.review_id')::uuid
  $$,
  'Tenant staff can approve review'
);

reset role;

-- Public can see approved review.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.other_user_id'), true);
select set_config('request.jwt.claim.email', 'other-reviews@example.com', true);

select isnt_empty(
  $$
    select 1 from public.reviews
    where id = current_setting('app.review_id')::uuid
      and status = 'approved'
  $$,
  'Approved reviews visible publicly'
);

reset role;

-- Staff posts seller response.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.staff_id'), true);
select set_config('request.jwt.claim.email', 'staff-reviews@example.com', true);

select lives_ok(
  $$
    insert into public.review_responses (id, review_id, responder_user_id, body)
    values (
      current_setting('app.review_response_id')::uuid,
      current_setting('app.review_id')::uuid,
      current_setting('app.staff_id')::uuid,
      'Dziękujemy za opinię!'
    )
  $$,
  'Tenant staff can leave exactly one response'
);

select throws_like(
  $$
    insert into public.review_responses (review_id, responder_user_id, body)
    values (
      current_setting('app.review_id')::uuid,
      current_setting('app.staff_id')::uuid,
      'Druga odpowiedź'
    )
  $$,
  'duplicate key%',
  'Duplicate seller responses blocked'
);

reset role;

-- Outsider cannot add response.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.other_user_id'), true);
select set_config('request.jwt.claim.email', 'other-reviews@example.com', true);

select throws_like(
  $$
    insert into public.review_responses (review_id, responder_user_id, body)
    values (
      current_setting('app.review_id')::uuid,
      current_setting('app.other_user_id')::uuid,
      'Podszywam się pod sprzedawcę'
    )
  $$,
  'permission denied%',
  'Non-staff users cannot respond'
);

reset role;

-- Reviewer can see seller response after approval.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.buyer_id'), true);
select set_config('request.jwt.claim.email', 'buyer-reviews@example.com', true);

select isnt_empty(
  $$
    select 1
    from public.review_responses
    where review_id = current_setting('app.review_id')::uuid
  $$,
  'Reviewer sees seller response'
);

reset role;

select finish();

rollback;

