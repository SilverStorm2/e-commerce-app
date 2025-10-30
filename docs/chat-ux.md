# Chat UI & Realtime Notes

## Overview

- Server route `app/[locale]/messages/[threadId]/page.tsx` resolves the thread, participants, and recent message batch via Supabase SSR client.
- Client component `components/messages/chat-thread.tsx` hydrates realtime data, drives the message list, composer, presence, typing indicator, and read receipts.
- Supabase Realtime channel `chat:thread:{threadId}` wires:
  - `postgres_changes` for messages (insert/update) and thread participants (insert/update/delete)
  - Presence tracking with payload `{ userId, displayName, avatarUrl, lastSeenAt }`
  - Broadcast `typing` events `{ userId, isTyping, at }`

## Interaction Model

- Initial render scrolls to the latest message and attempts to update read receipts when the viewer is at the bottom of the feed.
- Message composer supports optional file attachment (single file for MVP) stored in the `message-attachments` bucket. Metadata is stored on the message row in `metadata.attachment`.
- Attachments create short-lived signed URLs on demand; duplicated clicks reuse the memoised link.
- Typing status broadcasts as the user types and auto-resets after 1.5s of inactivity.
- Presence list merges explicit participants and drop-in tenant support accounts (who can join without a participant row).

## Error Handling

- Failed uploads trigger inline alerts and attempt to remove orphaned storage objects.
- Message send errors surface to the composer and the draft remains for correction.
- Attachment fetch failures show a warning and keep the download button visible for retry.

## i18n & Accessibility

- Strings live under `dictionary.messages.*` with PL/EN parity, including presence verbs and read receipt templates.
- Composer enforces the 8k character limit from the database constraint and exposes live character count.
- Read receipts summarise participants (excluding the viewer) with dictionary-driven templates.
