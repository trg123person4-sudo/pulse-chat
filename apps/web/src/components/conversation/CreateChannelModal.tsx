import { useState } from 'react';
import { api } from '../../lib/api-client.js';
import { useChatStore } from '../../stores/chat-store.js';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Hash, Lock } from 'lucide-react';
import { ConversationDto } from '@realtime-chat/shared';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateChannelModal({ isOpen, onClose }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { conversations, setConversations, setActiveConversationId } = useChatStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const res = await api.post<{ conversation: ConversationDto }>('/conversations', {
        type: 'CHANNEL',
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        topic: topic.trim() || undefined,
        isPrivate,
      });

      setConversations([res.conversation, ...conversations]);
      setActiveConversationId(res.conversation.id);
      onClose();
      setName('');
      setTopic('');
      setIsPrivate(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a Channel"
      description="Channels are where your team communicates."
      size="md"
    >
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="channel-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Channel Name
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-slate-400">#</span>
            <input
              id="channel-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. project-apollo"
              required
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2.5 pl-8 pr-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="channel-topic" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Topic <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="channel-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What is this channel about?"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2.5 px-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5">
          <div className="flex items-center gap-3">
            {isPrivate ? (
              <Lock className="w-5 h-5 text-amber-500 shrink-0" />
            ) : (
              <Hash className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            )}
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Make private</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isPrivate
                  ? 'Only invited members will be able to view this channel'
                  : 'Anyone in your workspace can view and join'}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            id="is-private-checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            aria-label="Make channel private"
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading} disabled={!name.trim()}>
            Create Channel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
