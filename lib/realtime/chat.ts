"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

import type { SupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["thread_participants"]["Row"];

export type ChatPresencePayload = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastSeenAt: string;
};

export type ChatPresenceState = Record<string, ChatPresencePayload[]>;

type TypingPayload = {
  userId: string;
  isTyping: boolean;
  at: string;
};

export type ChatRealtimeHandlers = {
  onMessageInserted?: (message: MessageRow) => void;
  onMessageUpdated?: (message: MessageRow) => void;
  onParticipantUpsert?: (participant: ParticipantRow) => void;
  onParticipantDelete?: (participant: ParticipantRow) => void;
  onPresenceSync?: (presence: ChatPresenceState) => void;
  onTyping?: (payload: TypingPayload) => void;
};

export type ChatRealtimeOptions = {
  client: SupabaseBrowserClient;
  threadId: string;
  currentUserId: string;
  trackPayload?: Omit<ChatPresencePayload, "userId" | "lastSeenAt">;
};

export type ChatRealtimeConnection = {
  channel: RealtimeChannel;
  sendTyping: (isTyping: boolean) => Promise<void>;
};

function presenceStateFromChannel(channel: RealtimeChannel): ChatPresenceState {
  return channel.presenceState() as ChatPresenceState;
}

export function initChatRealtime(
  options: ChatRealtimeOptions,
  handlers: ChatRealtimeHandlers,
): ChatRealtimeConnection {
  const channel = options.client.channel(`chat:thread:${options.threadId}`, {
    config: {
      presence: {
        key: options.currentUserId,
      },
    },
  });

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `thread_id=eq.${options.threadId}`,
    },
    (payload) => {
      const message = payload.new as MessageRow | null;
      if (message) {
        handlers.onMessageInserted?.(message);
      }
    },
  );

  channel.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "messages",
      filter: `thread_id=eq.${options.threadId}`,
    },
    (payload) => {
      const message = payload.new as MessageRow | null;
      if (message) {
        handlers.onMessageUpdated?.(message);
      }
    },
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "thread_participants",
      filter: `thread_id=eq.${options.threadId}`,
    },
    (payload) => {
      if (payload.eventType === "DELETE") {
        const previous = payload.old as ParticipantRow | null;
        if (previous) {
          handlers.onParticipantDelete?.(previous);
        }
        return;
      }

      const participant = payload.new as ParticipantRow | null;
      if (participant) {
        handlers.onParticipantUpsert?.(participant);
      }
    },
  );

  channel.on("presence", { event: "sync" }, () => {
    handlers.onPresenceSync?.(presenceStateFromChannel(channel));
  });

  channel.on("broadcast", { event: "typing" }, (payload) => {
    const typingPayload = payload.payload as TypingPayload | null;
    if (typingPayload?.userId) {
      handlers.onTyping?.(typingPayload);
    }
  });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      const nowIso = new Date().toISOString();
      await channel.track({
        userId: options.currentUserId,
        lastSeenAt: nowIso,
        displayName: options.trackPayload?.displayName ?? null,
        avatarUrl: options.trackPayload?.avatarUrl ?? null,
      });
      handlers.onPresenceSync?.(presenceStateFromChannel(channel));
    }
  });

  return {
    channel,
    async sendTyping(isTyping: boolean) {
      await channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: options.currentUserId,
          isTyping,
          at: new Date().toISOString(),
        },
      });
    },
  };
}
