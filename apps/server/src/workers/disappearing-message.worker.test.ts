import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DisappearingMessageWorker } from './disappearing-message.worker.js';
import { messageService } from '../services/message.service.js';
import { prisma } from '../db/client.js';

describe('DisappearingMessageWorker (Soft-deletes expired messages, fake clock)', () => {
  let conversations: any[] = [];
  let messages: any[] = [];
  let emittedEvents: Array<{ room: string; event: string; data: any }> = [];
  let fakeNow: Date;

  const mockIo: any = {
    to: (room: string) => ({
      emit: (event: string, data: any) => {
        emittedEvents.push({ room, event, data });
      },
    }),
  };

  beforeEach(() => {
    conversations = [];
    messages = [];
    emittedEvents = [];
    fakeNow = new Date('2026-09-25T12:00:00Z');

    // Mock prisma.conversation
    vi.spyOn(prisma.conversation, 'findMany').mockImplementation(async ({ where }: any) => {
      return conversations.filter((c) => {
        if (where?.disappearingAfterSeconds?.gt !== undefined) {
          if (!c.disappearingAfterSeconds || c.disappearingAfterSeconds <= where.disappearingAfterSeconds.gt) {
            return false;
          }
        }
        return true;
      }) as any;
    });

    vi.spyOn(prisma.conversation, 'findUnique').mockImplementation(async ({ where }: any) => {
      return conversations.find((c) => c.id === where.id) ?? null;
    });

    // Mock prisma.message
    vi.spyOn(prisma.message, 'findMany').mockImplementation(async ({ where }: any) => {
      return messages.filter((m) => {
        if (where.conversationId && m.conversationId !== where.conversationId) return false;
        if (where.deletedAt === null && m.deletedAt !== null) return false;
        if (where.createdAt?.lte && m.createdAt > where.createdAt.lte) return false;
        return true;
      }) as any;
    });

    vi.spyOn(prisma.message, 'findUnique').mockImplementation(async ({ where }: any) => {
      const msg = messages.find((m) => m.id === where.id);
      if (!msg) return null;
      const conv = conversations.find((c) => c.id === msg.conversationId);
      return {
        ...msg,
        conversation: conv ? { ...conv, memberships: [] } : null,
      } as any;
    });

    vi.spyOn(prisma.message, 'update').mockImplementation(async ({ where, data }: any) => {
      const m = messages.find((item) => item.id === where.id);
      if (!m) throw new Error('Message not found');
      Object.assign(m, data);
      return m as any;
    });

    // Spy on messageService.delete
    vi.spyOn(messageService, 'delete');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('soft-deletes messages older than disappearingAfterSeconds and broadcasts deletion', async () => {
    // Conv 1: disappearing after 300s (5 min)
    conversations.push({
      id: 'conv_ephemeral',
      type: 'CHANNEL',
      name: 'ephemeral',
      disappearingAfterSeconds: 300,
    });

    // Msg 1: created 10 minutes ago (11:50) -> EXPIRED
    messages.push({
      id: 'msg_expired_1',
      conversationId: 'conv_ephemeral',
      senderId: 'user_1',
      body: 'I will vanish',
      createdAt: new Date('2026-09-25T11:50:00Z'),
      deletedAt: null,
      deletedBy: null,
    });

    // Msg 2: created 2 minutes ago (11:58) -> STILL VALID
    messages.push({
      id: 'msg_fresh_2',
      conversationId: 'conv_ephemeral',
      senderId: 'user_2',
      body: 'I am still fresh',
      createdAt: new Date('2026-09-25T11:58:00Z'),
      deletedAt: null,
      deletedBy: null,
    });

    const worker = new DisappearingMessageWorker({
      getNow: () => fakeNow,
      ioProvider: () => mockIo,
    });

    const deletedCount = await worker.processDisappearingMessages();
    expect(deletedCount).toBe(1);

    // Verify msg 1 was soft deleted
    expect(messageService.delete).toHaveBeenCalledWith('msg_expired_1', 'system', {
      isSystem: true,
      deletedAt: fakeNow,
    });

    const msg1 = messages.find((m) => m.id === 'msg_expired_1');
    expect(msg1.deletedAt).toEqual(fakeNow);
    expect(msg1.deletedBy).toBe('system');

    // Verify msg 2 is untouched
    const msg2 = messages.find((m) => m.id === 'msg_fresh_2');
    expect(msg2.deletedAt).toBeNull();

    // Verify broadcast
    expect(emittedEvents.length).toBe(1);
    expect(emittedEvents[0].room).toBe('conv:conv_ephemeral');
    expect(emittedEvents[0].event).toBe('message:deleted');
    expect(emittedEvents[0].data.messageId).toBe('msg_expired_1');
    expect(emittedEvents[0].data.deletedBy).toBe('system');
  });

  it('preserves messages in conversations without disappearing policy', async () => {
    // Conv without retention policy
    conversations.push({
      id: 'conv_permanent',
      type: 'CHANNEL',
      name: 'permanent',
      disappearingAfterSeconds: null,
    });

    messages.push({
      id: 'msg_old_permanent',
      conversationId: 'conv_permanent',
      senderId: 'user_1',
      body: 'I stay forever',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      deletedBy: null,
    });

    const worker = new DisappearingMessageWorker({
      getNow: () => fakeNow,
      ioProvider: () => mockIo,
    });

    const deletedCount = await worker.processDisappearingMessages();
    expect(deletedCount).toBe(0);
    expect(messageService.delete).not.toHaveBeenCalled();
    expect(messages[0].deletedAt).toBeNull();
  });

  it('skips messages that are already soft-deleted', async () => {
    conversations.push({
      id: 'conv_ephemeral',
      type: 'CHANNEL',
      name: 'ephemeral',
      disappearingAfterSeconds: 60,
    });

    messages.push({
      id: 'msg_already_deleted',
      conversationId: 'conv_ephemeral',
      senderId: 'user_1',
      body: 'already deleted',
      createdAt: new Date('2026-09-25T11:00:00Z'),
      deletedAt: new Date('2026-09-25T11:05:00Z'),
      deletedBy: 'user_1',
    });

    const worker = new DisappearingMessageWorker({
      getNow: () => fakeNow,
      ioProvider: () => mockIo,
    });

    const deletedCount = await worker.processDisappearingMessages();
    expect(deletedCount).toBe(0);
    expect(messageService.delete).not.toHaveBeenCalled();
  });

  it('starts and stops gracefully', () => {
    const worker = new DisappearingMessageWorker({
      intervalMs: 2000,
      getNow: () => fakeNow,
    });

    worker.start();
    worker.start(); // Idempotent
    worker.stop();
  });
});
