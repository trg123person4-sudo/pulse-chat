import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmbeddingService } from './embedding.service.js';
import { env } from '../config/env.js';

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  const originalKey = env.GEMINI_API_KEY;

  beforeEach(() => {
    embeddingService = new EmbeddingService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (env as any).GEMINI_API_KEY = originalKey;
  });

  it('checks configuration status correctly based on GEMINI_API_KEY', () => {
    (env as any).GEMINI_API_KEY = 'test-key';
    expect(embeddingService.isConfigured()).toBe(true);

    (env as any).GEMINI_API_KEY = '';
    expect(embeddingService.isConfigured()).toBe(false);

    (env as any).GEMINI_API_KEY = undefined;
    expect(embeddingService.isConfigured()).toBe(false);
  });

  it('returns null if text is empty or blank', async () => {
    (env as any).GEMINI_API_KEY = 'test-key';
    expect(await embeddingService.generateEmbedding('')).toBeNull();
    expect(await embeddingService.generateEmbedding('   ')).toBeNull();
  });

  it('returns null if not configured', async () => {
    (env as any).GEMINI_API_KEY = '';
    expect(await embeddingService.generateEmbedding('hello world')).toBeNull();
  });

  it('generates embedding values successfully on 200 response', async () => {
    (env as any).GEMINI_API_KEY = 'test-key';
    const mockValues = [0.1, 0.2, 0.3];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        embedding: { values: mockValues },
      }),
    }));

    const result = await embeddingService.generateEmbedding('hello world');
    expect(result).toEqual(mockValues);
  });

  it('returns null if API returns error status', async () => {
    (env as any).GEMINI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    }));

    const result = await embeddingService.generateEmbedding('hello world');
    expect(result).toBeNull();
  });

  it('returns null if fetch throws an exception', async () => {
    (env as any).GEMINI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await embeddingService.generateEmbedding('hello world');
    expect(result).toBeNull();
  });

  it('returns null if response json has no valid embedding values', async () => {
    (env as any).GEMINI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: {} }),
    }));

    const result = await embeddingService.generateEmbedding('hello world');
    expect(result).toBeNull();
  });
});
