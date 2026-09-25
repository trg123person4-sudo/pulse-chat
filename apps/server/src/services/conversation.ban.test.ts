import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationService } from './conversation.service.js';
import { prisma } from '../db/client.js';

describe('ConversationService - Bans', () => {
  let service: ConversationService;

  beforeEach(() => {
    service = new ConversationService();
    vi.restoreAllMocks();
  });

  describe('banMember', () => {
    it('rejects banning yourself', async () => {
      await expect(
        service.banMember('conv_1', 'user_admin', 'user_admin'),
      ).rejects.toThrow('Cannot ban yourself');
    });

    it('rejects non-owner/non-admin operators', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        id: 'mem_1',
        userId: 'user_regular',
        conversationId: 'conv_1',
        role: 'MEMBER',
      } as any);

      await expect(
        service.banMember('conv_1', 'user_regular', 'user_target'),
      ).rejects.toThrow('Only channel owners or admins can ban members');
    });

    it('rejects banning the channel owner', async () => {
      vi.spyOn(prisma.membership, 'findUnique')
        .mockResolvedValueOnce({
          id: 'mem_admin',
          userId: 'user_admin',
          conversationId: 'conv_1',
          role: 'ADMIN',
        } as any)
        .mockResolvedValueOnce({
          id: 'mem_owner',
          userId: 'user_owner',
          conversationId: 'conv_1',
          role: 'OWNER',
        } as any);

      await expect(
        service.banMember('conv_1', 'user_admin', 'user_owner'),
      ).rejects.toThrow('Cannot ban the channel owner');
    });

    it('successfully bans member, deletes membership, and creates ban record', async () => {
      vi.spyOn(prisma.membership, 'findUnique')
        .mockResolvedValueOnce({
          id: 'mem_admin',
          userId: 'user_admin',
          conversationId: 'conv_1',
          role: 'ADMIN',
        } as any)
        .mockResolvedValueOnce({
          id: 'mem_target',
          userId: 'user_target',
          conversationId: 'conv_1',
          role: 'MEMBER',
        } as any);

      vi.spyOn(prisma.membership, 'delete').mockResolvedValue({} as any);
      vi.spyOn(prisma.ban, 'upsert').mockResolvedValue({
        id: 'ban_1',
        conversationId: 'conv_1',
        userId: 'user_target',
        bannedById: 'user_admin',
        reason: 'Violation of rules',
        createdAt: new Date(),
      } as any);

      const result = await service.banMember('conv_1', 'user_admin', 'user_target', 'Violation of rules');
      expect(result.success).toBe(true);
      expect(result.userId).toBe('user_target');
      expect(prisma.membership.delete).toHaveBeenCalledWith({ where: { id: 'mem_target' } });
      expect(prisma.ban.upsert).toHaveBeenCalled();
    });
  });

  describe('join', () => {
    it('blocks banned users from joining a public channel', async () => {
      vi.spyOn(prisma.conversation, 'findUnique').mockResolvedValue({
        id: 'conv_1',
        name: 'general',
        isPrivate: false,
      } as any);

      vi.spyOn(prisma.ban, 'findUnique').mockResolvedValue({
        id: 'ban_1',
        conversationId: 'conv_1',
        userId: 'user_banned',
        bannedById: 'user_admin',
        reason: 'Spamming',
        createdAt: new Date(),
      } as any);

      await expect(service.join('conv_1', 'user_banned')).rejects.toThrow(
        'You have been banned from this conversation',
      );
    });
  });

  describe('unbanMember', () => {
    it('successfully removes ban record', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        id: 'mem_admin',
        userId: 'user_admin',
        conversationId: 'conv_1',
        role: 'ADMIN',
      } as any);

      vi.spyOn(prisma.ban, 'delete').mockResolvedValue({} as any);

      const result = await service.unbanMember('conv_1', 'user_admin', 'user_banned');
      expect(result.success).toBe(true);
      expect(prisma.ban.delete).toHaveBeenCalledWith({
        where: {
          conversationId_userId: { conversationId: 'conv_1', userId: 'user_banned' },
        },
      });
    });
  });

  describe('listBans', () => {
    it('returns banned user summaries', async () => {
      vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
        id: 'mem_admin',
        userId: 'user_admin',
        conversationId: 'conv_1',
        role: 'ADMIN',
      } as any);

      const now = new Date();
      vi.spyOn(prisma.ban, 'findMany').mockResolvedValue([
        {
          id: 'ban_1',
          conversationId: 'conv_1',
          userId: 'user_banned',
          bannedById: 'user_admin',
          reason: 'Spam',
          createdAt: now,
          user: {
            id: 'user_banned',
            username: 'spammer',
            displayName: 'Spam Bot',
            avatarUrl: null,
            statusMessage: null,
          },
          bannedBy: {
            id: 'user_admin',
            username: 'admin',
            displayName: 'Admin',
            avatarUrl: null,
            statusMessage: null,
          },
        },
      ] as any);

      const bans = await service.listBans('user_admin', 'conv_1');
      expect(bans).toHaveLength(1);
      expect(bans[0].userId).toBe('user_banned');
      expect(bans[0].user?.username).toBe('spammer');
    });
  });
});
