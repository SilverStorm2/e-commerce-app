-- Verify tenancy RLS behaviour for core tables and helper views.
begin;

create extension if not exists pgtap;

select plan(6);

-- Deterministic test identities.
with upsert_users as (
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  values
    ('00000000-0000-4000-a000-000000000001', 'user-a@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-4000-a000-000000000002', 'user-b@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-4000-a000-0000000000aa', 'admin@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now())
  on conflict (id) do update
    set email = excluded.email
  returning 1
)
select coalesce(sum(1), 0) from upsert_users;

-- Ensure admin user is linked to platform_admins (without persisting changes).
insert into public.platform_admins (email, user_id, note)
values ('admin@example.com', '00000000-0000-4000-a000-0000000000aa', 'Test admin linkage')
on conflict (email) do update
  set user_id = excluded.user_id,
      note = excluded.note;

-- Simulate user A creating a tenant (trigger should grant owner membership).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000001', true);
select set_config('request.jwt.claim.email', 'user-a@example.com', true);

insert into public.tenants (slug, name)
values ('test-sklep-a', 'Test Sklep A');

reset role;

select ok(
  exists(
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where t.slug = 'test-sklep-a'
      and m.user_id = '00000000-0000-4000-a000-000000000001'
      and m.role = 'owner'::public.membership_role
  ),
  'Owner membership auto-created for tenant creator'
);

-- Non-member should not see tenant data.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000002', true);
select set_config('request.jwt.claim.email', 'user-b@example.com', true);

select is_empty(
  $$ select 1 from public.tenants where slug = 'test-sklep-a' $$,
  'Non-member cannot see tenant row'
);

select is_empty(
  $$ select 1 from app_public.my_active_tenants where slug = 'test-sklep-a' $$,
  'Non-member sees no rows in my_active_tenants view'
);

reset role;

-- Member should be able to read tenant and view.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000001', true);
select set_config('request.jwt.claim.email', 'user-a@example.com', true);

select isnt_empty(
  $$ select 1 from public.tenants where slug = 'test-sklep-a' $$,
  'Member can read own tenant'
);

select isnt_empty(
  $$ select 1 from app_public.my_active_tenants where slug = 'test-sklep-a' $$,
  'Member sees tenant in my_active_tenants view'
);

reset role;

-- Platform admin can read tenant regardless of membership.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-0000000000aa', true);
select set_config('request.jwt.claim.email', 'admin@example.com', true);

select isnt_empty(
  $$ select 1 from public.tenants where slug = 'test-sklep-a' $$,
  'Platform admin can view any tenant'
);

reset role;

select finish();

rollback;
