import { prisma } from '../db/client.js';
import { DraftDto } from '@realtime-chat/shared';

export class DraftService {
  async getDraft(userId: string, conversationId: string): Promise<DraftDto | null> {
    const draft = await prisma.draft.findUnique({
      where: {
        userId_conversationId: { userId, conversationId },
      },
    });

    if (!draft) return null;

    return {
      conversationId: draft.conversationId,
      text: draft.text,
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  async saveDraft(userId: string, conversationId: string, text: string): Promise<DraftDto> {
    const trimmed = text.trim();
    if (!trimmed) {
      await this.deleteDraft(userId, conversationId);
      return {
        conversationId,
        text: '',
        updatedAt: new Date().toISOString(),
      };
    }

    const draft = await prisma.draft.upsert({
      where: {
        userId_conversationId: { userId, conversationId },
      },
      create: {
        userId,
        conversationId,
        text,
      },
      update: {
        text,
      },
    });

    return {
      conversationId: draft.conversationId,
      text: draft.text,
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  async deleteDraft(userId: string, conversationId: string): Promise<void> {
    try {
      await prisma.draft.delete({
        where: {
          userId_conversationId: { userId, conversationId },
        },
      });
    } catch {
      // Ignore if draft doesn't exist
    }
  }
}

export const draftService = new DraftService();
