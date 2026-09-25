import { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chat-store.js';
import { api } from '../../lib/api-client.js';
import { getSocket } from '../../lib/socket-client.js';
import { Avatar } from '../common/Avatar.js';
import { EmptyState } from '../ui/EmptyState.js';
import { formatMessageTime, getUserColor } from '../../lib/utils.js';
import { MessageDto } from '@realtime-chat/shared';
import { Pin, X, PinOff, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export function PinnedMessagesModal() {
  const { isPinnedOpen, setPinnedOpen, activeConversationId, conversations } = useChatStore();
  const [pinnedMessages, setPinnedMessages] = useState<MessageDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    if (!isPinnedOpen || !activeConversationId) return;

    let isMounted = true;
    setIsLoading(true);

    api
      .get<MessageDto[]>(`/conversations/${activeConversationId}/pinned`)
      .then((res) => {
        if (isMounted) {
          setPinnedMessages(res || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load pinned messages', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isPinnedOpen, activeConversationId]);

  useEffect(() => {
    if (!isPinnedOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinnedOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinnedOpen, setPinnedOpen]);

  const handleUnpin = (messageId: string) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('message:pin', { messageId, pinned: false }, () => {
        setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
      });
    }
  };

  if (!isPinnedOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pinned Messages"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) setPinnedOpen(false);
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden text-slate-900 dark:text-white flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shrink-0">
              <Pin className="w-4 h-4 fill-amber-500/20" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Pinned Messages</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">#{activeConv?.name || 'conversation'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPinnedOpen(false)}
            aria-label="Close pinned messages dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 scrollbar-thin select-text flex-1">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-xs">Loading pinned messages...</span>
            </div>
          )}

          {!isLoading && pinnedMessages.length === 0 && (
            <EmptyState
              icon={<Pin className="w-6 h-6 text-amber-500" />}
              title="No pinned messages"
              description="Hover over any important message and click the pin icon to keep it accessible here."
            />
          )}

          {!isLoading &&
            pinnedMessages.map((msg) => {
              const author = msg.sender?.displayName || msg.sender?.username || 'Unknown';
              const color = getUserColor(msg.sender?.username || '');

              return (
                <div
                  key={msg.id}
                  className="group relative p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                      <Avatar name={author} src={msg.sender?.avatarUrl} size="sm" />
                      <div className="truncate">
                        <span className={`text-xs font-semibold ${color}`}>{author}</span>
                        <span className="text-[10px] text-slate-400 ml-2">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnpin(msg.id)}
                      className="p-1 text-slate-400 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors shrink-0"
                      title="Unpin message"
                      aria-label="Unpin message"
                    >
                      <PinOff className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed break-words">
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{msg.body}</ReactMarkdown>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => setPinnedOpen(false)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
