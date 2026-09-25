import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReminderService } from './reminder.service.js';
import { prisma } from '../db/client.js';
import { AppError } from '../errors/app-error.js';

describe('ReminderService', () => {
  let reminderService: ReminderService;

  beforeEach(() => {
    reminderService = new ReminderService();
    vi.restoreAllMocks();
  });

  it('rejects empty reminder text', async () => {
    await expect(
      reminderService.createReminder('user_1', '   ', new Date(Date.now() + 10000)),
    ).rejects.toThrow(AppError);
  });

  it('rejects past or invalid reminder time', async () => {
    await expect(
      reminderService.createReminder('user_1', 'Call Alice', new Date(Date.now() - 10000)),
    ).rejects.toThrow(AppError);

    await expect(
      reminderService.createReminder('user_1', 'Call Alice', new Date('invalid-date')),
    ).rejects.toThrow(AppError);
  });

  it('creates reminder successfully with future time', async () => {
    const future = new Date(Date.now() + 60000);
    const mockCreated = {
      id: 'rem_1',
      userId: 'user_1',
      conversationId: 'conv_1',
      text: 'Standup meeting',
      dueAt: future,
      status: 'PENDING',
      createdAt: new Date(),
    };

    vi.spyOn(prisma.reminder, 'create').mockResolvedValue(mockCreated as any);

    const result = await reminderService.createReminder('user_1', 'Standup meeting', future, 'conv_1');
    expect(result.id).toBe('rem_1');
    expect(result.text).toBe('Standup meeting');
    expect(result.status).toBe('PENDING');
  });

  it('lists reminders for a user', async () => {
    const mockList = [
      {
        id: 'rem_1',
        userId: 'user_1',
        conversationId: null,
        text: 'Review PR',
        dueAt: new Date(Date.now() + 30000),
        status: 'PENDING',
        createdAt: new Date(),
      },
    ];

    vi.spyOn(prisma.reminder, 'findMany').mockResolvedValue(mockList as any);

    const result = await reminderService.listReminders('user_1');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Review PR');
  });

  it('cancels pending reminder owned by the user', async () => {
    vi.spyOn(prisma.reminder, 'findUnique').mockResolvedValue({
      id: 'rem_1',
      userId: 'user_1',
      status: 'PENDING',
    } as any);

    const updateSpy = vi.spyOn(prisma.reminder, 'update').mockResolvedValue({} as any);

    await reminderService.cancelReminder('rem_1', 'user_1');
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'rem_1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('throws not found when cancelling non-existent reminder', async () => {
    vi.spyOn(prisma.reminder, 'findUnique').mockResolvedValue(null);

    await expect(reminderService.cancelReminder('non_existent', 'user_1')).rejects.toThrow(
      'Reminder not found',
    );
  });

  it('throws forbidden when cancelling another user reminder', async () => {
    vi.spyOn(prisma.reminder, 'findUnique').mockResolvedValue({
      id: 'rem_1',
      userId: 'other_user',
      status: 'PENDING',
    } as any);

    await expect(reminderService.cancelReminder('rem_1', 'user_1')).rejects.toThrow(
      'You can only cancel your own reminders',
    );
  });

  it('throws bad request when cancelling a non-pending reminder', async () => {
    vi.spyOn(prisma.reminder, 'findUnique').mockResolvedValue({
      id: 'rem_1',
      userId: 'user_1',
      status: 'SENT',
    } as any);

    await expect(reminderService.cancelReminder('rem_1', 'user_1')).rejects.toThrow(
      'Cannot cancel reminder with status SENT',
    );
  });
});
