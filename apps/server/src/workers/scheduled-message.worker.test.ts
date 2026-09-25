import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ScheduledMessageWorker } from './scheduled-message.worker.js';
import { scheduledMessageService } from '../services/scheduled-message.service.js';
import { messageService } from '../services/message.service.js';
import { prisma } from '../db/client.js';

describe('ScheduledMessageWorker & Service (Multi-instance safe, injectable clock)', () => {
  let scheduledMessages: any[] = [];
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
    scheduledMessages = [];
    emittedEvents = [];
    fakeNow = new Date('2026-09-25T12:00:00Z');

    // Mock prisma.scheduledMessage
    vi.spyOn(prisma.scheduledMessage, 'create').mockImplementation(async ({ data }: any) => {
      const record = {
        id: 'sched_' + Math.random().toString(36).substring(7),
        conversationId: data.conversationId,
        senderId: data.senderId,
        body: data.body,
        scheduledFor: data.scheduledFor,
        status: data.status || 'PENDING',
        metadata: data.metadata || null,
        createdAt: new Date(),
      };
      scheduledMessages.push(record);
      return record as any;
    });

    vi.spyOn(prisma.scheduledMessage, 'findMany').mockImplementation(async ({ where }: any) => {
      return scheduledMessages.filter((m) => {
        if (where.senderId && m.senderId !== where.senderId) return false;
        if (where.conversationId && m.conversationId !== where.conversationId) return false;
        if (where.status && m.status !== where.status) return false;
        if (where.scheduledFor?.lte && m.scheduledFor > where.scheduledFor.lte) return false;
        return true;
      }) as any;
    });

    vi.spyOn(prisma.scheduledMessage, 'findUnique').mockImplementation(async ({ where }: any) => {
      return scheduledMessages.find((m) => m.id === where.id) ?? null;
    });

    vi.spyOn(prisma.scheduledMessage, 'updateMany').mockImplementation(async ({ where, data }: any) => {
      let count = 0;
      for (const m of scheduledMessages) {
        if (where.id && m.id !== where.id) continue;
        if (where.senderId && m.senderId !== where.senderId) continue;
        if (where.status && m.status !== where.status) continue;
        Object.assign(m, data);
        count++;
      }
      return { count } as any;
    });

    vi.spyOn(prisma.scheduledMessage, 'update').mockImplementation(async ({ where, data }: any) => {
      const m = scheduledMessages.find((item) => item.id === where.id);
      if (!m) throw new Error('Not found');
      Object.assign(m, data);
      return m as any;
    });

    // Mock prisma.membership
    vi.spyOn(prisma.membership, 'findUnique').mockImplementation(async ({ where }: any) => {
      if (where.userId_conversationId?.userId === 'user_muted') {
        return {
          id: 'mem_muted',
          userId: 'user_muted',
          conversationId: 'conv_1',
          role: 'MEMBER',
          mutedUntil: new Date('2026-09-25T13:00:00Z'),
        } as any;
      }
      if (where.userId_conversationId?.userId === 'user_outsider') {
        return null;
      }
      return {
        id: 'mem_1',
        userId: where.userId_conversationId?.userId || 'user_1',
        conversationId: where.userId_conversationId?.conversationId || 'conv_1',
        role: 'MEMBER',
        mutedUntil: null,
      } as any;
    });

    // Spy on messageService.create
    vi.spyOn(messageService, 'create').mockImplementation(async (senderId, input) => {
      return {
        id: 'msg_created_' + Math.random().toString(36).substring(7),
        conversationId: input.conversationId,
        senderId,
        sender: {
          id: senderId,
          username: senderId,
          displayName: senderId,
          avatarUrl: null,
          statusMessage: null,
        },
        body: input.body,
        replyToId: null,
        clientMessageId: input.clientMessageId,
        editedAt: null,
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date().toISOString(),
        attachments: [],
        reactions: [],
        status: 'sent',
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('processes and delivers due scheduled messages', async () => {
    // 1. Create a message scheduled for 11:55 (5 minutes ago)
    scheduledMessages.push({
      id: 'sched_due_1',
      conversationId: 'conv_1',
      senderId: 'user_1',
      body: 'Hello scheduled world!',
      scheduledFor: new Date('2026-09-25T11:55:00Z'),
      status: 'PENDING',
      metadata: null,
      createdAt: new Date('2026-09-25T11:00:00Z'),
    });

    const worker = new ScheduledMessageWorker({
      getNow: () => fakeNow,
      ioProvider: () => mockIo,
    });

    const processed = await worker.processDueMessages();
    expect(processed).toBe(1);

    // Verify it called messageService.create
    expect(messageService.create).toHaveBeenCalledWith('user_1', {
      conversationId: 'conv_1',
      clientMessageId: 'scheduled-sched_due_1',
      body: 'Hello scheduled world!',
      metadata: undefined,
    });

    // Verify Socket.IO broadcast
    expect(emittedEvents.length).toBe(1);
    expect(emittedEvents[0].room).toBe('conv:conv_1');
    expect(emittedEvents[0].event).toBe('message:created');
    expect(emittedEvents[0].data.body).toBe('Hello scheduled world!');

    // Verify status updated to SENT
    expect(scheduledMessages[0].status).toBe('SENT');
  });

  it('does not send future messages before their scheduled time', async () => {
    // Scheduled for 12:05 (5 minutes into future)
    scheduledMessages.push({
      id: 'sched_future_1',
      conversationId: 'conv_1',
      senderId: 'user_1',
      body: 'I am from the future',
      scheduledFor: new Date('2026-09-25T12:05:00Z'),
      status: 'PENDING',
      metadata: null,
      createdAt: new Date('2026-09-25T11:00:00Z'),
    });

    const worker = new ScheduledMessageWorker({
      getNow: () => fakeNow,
      ioProvider: () => mockIo,
    });

    const processed = await worker.processDueMessages();
    expect(processed).toBe(0);
    expect(messageService.create).not.toHaveBeenCalled();
    expect(scheduledMessages[0].status).toBe('PENDING');

    // Advance clock past 12:05
    fakeNow = new Date('2026-09-25T12:06:00Z');
    const processedAfterAdvance = await worker.processDueMessages();
    expect(processedAfterAdvance).toBe(1);
    expect(messageService.create).toHaveBeenCalledTimes(1);
    expect(scheduledMessages[0].status).toBe('SENT');
  });

  it('guarantees multi-instance atomic claiming: no double sends', async () => {
    scheduledMessages.push({
      id: 'sched_race_1',
      conversationId: 'conv_1',
      senderId: 'user_1',
      body: 'Race condition test',
      scheduledFor: new Date('2026-09-25T11:59:00Z'),
      status: 'PENDING',
      metadata: null,
      createdAt: new Date(),
    });

    const worker1 = new ScheduledMessageWorker({
      getNow: () => fakeNow,
      ioProvider: () => mockIo,
    });

    const worker2 = new ScheduledMessageWorker({
      getNow: () => fakeNow,
      ioProvider: () => mockIo,
    });

    // Run both workers simultaneously on the same message
    const [res1, res2] = await Promise.all([
      worker1.processDueMessages(),
      worker2.processDueMessages(),
    ]);

    // Exactly one worker claims and delivers it
    expect(res1 + res2).toBe(1);
    expect(messageService.create).toHaveBeenCalledTimes(1);
    expect(emittedEvents.length).toBe(1);
    expect(scheduledMessages[0].status).toBe('SENT');
  });

  it('supports cancellation: cancelled message is never delivered', async () => {
    // 1. Create via service
    const created = await scheduledMessageService.create('user_1', {
      conversationId: 'conv_1',
      body: 'Cancel me please',
      scheduledFor: '2026-09-25T12:30:00.000Z',
    });

    expect(created.status).toBe('PENDING');

    // 2. Cancel via service
    const cancelled = await scheduledMessageService.cancel(created.id, 'user_1');
    expect(cancelled).toBe(true);

    const record = scheduledMessages.find((m) => m.id === created.id);
    expect(record.status).toBe('CANCELLED');

    // 3. Fast-forward clock to 12:35
    fakeNow = new Date('2026-09-25T12:35:00Z');
    const worker = new ScheduledMessageWorker({
      getNow: () => fakeNow,
      ioProvider: () => mockIo,
    });

    const processed = await worker.processDueMessages();
    expect(processed).toBe(0);
    expect(messageService.create).not.toHaveBeenCalled();
  });

  it('rejects scheduling by non-members or muted members', async () => {
    await expect(
      scheduledMessageService.create('user_outsider', {
        conversationId: 'conv_1',
        body: 'Outsider message',
        scheduledFor: '2026-09-25T12:30:00.000Z',
      }),
    ).rejects.toThrow('Cannot schedule messages for a conversation you are not a member of');

    await expect(
      scheduledMessageService.create('user_muted', {
        conversationId: 'conv_1',
        body: 'Muted message',
        scheduledFor: '2026-09-25T12:30:00.000Z',
      }),
    ).rejects.toThrow('You are muted in this conversation');
  });

  it('can be started and cleanly stopped', () => {
    const worker = new ScheduledMessageWorker({
      intervalMs: 1000,
      getNow: () => fakeNow,
    });

    worker.start();
    // Starting twice should be idempotent
    worker.start();
    worker.stop();
  });
});
