-- M4-DB-MSG
-- Direct messaging threads, participants, and messages with tenant support access.

begin;

-- Enumerations for messaging domain.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'thread_participant_role') then
    create type public.thread_participant_role as enum ('participant', 'support', 'system');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_type') then
    create type public.message_type as enum ('text', 'system', 'file');
  end if;
end
$$;

-- Thread metadata (buyer <-> seller / internal support).
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  subject text,
  metadata jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists threads_tenant_idx on public.threads (tenant_id);
create index if not exists threads_last_message_idx on public.threads (last_message_at desc nulls last);

-- Messages exchanged within a thread.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  sender_user_id uuid not null references auth.users (id) on delete restrict,
  message_type public.message_type not null default 'text',
  body text not null check (char_length(body) <= 8000),
  metadata jsonb not null default '{}'::jsonb,
  reply_to_message_id uuid references public.messages (id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists messages_thread_idx on public.messages (thread_id, created_at asc);
create index if not exists messages_sender_idx on public.messages (sender_user_id);

-- Participants per thread, including last-read markers.
create table if not exists public.thread_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.thread_participant_role not null default 'participant',
  last_read_at timestamptz,
  last_read_message_id uuid references public.messages (id) on delete set null,
  is_muted boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint thread_participants_unique unique (thread_id, user_id)
);

create index if not exists thread_participants_user_idx on public.thread_participants (user_id);
create index if not exists thread_participants_thread_idx on public.thread_participants (thread_id);

-- Ensure participant rows inherit thread tenant context.
create or replace function app_hidden.ensure_thread_participant_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  thread_row public.threads%rowtype;
begin
  select *
    into thread_row
  from public.threads
  where id = new.thread_id;

  if thread_row is null then
    raise exception 'Thread % not found for participant', new.thread_id;
  end if;

  if new.tenant_id is null then
    new.tenant_id := thread_row.tenant_id;
  elsif thread_row.tenant_id is not null and new.tenant_id <> thread_row.tenant_id then
    raise exception 'Participant tenant mismatch for thread %', new.thread_id;
  end if;

  return new;
end;
$$;

-- Ensure messages inherit thread tenant and forbid retargeting.
create or replace function app_hidden.ensure_message_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  thread_row public.threads%rowtype;
  reply_thread_id uuid;
begin
  select *
    into thread_row
  from public.threads
  where id = new.thread_id;

  if thread_row is null then
    raise exception 'Thread % not found for message', new.thread_id;
  end if;

  if tg_op = 'UPDATE' then
    if new.thread_id <> old.thread_id then
      raise exception 'Message cannot be moved between threads';
    end if;
  end if;

  if new.tenant_id is null then
    new.tenant_id := thread_row.tenant_id;
  elsif thread_row.tenant_id is not null and new.tenant_id <> thread_row.tenant_id then
    raise exception 'Message tenant mismatch for thread %', new.thread_id;
  end if;

  if new.reply_to_message_id is not null then
    select m.thread_id
      into reply_thread_id
    from public.messages m
    where m.id = new.reply_to_message_id;

    if reply_thread_id is null then
      raise exception 'Reply target % not found', new.reply_to_message_id;
    elsif reply_thread_id <> new.thread_id then
      raise exception 'Reply must reference a message within the same thread';
    end if;
  end if;

  return new;
end;
$$;

-- Update thread timestamps on message changes.
create or replace function app_hidden.bump_thread_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.threads
  set
    last_message_at = greatest(coalesce(last_message_at, '-infinity'::timestamptz), coalesce(new.created_at, now())),
    updated_at = now()
  where id = new.thread_id;

  return null;
end;
$$;

-- Attach triggers.
drop trigger if exists ensure_thread_participant_defaults_before_write on public.thread_participants;
create trigger ensure_thread_participant_defaults_before_write
before insert or update on public.thread_participants
for each row
execute function app_hidden.ensure_thread_participant_defaults();

drop trigger if exists ensure_message_defaults_before_write on public.messages;
create trigger ensure_message_defaults_before_write
before insert or update on public.messages
for each row
execute function app_hidden.ensure_message_defaults();

drop trigger if exists bump_thread_last_message_after_insert on public.messages;
create trigger bump_thread_last_message_after_insert
after insert on public.messages
for each row
execute function app_hidden.bump_thread_last_message();

drop trigger if exists touch_threads_updated_at on public.threads;
create trigger touch_threads_updated_at
before update on public.threads
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists touch_thread_participants_updated_at on public.thread_participants;
create trigger touch_thread_participants_updated_at
before update on public.thread_participants
for each row
execute function app_hidden.touch_updated_at();

drop trigger if exists touch_messages_updated_at on public.messages;
create trigger touch_messages_updated_at
before update on public.messages
for each row
execute function app_hidden.touch_updated_at();

-- Enable RLS.
alter table public.threads enable row level security;
alter table public.threads force row level security;

alter table public.thread_participants enable row level security;
alter table public.thread_participants force row level security;

alter table public.messages enable row level security;
alter table public.messages force row level security;

-- Helper predicate: user participates in thread.
create or replace view app_hidden.thread_access as
select distinct
  t.id as thread_id,
  tp.user_id as participant_user_id
from public.threads t
join public.thread_participants tp on tp.thread_id = t.id;

-- Threads policies.
create policy threads_select_allowed on public.threads
for select
using (
  exists (
    select 1
    from public.thread_participants tp
    where tp.thread_id = threads.id
      and tp.user_id = auth.uid()
  )
  or (
    tenant_id is not null
    and app_hidden.is_tenant_member(
      tenant_id,
      array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
    )
  )
  or app_hidden.is_platform_admin()
);

create policy threads_insert_author on public.threads
for insert
with check (
  auth.uid() = created_by
  or app_hidden.is_platform_admin()
);

create policy threads_update_allowed on public.threads
for update
using (
  exists (
    select 1
    from public.thread_participants tp
    where tp.thread_id = threads.id
      and tp.user_id = auth.uid()
  )
  or (
    tenant_id is not null
    and app_hidden.is_tenant_member(
      tenant_id,
      array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
    )
  )
  or app_hidden.is_platform_admin()
)
with check (
  (
    exists (
      select 1
      from public.thread_participants tp
      where tp.thread_id = threads.id
        and tp.user_id = auth.uid()
    )
    or (
      tenant_id is not null
      and app_hidden.is_tenant_member(
        tenant_id,
        array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
      )
    )
    or app_hidden.is_platform_admin()
  )
);

create policy threads_delete_restricted on public.threads
for delete
using (
  auth.uid() = created_by
  or app_hidden.is_platform_admin()
);

-- Thread participants policies.
create policy thread_participants_select_allowed on public.thread_participants
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.threads t
    where t.id = thread_participants.thread_id
      and (
        app_hidden.is_platform_admin()
        or (
          t.tenant_id is not null
          and app_hidden.is_tenant_member(
            t.tenant_id,
            array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
          )
        )
      )
  )
);

create policy thread_participants_insert_allowed on public.thread_participants
for insert
with check (
  user_id = auth.uid()
  or app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.threads t
    where t.id = thread_participants.thread_id
      and t.tenant_id is not null
      and app_hidden.is_tenant_member(
        t.tenant_id,
        array['owner', 'manager', 'staff']::public.membership_role[]
      )
  )
);

create policy thread_participants_update_allowed on public.thread_participants
for update
using (
  user_id = auth.uid()
  or app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.threads t
    where t.id = thread_participants.thread_id
      and t.tenant_id is not null
      and app_hidden.is_tenant_member(
        t.tenant_id,
        array['owner', 'manager', 'staff']::public.membership_role[]
      )
  )
)
with check (
  user_id = auth.uid()
  or app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.threads t
    where t.id = thread_participants.thread_id
      and t.tenant_id is not null
      and app_hidden.is_tenant_member(
        t.tenant_id,
        array['owner', 'manager', 'staff']::public.membership_role[]
      )
  )
);

create policy thread_participants_delete_allowed on public.thread_participants
for delete
using (
  user_id = auth.uid()
  or app_hidden.is_platform_admin()
  or exists (
    select 1
    from public.threads t
    where t.id = thread_participants.thread_id
      and t.tenant_id is not null
      and app_hidden.is_tenant_member(
        t.tenant_id,
        array['owner', 'manager', 'staff']::public.membership_role[]
      )
  )
);

-- Messages policies.
create policy messages_select_allowed on public.messages
for select
using (
  exists (
    select 1
    from public.thread_participants tp
    where tp.thread_id = messages.thread_id
      and tp.user_id = auth.uid()
  )
  or (
    tenant_id is not null
    and app_hidden.is_tenant_member(
      tenant_id,
      array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
    )
  )
  or app_hidden.is_platform_admin()
);

create policy messages_insert_allowed on public.messages
for insert
with check (
  auth.uid() = sender_user_id
  and (
    exists (
      select 1
      from public.thread_participants tp
      where tp.thread_id = messages.thread_id
        and tp.user_id = auth.uid()
    )
    or (
      tenant_id is not null
      and app_hidden.is_tenant_member(
        tenant_id,
        array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
      )
    )
    or app_hidden.is_platform_admin()
  )
);

create policy messages_update_allowed on public.messages
for update
using (
  auth.uid() = sender_user_id
  or app_hidden.is_platform_admin()
  or (
    tenant_id is not null
    and app_hidden.is_tenant_member(
      tenant_id,
      array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
    )
  )
)
with check (
  auth.uid() = sender_user_id
  or app_hidden.is_platform_admin()
  or (
    tenant_id is not null
    and app_hidden.is_tenant_member(
      tenant_id,
      array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
    )
  )
);

create policy messages_delete_allowed on public.messages
for delete
using (
  auth.uid() = sender_user_id
  or app_hidden.is_platform_admin()
  or (
    tenant_id is not null
    and app_hidden.is_tenant_member(
      tenant_id,
      array['owner', 'manager', 'staff', 'contractor']::public.membership_role[]
    )
  )
);

commit;
