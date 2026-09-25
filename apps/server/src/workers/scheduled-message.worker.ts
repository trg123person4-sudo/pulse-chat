import { prisma } from '../db/client.js';
import { messageService } from '../services/message.service.js';
import { getIO, TypedSocketServer } from '../socket/index.js';
import { logger } from '../utils/logger.js';

export interface ScheduledWorkerOptions {
  intervalMs?: number;
  getNow?: () => Date;
  ioProvider?: () => TypedSocketServer | null;
}

export class ScheduledMessageWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private getNow: () => Date;
  private ioProvider?: () => TypedSocketServer | null;
  private intervalMs: number;

  constructor(options?: ScheduledWorkerOptions) {
    this.intervalMs = options?.intervalMs ?? 5000;
    this.getNow = options?.getNow ?? (() => new Date());
    this.ioProvider = options?.ioProvider;
  }

  async processDueMessages(customNow?: Date): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const now = customNow ?? this.getNow();

      // Find candidates that are currently due
      const candidates = await prisma.scheduledMessage.findMany({
        where: {
          status: 'PENDING',
          scheduledFor: { lte: now },
        },
        take: 50,
        orderBy: { scheduledFor: 'asc' },
      });

      let processedCount = 0;

      for (const candidate of candidates) {
        // ponytail: conditional updateMany claim per message; advisory lock or pg_partman if batch throughput > 10k/sec
        // Atomic conditional claim: exactly one server instance succeeds in transitioning PENDING -> CLAIMED
        const claimResult = await prisma.scheduledMessage.updateMany({
          where: {
            id: candidate.id,
            status: 'PENDING',
          },
          data: {
            status: 'CLAIMED',
          },
        });

        if (claimResult.count === 0) {
          // Another concurrent worker claimed or cancelled this message
          continue;
        }

        try {
          // Send through exact same persistence path as normal message
          const message = await messageService.create(candidate.senderId, {
            conversationId: candidate.conversationId,
            clientMessageId: `scheduled-${candidate.id}`,
            body: candidate.body,
            metadata: candidate.metadata || undefined,
          });

          // Broadcast through exact same room broadcast path as normal message
          try {
            const io = this.ioProvider ? this.ioProvider() : getIO();
            if (io) {
              io.to(`conv:${candidate.conversationId}`).emit('message:created', message);
            }
          } catch (broadcastErr) {
            // Socket server might not be running in tests or offline
            logger.debug({ err: broadcastErr, id: candidate.id }, 'Socket.IO broadcast skipped or failed for scheduled message');
          }

          // Mark SENT
          await prisma.scheduledMessage.update({
            where: { id: candidate.id },
            data: { status: 'SENT' },
          });

          processedCount++;
        } catch (deliveryErr: any) {
          logger.error({ err: deliveryErr, id: candidate.id }, 'Error delivering scheduled message; marking FAILED');
          await prisma.scheduledMessage.update({
            where: { id: candidate.id },
            data: { status: 'FAILED' },
          }).catch(() => {});
        }
      }

      return processedCount;
    } finally {
      this.isProcessing = false;
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.processDueMessages().catch((err) => {
        logger.error({ err }, 'Error in ScheduledMessageWorker cycle');
      });
    }, this.intervalMs);
    // Unref so worker doesn't keep node process alive during tests
    if (this.timer.unref) {
      this.timer.unref();
    }
    logger.info(`ScheduledMessageWorker started (polling every ${this.intervalMs}ms)`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('ScheduledMessageWorker stopped');
    }
  }
}

export function startScheduledMessageWorker(options?: ScheduledWorkerOptions): ScheduledMessageWorker {
  const worker = new ScheduledMessageWorker(options);
  worker.start();
  return worker;
}
