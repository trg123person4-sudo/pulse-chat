import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiService } from './ai.service.js';
import { prisma } from '../db/client.js';

describe('AIService', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
  });

  describe('translateText', () => {
    it('returns empty text unchanged if input is empty or whitespace', async () => {
      const result = await aiService.translateText('   ', 'es');
      expect(result).toEqual({
        originalText: '   ',
        translatedText: '   ',
        targetLanguage: 'es',
        source: 'llm',
      });
    });

    it('honestly returns source unavailable and null translatedText when GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const result = await aiService.translateText('Hello world', 'es');
      expect(result.source).toBe('unavailable');
      expect(result.translatedText).toBeNull();
      expect(result.originalText).toBe('Hello world');
      expect(result.targetLanguage).toBe('es');
    });

    it('translates successfully with Gemini and marks source as llm', async () => {
      process.env.GEMINI_API_KEY = 'test_gemini_key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '¡Hola Mundo!' }],
              },
            },
          ],
        }),
      } as any);

      const result = await aiService.translateText('Hello World', 'es');
      expect(result.source).toBe('llm');
      expect(result.translatedText).toBe('¡Hola Mundo!');
      expect(result.originalText).toBe('Hello World');
    });

    it('returns source unavailable when Gemini call fails instead of faking translation', async () => {
      process.env.GEMINI_API_KEY = 'test_gemini_key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      const result = await aiService.translateText('Hello World', 'es');
      expect(result.source).toBe('unavailable');
      expect(result.translatedText).toBeNull();
    });
  });

  describe('checkTone', () => {
    it('returns gentle and heuristic for short or trivial text', async () => {
      const result = await aiService.checkTone('hi');
      expect(result.label).toBe('gentle');
      expect(result.source).toBe('heuristic');
    });

    it('detects harsh text with fast heuristic pass', async () => {
      const result = await aiService.checkTone('YOU IDIOT THIS IS A COMPLETE WASTE OF TIME AND STUPID!!!');
      expect(result.label).toBe('harsh');
      expect(result.source).toBe('heuristic');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.suggestion).toBeDefined();
    });

    it('returns heuristic for ambiguous text when GEMINI_API_KEY is not set', async () => {
      delete process.env.GEMINI_API_KEY;
      const result = await aiService.checkTone('Can we please make sure this is delivered by Friday without delays?');
      expect(result.source).toBe('heuristic');
      expect(result.label).toBeDefined();
    });

    it('escalates ambiguous text to Gemini when GEMINI_API_KEY is set', async () => {
      process.env.GEMINI_API_KEY = 'test_gemini_key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      score: 40,
                      label: 'neutral',
                      warnings: ['Tone is direct and could be phrased more collaboratively.'],
                      suggestion: 'Would it be possible to ensure this is delivered by Friday?',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any);

      const result = await aiService.checkTone('Can we please make sure this is delivered by Friday without delays?');
      expect(result.source).toBe('llm');
      expect(result.score).toBe(40);
      expect(result.label).toBe('neutral');
      expect(result.suggestion).toBe('Would it be possible to ensure this is delivered by Friday?');
    });
  });

  describe('catchUpSummary', () => {
    it('returns honest source heuristic when Gemini is not configured', async () => {
      delete process.env.GEMINI_API_KEY;
      vi.spyOn(prisma.conversation, 'findUnique').mockResolvedValue({
        id: 'c1',
        name: 'general',
        memberships: [{ lastReadMessageId: 'm1' }],
      } as any);

      vi.spyOn(prisma.message, 'findMany').mockResolvedValue([
        {
          id: 'm2',
          body: 'Did we finish the release?',
          sender: { displayName: 'Alice', username: 'alice' },
        },
        {
          id: 'm3',
          body: 'Yes, we shipped it today!',
          sender: { displayName: 'Bob', username: 'bob' },
        },
      ] as any);

      const result = await aiService.catchUpSummary('c1', 'u1');
      expect(result.source).toBe('heuristic');
      expect(result.channelName).toBe('general');
      expect(result.summary).toBeDefined();
    });

    it('returns source llm when Gemini succeeds', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      vi.spyOn(prisma.conversation, 'findUnique').mockResolvedValue({
        id: 'c1',
        name: 'engineering',
        memberships: [{ lastReadMessageId: null }],
      } as any);

      vi.spyOn(prisma.message, 'findMany').mockResolvedValue([
        {
          id: 'm2',
          body: 'Database migration is done.',
          sender: { displayName: 'Alice', username: 'alice' },
        },
      ] as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: 'Alice completed the database migration.',
                      bulletPoints: ['Database migration completed'],
                      actionItems: ['Verify staging'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any);

      const result = await aiService.catchUpSummary('c1', 'u1');
      expect(result.source).toBe('llm');
      expect(result.summary).toBe('Alice completed the database migration.');
    });
  });

  describe('smartReplies', () => {
    it('returns source heuristic when Gemini is unconfigured', async () => {
      delete process.env.GEMINI_API_KEY;
      vi.spyOn(prisma.message, 'findMany').mockResolvedValue([
        {
          id: 'm1',
          body: 'We shipped it!',
          sender: { displayName: 'Alice', username: 'alice' },
        },
      ] as any);

      const result = await aiService.smartReplies('c1', 'u1');
      expect(result.source).toBe('heuristic');
      expect(result.replies.length).toBeGreaterThan(0);
    });

    it('returns source llm when Gemini generates replies', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      vi.spyOn(prisma.message, 'findMany').mockResolvedValue([
        {
          id: 'm1',
          body: 'Can we sync at 3pm?',
          sender: { displayName: 'Alice', username: 'alice' },
        },
      ] as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replies: ['Works for me!', 'Let me check', 'Sent invite'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any);

      const result = await aiService.smartReplies('c1', 'u1');
      expect(result.source).toBe('llm');
      expect(result.replies).toEqual(['Works for me!', 'Let me check', 'Sent invite']);
    });
  });
});
