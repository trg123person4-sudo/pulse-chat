import { useState } from 'react';
import { useChatStore } from '../../stores/chat-store.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { Avatar } from '../common/Avatar.js';
import { CreateChannelModal } from '../conversation/CreateChannelModal.js';
import { Badge } from '../ui/Badge.js';
import { ThemeToggle } from '../ui/ThemeToggle.js';
import { Hash, Lock, Plus, LogOut, Search } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export function Sidebar() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    setQuickSwitcherOpen,
    setMobileDrawerOpen,
    presences,
  } = useChatStore();
  const { user, logout } = useAuthStore();

  const channels = conversations.filter((c) => c.type === 'CHANNEL');
  const directMessages = conversations.filter((c) => c.type === 'DM');

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setMobileDrawerOpen(false);
  };

  return (
    <>
      <aside className="w-full md:w-64 shrink-0 flex flex-col h-full bg-slate-100/80 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 select-none overflow-hidden">
        {/* Workspace Brand / Header */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-md shadow-indigo-600/30">
              ⚡
            </div>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-base tracking-tight">PulseChat</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Quick Switcher Trigger */}
        <div className="px-3 pt-3 shrink-0">
          <button
            type="button"
            onClick={() => setQuickSwitcherOpen(true)}
            aria-label="Search and jump to conversation (Ctrl+K)"
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Jump to...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Scrollable Conversation Lists */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5 scrollbar-thin">
          {/* Channels Section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Channels
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                title="Create Channel"
                aria-label="Create Channel"
                className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5">
              {channels.map((channel) => {
                const isActive = channel.id === activeConversationId;
                const hasUnread = (channel.unreadCount || 0) > 0;

                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => handleSelectConversation(channel.id)}
                    aria-label={`Channel ${channel.name}${hasUnread ? `, ${channel.unreadCount} unread messages` : ''}`}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs sm:text-sm transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                      isActive
                        ? 'bg-indigo-600 text-white font-medium shadow-sm shadow-indigo-600/20'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 pr-1">
                      {channel.isPrivate ? (
                        <Lock className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-white')} />
                      ) : (
                        <Hash className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-white')} />
                      )}
                      <span className={cn('truncate', hasUnread && !isActive && 'font-bold text-slate-900 dark:text-white')}>
                        {channel.name}
                      </span>
                    </div>

                    {hasUnread && !isActive && (
                      <Badge variant="primary" size="sm">
                        {channel.unreadCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div>
            <div className="px-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Direct Messages
              </span>
            </div>

            <div className="space-y-0.5">
              {directMessages.map((dm) => {
                const isActive = dm.id === activeConversationId;
                const hasUnread = (dm.unreadCount || 0) > 0;
                const otherMember = dm.members?.find((m) => m.userId !== user?.id);
                const otherUserId = otherMember?.userId;
                const presence = otherUserId ? presences[otherUserId] || 'offline' : 'offline';

                return (
                  <button
                    key={dm.id}
                    type="button"
                    onClick={() => handleSelectConversation(dm.id)}
                    aria-label={`Direct message with ${dm.name}${hasUnread ? `, ${dm.unreadCount} unread messages` : ''}`}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs sm:text-sm transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                      isActive
                        ? 'bg-indigo-600 text-white font-medium shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white',
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0 pr-1">
                      <Avatar name={dm.name || 'DM'} size="sm" presence={presence} />
                      <span className={cn('truncate', hasUnread && !isActive && 'font-bold text-slate-900 dark:text-white')}>
                        {dm.name}
                      </span>
                    </div>

                    {hasUnread && !isActive && (
                      <Badge variant="primary" size="sm">
                        {dm.unreadCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Current User Bar Footer */}
        {user && (
          <div className="h-16 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/80 px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
              <Avatar
                name={user.displayName || user.username}
                src={user.avatarUrl}
                size="md"
                presence="online"
              />
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {user.displayName || user.username}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {user.statusMessage || `@${user.username}`}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shrink-0 touch-target"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      <CreateChannelModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
