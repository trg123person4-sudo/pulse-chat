import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { embeddingService } from '../services/embedding.service.js';

export interface EmbeddingWorkerOptions {
  intervalMs?: number;
  batchSize?: number;
  embedder?: (text: string) => Promise<number[] | null>;
}

export class EmbeddingWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private intervalMs: number;
  private batchSize: number;
  private embedder: (text: string) => Promise<number[] | null>;

  constructor(options?: EmbeddingWorkerOptions) {
    this.intervalMs = options?.intervalMs ?? 3000;
    this.batchSize = options?.batchSize ?? 10;
    this.embedder = options?.embedder ?? ((text) => embeddingService.generateEmbedding(text));
  }

  start(): void {
    if (this.timer) return;
    logger.info({ intervalMs: this.intervalMs }, `EmbeddingWorker started (polling every ${this.intervalMs}ms)`);
    this.timer = setInterval(() => {
      this.processUnembeddedMessages().catch((err) => {
        logger.error({ err }, 'Error in EmbeddingWorker poll cycle');
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('EmbeddingWorker stopped');
    }
  }

  async processUnembeddedMessages(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      let unembedded: Array<{ id: string; body: string }> = [];
      try {
        unembedded = await prisma.$queryRaw<Array<{ id: string; body: string }>>`
          SELECT id, body FROM messages
          WHERE embedding IS NULL AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
          LIMIT ${this.batchSize};
        `;
      } catch {
        return 0;
      }

      if (!unembedded || unembedded.length === 0) {
        return 0;
      }

      let embeddedCount = 0;
      for (const msg of unembedded) {
        const vector = await this.embedder(msg.body);
        if (vector && Array.isArray(vector) && vector.length > 0) {
          const vectorStr = `[${vector.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE messages SET embedding = $1::vector WHERE id = $2`,
            vectorStr,
            msg.id,
          );
          embeddedCount++;
        }
      }

      return embeddedCount;
    } catch (err) {
      logger.warn({ err }, 'Failed to process unembedded messages');
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }
}

export const embeddingWorker = new EmbeddingWorker();
