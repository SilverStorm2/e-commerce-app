import { describe, expect, it, vi } from "vitest";

import { initChatRealtime } from "@/lib/realtime/chat";
import type { Database } from "@/types/supabase";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["thread_participants"]["Row"];

type PresenceRecord = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastSeenAt: string;
};

class MockChannel {
  public handlers: {
    insert?: (payload: { new: MessageRow }) => void;
    update?: (payload: { new: MessageRow }) => void;
    participant?: (payload: {
      new?: ParticipantRow;
      old?: ParticipantRow;
      eventType: string;
    }) => void;
    presence?: () => void;
    typing?: (payload: { payload: { userId: string; isTyping: boolean; at: string } }) => void;
  } = {};

  public subscribeCallback: ((status: string) => Promise<void> | void) | null = null;
  public presenceStateValue: Record<string, PresenceRecord[]> = {};
  public sentPayloads: unknown[] = [];
  public trackedPayloads: unknown[] = [];

  constructor(
    public readonly name: string,
    public readonly config: unknown,
  ) {}

  on(event: string, filter: Record<string, unknown>, callback: (...args: any[]) => void) {
    if (event === "postgres_changes") {
      const table = filter.table as string;
      const eventType = (filter.event as string) ?? "*";
      if (table === "messages" && eventType === "INSERT") {
        this.handlers.insert = callback as (payload: { new: MessageRow }) => void;
      } else if (table === "messages" && eventType === "UPDATE") {
        this.handlers.update = callback as (payload: { new: MessageRow }) => void;
      } else if (table === "thread_participants") {
        this.handlers.participant = callback as (payload: {
          new?: ParticipantRow;
          old?: ParticipantRow;
          eventType: string;
        }) => void;
      }
    } else if (event === "presence") {
      this.handlers.presence = callback as () => void;
    } else if (event === "broadcast") {
      this.handlers.typing = callback as (payload: {
        payload: { userId: string; isTyping: boolean; at: string };
      }) => void;
    }
    return this;
  }

  subscribe(callback: (status: string) => Promise<void> | void) {
    this.subscribeCallback = callback;
    return this;
  }

  async track(payload: unknown) {
    this.trackedPayloads.push(payload);
  }

  async send(payload: unknown) {
    this.sentPayloads.push(payload);
    return { status: "ok" };
  }

  presenceState() {
    return this.presenceStateValue;
  }
}

class MockSupabaseClient {
  public lastChannel: MockChannel | null = null;
  public removeChannel = vi.fn();

  channel(name: string, config: unknown) {
    const channel = new MockChannel(name, config);
    this.lastChannel = channel;
    return channel;
  }
}

describe("initChatRealtime", () => {
  it("wires channel handlers and supports typing broadcasts", async () => {
    const client = new MockSupabaseClient();
    const onMessageInserted = vi.fn();
    const onMessageUpdated = vi.fn();
    const onParticipantUpsert = vi.fn();
    const onParticipantDelete = vi.fn();
    const onPresenceSync = vi.fn();
    const onTyping = vi.fn();

    const connection = initChatRealtime(
      {
        client: client as unknown as {
          channel: typeof client.channel;
          removeChannel: typeof client.removeChannel;
        },
        threadId: "thread-1",
        currentUserId: "user-1",
        trackPayload: {
          displayName: "Alice",
          avatarUrl: null,
        },
      },
      {
        onMessageInserted,
        onMessageUpdated,
        onParticipantUpsert,
        onParticipantDelete,
        onPresenceSync,
        onTyping,
      },
    );

    const channel = client.lastChannel;
    expect(channel).not.toBeNull();
    expect(channel?.config).toMatchObject({
      config: { presence: { key: "user-1" } },
    });

    const messageRow: MessageRow = {
      id: "m-1",
      thread_id: "thread-1",
      tenant_id: null,
      sender_user_id: "user-2",
      message_type: "text",
      body: "Hello",
      metadata: {},
      reply_to_message_id: null,
      is_deleted: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      edited_at: null,
    };

    channel!.handlers.insert?.({ new: messageRow });
    expect(onMessageInserted).toHaveBeenCalledWith(messageRow);

    channel!.handlers.update?.({ new: { ...messageRow, body: "Updated" } });
    expect(onMessageUpdated).toHaveBeenCalledTimes(1);

    const participantRow: ParticipantRow = {
      id: "p-1",
      thread_id: "thread-1",
      tenant_id: null,
      user_id: "user-3",
      role: "participant",
      last_read_at: null,
      last_read_message_id: null,
      is_muted: false,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    channel!.handlers.participant?.({ eventType: "INSERT", new: participantRow });
    expect(onParticipantUpsert).toHaveBeenCalledWith(participantRow);

    channel!.handlers.participant?.({ eventType: "DELETE", old: participantRow });
    expect(onParticipantDelete).toHaveBeenCalledWith(participantRow);

    const presenceRecord: PresenceRecord = {
      userId: "user-2",
      displayName: "Bob",
      avatarUrl: null,
      lastSeenAt: new Date().toISOString(),
    };
    channel!.presenceStateValue = {
      "user-2": [presenceRecord],
    };

    if (channel?.subscribeCallback) {
      await channel.subscribeCallback("SUBSCRIBED");
    }
    expect(channel!.trackedPayloads[0]).toMatchObject({
      userId: "user-1",
      displayName: "Alice",
    });
    expect(onPresenceSync).toHaveBeenCalledWith(channel!.presenceStateValue);

    await connection.sendTyping(true);
    expect(channel!.sentPayloads).toHaveLength(1);
    expect(channel!.sentPayloads[0]).toMatchObject({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: "user-1",
        isTyping: true,
      },
    });

    channel!.handlers.typing?.({
      payload: { userId: "user-2", isTyping: true, at: new Date().toISOString() },
    });
    expect(onTyping).toHaveBeenCalledWith({
      userId: "user-2",
      isTyping: true,
      at: expect.any(String),
    });
  });
});
