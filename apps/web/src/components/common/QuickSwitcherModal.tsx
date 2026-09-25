import React, { useState, useEffect, useRef } from 'react';
import { Search, Hash, Lock, User as UserIcon, MessageSquare, ArrowRight, X, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { useChatStore } from '../../stores/chat-store.js';
import { api } from '../../lib/api-client.js';
import { EmptyState } from '../ui/EmptyState.js';
import { SearchResultDto, SemanticSearchResponseDto } from '@realtime-chat/shared';
import { cn } from '../../lib/utils.js';

interface QuickSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSwitcherModal({ isOpen, onClose }: QuickSwitcherModalProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'conversations' | 'messages'>('conversations');
  const [isSemantic, setIsSemantic] = useState(false);
  const [searchSource, setSearchSource] = useState<'keyword' | 'hybrid-semantic' | 'keyword-only' | null>(null);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const { conversations, setActiveConversationId, activeConversationId } = useChatStore();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSearchResults([]);
      setSearchSource(null);
      setSearchWarning(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search messages debounced
  useEffect(() => {
    if (activeTab !== 'messages') return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchSource(null);
      setSearchWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (isSemantic) {
          const res = await api.get<SemanticSearchResponseDto>(
            `/search/semantic?q=${encodeURIComponent(trimmed)}&limit=15`,
          );
          setSearchResults(
            (res.results || []).map((r) => ({
              message: r.message,
              highlight: r.highlight,
              conversation: r.conversation,
            })),
          );
          setSearchSource(res.source);
          setSearchWarning(res.warning || null);
        } else {
          const res = await api.get<{ results: SearchResultDto[] }>(
            `/search?q=${encodeURIComponent(trimmed)}&limit=15`,
          );
          setSearchResults(res.results || []);
          setSearchSource('keyword');
          setSearchWarning(null);
        }
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab, isSemantic]);

  // Filter conversations locally
  const filteredConversations = conversations.filter((c) => {
    if (!query.trim()) return true;
    return (c.name || '').toLowerCase().includes(query.toLowerCase());
  });

  const totalItems =
    activeTab === 'conversations' ? filteredConversations.length : searchResults.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (totalItems || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (totalItems || 1)) % (totalItems || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeTab === 'conversations' && filteredConversations[selectedIndex]) {
        setActiveConversationId(filteredConversations[selectedIndex].id);
        onClose();
      } else if (activeTab === 'messages' && searchResults[selectedIndex]) {
        setActiveConversationId(searchResults[selectedIndex].conversation.id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick Switcher and Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-3 sm:px-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeTab === 'conversations'
                ? 'Jump to channel or direct message...'
                : 'Search messages across all conversations...'
            }
            aria-label="Search query"
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear query"
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Controls & Semantic AI Search Toggle */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('conversations');
                setSelectedIndex(0);
              }}
              className={cn(
                'px-3 py-1 rounded-lg font-semibold transition-colors',
                activeTab === 'conversations'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              Channels & DMs
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('messages');
                setSelectedIndex(0);
              }}
              className={cn(
                'px-3 py-1 rounded-lg font-semibold transition-colors',
                activeTab === 'messages'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              Messages
            </button>
          </div>

          {activeTab === 'messages' && (
            <button
              type="button"
              onClick={() => setIsSemantic(!isSemantic)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all border',
                isSemantic
                  ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-400 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Semantic Search</span>
            </button>
          )}
        </div>

        {/* Search Warning Banner */}
        {searchWarning && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{searchWarning}</span>
          </div>
        )}

        {/* Results Metadata */}
        {activeTab === 'messages' && query.trim().length >= 2 && !isSearching && (
          <div className="px-4 py-1.5 bg-slate-50/50 dark:bg-slate-950/30 text-[11px] text-slate-500 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <div>
              {searchSource === 'hybrid-semantic' ? (
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Powered by Gemini Embeddings & pgvector
                </span>
              ) : searchSource === 'keyword-only' ? (
                <span className="text-amber-600 dark:text-amber-400">Basic keyword search (AI unavailable)</span>
              ) : (
                <span>Keyword search</span>
              )}
            </div>
            {searchResults.length > 0 && <span>{searchResults.length} results</span>}
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {activeTab === 'conversations' ? (
            filteredConversations.length === 0 ? (
              <EmptyState
                title="No conversations found"
                description={`No channels or direct messages match "${query}".`}
              />
            ) : (
              filteredConversations.map((conv, idx) => {
                const isSelected = idx === selectedIndex;
                const isCurrentActive = conv.id === activeConversationId;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors',
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                      {conv.type === 'CHANNEL' ? (
                        conv.isPrivate ? (
                          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                        )
                      ) : (
                        <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate">{conv.name}</span>
                      {isCurrentActive && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                          Current
                        </span>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })
            )
          ) : isSearching ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Searching messages...</span>
            </div>
          ) : query.trim().length < 2 ? (
            <EmptyState
              title="Search messages"
              description="Type at least 2 characters to search across conversations."
            />
          ) : searchResults.length === 0 ? (
            <EmptyState
              title="No messages found"
              description={`No matching messages found for "${query}".`}
            />
          ) : (
            searchResults.map((res, idx) => {
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={res.message.id}
                  type="button"
                  onClick={() => {
                    setActiveConversationId(res.conversation.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'w-full p-2.5 rounded-xl text-left transition-colors space-y-1 border',
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800/90 border-indigo-500 text-slate-900 dark:text-white'
                      : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300',
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      {res.conversation.type === 'CHANNEL' ? '#' : '@'}
                      {res.conversation.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      @{res.message.sender?.username}
                    </span>
                  </div>
                  <div
                    className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: res.highlight }}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500 select-none">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300 mr-1">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300 mr-1">
                ↓
              </kbd>
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300 mr-1">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300 mr-1">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
