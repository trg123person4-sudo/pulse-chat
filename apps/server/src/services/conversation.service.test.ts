import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationService } from './conversation.service.js';
import { prisma } from '../db/client.js';
import { AppError } from '../errors/app-error.js';

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(() => {
    service = new ConversationService();
    vi.restoreAllMocks();
    vi.spyOn(prisma.membership, 'delete').mockResolvedValue({} as any);
  });

  describe('listForUser', () => {
    it('returns formatted conversations with membership and unread count', async () => {
      const mockMemberships = [
        {
          id: 'mem_1',
          userId: 'user_1',
          conversationId: 'conv_1',
          role: 'OWNER',
          joinedAt: new Date(),
          createdAt: new Date(),
          lastReadMessageId: 'msg_1',
          mutedUntil: null,
          user: {
            id: 'user_1',
            username: 'alice',
            displayName: 'Alice',
            avatarUrl: null,
            statusMessage: null,
          },
          conversation: {
            id: 'conv_1',
            type: 'CHANNEL',
            name: 'general',
            topic: 'General discussion',
            avatarUrl: null,
            isPrivate: false,
            createdById: 'user_1',
            createdAt: new Date(),
            updatedAt: new Date(),
            disappearingAfterSeconds: null,
            memberships: [
              {
                id: 'mem_1',
                userId: 'user_1',
                conversationId: 'conv_1',
                role: 'OWNER',
                joinedAt: new Date(),
                createdAt: new Date(),
                lastReadMessageId: 'msg_1',
                mutedUntil: null,
                user: {
                  id: 'user_1',
                  username: 'alice',
                  displayName: 'Alice',
                  avatarUrl: null,
                  statusMessage: null,
                },
              },
            ],
            messages: [
              {
                id: 'msg_2',
                conversationId: 'conv_1',
                senderId: 'user_2',
                body: 'Hello',
                replyToId: null,
                clientMessageId: 'cli_1',
                editedAt: null,
                deletedAt: null,
                deletedBy: null,
                createdAt: new Date(),
                sender: {
                  id: 'user_2',
                  username: 'bob',
                  displayName: 'Bob',
                  avatarUrl: null,
                  statusMessage: null,
                },
                attachments: [],
                reactions: [],
              },
            ],
          },
        },
      ];

      vi.spyOn(prisma.membership, 'findMany').mockResolvedValue(mockMemberships as any);
      vi.spyOn(prisma.message, 'count').mockResolvedValue(1);

      const result = await service.listForUser('user_1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('conv_1');
      expect(result[0].unreadCount).toBe(1);
      expect(result[0].lastMessage?.body).toBe('Hello');
    });
  });

  describe('create', () => {
    it('creates a new public channel with slugified name', async () => {
      const mockCreated = {
        id: 'conv_channel',
        type: 'CHANNEL',
        name: 'my-cool-channel',
        topic: 'Cool topic',
        avatarUrl: null,
        isPrivate: false,
        createdById: 'user_1',
        createdAt: new Date(),
        updatedAt: new Date(),
        disappearingAfterSeconds: null,
        memberships: [
          {
            id: 'mem_1',
            userId: 'user_1',
            conversationId: 'conv_channel',
            role: 'OWNER',
            joinedAt: new Date(),
            createdAt: new Date(),
            lastReadMessageId: null,
            mutedUntil: null,
            user: {
              id: 'user_1',
              username: 'alice',
              displayName: 'Alice',
              avatarUrl: null,
              statusMessage: null,
            },
          },
        ],
        messages: [],
      };

      vi.spyOn(prisma.conversation, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.conversation, 'create').mockResolvedValue(mockCreated as any);

      const result = await service.create('user_1', {
        type: 'CHANNEL',
        name: 'My Cool Channel',
        topic: 'Cool topic',
        isPrivate: false,
        memberUserIds: [],
      });

      expect(result.id).toBe('conv_channel');
      expect(result.name).toBe('my-cool-channel');
    });

    it('rejects DM creation with self or missing recipient', async () => {
      await expect(
        service.create('user_1', {
          type: 'DM',
          memberUserIds: ['user_1'],
        }),
      ).rejects.toThrow('DM requires a distinct recipient user ID');
    });

    it('creates or reuses a direct message', async () => {
      vi.spyOn(prisma.conversation, 'findFirst').mockResolvedValue(null);

      const mockDm = {
        id: 'conv_dm',
        type: 'DM',
        name: null,
        topic: null,
        avatarUrl: null,
        isPrivate: true,
        createdById: 'user_1',
        createdAt: new Date(),
        updatedAt: new Date(),
        disappearingAfterSeconds: null,
        memberships: [
          {
            id: 'mem_1',
            userId: 'user_1',
            conversationId: 'conv_dm',
            role: 'MEMBER',
            joinedAt: new Date(),
            createdAt: new Date(),
            lastReadMessageId: null,
            mutedUntil: null,
            user: { id: 'user_1', username: 'alice', displayName: 'Alice' },
          },
          {
            id: 'mem_2',
            userId: 'user_2',
            conversationId: 'conv_dm',
            role: 'MEMBER',
            joinedAt: new Date(),
            createdAt: new Date(),
            lastReadMessageId: null,
            mutedUntil: null,
            user: { id: 'user_2', username: 'bob', displayName: 'Bob' },
          },
        ],
        messages: [],
      };

      vi.spyOn(prisma.conversation, 'create').mockResolvedValue(mockDm as any);

      const result = await service.create('user_1', {
        type: 'DM',
        memberUserIds: ['user_2'],
      });

      expect(result.id).toBe('conv_dm');
      expect(result.type).toBe('DM');
    });
  });

  describe('getById', () => {
    it('returns conversation if user is a member', async () => {
      const mockConv = {
        id: 'conv_1',
        type: 'CHANNEL',
        name: 'general',
        isPrivate: false,
        createdById: 'user_1',
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [
          {
            id: 'mem_1',
            userId: 'user_1',
            conversationId: 'conv_1',
            role: 'MEMBER',
            createdAt: new Date(),
            user: { id: 'user_1', username: 'alice' },
          },
        ],
        messages: [],
      };

      vi.spyOn(prisma.conversation, 'findUnique').mockResolvedValue(mockConv as any);
      vi.spyOn(prisma.message, 'count').mockResolvedValue(0);

      const result = await service.getById('conv_1', 'user_1');
      expect(result.id).toBe('conv_1');
    });

    it('throws forbidden if user is not member of private conversation', async () => {
      const mockConv = {
        id: 'conv_1',
        type: 'CHANNEL',
        name: 'secret',
        isPrivate: true,
        createdById: 'other',
        memberships: [
          {
            id: 'mem_other',
            userId: 'other',
            conversationId: 'conv_1',
            role: 'OWNER',
            createdAt: new Date(),
            user: { id: 'other', username: 'other' },
          },
        ],
        messages: [],
      };

      vi.spyOn(prisma.conversation, 'findUnique').mockResolvedValue(mockConv as any);

      await expect(service.getById('conv_1', 'user_1')).rejects.toThrow(
        'You do not have permission to view this conversation',
      );
    });
  });

  describe('join and leave', () => {
    it('allows user to join a public channel', async () => {
      vi.spyOn(prisma.ban, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.conversation, 'findUnique').mockResolvedValue({
        id: 'conv_1',
        type: 'CHANNEL',
        isPrivate: false,
      } as any);
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue(null);

      const mockMembership = {
        id: 'mem_1',
        userId: 'user_1',
        conversationId: 'conv_1',
        role: 'MEMBER',
        joinedAt: new Date(),
        createdAt: new Date(),
        lastReadMessageId: null,
        mutedUntil: null,
        user: { id: 'user_1', username: 'alice', displayName: 'Alice' },
      };
      vi.spyOn(prisma.membership, 'create').mockResolvedValue(mockMembership as any);

      const result = await service.join('conv_1', 'user_1');
      expect(result.userId).toBe('user_1');
      expect(result.role).toBe('MEMBER');
    });

    it('allows member to leave', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        id: 'mem_1',
        userId: 'user_1',
        conversationId: 'conv_1',
        role: 'MEMBER',
      } as any);

      const deleteSpy = vi.spyOn(prisma.membership, 'delete').mockResolvedValue({} as any);

      await service.leave('conv_1', 'user_1');
      expect(deleteSpy).toHaveBeenCalled();
    });

    it('prevents channel owner from leaving if there are other members without transferring ownership', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        id: 'mem_1',
        userId: 'user_1',
        conversationId: 'conv_1',
        role: 'OWNER',
      } as any);

      vi.spyOn(prisma.membership, 'findMany').mockResolvedValue([{ id: 'mem_2' }] as any);

      await expect(service.leave('conv_1', 'user_1')).rejects.toThrow(
        'Transfer channel ownership before leaving',
      );
    });
  });

  describe('markAsRead and isMember', () => {
    it('marks conversation as read', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        userId: 'user_1',
        conversationId: 'conv_1',
      } as any);
      vi.spyOn(prisma.message, 'count').mockResolvedValue(0);

      const updateSpy = vi.spyOn(prisma.membership, 'update').mockResolvedValue({} as any);

      await service.markAsRead('conv_1', 'user_1', 'msg_10');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastReadMessageId: 'msg_10' }),
        }),
      );
    });

    it('checks membership status accurately', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({ id: 'mem_1' } as any);
      expect(await service.isMember('conv_1', 'user_1')).toBe(true);

      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue(null);
      expect(await service.isMember('conv_1', 'user_2')).toBe(false);
    });
  });

  describe('moderation: kick and mute', () => {
    it('allows owner to kick member', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockImplementation(async ({ where }: any) => {
        if (where.userId_conversationId?.userId === 'owner_1') {
          return { userId: 'owner_1', role: 'OWNER' } as any;
        }
        if (where.userId_conversationId?.userId === 'target_1') {
          return { id: 'mem_target', userId: 'target_1', role: 'MEMBER' } as any;
        }
        return null;
      });

      const deleteSpy = vi.spyOn(prisma.membership, 'delete').mockResolvedValue({} as any);

      await service.kickMember('conv_1', 'owner_1', 'target_1');
      expect(deleteSpy).toHaveBeenCalled();
    });

    it('allows owner to mute member for a duration', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockImplementation(async ({ where }: any) => {
        if (where.userId_conversationId?.userId === 'owner_1') {
          return { userId: 'owner_1', role: 'OWNER' } as any;
        }
        if (where.userId_conversationId?.userId === 'target_1') {
          return { userId: 'target_1', role: 'MEMBER' } as any;
        }
        return null;
      });

      const updateSpy = vi.spyOn(prisma.membership, 'update').mockResolvedValue({
        id: 'mem_target',
        userId: 'target_1',
        conversationId: 'conv_1',
        role: 'MEMBER',
        createdAt: new Date(),
        joinedAt: new Date(),
        mutedUntil: new Date(Date.now() + 60000),
        user: { id: 'target_1', username: 'target' },
      } as any);

      const result = await service.muteMember('conv_1', 'owner_1', 'target_1', 60);
      expect(updateSpy).toHaveBeenCalled();
      expect(result.userId).toBe('target_1');
    });
  });

  describe('update and listPublicChannels', () => {
    it('updates conversation name and topic when requested by owner/admin', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        userId: 'owner_1',
        role: 'OWNER',
      } as any);

      const mockUpdated = {
        id: 'conv_1',
        type: 'CHANNEL',
        name: 'renamed-channel',
        topic: 'New topic',
        isPrivate: false,
        disappearingAfterSeconds: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [
          {
            id: 'mem_1',
            userId: 'owner_1',
            conversationId: 'conv_1',
            role: 'OWNER',
            createdAt: new Date(),
            user: { id: 'owner_1', username: 'owner' },
          },
        ],
      };

      vi.spyOn(prisma.conversation, 'update').mockResolvedValue(mockUpdated as any);

      const result = await service.update('conv_1', 'owner_1', {
        name: 'renamed-channel',
        topic: 'New topic',
      });

      expect(result.name).toBe('renamed-channel');
      expect(result.topic).toBe('New topic');
    });

    it('lists public channels', async () => {
      vi.spyOn(prisma.conversation, 'findMany').mockResolvedValue([
        {
          id: 'pub_1',
          type: 'CHANNEL',
          name: 'announcements',
          topic: 'News',
          isPrivate: false,
          disappearingAfterSeconds: null,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          memberships: [],
        },
      ] as any);

      const result = await service.listPublicChannels();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('announcements');
    });
  });
});

