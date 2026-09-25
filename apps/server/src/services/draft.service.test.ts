import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DraftService } from './draft.service.js';
import { prisma } from '../db/client.js';

describe('DraftService', () => {
  let service: DraftService;

  beforeEach(() => {
    service = new DraftService();
    vi.restoreAllMocks();
  });

  it('returns null when draft does not exist', async () => {
    vi.spyOn(prisma.draft, 'findUnique').mockResolvedValue(null);
    const draft = await service.getDraft('user_1', 'conv_1');
    expect(draft).toBeNull();
  });

  it('returns draft dto when draft exists', async () => {
    const now = new Date();
    vi.spyOn(prisma.draft, 'findUnique').mockResolvedValue({
      id: 'd_1',
      userId: 'user_1',
      conversationId: 'conv_1',
      text: 'Working draft message',
      createdAt: now,
      updatedAt: now,
    });

    const draft = await service.getDraft('user_1', 'conv_1');
    expect(draft).not.toBeNull();
    expect(draft?.text).toBe('Working draft message');
    expect(draft?.conversationId).toBe('conv_1');
  });

  it('saves draft via upsert when non-empty text provided', async () => {
    const now = new Date();
    vi.spyOn(prisma.draft, 'upsert').mockResolvedValue({
      id: 'd_1',
      userId: 'user_1',
      conversationId: 'conv_1',
      text: 'Saved draft message',
      createdAt: now,
      updatedAt: now,
    });

    const res = await service.saveDraft('user_1', 'conv_1', 'Saved draft message');
    expect(res.text).toBe('Saved draft message');
    expect(prisma.draft.upsert).toHaveBeenCalledWith({
      where: {
        userId_conversationId: { userId: 'user_1', conversationId: 'conv_1' },
      },
      create: {
        userId: 'user_1',
        conversationId: 'conv_1',
        text: 'Saved draft message',
      },
      update: {
        text: 'Saved draft message',
      },
    });
  });

  it('clears draft when saving empty or whitespace string', async () => {
    vi.spyOn(prisma.draft, 'delete').mockResolvedValue({} as any);

    const res = await service.saveDraft('user_1', 'conv_1', '   ');
    expect(res.text).toBe('');
    expect(prisma.draft.delete).toHaveBeenCalled();
  });

  it('deletes draft safely without throwing when nonexistent', async () => {
    vi.spyOn(prisma.draft, 'delete').mockRejectedValue(new Error('Record not found'));
    await expect(service.deleteDraft('user_1', 'conv_1')).resolves.not.toThrow();
  });
});
