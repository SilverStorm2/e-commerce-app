-- Validate RLS for messaging tables (threads, participants, messages).
begin;

create extension if not exists pgtap;

select plan(9);

-- Deterministic identifiers for reproducible fixtures.
select
  set_config('app.owner_id', '00000000-0000-9000-b000-000000000001', true),
  set_config('app.staff_id', '00000000-0000-9000-b000-000000000002', true),
  set_config('app.buyer_id', '00000000-0000-9000-b000-000000000003', true),
  set_config('app.other_user_id', '00000000-0000-9000-b000-000000000004', true),
  set_config('app.tenant_id', '10000000-0000-9000-b000-000000000010', true),
  set_config('app.thread_id', '20000000-0000-9000-b000-000000000020', true),
  set_config('app.participant_buyer_id', '21000000-0000-9000-b000-000000000021', true),
  set_config('app.participant_owner_id', '21000000-0000-9000-b000-000000000022', true),
  set_config('app.membership_owner_id', '22000000-0000-9000-b000-000000000023', true),
  set_config('app.membership_staff_id', '22000000-0000-9000-b000-000000000024', true),
  set_config('app.message_buyer_id', '30000000-0000-9000-b000-000000000030', true),
  set_config('app.message_staff_id', '30000000-0000-9000-b000-000000000031', true);

-- Seed required users.
with upsert_users as (
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  values
    (current_setting('app.owner_id')::uuid, 'owner-messaging@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.staff_id')::uuid, 'staff-messaging@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.buyer_id')::uuid, 'buyer-messaging@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now()),
    (current_setting('app.other_user_id')::uuid, 'other-messaging@example.com', crypt('Password123!', gen_salt('bf')), now(), now(), now(), jsonb_build_object('provider', 'email', 'providers', array['email']), '{}'::jsonb, 'authenticated', 'authenticated', now(), now())
  on conflict (id) do update
    set email = excluded.email
  returning 1
)
select coalesce(sum(1), 0) from upsert_users;

-- Owner provisions tenant and staff membership.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.owner_id'), true);
select set_config('request.jwt.claim.email', 'owner-messaging@example.com', true);

insert into public.tenants (id, slug, name, created_by)
values (
  current_setting('app.tenant_id')::uuid,
  'messaging-test-store',
  'Messaging Test Store',
  current_setting('app.owner_id')::uuid
)
on conflict (id) do nothing;

insert into public.memberships (id, tenant_id, user_id, role, status)
values
  (
    current_setting('app.membership_owner_id')::uuid,
    current_setting('app.tenant_id')::uuid,
    current_setting('app.owner_id')::uuid,
    'owner',
    'active'
  ),
  (
    current_setting('app.membership_staff_id')::uuid,
    current_setting('app.tenant_id')::uuid,
    current_setting('app.staff_id')::uuid,
    'staff',
    'active'
  )
on conflict (id) do update
  set role = excluded.role,
      status = excluded.status,
      updated_at = now();

reset role;

-- Buyer opens thread and joins as participant.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.buyer_id'), true);
select set_config('request.jwt.claim.email', 'buyer-messaging@example.com', true);

insert into public.threads (id, tenant_id, created_by, subject)
values (
  current_setting('app.thread_id')::uuid,
  current_setting('app.tenant_id')::uuid,
  current_setting('app.buyer_id')::uuid,
  'Need help with my order'
)
on conflict (id) do nothing;

insert into public.thread_participants (id, thread_id, user_id)
values (
  current_setting('app.participant_buyer_id')::uuid,
  current_setting('app.thread_id')::uuid,
  current_setting('app.buyer_id')::uuid
)
on conflict (id) do nothing;

reset role;

-- Store owner subscribes for support context.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.owner_id'), true);
select set_config('request.jwt.claim.email', 'owner-messaging@example.com', true);

insert into public.thread_participants (id, thread_id, user_id, role)
values (
  current_setting('app.participant_owner_id')::uuid,
  current_setting('app.thread_id')::uuid,
  current_setting('app.owner_id')::uuid,
  'support'
)
on conflict (id) do update
  set role = excluded.role,
      updated_at = now();

reset role;

-- Buyer posts first message.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.buyer_id'), true);
select set_config('request.jwt.claim.email', 'buyer-messaging@example.com', true);

insert into public.messages (id, thread_id, sender_user_id, body)
values (
  current_setting('app.message_buyer_id')::uuid,
  current_setting('app.thread_id')::uuid,
  current_setting('app.buyer_id')::uuid,
  'Can someone help with my delivery?'
)
on conflict (id) do nothing;

reset role;

-- Thread timestamp bumped after message insert.
select ok(
  (
    select last_message_at is not null
    from public.threads
    where id = current_setting('app.thread_id')::uuid
  ),
  'Thread last_message_at updates when a message arrives'
);

-- Participant reads messages normally.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.buyer_id'), true);
select set_config('request.jwt.claim.email', 'buyer-messaging@example.com', true);

select isnt_empty(
  $$
    select 1
    from public.messages
    where thread_id = current_setting('app.thread_id')::uuid
  $$,
  'Participant can read their thread messages'
);

reset role;

-- Unrelated user cannot read thread messages.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.other_user_id'), true);
select set_config('request.jwt.claim.email', 'other-messaging@example.com', true);

select is_empty(
  $$
    select 1
    from public.messages
    where thread_id = current_setting('app.thread_id')::uuid
  $$,
  'Unrelated user blocked from reading thread messages'
);

reset role;

-- Tenant support can drop in without explicit participant row.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.staff_id'), true);
select set_config('request.jwt.claim.email', 'staff-messaging@example.com', true);

select isnt_empty(
  $$
    select 1
    from public.messages
    where thread_id = current_setting('app.thread_id')::uuid
  $$,
  'Tenant support member can read messages without a participant record'
);

reset role;

-- Tenant support replies while dropping in.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.staff_id'), true);
select set_config('request.jwt.claim.email', 'staff-messaging@example.com', true);

select lives_ok(
  $$
    insert into public.messages (id, thread_id, sender_user_id, body)
    values (
      current_setting('app.message_staff_id')::uuid,
      current_setting('app.thread_id')::uuid,
      current_setting('app.staff_id')::uuid,
      'Hi, I will check the shipping status and follow up.'
    )
  $$,
  'Tenant support member can reply without explicit participant enrollment'
);

reset role;

-- Participant observes both messages.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.buyer_id'), true);
select set_config('request.jwt.claim.email', 'buyer-messaging@example.com', true);

select results_eq(
  $$
    select count(*)::int
    from public.messages
    where thread_id = current_setting('app.thread_id')::uuid
  $$,
  $$ values (2) $$,
  'Buyer sees both their message and the support response'
);

reset role;

-- Participant updates read receipts.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.buyer_id'), true);
select set_config('request.jwt.claim.email', 'buyer-messaging@example.com', true);

select lives_ok(
  $$
    update public.thread_participants
    set
      last_read_at = now(),
      last_read_message_id = current_setting('app.message_staff_id')::uuid
    where id = current_setting('app.participant_buyer_id')::uuid
  $$,
  'Participant can update their read receipt markers'
);

select ok(
  (
    select last_read_message_id = current_setting('app.message_staff_id')::uuid
    from public.thread_participants
    where id = current_setting('app.participant_buyer_id')::uuid
  ),
  'Read receipt persists latest message id'
);

reset role;

-- Outsider cannot tamper with someone else's read receipts.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.other_user_id'), true);
select set_config('request.jwt.claim.email', 'other-messaging@example.com', true);

select throws_like(
  $$
    update public.thread_participants
    set last_read_at = now()
    where id = current_setting('app.participant_buyer_id')::uuid
  $$,
  'permission denied%',
  'RLS prevents outsiders from updating read receipts'
);

reset role;

select finish();

rollback;
