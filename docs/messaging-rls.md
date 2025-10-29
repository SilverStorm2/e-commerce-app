# Messaging Tables & RLS Summary

## Tables

- `threads` - container for buyer <-> seller/support conversations. Tracks `tenant_id`, `created_by`, optional subject, JSON metadata, and `last_message_at` for ordering inboxes.
- `messages` - chat payloads with `message_type` (`text|system|file`), soft-delete fields, and `metadata` for attachments. Tenant context is inherited via trigger to prevent cross-tenant leakage.
- `thread_participants` - membership records linking users to threads, including support/system roles, read receipts (`last_read_at`, `last_read_message_id`), mute flags, and per-user metadata.

## Business Rules

- Any authenticated user can open a thread with a store; `created_by` is enforced by RLS and drives the initial participant record.
- Explicit participants, tenant support staff (owner/manager/staff/contractor), and platform admins may read thread metadata and messages.
- Tenant support members can respond without an explicit participant row (support drop-in) but may add themselves to subscribe for realtime presence.
- Read receipts are scoped per participant; users update their own markers while tenant support/admins may manage support participants during escalations.

## RLS Overview

- Policies are implemented in `supabase/migrations/0009_messaging.sql` and summarized in `supabase/policies/messaging.sql`.
- Helper triggers:
  - `app_hidden.ensure_thread_participant_defaults` copies tenant affinity from the parent thread and blocks cross-tenant inserts.
  - `app_hidden.ensure_message_defaults` enforces tenant inheritance and prevents moving a message between threads.
  - `app_hidden.bump_thread_last_message` refreshes `last_message_at` and `updated_at` whenever a new message arrives.
- Access highlights:
  - `threads_select_allowed` grants visibility to participants, tenant staff, and platform admins.
  - `messages_insert_allowed` requires `auth.uid() = sender_user_id` and participant or tenant-support status.
  - `thread_participants_update_allowed` lets participants maintain their own read receipts/mute state while granting support/admin override.

## Testing

- `supabase/tests/rls.messaging.spec.sql` validates key flows with pgTAP:
  1. Participant can read messages and last-message timestamp updates on send.
  2. Tenant support without a participant row can read and reply in a buyer thread.
  3. Unrelated users are denied access to threads/messages and cannot tamper with read receipts.
  4. Read receipt updates succeed for participants and persist latest message pointer.
