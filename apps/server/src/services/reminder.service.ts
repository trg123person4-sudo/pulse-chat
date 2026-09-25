import { prisma } from '../db/client.js';
import { AppError } from '../errors/app-error.js';
import { ReminderDto } from '@realtime-chat/shared';

export class ReminderService {
  async createReminder(
    userId: string,
    text: string,
    dueAt: Date,
    conversationId?: string,
  ): Promise<ReminderDto> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw AppError.badRequest('Reminder text is required');
    }

    if (isNaN(dueAt.getTime()) || dueAt.getTime() <= Date.now()) {
      throw AppError.badRequest('Reminder time must be in the future');
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId,
        conversationId: conversationId || null,
        text: trimmed,
        dueAt,
        status: 'PENDING',
      },
    });

    return {
      id: reminder.id,
      userId: reminder.userId,
      conversationId: reminder.conversationId,
      text: reminder.text,
      dueAt: reminder.dueAt.toISOString(),
      status: reminder.status as any,
      createdAt: reminder.createdAt.toISOString(),
    };
  }

  async listReminders(userId: string): Promise<ReminderDto[]> {
    const reminders = await prisma.reminder.findMany({
      where: { userId },
      orderBy: { dueAt: 'asc' },
    });

    return reminders.map((r) => ({
      id: r.id,
      userId: r.userId,
      conversationId: r.conversationId,
      text: r.text,
      dueAt: r.dueAt.toISOString(),
      status: r.status as any,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async cancelReminder(id: string, userId: string): Promise<void> {
    const reminder = await prisma.reminder.findUnique({
      where: { id },
    });

    if (!reminder) {
      throw AppError.notFound('Reminder not found');
    }

    if (reminder.userId !== userId) {
      throw AppError.forbidden('You can only cancel your own reminders');
    }

    if (reminder.status !== 'PENDING') {
      throw AppError.badRequest(`Cannot cancel reminder with status ${reminder.status}`);
    }

    await prisma.reminder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}

export const reminderService = new ReminderService();
