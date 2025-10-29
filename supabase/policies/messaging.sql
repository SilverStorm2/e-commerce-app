-- M4-DB-MSG policy snapshot.
-- Policies defined in supabase/migrations/0009_messaging.sql for direct messaging tables.
-- Reference file only; changes should be made in the migration.

-- threads
--   threads_select_allowed    -- Participant, tenant staff (owner/manager/staff/contractor), or platform admin can read.
--   threads_insert_author     -- auth.uid() creator or platform admin can open a new thread row.
--   threads_update_allowed    -- Participants, tenant staff, or platform admin may adjust metadata/subject.
--   threads_delete_restricted -- Creator or platform admin can delete (prefer soft-delete at application layer).

-- thread_participants
--   thread_participants_select_allowed -- Participant sees own record; tenant staff/platform admin can audit members.
--   thread_participants_insert_allowed -- User self-enrolls; tenant staff/platform admin can add support/system participants.
--   thread_participants_update_allowed -- Participants update read receipts/mute flags; tenant staff/platform admin maintain support entries.
--   thread_participants_delete_allowed -- Participants or tenant staff/platform admin remove memberships during offboarding.

-- messages
--   messages_select_allowed   -- Participants, tenant staff (support roles), or platform admin can read thread messages.
--   messages_insert_allowed   -- Sender must be auth.uid() and either participant or tenant staff/platform admin.
--   messages_update_allowed   -- Sender edits their own message; tenant staff/platform admin can moderate.
--   messages_delete_allowed   -- Sender or tenant staff/platform admin can soft-delete via flag.
