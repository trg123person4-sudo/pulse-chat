import { ScheduledMessageDto, ScheduleMessageInput } from '@realtime-chat/shared';
import { prisma } from '../db/client.js';
import { AppError } from '../errors/app-error.js';

export class ScheduledMessageService {
  private formatDto(record: any): ScheduledMessageDto {
    return {
      id: record.id,
      conversationId: record.conversationId,
      senderId: record.senderId,
      body: record.body,
      scheduledFor: record.scheduledFor instanceof Date ? record.scheduledFor.toISOString() : record.scheduledFor,
      status: record.status as any,
      metadata: record.metadata || null,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    };
  }

  async create(senderId: string, input: ScheduleMessageInput): Promise<ScheduledMessageDto> {
    const membership = await prisma.membership.findUnique({
      where: { userId_conversationId: { userId: senderId, conversationId: input.conversationId } },
    });

    if (!membership) {
      throw AppError.forbidden('Cannot schedule messages for a conversation you are not a member of');
    }

    if (membership.mutedUntil && new Date(membership.mutedUntil) > new Date()) {
      throw AppError.forbidden('You are muted in this conversation');
    }

    const scheduledDate = new Date(input.scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      throw AppError.badRequest('Invalid scheduledFor date');
    }

    const created = await prisma.scheduledMessage.create({
      data: {
        conversationId: input.conversationId,
        senderId,
        body: input.body,
        scheduledFor: scheduledDate,
        status: 'PENDING',
        metadata: input.metadata || null,
      },
    });

    return this.formatDto(created);
  }

  async list(userId: string, conversationId?: string): Promise<ScheduledMessageDto[]> {
    const where: any = {
      senderId: userId,
      status: 'PENDING',
    };

    if (conversationId) {
      where.conversationId = conversationId;
    }

    const records = await prisma.scheduledMessage.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
    });

    return records.map((r) => this.formatDto(r));
  }

  async cancel(id: string, userId: string): Promise<boolean> {
    const updated = await prisma.scheduledMessage.updateMany({
      where: {
        id,
        senderId: userId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (updated.count === 0) {
      const existing = await prisma.scheduledMessage.findUnique({ where: { id } });
      if (!existing) {
        throw AppError.notFound('Scheduled message not found');
      }
      if (existing.senderId !== userId) {
        throw AppError.forbidden('You cannot cancel another user\'s scheduled message');
      }
      throw AppError.badRequest(`Cannot cancel scheduled message with status ${existing.status}`);
    }

    return true;
  }
}

export const scheduledMessageService = new ScheduledMessageService();
