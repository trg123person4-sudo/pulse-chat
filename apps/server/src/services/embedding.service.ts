import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class EmbeddingService {
  isConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== '');
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (!this.isConfigured()) return null;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text: trimmed }],
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        logger.warn({ status: response.status, errText }, 'Gemini embedding API returned error status');
        return null;
      }

      const data = (await response.json()) as any;
      const values = data?.embedding?.values;
      if (Array.isArray(values) && values.length > 0) {
        return values;
      }
      return null;
    } catch (err) {
      logger.warn({ err }, 'Failed to generate embedding via Gemini API');
      return null;
    }
  }
}

export const embeddingService = new EmbeddingService();
