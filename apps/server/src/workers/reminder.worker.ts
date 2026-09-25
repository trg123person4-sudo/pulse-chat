import { Server } from 'socket.io';
import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';

export interface ReminderWorkerOptions {
  intervalMs?: number;
  getNow?: () => Date;
  ioProvider?: () => Server | null;
}

export class ReminderWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private intervalMs: number;
  private getNow: () => Date;
  private ioProvider: () => Server | null;

  constructor(options?: ReminderWorkerOptions) {
    this.intervalMs = options?.intervalMs ?? 1000;
    this.getNow = options?.getNow ?? (() => new Date());
    this.ioProvider = options?.ioProvider ?? (() => null);
  }

  setIoProvider(provider: () => Server | null): void {
    this.ioProvider = provider;
  }

  start(): void {
    if (this.timer) return;
    logger.info({ intervalMs: this.intervalMs }, `ReminderWorker started (polling every ${this.intervalMs}ms)`);
    this.timer = setInterval(() => {
      this.processDueReminders().catch((err) => {
        logger.error({ err }, 'Error in ReminderWorker execution cycle');
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('ReminderWorker stopped');
    }
  }

  async processDueReminders(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const now = this.getNow();

      const dueReminders = await prisma.reminder.findMany({
        where: {
          status: 'PENDING',
          dueAt: { lte: now },
        },
        orderBy: { dueAt: 'asc' },
        take: 50,
      });

      if (dueReminders.length === 0) {
        return 0;
      }

      let sentCount = 0;
      const io = this.ioProvider();

      for (const reminder of dueReminders) {
        // Atomic claim
        const claimResult = await prisma.reminder.updateMany({
          where: {
            id: reminder.id,
            status: 'PENDING',
          },
          data: {
            status: 'CLAIMED',
          },
        });

        if (claimResult.count === 0) {
          continue; // Claimed by another worker
        }

        try {
          if (io) {
            io.to(`user:${reminder.userId}`).emit('notification:reminder', {
              id: reminder.id,
              text: reminder.text,
              conversationId: reminder.conversationId,
              dueAt: reminder.dueAt.toISOString(),
            });
          }

          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: 'SENT' },
          });

          sentCount++;
        } catch (err) {
          logger.error({ err, reminderId: reminder.id }, 'Failed to deliver reminder notification');
        }
      }

      return sentCount;
    } finally {
      this.isProcessing = false;
    }
  }
}

export const reminderWorker = new ReminderWorker();
