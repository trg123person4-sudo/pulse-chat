import { useEffect, useRef, useState, useCallback } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useChatStore } from '../../stores/chat-store.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { api } from '../../lib/api-client.js';
import { MessageItem } from './MessageItem.js';
import { formatDividerDate } from '../../lib/utils.js';
import { MessageListSkeleton } from '../ui/Skeleton.js';
import { EmptyState } from '../ui/EmptyState.js';
import { MessageDto } from '@realtime-chat/shared';
import { ArrowDown, MessageSquare } from 'lucide-react';

interface MessageListProps {
  conversationId: string;
}

export function MessageList({ conversationId }: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const user = useAuthStore((state) => state.user);
  const { messages, prependOlderMessages } = useChatStore();
  const [atBottom, setAtBottom] = useState(true);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const prevMessagesLength = useRef(0);

  const conversationMessages = messages[conversationId] || [];

  // Initial load of messages for conversation
  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      const existing = useChatStore.getState().messages[conversationId];
      if (!existing || existing.length === 0) {
        setInitialLoading(true);
      }
      try {
        const res = await api.get<{ messages: MessageDto[]; hasMore: boolean }>(
          `/conversations/${conversationId}/messages?limit=50&direction=older`,
        );
        if (isMounted) {
          const current = useChatStore.getState().messages[conversationId] || [];
          const resIds = new Set(res.messages.map((m) => m.id));
          const resClientIds = new Set(res.messages.map((m) => m.clientMessageId).filter(Boolean));
          const newMessages = current.filter(
            (m) => !resIds.has(m.id) && (!m.clientMessageId || !resClientIds.has(m.clientMessageId)),
          );

          const seen = new Set<string>();
          const deduped: MessageDto[] = [];
          for (const m of [...res.messages, ...newMessages]) {
            if (!seen.has(m.id)) {
              seen.add(m.id);
              deduped.push(m);
            }
          }

          useChatStore.getState().setMessages(conversationId, deduped);
          setHasMoreOlder(res.hasMore);
          prevMessagesLength.current = deduped.length;
          setNewMessagesCount(0);
        }
      } catch (err) {
        console.error('Failed to load initial messages', err);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // Track incoming new messages and keep scroll pinned to bottom for own messages
  useEffect(() => {
    const currentLen = conversationMessages.length;
    if (currentLen > prevMessagesLength.current) {
      const added = currentLen - prevMessagesLength.current;
      const lastMsg = conversationMessages[currentLen - 1];
      const isMine = lastMsg && (lastMsg.senderId === user?.id || lastMsg.status === 'pending');

      if (isMine || atBottom) {
        setNewMessagesCount(0);
        virtuosoRef.current?.scrollToIndex({
          index: currentLen - 1,
          align: 'end',
          behavior: 'auto',
        });
      } else {
        setNewMessagesCount((prev) => prev + added);
      }
    }
    prevMessagesLength.current = currentLen;
  }, [conversationMessages.length, atBottom, user?.id]);

  // When user returns to bottom, reset unread counter
  const handleAtBottomStateChange = useCallback((bottom: boolean) => {
    setAtBottom(bottom);
    if (bottom) {
      setNewMessagesCount(0);
    }
  }, []);

  // Infinite scroll upward (load older messages)
  const handleStartReached = async () => {
    if (!hasMoreOlder || loadingOlder || conversationMessages.length === 0) return;

    const oldest = conversationMessages[0];
    if (!oldest) return;

    setLoadingOlder(true);
    try {
      const res = await api.get<{ messages: MessageDto[]; hasMore: boolean }>(
        `/conversations/${conversationId}/messages?cursor=${oldest.id}&direction=older&limit=50`,
      );

      prependOlderMessages(conversationId, res.messages);
      setHasMoreOlder(res.hasMore);
    } catch (err) {
      console.error('Failed to load older messages', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Ensure the list is scrolled to the bottom on initial load / channel switch
  useEffect(() => {
    if (initialLoading || conversationMessages.length === 0) {
      return;
    }

    const timer1 = setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({
        index: conversationMessages.length - 1,
        align: 'end',
        behavior: 'auto',
      });
      setAtBottom(true);
      setNewMessagesCount(0);
    }, 50);

    const timer2 = setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({
        index: conversationMessages.length - 1,
        align: 'end',
        behavior: 'auto',
      });
      setAtBottom(true);
      setNewMessagesCount(0);
    }, 200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [initialLoading, conversationId]);

  const scrollToBottom = () => {
    virtuosoRef.current?.scrollToIndex({
      index: conversationMessages.length - 1,
      align: 'end',
      behavior: 'smooth',
    });
    setNewMessagesCount(0);
    setAtBottom(true);
  };

  if (initialLoading) {
    return (
      <div className="flex-1 h-full overflow-hidden bg-white dark:bg-slate-950">
        <MessageListSkeleton />
      </div>
    );
  }

  if (conversationMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-white dark:bg-slate-950">
        <EmptyState
          icon={<MessageSquare className="w-6 h-6 text-slate-400" />}
          title="No messages yet"
          description="Be the first to send a message and start the conversation in this room."
        />
      </div>
    );
  }

  return (
    <div
      className="relative flex-1 h-full overflow-hidden bg-white dark:bg-slate-950"
      role="log"
      aria-live="polite"
    >
      <Virtuoso
        ref={virtuosoRef}
        data={conversationMessages}
        computeItemKey={(index, msg) =>
          `${msg.id}_${index}_${msg.replyCount || 0}_${msg.reactions?.length || 0}_${msg.pinnedAt || ''}_${msg.editedAt || ''}_${msg.status || ''}`
        }
        startReached={handleStartReached}
        atBottomThreshold={60}
        atBottomStateChange={handleAtBottomStateChange}
        followOutput={(isAtBottom) => {
          const lastMsg = conversationMessages[conversationMessages.length - 1];
          const isMine = lastMsg && (lastMsg.senderId === user?.id || lastMsg.status === 'pending');
          if (isMine) return 'auto';
          return isAtBottom ? 'smooth' : false;
        }}
        overscan={400}
        initialTopMostItemIndex={{ index: 'LAST', align: 'end' }}
        className="h-full scrollbar-thin"
        itemContent={(index, msg) => {
          const prevMsg = index > 0 ? conversationMessages[index - 1] : null;

          // 1. Check Date Separator
          const msgDate = new Date(msg.createdAt).toDateString();
          const prevDate = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
          const showDateDivider = msgDate !== prevDate;

          // 2. Check 5-Minute Sender Grouping
          const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;
          const timeDiffMs = prevMsg
            ? new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()
            : Infinity;
          const isWithin5Min = timeDiffMs < 5 * 60 * 1000;
          const isGrouped = Boolean(
            !showDateDivider && isSameSender && isWithin5Min && !prevMsg?.deletedAt,
          );

          return (
            <div>
              {showDateDivider && (
                <div className="flex items-center my-4 px-4 select-none">
                  <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
                  <span className="px-3 text-[11px] font-semibold text-slate-500 bg-white dark:bg-slate-950">
                    {formatDividerDate(msg.createdAt)}
                  </span>
                  <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
                </div>
              )}

              <MessageItem message={msg} isGrouped={isGrouped} />
            </div>
          );
        }}
      />

      {/* Floating Scroll-to-Bottom / New Messages Pill */}
      {!atBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label={newMessagesCount > 0 ? `${newMessagesCount} new messages. Click to jump to bottom.` : 'Jump to latest messages'}
          className="absolute bottom-4 right-6 flex items-center gap-2 rounded-full bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xl shadow-indigo-600/40 hover:bg-indigo-500 active:scale-95 transition-all z-20 select-none animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>{newMessagesCount > 0 ? `↓ ${newMessagesCount} new message${newMessagesCount > 1 ? 's' : ''}` : '↓ New messages'}</span>
        </button>
      )}
    </div>
  );
}
