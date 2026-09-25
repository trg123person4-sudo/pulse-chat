import { useState } from 'react';
import { useChatStore } from '../../stores/chat-store.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { soundService } from '../../lib/sound-service.js';
import {
  Hash,
  Lock,
  Users,
  Menu,
  Search,
  Sparkles,
  Pin,
  Volume2,
  VolumeX,
} from 'lucide-react';

export function ChatHeader() {
  const { user } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    toggleDetails,
    setMobileDrawerOpen,
    setQuickSwitcherOpen,
    setCatchUpOpen,
    setPinnedOpen,
    presences,
  } = useChatStore();

  const [soundEnabled, setSoundEnabled] = useState(soundService.isEnabled());

  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    soundService.setEnabled(nextState);
    setSoundEnabled(nextState);
    if (nextState) {
      soundService.playReaction();
    }
  };

  const conversation = conversations.find((c) => c.id === activeConversationId);

  if (!conversation) {
    return (
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open sidebar navigation"
            className="md:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 touch-target"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">Select a conversation</span>
        </div>
      </header>
    );
  }

  const memberCount = conversation.members?.length || 0;
  const isDM = conversation.type === 'DM';
  const otherMember = isDM ? conversation.members?.find((m) => m.userId !== user?.id) : null;
  const otherPresence = otherMember?.userId
    ? presences[otherMember.userId] || 'offline'
    : 'offline';

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-900/60 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between select-none shrink-0 z-10">
      {/* Left section: Drawer toggle & Conversation info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open sidebar navigation"
          className="md:hidden p-2 -ml-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 touch-target"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0">
          {conversation.isPrivate ? (
            <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          ) : (
            <Hash className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          )}
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs">
            {conversation.name}
          </h2>
        </div>

        {isDM ? (
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                otherPresence === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span
              className={
                otherPresence === 'online'
                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-slate-500 dark:text-slate-400'
              }
            >
              {otherPresence === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        ) : (
          conversation.topic && (
            <>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden lg:inline max-w-xs xl:max-w-md">
                {conversation.topic}
              </p>
            </>
          )
        )}
      </div>

      {/* Right section: Action buttons */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Catch Me Up AI Button */}
        <button
          type="button"
          onClick={() => setCatchUpOpen(true)}
          aria-label="Catch me up: AI channel summary"
          title="Catch me up: AI channel summary"
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 touch-target"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300 animate-pulse" />
          <span className="hidden sm:inline">Catch Up</span>
        </button>

        {/* Pinned Messages Button */}
        <button
          type="button"
          onClick={() => setPinnedOpen(true)}
          aria-label="Pinned messages in this channel"
          title="Pinned messages in this channel"
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 touch-target"
        >
          <Pin className="w-4 h-4" />
        </button>

        {/* Sound FX Toggle */}
        <button
          type="button"
          onClick={handleToggleSound}
          aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 touch-target"
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Quick Switcher & Global Search */}
        <button
          type="button"
          onClick={() => setQuickSwitcherOpen(true)}
          aria-label="Quick Switcher and Search (Ctrl+K)"
          title="Quick Switcher & Semantic Search (Ctrl+K)"
          className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 touch-target"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Search</span>
        </button>

        {/* Members Panel Toggle */}
        <button
          type="button"
          onClick={toggleDetails}
          aria-label={`Conversation members (${memberCount})`}
          title="Conversation Members & Details"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 touch-target"
        >
          <Users className="w-3.5 h-3.5" />
          <span>{memberCount}</span>
        </button>
      </div>
    </header>
  );
}
