import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduledMessageService } from './scheduled-message.service.js';
import { prisma } from '../db/client.js';
import { AppError } from '../errors/app-error.js';

describe('ScheduledMessageService', () => {
  let service: ScheduledMessageService;

  beforeEach(() => {
    service = new ScheduledMessageService();
    vi.restoreAllMocks();
  });

  it('throws forbidden if user is not a member of the conversation', async () => {
    vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue(null);

    await expect(
      service.create('user_1', {
        conversationId: 'conv_1',
        body: 'Hello',
        scheduledFor: new Date(Date.now() + 10000).toISOString(),
      }),
    ).rejects.toThrow('Cannot schedule messages for a conversation you are not a member of');
  });

  it('throws forbidden if member is muted', async () => {
    vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
      userId: 'user_1',
      conversationId: 'conv_1',
      mutedUntil: new Date(Date.now() + 60000),
    } as any);

    await expect(
      service.create('user_1', {
        conversationId: 'conv_1',
        body: 'Hello',
        scheduledFor: new Date(Date.now() + 10000).toISOString(),
      }),
    ).rejects.toThrow('You are muted in this conversation');
  });

  it('throws bad request if scheduledFor is invalid date', async () => {
    vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
      userId: 'user_1',
      conversationId: 'conv_1',
      mutedUntil: null,
    } as any);

    await expect(
      service.create('user_1', {
        conversationId: 'conv_1',
        body: 'Hello',
        scheduledFor: 'not-a-date',
      }),
    ).rejects.toThrow('Invalid scheduledFor date');
  });

  it('creates scheduled message successfully', async () => {
    vi.spyOn(prisma.membership, 'findUnique').mockResolvedValue({
      userId: 'user_1',
      conversationId: 'conv_1',
      mutedUntil: null,
    } as any);

    const futureDate = new Date(Date.now() + 10000);
    vi.spyOn(prisma.scheduledMessage, 'create').mockResolvedValue({
      id: 'sched_1',
      conversationId: 'conv_1',
      senderId: 'user_1',
      body: 'Scheduled text',
      scheduledFor: futureDate,
      status: 'PENDING',
      metadata: null,
      createdAt: new Date(),
    } as any);

    const result = await service.create('user_1', {
      conversationId: 'conv_1',
      body: 'Scheduled text',
      scheduledFor: futureDate.toISOString(),
    });

    expect(result.id).toBe('sched_1');
    expect(result.body).toBe('Scheduled text');
    expect(result.status).toBe('PENDING');
  });

  it('lists scheduled messages with and without conversationId filter', async () => {
    vi.spyOn(prisma.scheduledMessage, 'findMany').mockResolvedValue([
      {
        id: 'sched_1',
        conversationId: 'conv_1',
        senderId: 'user_1',
        body: 'Text 1',
        scheduledFor: new Date(),
        status: 'PENDING',
        metadata: null,
        createdAt: new Date(),
      },
    ] as any);

    const list1 = await service.list('user_1');
    expect(list1).toHaveLength(1);

    const list2 = await service.list('user_1', 'conv_1');
    expect(list2).toHaveLength(1);
  });

  it('cancels pending scheduled message', async () => {
    vi.spyOn(prisma.scheduledMessage, 'updateMany').mockResolvedValue({ count: 1 });

    const result = await service.cancel('sched_1', 'user_1');
    expect(result).toBe(true);
  });

  it('throws notFound if message does not exist on cancel failure', async () => {
    vi.spyOn(prisma.scheduledMessage, 'updateMany').mockResolvedValue({ count: 0 });
    vi.spyOn(prisma.scheduledMessage, 'findUnique').mockResolvedValue(null);

    await expect(service.cancel('sched_1', 'user_1')).rejects.toThrow('Scheduled message not found');
  });

  it('throws forbidden if cancelling another user message', async () => {
    vi.spyOn(prisma.scheduledMessage, 'updateMany').mockResolvedValue({ count: 0 });
    vi.spyOn(prisma.scheduledMessage, 'findUnique').mockResolvedValue({
      id: 'sched_1',
      senderId: 'user_2',
      status: 'PENDING',
    } as any);

    await expect(service.cancel('sched_1', 'user_1')).rejects.toThrow(
      'You cannot cancel another user\'s scheduled message',
    );
  });

  it('throws badRequest if cancelling a non-pending message', async () => {
    vi.spyOn(prisma.scheduledMessage, 'updateMany').mockResolvedValue({ count: 0 });
    vi.spyOn(prisma.scheduledMessage, 'findUnique').mockResolvedValue({
      id: 'sched_1',
      senderId: 'user_1',
      status: 'SENT',
    } as any);

    await expect(service.cancel('sched_1', 'user_1')).rejects.toThrow(
      'Cannot cancel scheduled message with status SENT',
    );
  });
});
