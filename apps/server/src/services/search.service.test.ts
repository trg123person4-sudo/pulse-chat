import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService } from './search.service.js';
import { prisma } from '../db/client.js';

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService();
  });

  it('rejects search query shorter than 2 characters', async () => {
    await expect(searchService.searchGlobal('user_1', 'a')).rejects.toThrow(
      'Search query must be at least 2 characters long',
    );
  });

  it('returns highlighted search results for matching messages', async () => {
    vi.spyOn(prisma.membership, 'findMany').mockImplementation(async () => {
      return [{ conversationId: 'conv_1' }] as any;
    });

    vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('no tsvector in mock'));

    vi.spyOn(prisma.message, 'findMany').mockImplementation(async () => {
      return [
        {
          id: 'msg_1',
          conversationId: 'conv_1',
          senderId: 'user_alice',
          body: 'Deploying the Kubernetes cluster this afternoon',
          replyToId: null,
          clientMessageId: 'c1',
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
          createdAt: new Date(),
          sender: {
            id: 'user_alice',
            username: 'alice',
            displayName: 'Alice',
            avatarUrl: null,
            statusMessage: null,
          },
          conversation: {
            id: 'conv_1',
            name: 'devops',
            type: 'CHANNEL',
          },
          attachments: [],
          reactions: [],
        },
      ] as any;
    });

    const results = await searchService.searchGlobal('user_alice', 'Kubernetes');
    expect(results).toHaveLength(1);
    expect(results[0].message.id).toBe('msg_1');
    expect(results[0].highlight).toContain('<mark');
    expect(results[0].highlight).toContain('Kubernetes');
    expect(results[0].conversation.name).toBe('devops');
  });

  describe('searchSemantic', () => {
    it('returns honest keyword-only fallback when embeddings are unconfigured', async () => {
      vi.spyOn(prisma.membership, 'findMany').mockResolvedValue([
        { conversationId: 'conv_1' },
      ] as any);

      vi.spyOn(prisma.message, 'findMany').mockResolvedValue([
        {
          id: 'msg_kw',
          conversationId: 'conv_1',
          senderId: 'user_alice',
          body: 'Budget deadline tomorrow',
          replyToId: null,
          clientMessageId: 'c1',
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
          createdAt: new Date(),
          sender: {
            id: 'user_alice',
            username: 'alice',
            displayName: 'Alice',
            avatarUrl: null,
            statusMessage: null,
          },
          conversation: {
            id: 'conv_1',
            name: 'finance',
            type: 'CHANNEL',
          },
          attachments: [],
          reactions: [],
        },
      ] as any);

      const res = await searchService.searchSemantic('user_alice', 'budget deadline');
      expect(res.source).toBe('keyword-only');
      expect(res.warning).toContain('GEMINI_API_KEY');
      expect(res.results.length).toBeGreaterThanOrEqual(1);
    });

    it('merges vector and keyword results with hybrid-semantic labeling when embeddings configured', async () => {
      const { embeddingService } = await import('./embedding.service.js');
      vi.spyOn(embeddingService, 'isConfigured').mockReturnValue(true);
      vi.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(new Array(768).fill(0.01));

      vi.spyOn(prisma.membership, 'findMany').mockResolvedValue([
        { conversationId: 'conv_1' },
      ] as any);

      vi.spyOn(searchService as any, 'executeSearch').mockResolvedValue([
        {
          message: {
            id: 'msg_kw',
            conversationId: 'conv_1',
            senderId: 'user_alice',
            body: 'Budget deadline is Friday',
            replyToId: null,
            clientMessageId: 'c1',
            editedAt: null,
            deletedAt: null,
            deletedBy: null,
            createdAt: new Date().toISOString(),
            sender: {
              id: 'user_alice',
              username: 'alice',
              displayName: 'Alice',
              avatarUrl: null,
              statusMessage: null,
            },
            attachments: [],
            reactions: [],
            status: 'sent',
          },
          highlight: 'Budget deadline is Friday',
          conversation: {
            id: 'conv_1',
            name: 'finance',
            type: 'CHANNEL',
          },
        },
      ]);

      vi.spyOn(prisma, '$queryRaw').mockResolvedValue([
        {
          id: 'msg_sem',
          conversationId: 'conv_1',
          senderId: 'user_bob',
          body: 'Quarterly financial report timeline',
          replyToId: null,
          clientMessageId: 'c2',
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
          createdAt: new Date(),
          similarity: 0.88,
          highlight: 'Quarterly financial report timeline',
          sender_id: 'user_bob',
          sender_username: 'bob',
          sender_displayName: 'Bob',
          sender_avatarUrl: null,
          sender_statusMessage: null,
          conv_id: 'conv_1',
          conv_name: 'finance',
          conv_type: 'CHANNEL',
        },
      ] as any);

      const res = await searchService.searchSemantic('user_alice', 'fiscal planning');
      expect(res.source).toBe('hybrid-semantic');
      expect(res.results).toHaveLength(2);
      expect(res.results.some((r) => r.message.id === 'msg_sem')).toBe(true);
      expect(res.results.some((r) => r.message.id === 'msg_kw')).toBe(true);
    });
  });
});
