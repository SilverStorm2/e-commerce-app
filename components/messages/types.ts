import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/pl";
import type { Database, Json } from "@/types/supabase";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["thread_participants"]["Row"];
type ThreadRow = Database["public"]["Tables"]["threads"]["Row"];

export type ChatMessage = Omit<MessageRow, "metadata"> & {
  metadata: Record<string, unknown>;
};

export type ChatParticipant = Omit<ParticipantRow, "metadata"> & {
  metadata: Record<string, unknown>;
};

export type ChatThreadSummary = Omit<ThreadRow, "metadata"> & {
  metadata: Record<string, unknown>;
};

export type ChatProfile = {
  displayName: string | null;
  avatarUrl: string | null;
};

export type ChatProfileMap = Record<string, ChatProfile>;

export type ChatDictionary = Dictionary["messages"];

export type ChatAttachmentMetadata = {
  storagePath: string;
  bucket?: string;
  fileName: string;
  size: number;
  contentType: string;
};

export function ensureRecord(value: Json | Record<string, unknown>): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function parseAttachment(metadata: Record<string, unknown>): ChatAttachmentMetadata | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const raw = (metadata as Record<string, unknown>).attachment as
    | Record<string, unknown>
    | undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const storagePath = typeof raw.storagePath === "string" ? raw.storagePath : null;
  const fileName = typeof raw.fileName === "string" ? raw.fileName : null;
  const size = typeof raw.size === "number" ? raw.size : null;
  const contentType =
    typeof raw.contentType === "string" && raw.contentType.length > 0
      ? raw.contentType
      : "application/octet-stream";

  if (!storagePath || !fileName || size === null) {
    return null;
  }

  const bucket = typeof raw.bucket === "string" ? raw.bucket : undefined;

  return {
    storagePath,
    bucket,
    fileName,
    size,
    contentType,
  };
}

export type ChatThreadHydration = {
  locale: Locale;
  currentUserId: string;
  thread: ChatThreadSummary;
  messages: ChatMessage[];
  participants: ChatParticipant[];
  profiles: ChatProfileMap;
  dictionary: ChatDictionary;
};
