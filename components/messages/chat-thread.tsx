"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Paperclip, Send, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient, type SupabaseBrowserClient } from "@/lib/supabaseClient";
import { initChatRealtime, type ChatPresenceState } from "@/lib/realtime/chat";
import type { Database } from "@/types/supabase";

import {
  ensureRecord,
  parseAttachment,
  type ChatAttachmentMetadata,
  type ChatDictionary,
  type ChatMessage,
  type ChatParticipant,
  type ChatProfileMap,
  type ChatThreadHydration,
} from "./types";

const ATTACHMENTS_BUCKET = "message-attachments";
const TYPING_TIMEOUT_MS = 1500;
const TYPING_CLEANUP_INTERVAL_MS = 1000;
const AUTO_SCROLL_THRESHOLD_PX = 128;

type MessagesInsertPayload = Database["public"]["Tables"]["messages"]["Insert"];

type MessageBubbleProps = {
  message: ChatMessage;
  isOwn: boolean;
  locale: string;
  name: string;
  dictionary: ChatDictionary;
  attachmentUrl?: string;
  onRequestAttachment?: (messageId: string, attachment: ChatAttachmentMetadata) => void;
};

type PresenceSummaryProps = {
  onlineUserIds: string[];
  resolveName: (userId: string) => string;
  dictionary: ChatDictionary;
  currentUserId: string;
};

const MESSAGE_COMPOSER_MAX_LENGTH = 8000;

export type ChatThreadProps = ChatThreadHydration;

export function ChatThread(props: ChatThreadProps) {
  const supabaseRef = useRef<SupabaseBrowserClient | null>(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createSupabaseBrowserClient();
  }
  const supabase = supabaseRef.current!;

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    [...props.messages].sort(sortMessages),
  );
  const [participants, setParticipants] = useState<ChatParticipant[]>(props.participants);
  const [profiles, setProfiles] = useState<ChatProfileMap>(props.profiles);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [composerValue, setComposerValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});

  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingBroadcastActiveRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof initChatRealtime> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const profileFetchQueueRef = useRef<Set<string>>(new Set());
  const acknowledgementRef = useRef<string | null>(
    props.participants.find((participant) => participant.user_id === props.currentUserId)
      ?.last_read_message_id ?? null,
  );

  const profilesRef = useRef(profiles);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  const currentParticipant = useMemo(
    () => participants.find((participant) => participant.user_id === props.currentUserId) ?? null,
    [participants, props.currentUserId],
  );

  useEffect(() => {
    acknowledgementRef.current = currentParticipant?.last_read_message_id ?? null;
  }, [currentParticipant?.last_read_message_id]);

  const ensureProfile = useCallback(
    async (userId: string) => {
      if (!userId || profilesRef.current[userId] || profileFetchQueueRef.current.has(userId)) {
        return;
      }

      profileFetchQueueRef.current.add(userId);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .eq("user_id", userId)
          .maybeSingle<ProfileSelection>();

        if (error) {
          return;
        }

        setProfiles((previous) => ({
          ...previous,
          [userId]: {
            displayName: data?.display_name ?? null,
            avatarUrl: data?.avatar_url ?? null,
          },
        }));
      } finally {
        profileFetchQueueRef.current.delete(userId);
      }
    },
    [supabase],
  );

  const handlePresenceSync = useCallback((presence: ChatPresenceState) => {
    const ids = Object.keys(presence ?? {});
    setOnlineUserIds(ids);

    const updates: ChatProfileMap = {};
    ids.forEach((userId) => {
      const entries = presence[userId];
      const latest = entries?.[entries.length - 1];
      if (!latest) {
        return;
      }

      if (!profilesRef.current[userId]) {
        updates[userId] = {
          displayName: latest.displayName ?? null,
          avatarUrl: latest.avatarUrl ?? null,
        };
      }
    });

    if (Object.keys(updates).length > 0) {
      setProfiles((previous) => ({
        ...previous,
        ...updates,
      }));
    }
  }, []);

  const handleTyping = useCallback(
    ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      if (!userId || userId === props.currentUserId) {
        return;
      }

      setTypingUsers((current) => {
        if (!isTyping) {
          if (!(userId in current)) {
            return current;
          }

          const { [userId]: _removed, ...rest } = current;
          return rest;
        }

        const expiresAt = Date.now() + TYPING_TIMEOUT_MS;
        return {
          ...current,
          [userId]: expiresAt,
        };
      });
    },
    [props.currentUserId],
  );

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((current) => {
        const entries = Object.entries(current).filter(([, expires]) => expires > now);
        if (entries.length === Object.keys(current).length) {
          return current;
        }

        return entries.reduce<Record<string, number>>((accumulator, [userId, expires]) => {
          accumulator[userId] = expires;
          return accumulator;
        }, {});
      });
    }, TYPING_CLEANUP_INTERVAL_MS);

    return () => clearInterval(cleanupInterval);
  }, []);

  const handleMessageInserted = useCallback(
    (row: Database["public"]["Tables"]["messages"]["Row"]) => {
      const normalized: ChatMessage = {
        ...row,
        metadata: ensureRecord(row.metadata),
      };

      setMessages((previous) => {
        if (previous.some((message) => message.id === normalized.id)) {
          return previous;
        }

        const next = [...previous, normalized];
        next.sort(sortMessages);
        return next;
      });

      void ensureProfile(normalized.sender_user_id);
    },
    [ensureProfile],
  );

  const handleMessageUpdated = useCallback(
    (row: Database["public"]["Tables"]["messages"]["Row"]) => {
      const normalized: ChatMessage = {
        ...row,
        metadata: ensureRecord(row.metadata),
      };

      setMessages((previous) => {
        const index = previous.findIndex((message) => message.id === normalized.id);
        if (index === -1) {
          return previous;
        }

        const next = [...previous];
        next[index] = normalized;
        return next;
      });
    },
    [],
  );

  const handleParticipantUpsert = useCallback(
    (row: Database["public"]["Tables"]["thread_participants"]["Row"]) => {
      const normalized: ChatParticipant = {
        ...row,
        metadata: ensureRecord(row.metadata),
      };

      setParticipants((previous) => {
        const index = previous.findIndex((participant) => participant.id === normalized.id);
        if (index === -1) {
          return [...previous, normalized];
        }

        const next = [...previous];
        next[index] = normalized;
        return next;
      });

      void ensureProfile(normalized.user_id);
    },
    [ensureProfile],
  );

  const handleParticipantDelete = useCallback(
    (row: Database["public"]["Tables"]["thread_participants"]["Row"]) => {
      setParticipants((previous) => previous.filter((participant) => participant.id !== row.id));
    },
    [],
  );

  useEffect(() => {
    const connection = initChatRealtime(
      {
        client: supabase,
        threadId: props.thread.id,
        currentUserId: props.currentUserId,
        trackPayload: {
          displayName: profilesRef.current[props.currentUserId]?.displayName ?? null,
          avatarUrl: profilesRef.current[props.currentUserId]?.avatarUrl ?? null,
        },
      },
      {
        onMessageInserted: handleMessageInserted,
        onMessageUpdated: handleMessageUpdated,
        onParticipantUpsert: handleParticipantUpsert,
        onParticipantDelete: handleParticipantDelete,
        onPresenceSync: handlePresenceSync,
        onTyping: handleTyping,
      },
    );

    channelRef.current = connection;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current.channel);
        channelRef.current = null;
      }
    };
  }, [
    handleMessageInserted,
    handleMessageUpdated,
    handleParticipantUpsert,
    handleParticipantDelete,
    handlePresenceSync,
    handleTyping,
    props.currentUserId,
    props.thread.id,
    supabase,
  ]);

  const handleScroll = useCallback(() => {
    const container = messageContainerRef.current;
    if (!container) {
      return;
    }

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    autoScrollRef.current = distanceToBottom < AUTO_SCROLL_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const element = messagesEndRef.current;
    if (!element) {
      return;
    }

    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior, block: "end" });
    });
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const latest = messages[messages.length - 1];
    if (autoScrollRef.current || latest.sender_user_id === props.currentUserId) {
      scrollToBottom(latest.sender_user_id === props.currentUserId ? "smooth" : "auto");
    }
  }, [messages, props.currentUserId, scrollToBottom]);

  useEffect(() => {
    if (!currentParticipant || messages.length === 0) {
      return;
    }

    const latest = messages[messages.length - 1];
    if (latest.sender_user_id === props.currentUserId || !autoScrollRef.current) {
      return;
    }

    if (acknowledgementRef.current === latest.id) {
      return;
    }

    const participantSnapshot = currentParticipant;
    const acknowledgedAt = new Date().toISOString();
    acknowledgementRef.current = latest.id;

    setParticipants((previous) =>
      previous.map((participant) =>
        participant.id === participantSnapshot.id
          ? {
              ...participant,
              last_read_at: acknowledgedAt,
              last_read_message_id: latest.id,
            }
          : participant,
      ),
    );

    const updatePayload: ThreadParticipantUpdate = {
      last_read_at: acknowledgedAt,
      last_read_message_id: latest.id,
    };

    void supabase
      .from("thread_participants")
      .update(updatePayload)
      .eq("id", participantSnapshot.id)
      .then(({ error }) => {
        if (error) {
          acknowledgementRef.current = participantSnapshot.last_read_message_id ?? null;
          setParticipants((previous) =>
            previous.map((participant) =>
              participant.id === participantSnapshot.id ? participantSnapshot : participant,
            ),
          );
        }
      });
  }, [currentParticipant, messages, props.currentUserId, supabase]);

  const resolveName = useCallback(
    (userId: string) => {
      if (userId === props.currentUserId) {
        return props.dictionary.presence?.you ?? "You";
      }

      const profile = profiles[userId];
      if (profile?.displayName) {
        return profile.displayName;
      }

      return props.dictionary.presence?.unknown ?? "Participant";
    },
    [
      profiles,
      props.currentUserId,
      props.dictionary.presence?.unknown,
      props.dictionary.presence?.you,
    ],
  );

  const handleComposerChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComposerValue(event.target.value.slice(0, MESSAGE_COMPOSER_MAX_LENGTH));
    setSendError(null);

    if (!channelRef.current) {
      return;
    }

    if (!typingBroadcastActiveRef.current) {
      typingBroadcastActiveRef.current = true;
      void channelRef.current.sendTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      typingBroadcastActiveRef.current = false;
      void channelRef.current?.sendTyping(false);
      typingTimeoutRef.current = null;
    }, TYPING_TIMEOUT_MS);
  }, []);

  const resetTypingState = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (typingBroadcastActiveRef.current) {
      typingBroadcastActiveRef.current = false;
      void channelRef.current?.sendTyping(false);
    }
  }, []);

  const handleComposerBlur = useCallback(() => {
    resetTypingState();
  }, [resetTypingState]);

  const handleFileTrigger = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    event.target.value = "";
  }, []);

  const handleRemoveAttachment = useCallback(() => {
    setSelectedFile(null);
    setAttachmentError(null);
  }, []);

  const createAttachmentPath = useCallback(
    (fileName: string) => {
      const sanitizedName = fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
      const uniqueId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      return `${props.thread.id}/${uniqueId}-${sanitizedName}`;
    },
    [props.thread.id],
  );

  const sendMessage = useCallback(async () => {
    const trimmed = composerValue.trim();
    if (!trimmed && !selectedFile) {
      return;
    }

    setIsSending(true);
    setSendError(null);
    setAttachmentError(null);

    let attachment: ChatAttachmentMetadata | null = null;
    let uploadedObject: { bucket: string; path: string } | null = null;

    try {
      if (selectedFile) {
        const path = createAttachmentPath(selectedFile.name);
        const bucket = ATTACHMENTS_BUCKET;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, selectedFile, {
            contentType: selectedFile.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        attachment = {
          storagePath: path,
          bucket,
          fileName: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type || "application/octet-stream",
        };
        uploadedObject = { bucket, path };
      }

      const insertPayload: MessagesInsertPayload = {
        thread_id: props.thread.id,
        sender_user_id: props.currentUserId,
        body:
          trimmed.length > 0
            ? trimmed
            : selectedFile
              ? selectedFile.name
              : (props.dictionary.composer?.attachmentFallback ?? "."),
        message_type: selectedFile ? "file" : "text",
        metadata: attachment ? { attachment } : {},
      };

      const { data, error } = await supabase
        .from("messages")
        .insert([insertPayload])
        .select("*")
        .single<MessageRowType>();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        const normalized: ChatMessage = {
          ...data,
          metadata: ensureRecord(data.metadata),
        };

        setMessages((previous) => {
          if (previous.some((message) => message.id === normalized.id)) {
            return previous;
          }

          const next = [...previous, normalized];
          next.sort(sortMessages);
          return next;
        });
      }

      setComposerValue("");
      setSelectedFile(null);
      resetTypingState();
    } catch (error) {
      setSendError(
        props.dictionary.composer?.sendError ?? "We could not send this message. Please try again.",
      );

      if (uploadedObject) {
        void supabase.storage.from(uploadedObject.bucket).remove([uploadedObject.path]);
      }
    } finally {
      setIsSending(false);
    }
  }, [
    composerValue,
    createAttachmentPath,
    props.thread.id,
    props.currentUserId,
    props.dictionary.composer?.attachmentFallback,
    props.dictionary.composer?.sendError,
    resetTypingState,
    selectedFile,
    supabase,
  ]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await sendMessage();
    },
    [sendMessage],
  );

  const fetchAttachmentUrl = useCallback(
    async (messageId: string, attachment: ChatAttachmentMetadata) => {
      const bucket = attachment.bucket ?? ATTACHMENTS_BUCKET;
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(attachment.storagePath, 60 * 15);

      if (error || !data?.signedUrl) {
        setAttachmentError(
          props.dictionary.message?.attachmentError ?? "Attachment is not available right now.",
        );
        return;
      }

      setAttachmentUrls((previous) => ({
        ...previous,
        [messageId]: data.signedUrl,
      }));

      if (typeof window !== "undefined") {
        window.open(data.signedUrl, "_blank", "noopener");
      }
    },
    [props.dictionary.message?.attachmentError, supabase],
  );

  const typingUserIds = useMemo(
    () => Object.keys(typingUsers).filter((userId) => typingUsers[userId] > Date.now()),
    [typingUsers],
  );

  const typingLabel = useMemo(() => {
    if (typingUserIds.length === 0) {
      return null;
    }

    if (typingUserIds.length === 1) {
      const template = props.dictionary.typingIndicator?.single ?? "{name} is typing…";
      return formatTemplate(template, { name: resolveName(typingUserIds[0]) });
    }

    const template = props.dictionary.typingIndicator?.multiple ?? "{count} people are typing…";
    return formatTemplate(template, { count: typingUserIds.length });
  }, [
    props.dictionary.typingIndicator?.multiple,
    props.dictionary.typingIndicator?.single,
    resolveName,
    typingUserIds,
  ]);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const readByUserIds = useMemo(() => {
    if (!lastMessage) {
      return [];
    }

    return participants
      .filter(
        (participant) =>
          participant.user_id !== props.currentUserId &&
          participant.last_read_message_id === lastMessage.id,
      )
      .map((participant) => participant.user_id);
  }, [lastMessage, participants, props.currentUserId]);

  const readReceiptLabel = useMemo(() => {
    if (!lastMessage) {
      return props.dictionary.readReceipt?.notSeen ?? "";
    }

    if (readByUserIds.length === 0) {
      return props.dictionary.readReceipt?.notSeen ?? "";
    }

    const names = readByUserIds.map(resolveName).join(", ");
    const template = props.dictionary.readReceipt?.seenBy ?? "Seen by {names}";
    return formatTemplate(template, { names });
  }, [
    lastMessage,
    props.dictionary.readReceipt?.notSeen,
    props.dictionary.readReceipt?.seenBy,
    readByUserIds,
    resolveName,
  ]);

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
      <header className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {props.thread.subject || props.dictionary.header?.fallbackTitle || "Conversation"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatThreadSubtitle(
                props.dictionary.header?.subtitle,
                participants,
                resolveName,
                props.currentUserId,
              )}
            </p>
          </div>
          <PresenceSummary
            dictionary={props.dictionary}
            currentUserId={props.currentUserId}
            onlineUserIds={onlineUserIds}
            resolveName={resolveName}
          />
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div
          ref={messageContainerRef}
          onScroll={handleScroll}
          className="flex-1 space-y-4 overflow-y-auto p-4"
        >
          {messages.length === 0 ? (
            <EmptyState dictionary={props.dictionary} />
          ) : (
            messages.map((message) => {
              const isOwn = message.sender_user_id === props.currentUserId;
              const attachment = parseAttachment(message.metadata);
              const attachmentUrl = attachmentUrls[message.id];

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  locale={props.locale}
                  isOwn={isOwn}
                  name={resolveName(message.sender_user_id)}
                  dictionary={props.dictionary}
                  attachmentUrl={attachmentUrl}
                  onRequestAttachment={
                    attachment
                      ? (messageId) => void fetchAttachmentUrl(messageId, attachment)
                      : undefined
                  }
                />
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <footer className="border-t border-border bg-card p-4">
          {typingLabel ? <p className="mb-2 text-sm text-muted-foreground">{typingLabel}</p> : null}
          {sendError ? (
            <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {sendError}
            </p>
          ) : null}
          {attachmentError ? (
            <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {attachmentError}
            </p>
          ) : null}

          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 rounded-md border border-input bg-background p-3">
              <textarea
                value={composerValue}
                onChange={handleComposerChange}
                onBlur={handleComposerBlur}
                placeholder={props.dictionary.composer?.placeholder ?? "Write a message…"}
                rows={selectedFile ? 4 : 3}
                className="w-full resize-none bg-transparent text-sm outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleFileTrigger}
                    className="gap-2"
                  >
                    <Paperclip className="h-4 w-4" />
                    {props.dictionary.composer?.attach ??
                      props.dictionary.composer?.attachFallback ??
                      "Attach file"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {composerValue.length}/{MESSAGE_COMPOSER_MAX_LENGTH}
                  </span>
                </div>
                <Button type="submit" size="sm" disabled={isSending}>
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {props.dictionary.composer?.sending ?? "Sending"}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {props.dictionary.composer?.send ?? "Send"}
                    </>
                  )}
                </Button>
              </div>
            </div>
            {selectedFile ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/70 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAttachment}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </form>

          <p className="mt-3 text-xs text-muted-foreground">{readReceiptLabel}</p>
        </footer>
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  isOwn,
  locale,
  name,
  dictionary,
  attachmentUrl,
  onRequestAttachment,
}: MessageBubbleProps) {
  const attachment = parseAttachment(message.metadata);
  const showAttachment = Boolean(attachment && !message.is_deleted);

  return (
    <div className={cn("flex w-full", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] space-y-2 rounded-2xl border border-border px-4 py-3 shadow-sm",
          isOwn ? "rounded-tr-none bg-primary text-primary-foreground" : "rounded-tl-none bg-muted",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn("font-medium", isOwn ? "text-primary-foreground" : "text-foreground")}
          >
            {name}
          </span>
          <span>{formatTimestamp(locale, message.created_at)}</span>
          {message.edited_at ? <span>{dictionary.message?.edited ?? "edited"}</span> : null}
        </div>
        <div
          className={cn(
            "whitespace-pre-line text-sm leading-relaxed",
            isOwn ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {message.is_deleted
            ? (dictionary.message?.deleted ?? "Message removed by sender.")
            : message.body}
        </div>

        {showAttachment && attachment ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/80 p-3 text-sm text-foreground">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{attachment.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)} · {attachment.contentType}
                </p>
              </div>
            </div>
            {attachmentUrl ? (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
              >
                <Download className="h-4 w-4" />
                {dictionary.message?.download ?? "Download"}
              </a>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit gap-2"
                onClick={() => onRequestAttachment?.(message.id)}
              >
                <Download className="h-4 w-4" />
                {dictionary.message?.download ?? "Download"}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PresenceSummary({
  onlineUserIds,
  resolveName,
  dictionary,
  currentUserId,
}: PresenceSummaryProps) {
  const onlineLabel = dictionary.presence?.online ?? "Online now";
  const offlineLabel = dictionary.presence?.offline ?? "Currently offline";

  const names = onlineUserIds.map(resolveName);
  const youOnline = onlineUserIds.includes(currentUserId);
  const others = names.filter((name) => name !== resolveName(currentUserId));

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="border-transparent bg-muted px-2 py-1 text-xs">
        {onlineLabel}
      </Badge>
      {onlineUserIds.length === 0 ? (
        <span>{offlineLabel}</span>
      ) : (
        <span>
          {[
            youOnline ? resolveName(currentUserId) : null,
            ...others.filter((value, index, self) => value && self.indexOf(value) === index),
          ]
            .filter(Boolean)
            .join(", ")}
        </span>
      )}
    </div>
  );
}

function EmptyState({ dictionary }: { dictionary: ChatDictionary }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30 p-8 text-center">
      <p className="text-base font-medium text-foreground">
        {dictionary.empty?.title ?? "No messages yet"}
      </p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {dictionary.empty?.description ?? "Start the conversation to get things moving."}
      </p>
    </div>
  );
}

function sortMessages(first: ChatMessage, second: ChatMessage) {
  return new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
}

function formatTimestamp(locale: string, isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  if (exponent === 0) {
    return `${bytes} ${units[exponent]}`;
  }

  return `${value.toFixed(1)} ${units[exponent]}`;
}

function formatTemplate(template: string, replacements: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = replacements[key];
    return value === undefined ? "" : String(value);
  });
}

function formatThreadSubtitle(
  template: string | undefined,
  participants: ChatParticipant[],
  resolveName: (userId: string) => string,
  currentUserId: string,
) {
  if (!template) {
    return participants
      .filter((participant) => participant.user_id !== currentUserId)
      .map((participant) => resolveName(participant.user_id))
      .join(", ");
  }

  const names = participants
    .filter((participant) => participant.user_id !== currentUserId)
    .map((participant) => resolveName(participant.user_id))
    .join(", ");

  return formatTemplate(template, { names });
}
