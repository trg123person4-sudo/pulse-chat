import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from './message.service.js';
import { prisma } from '../db/client.js';

describe('MessageService', () => {
  let service: MessageService;

  beforeEach(() => {
    service = new MessageService();
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('creates a message for an active member', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        userId: 'user_1',
        conversationId: 'conv_1',
        mutedUntil: null,
      } as any);

      vi.spyOn(prisma.message, 'findUnique').mockResolvedValue(null);

      const mockMessage = {
        id: 'msg_1',
        conversationId: 'conv_1',
        senderId: 'user_1',
        body: 'Hello team',
        replyToId: null,
        clientMessageId: 'cli_1',
        editedAt: null,
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        sender: {
          id: 'user_1',
          username: 'alice',
          displayName: 'Alice',
          avatarUrl: null,
          statusMessage: null,
        },
        attachments: [],
        reactions: [],
      };

      vi.spyOn(prisma.message, 'create').mockResolvedValue(mockMessage as any);
      vi.spyOn(prisma.conversation, 'update').mockResolvedValue({} as any);

      const result = await service.create('user_1', {
        conversationId: 'conv_1',
        body: 'Hello team',
        clientMessageId: 'cli_1',
      });

      expect(result.id).toBe('msg_1');
      expect(result.body).toBe('Hello team');
    });

    it('rejects message if user is not member of conversation', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue(null);

      await expect(
        service.create('user_1', {
          conversationId: 'conv_1',
          body: 'Hello team',
        }),
      ).rejects.toThrow('Cannot send messages to a conversation you are not a member of');
    });

    it('rejects message if member is muted', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        userId: 'user_1',
        conversationId: 'conv_1',
        mutedUntil: new Date(Date.now() + 60000),
      } as any);

      await expect(
        service.create('user_1', {
          conversationId: 'conv_1',
          body: 'Hello team',
        }),
      ).rejects.toThrow('You are muted in this conversation');
    });
  });

  describe('edit', () => {
    it('allows author to edit their message', async () => {
      vi.spyOn(prisma.message, 'findUnique').mockResolvedValue({
        id: 'msg_1',
        senderId: 'user_1',
        deletedAt: null,
      } as any);

      const mockEdited = {
        id: 'msg_1',
        conversationId: 'conv_1',
        senderId: 'user_1',
        body: 'Updated body',
        replyToId: null,
        clientMessageId: 'cli_1',
        editedAt: new Date(),
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        sender: { id: 'user_1', username: 'alice', displayName: 'Alice' },
        attachments: [],
        reactions: [],
      };

      vi.spyOn(prisma.message, 'update').mockResolvedValue(mockEdited as any);

      const result = await service.edit('msg_1', 'user_1', 'Updated body');
      expect(result.body).toBe('Updated body');
      expect(result.editedAt).not.toBeNull();
    });

    it('prevents non-author from editing', async () => {
      vi.spyOn(prisma.message, 'findUnique').mockResolvedValue({
        id: 'msg_1',
        senderId: 'user_2',
        deletedAt: null,
      } as any);

      await expect(service.edit('msg_1', 'user_1', 'Hacked body')).rejects.toThrow(
        'You can only edit your own messages',
      );
    });
  });

  describe('delete', () => {
    it('allows author to soft delete their message', async () => {
      vi.spyOn(prisma.message, 'findUnique').mockResolvedValue({
        id: 'msg_1',
        senderId: 'user_1',
        conversationId: 'conv_1',
        deletedAt: null,
        conversation: { memberships: [{ userId: 'user_1', role: 'MEMBER' }] },
      } as any);

      const updateSpy = vi.spyOn(prisma.message, 'update').mockResolvedValue({} as any);

      await service.delete('msg_1', 'user_1');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg_1' },
          data: expect.objectContaining({
            deletedBy: 'user_1',
          }),
        }),
      );
    });
  });

  describe('toggleReaction', () => {
    it('adds reaction if not present, removes if already reacted', async () => {
      vi.spyOn(prisma.message, 'findUnique').mockResolvedValue({
        id: 'msg_1',
        conversationId: 'conv_1',
        deletedAt: null,
      } as any);
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({ userId: 'user_1' } as any);

      // Case 1: reaction does not exist -> create
      vi.spyOn(prisma.reaction, 'findUnique').mockResolvedValueOnce(null);
      const createSpy = vi.spyOn(prisma.reaction, 'create').mockResolvedValue({} as any);

      const addResult = await service.toggleReaction('msg_1', 'user_1', '🚀');
      expect(addResult.added).toBe(true);
      expect(createSpy).toHaveBeenCalled();

      // Case 2: reaction exists -> delete
      vi.spyOn(prisma.reaction, 'findUnique').mockResolvedValueOnce({ id: 'react_1' } as any);
      const deleteSpy = vi.spyOn(prisma.reaction, 'delete').mockResolvedValue({} as any);

      const removeResult = await service.toggleReaction('msg_1', 'user_1', '🚀');
      expect(removeResult.added).toBe(false);
      expect(deleteSpy).toHaveBeenCalled();
    });
  });

  describe('togglePin', () => {
    it('toggles pinned status of message', async () => {
      vi.spyOn(prisma.message, 'findUnique').mockResolvedValue({
        id: 'msg_1',
        conversationId: 'conv_1',
        pinnedAt: null,
        pinnedById: null,
      } as any);
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        userId: 'admin_1',
        role: 'ADMIN',
      } as any);

      const updateSpy = vi.spyOn(prisma.message, 'update').mockResolvedValue({
        id: 'msg_1',
        conversationId: 'conv_1',
        senderId: 'user_1',
        body: 'Pinned note',
        pinnedAt: new Date(),
        pinnedById: 'admin_1',
        createdAt: new Date(),
        sender: { id: 'user_1', username: 'alice' },
        attachments: [],
        reactions: [],
      } as any);

      const result = await service.togglePin('msg_1', 'admin_1', true);
      expect(updateSpy).toHaveBeenCalled();
      expect(result.pinned).toBe(true);
    });
  });

  describe('toggleSave', () => {
    it('saves and unsaves message bookmark', async () => {
      vi.spyOn(prisma.message, 'findUnique').mockResolvedValue({
        id: 'msg_1',
        conversationId: 'conv_1',
      } as any);

      const upsertSpy = vi.spyOn(prisma.savedMessage, 'upsert').mockResolvedValue({} as any);
      const saveResult = await service.toggleSave('msg_1', 'user_1', true);
      expect(saveResult.isSaved).toBe(true);
      expect(upsertSpy).toHaveBeenCalled();

      const deleteManySpy = vi.spyOn(prisma.savedMessage, 'deleteMany').mockResolvedValue({ count: 1 });
      const unsaveResult = await service.toggleSave('msg_1', 'user_1', false);
      expect(unsaveResult.isSaved).toBe(false);
      expect(deleteManySpy).toHaveBeenCalled();
    });

    it('retrieves saved bookmarks for a user', async () => {
      vi.spyOn(prisma.savedMessage, 'findMany').mockResolvedValue([
        {
          id: 'sm_1',
          userId: 'user_1',
          messageId: 'msg_1',
          createdAt: new Date(),
          message: {
            id: 'msg_1',
            conversationId: 'conv_1',
            senderId: 'user_2',
            body: 'Saved text',
            replyToId: null,
            clientMessageId: 'cli_saved',
            editedAt: null,
            deletedAt: null,
            deletedBy: null,
            createdAt: new Date(),
            sender: { id: 'user_2', username: 'bob' },
            attachments: [],
            reactions: [],
            savedBy: [{ userId: 'user_1' }],
          },
        },
      ] as any);

      const result = await service.getSavedMessages('user_1');
      expect(result).toHaveLength(1);
      expect(result[0].body).toBe('Saved text');
    });

    it('retrieves pinned messages in a conversation', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        userId: 'user_1',
        conversationId: 'conv_1',
      } as any);

      vi.spyOn(prisma.message, 'findMany').mockResolvedValue([
        {
          id: 'msg_pinned',
          conversationId: 'conv_1',
          senderId: 'user_1',
          body: 'Pinned announcement',
          pinnedAt: new Date(),
          pinnedById: 'user_1',
          replyToId: null,
          clientMessageId: 'cli_pin',
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
          createdAt: new Date(),
          sender: { id: 'user_1', username: 'alice' },
          attachments: [],
          reactions: [],
        },
      ] as any);

      const result = await service.getPinnedMessages('conv_1', 'user_1');
      expect(result).toHaveLength(1);
      expect(result[0].body).toBe('Pinned announcement');
    });
  });

  describe('votePoll', () => {
    it('records user vote on a poll option', async () => {
      const pollMetadata = JSON.stringify({
        type: 'poll',
        question: 'Lunch?',
        options: ['Pizza', 'Tacos'],
      });

      vi.spyOn(prisma.message, 'findUnique').mockResolvedValue({
        id: 'msg_poll',
        conversationId: 'conv_1',
        metadata: pollMetadata,
      } as any);

      vi.spyOn(prisma.pollVote, 'findUnique').mockResolvedValue(null);
      const createSpy = vi.spyOn(prisma.pollVote, 'create').mockResolvedValue({} as any);
      vi.spyOn(prisma.pollVote, 'findMany').mockResolvedValue([
        { optionIndex: 0, userId: 'user_1' },
      ] as any);

      const result = await service.votePoll('msg_poll', 'user_1', 0);
      expect(createSpy).toHaveBeenCalled();
      expect(result.question).toBe('Lunch?');
      expect(result.totalVotes).toBe(1);
      expect(result.options[0].votes).toBe(1);
    });
  });

  describe('getMessages and getThread', () => {
    it('retrieves paginated messages for a member', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        userId: 'user_1',
        conversationId: 'conv_1',
      } as any);

      vi.spyOn(prisma.message, 'findMany').mockResolvedValue([
        {
          id: 'msg_1',
          conversationId: 'conv_1',
          senderId: 'user_1',
          body: 'Hello',
          replyToId: null,
          clientMessageId: 'cli_1',
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
          createdAt: new Date(),
          sender: { id: 'user_1', username: 'alice' },
          attachments: [],
          reactions: [],
        },
      ] as any);

      const result = await service.getMessages('conv_1', 'user_1', { limit: 10 });
      expect(result.messages).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('retrieves thread root message and its replies', async () => {
      vi.spyOn(prisma.message, 'findUnique').mockResolvedValue({
        id: 'msg_root',
        conversationId: 'conv_1',
        senderId: 'user_1',
        body: 'Root question',
        replyToId: null,
        clientMessageId: 'cli_root',
        editedAt: null,
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        sender: { id: 'user_1', username: 'alice' },
        attachments: [],
        reactions: [],
      } as any);

      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        userId: 'user_1',
        conversationId: 'conv_1',
      } as any);

      vi.spyOn(prisma.message, 'findMany').mockResolvedValue([
        {
          id: 'msg_reply',
          conversationId: 'conv_1',
          senderId: 'user_2',
          body: 'Reply text',
          replyToId: 'msg_root',
          clientMessageId: 'cli_reply',
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
          createdAt: new Date(),
          sender: { id: 'user_2', username: 'bob' },
          attachments: [],
          reactions: [],
        },
      ] as any);

      const result = await service.getThread('msg_root', 'user_1');
      expect(result.root.id).toBe('msg_root');
      expect(result.replies).toHaveLength(1);
      expect(result.replies[0].id).toBe('msg_reply');
    });
  });
});

