import { notFound, redirect } from "next/navigation";

import { ChatThread } from "@/components/messages/chat-thread";
import {
  ensureRecord,
  type ChatMessage,
  type ChatParticipant,
  type ChatProfileMap,
  type ChatThreadHydration,
  type ChatThreadSummary,
} from "@/components/messages/types";
import { locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type ThreadMessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ThreadParticipantRow = Database["public"]["Tables"]["thread_participants"]["Row"];
type ThreadRow = Database["public"]["Tables"]["threads"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type ThreadPageProps = {
  params: {
    locale: Locale;
    threadId: string;
  };
};

function sortMessagesAscending(messages: ThreadMessageRow[]): ThreadMessageRow[] {
  return [...messages].sort((first, second) => {
    const firstTime = new Date(first.created_at).getTime();
    const secondTime = new Date(second.created_at).getTime();
    return firstTime - secondTime;
  });
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { locale, threadId } = params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: threadRow, error: threadError } = await supabase
    .from("threads")
    .select(
      `
        id,
        tenant_id,
        created_by,
        subject,
        metadata,
        last_message_at,
        created_at,
        updated_at,
        thread_participants (
          id,
          user_id,
          role,
          last_read_at,
          last_read_message_id,
          is_muted,
          metadata,
          created_at,
          updated_at,
          tenant_id
        ),
        messages (
          id,
          thread_id,
          tenant_id,
          sender_user_id,
          message_type,
          body,
          metadata,
          reply_to_message_id,
          is_deleted,
          deleted_at,
          created_at,
          updated_at,
          edited_at
        )
      `,
    )
    .eq("id", threadId)
    .order("created_at", { ascending: true, referencedTable: "messages" })
    .maybeSingle<
      ThreadRow & { thread_participants: ThreadParticipantRow[]; messages: ThreadMessageRow[] }
    >();

  if (threadError || !threadRow) {
    notFound();
  }

  const messages = sortMessagesAscending(
    Array.isArray(threadRow.messages) ? threadRow.messages : [],
  );
  const participants = Array.isArray(threadRow.thread_participants)
    ? threadRow.thread_participants
    : [];

  const profileIds = new Set<string>();
  participants.forEach((participant) => {
    profileIds.add(participant.user_id);
  });
  messages.forEach((message) => {
    profileIds.add(message.sender_user_id);
  });

  let profiles: ProfileRow[] = [];
  if (profileIds.size > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", Array.from(profileIds));

    profiles = Array.isArray(profileRows) ? profileRows : [];
  }

  const profileMap = profiles.reduce<ChatProfileMap>((accumulator, profile) => {
    accumulator[profile.user_id] = {
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
    };
    return accumulator;
  }, {});

  const dictionary = await getDictionary(locale);

  const thread: ChatThreadSummary = {
    id: threadRow.id,
    tenant_id: threadRow.tenant_id,
    created_by: threadRow.created_by,
    subject: threadRow.subject,
    metadata: ensureRecord(threadRow.metadata),
    last_message_at: threadRow.last_message_at,
    created_at: threadRow.created_at,
    updated_at: threadRow.updated_at,
  };

  const initialMessages: ChatMessage[] = messages.map((message) => ({
    ...message,
    metadata: ensureRecord(message.metadata),
  }));

  const initialParticipants: ChatParticipant[] = participants.map((participant) => ({
    ...participant,
    metadata: ensureRecord(participant.metadata),
  }));

  const hydration: ChatThreadHydration = {
    locale,
    currentUserId: user.id,
    thread,
    messages: initialMessages,
    participants: initialParticipants,
    profiles: profileMap,
    dictionary: dictionary.messages,
  };

  return <ChatThread {...hydration} />;
}
