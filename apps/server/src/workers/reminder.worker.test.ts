import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ReminderWorker } from './reminder.worker.js';
import { prisma } from '../db/client.js';

describe('ReminderWorker', () => {
  let worker: ReminderWorker;
  let mockIo: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
    worker = new ReminderWorker({
      intervalMs: 100,
      ioProvider: () => mockIo,
    });
  });

  afterEach(() => {
    worker.stop();
  });

  it('does nothing when no reminders are due', async () => {
    vi.spyOn(prisma.reminder, 'findMany').mockResolvedValue([]);
    const count = await worker.processDueReminders();
    expect(count).toBe(0);
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  it('processes and delivers due reminders via socket emission', async () => {
    const dueTime = new Date(Date.now() - 1000);
    const mockReminder = {
      id: 'rem_1',
      userId: 'user_alice',
      text: 'Stand up and stretch',
      conversationId: 'conv_1',
      dueAt: dueTime,
      status: 'PENDING',
      createdAt: new Date(),
    };

    vi.spyOn(prisma.reminder, 'findMany').mockResolvedValue([mockReminder] as any);
    vi.spyOn(prisma.reminder, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(prisma.reminder, 'update').mockResolvedValue({
      ...mockReminder,
      status: 'SENT',
    } as any);

    const count = await worker.processDueReminders();
    expect(count).toBe(1);

    // Verified atomic claim
    expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
      where: { id: 'rem_1', status: 'PENDING' },
      data: { status: 'CLAIMED' },
    });

    // Verified socket emission
    expect(mockIo.to).toHaveBeenCalledWith('user:user_alice');
    expect(mockIo.emit).toHaveBeenCalledWith('notification:reminder', {
      id: 'rem_1',
      text: 'Stand up and stretch',
      conversationId: 'conv_1',
      dueAt: dueTime.toISOString(),
    });

    // Verified status update to SENT
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'rem_1' },
      data: { status: 'SENT' },
    });
  });

  it('skips processing if reminder was claimed by concurrent worker', async () => {
    const dueTime = new Date(Date.now() - 1000);
    const mockReminder = {
      id: 'rem_2',
      userId: 'user_bob',
      text: 'Deploy staging',
      conversationId: null,
      dueAt: dueTime,
      status: 'PENDING',
      createdAt: new Date(),
    };

    vi.spyOn(prisma.reminder, 'findMany').mockResolvedValue([mockReminder] as any);
    vi.spyOn(prisma.reminder, 'updateMany').mockResolvedValue({ count: 0 }); // Claim lost

    const count = await worker.processDueReminders();
    expect(count).toBe(0);
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  it('starts and stops gracefully', () => {
    expect(() => worker.start()).not.toThrow();
    expect(() => worker.stop()).not.toThrow();
  });
});
