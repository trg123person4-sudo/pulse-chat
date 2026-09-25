import { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chat-store.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { api } from '../../lib/api-client.js';
import { Avatar } from '../common/Avatar.js';
import { BanDto } from '@realtime-chat/shared';
import {
  X,
  Shield,
  Crown,
  Hash,
  Lock,
  Volume2,
  VolumeX,
  UserMinus,
  UserX,
  Ban,
} from 'lucide-react';

export function MembersPanel() {
  const [muteMenuMemberId, setMuteMenuMemberId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bans, setBans] = useState<BanDto[]>([]);

  const { user } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    isDetailsOpen,
    toggleDetails,
    presences,
    removeMemberFromConversation,
    updateMemberInConversation,
  } = useChatStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const members = conversation?.members || [];
  const currentMember = members.find((m) => m.userId === user?.id);
  const isChannel = conversation?.type === 'CHANNEL';
  const isOwner = currentMember?.role === 'OWNER';
  const isAdmin = currentMember?.role === 'ADMIN' || isOwner;

  const fetchBans = async () => {
    if (!isAdmin || !isChannel || !conversation) return;
    try {
      const res = await api.get<BanDto[]>(`/conversations/${conversation.id}/bans`);
      if (Array.isArray(res)) setBans(res);
    } catch {
      // Ignore if not permitted
    }
  };

  useEffect(() => {
    if (isDetailsOpen && conversation) {
      fetchBans();
    }
  }, [conversation?.id, isAdmin, isChannel, isDetailsOpen]);

  if (!isDetailsOpen || !conversation) return null;

  const handleKick = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to kick @${memberName} from #${conversation.name}?`)) {
      return;
    }

    try {
      setActionError(null);
      await api.delete(`/conversations/${conversation.id}/members/${memberId}`);
      removeMemberFromConversation(conversation.id, memberId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to kick member';
      setActionError(msg);
    }
  };

  const handleKickAndBan = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to BAN @${memberName} from #${conversation.name}? They will be blocked from rejoining.`)) {
      return;
    }

    try {
      setActionError(null);
      await api.delete(`/conversations/${conversation.id}/members/${memberId}?ban=true&reason=Banned+by+admin`);
      removeMemberFromConversation(conversation.id, memberId);
      fetchBans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to ban member';
      setActionError(msg);
    }
  };

  const handleUnban = async (userId: string, username: string) => {
    if (!window.confirm(`Unban @${username} from #${conversation.name}?`)) return;
    try {
      setActionError(null);
      await api.delete(`/conversations/${conversation.id}/bans/${userId}`);
      setBans((prev) => prev.filter((b) => b.userId !== userId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unban user';
      setActionError(msg);
    }
  };

  const handleMute = async (memberId: string, durationMinutes: number) => {
    try {
      setActionError(null);
      const res = await api.put<any>(
        `/conversations/${conversation.id}/members/${memberId}/mute`,
        { durationMinutes },
      );
      updateMemberInConversation(conversation.id, memberId, {
        mutedUntil: res.member?.mutedUntil,
      });
      setMuteMenuMemberId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update mute state';
      setActionError(msg);
    }
  };

  return (
    <aside
      role="complementary"
      aria-label="Conversation details and members"
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:static flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl md:shadow-none shrink-0 select-none animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Details & Members</h3>
        <button
          type="button"
          onClick={toggleDetails}
          aria-label="Close details panel"
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 touch-target"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        {/* Error notification */}
        {actionError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-300 text-xs">
            {actionError}
          </div>
        )}

        {/* Conversation Info */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-2 mb-1.5">
            {conversation.isPrivate ? (
              <Lock className="w-4 h-4 text-slate-400" />
            ) : (
              <Hash className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {conversation.name}
            </span>
          </div>
          {conversation.topic && (
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
              {conversation.topic}
            </p>
          )}
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Created {new Date(conversation.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Members List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Members — {members.length}
            </h4>
          </div>

          <div className="space-y-1">
            {members.map((m) => {
              const isSelf = m.userId === user?.id;
              const presence = presences[m.userId] || 'offline';
              const username = m.user?.username || 'user';
              const displayName = m.user?.displayName || username;
              const isMuted = m.mutedUntil && new Date(m.mutedUntil) > new Date();
              const isTargetAdmin = m.role === 'ADMIN' || m.role === 'OWNER';
              const canModerate = isAdmin && !isSelf && (!isTargetAdmin || isOwner);
              const isMenuOpen = muteMenuMemberId === m.id;

              return (
                <div
                  key={m.id}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      <Avatar name={displayName} src={m.user?.avatarUrl} size="sm" presence={presence} />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate">
                            {displayName}
                          </span>
                          {m.role === 'OWNER' && (
                            <span title="Channel Owner"><Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" /></span>
                          )}
                          {m.role === 'ADMIN' && (
                            <span title="Channel Admin"><Shield className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" /></span>
                          )}
                          {isMuted && (
                            <span title="Muted"><VolumeX className="w-3.5 h-3.5 text-rose-500 shrink-0" /></span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 truncate block">@{username}</span>
                      </div>
                    </div>

                    {/* Admin Moderation Actions */}
                    {canModerate && isChannel && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setMuteMenuMemberId(isMenuOpen ? null : m.id)}
                          aria-label={`Mute options for ${displayName}`}
                          title={isMuted ? 'Muted (click to edit)' : 'Mute member'}
                          className={`p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${
                            isMuted ? 'text-rose-500' : ''
                          }`}
                        >
                          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKick(m.id, username)}
                          aria-label={`Kick ${displayName}`}
                          title="Kick member"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKickAndBan(m.id, username)}
                          aria-label={`Ban ${displayName}`}
                          title="Ban member"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Mute Duration Popup Menu */}
                  {isMenuOpen && (
                    <div className="mt-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xl space-y-1.5 text-xs animate-in fade-in z-20">
                      <div className="text-[10px] uppercase font-bold text-slate-500 px-1">
                        Mute Options
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => handleMute(m.id, 15)}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 text-center font-medium transition-colors"
                        >
                          15m
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMute(m.id, 60)}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 text-center font-medium transition-colors"
                        >
                          1h
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMute(m.id, 1440)}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 text-center font-medium transition-colors"
                        >
                          24h
                        </button>
                      </div>
                      {isMuted && (
                        <button
                          type="button"
                          onClick={() => handleMute(m.id, 0)}
                          className="w-full py-1 px-2 rounded bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white font-medium text-center transition-colors flex items-center justify-center gap-1"
                        >
                          <Volume2 className="w-3 h-3" />
                          Unmute Member
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Banned Users Section (Admin/Owner only) */}
        {isAdmin && isChannel && bans.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-500 mb-2 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" />
              <span>Banned Users ({bans.length})</span>
            </h4>

            <div className="space-y-1">
              {bans.map((b) => {
                const bUsername = b.user?.username || 'user';
                const bDisplayName = b.user?.displayName || bUsername;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-xs"
                  >
                    <div className="truncate">
                      <div className="font-medium text-slate-900 dark:text-slate-200 truncate">{bDisplayName}</div>
                      <div className="text-[10px] text-slate-500 truncate">@{bUsername}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnban(b.userId, bUsername)}
                      className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold transition-colors shrink-0 ml-2"
                    >
                      Unban
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
