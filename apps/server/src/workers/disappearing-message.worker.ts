import { prisma } from '../db/client.js';
import { messageService } from '../services/message.service.js';
import { getIO, TypedSocketServer } from '../socket/index.js';
import { logger } from '../utils/logger.js';

export interface DisappearingWorkerOptions {
  intervalMs?: number;
  getNow?: () => Date;
  ioProvider?: () => TypedSocketServer | null;
}

export class DisappearingMessageWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private getNow: () => Date;
  private ioProvider?: () => TypedSocketServer | null;
  private intervalMs: number;

  constructor(options?: DisappearingWorkerOptions) {
    this.intervalMs = options?.intervalMs ?? 10000;
    this.getNow = options?.getNow ?? (() => new Date());
    this.ioProvider = options?.ioProvider;
  }

  async processDisappearingMessages(customNow?: Date): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const now = customNow ?? this.getNow();

      // Find all conversations that have an active disappearing messages policy
      const conversations = await prisma.conversation.findMany({
        where: {
          disappearingAfterSeconds: {
            not: null,
            gt: 0,
          },
        },
        select: {
          id: true,
          disappearingAfterSeconds: true,
        },
      });

      let totalDeleted = 0;

      for (const conv of conversations) {
        if (!conv.disappearingAfterSeconds) continue;

        const thresholdDate = new Date(now.getTime() - conv.disappearingAfterSeconds * 1000);

        // Find messages older than the conversation's retention window that haven't been soft-deleted yet
        const expiredMessages = await prisma.message.findMany({
          where: {
            conversationId: conv.id,
            deletedAt: null,
            createdAt: { lte: thresholdDate },
          },
          select: { id: true },
          take: 100,
        });

        for (const msg of expiredMessages) {
          try {
            // Soft-delete through the exact same messageService.delete method
            const deleted = await messageService.delete(msg.id, 'system', {
              isSystem: true,
              deletedAt: now,
            });

            // Broadcast message:deleted to the conversation room so clients update in real-time
            try {
              const io = this.ioProvider ? this.ioProvider() : getIO();
              if (io) {
                io.to(`conv:${deleted.conversationId}`).emit('message:deleted', deleted);
              }
            } catch (broadcastErr) {
              logger.debug({ err: broadcastErr, id: msg.id }, 'Socket.IO broadcast skipped for disappearing message');
            }

            totalDeleted++;
          } catch (deleteErr: any) {
            logger.warn({ err: deleteErr, messageId: msg.id }, 'Failed to soft-delete disappearing message');
          }
        }
      }

      return totalDeleted;
    } finally {
      this.isProcessing = false;
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.processDisappearingMessages().catch((err) => {
        logger.error({ err }, 'Error in DisappearingMessageWorker cycle');
      });
    }, this.intervalMs);
    if (this.timer.unref) {
      this.timer.unref();
    }
    logger.info(`DisappearingMessageWorker started (polling every ${this.intervalMs}ms)`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('DisappearingMessageWorker stopped');
    }
  }
}

export function startDisappearingMessageWorker(options?: DisappearingWorkerOptions): DisappearingMessageWorker {
  const worker = new DisappearingMessageWorker(options);
  worker.start();
  return worker;
}
