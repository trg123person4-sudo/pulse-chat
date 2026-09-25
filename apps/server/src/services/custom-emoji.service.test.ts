import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomEmojiService } from './custom-emoji.service.js';
import { prisma } from '../db/client.js';
import { uploadService } from './upload.service.js';

describe('CustomEmojiService', () => {
  let service: CustomEmojiService;

  beforeEach(() => {
    service = new CustomEmojiService();
    vi.restoreAllMocks();
  });

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'party_parrot.gif',
    encoding: '7bit',
    mimetype: 'image/gif',
    buffer: Buffer.from('GIF89a'),
    size: 6,
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  it('rejects shortcodes with invalid characters or bad length', async () => {
    await expect(
      service.createCustomEmoji('user_1', 'x', mockFile),
    ).rejects.toThrow('Shortcode must be 2-32 characters long');

    await expect(
      service.createCustomEmoji('user_1', 'bad name with spaces!', mockFile),
    ).rejects.toThrow('Shortcode must be 2-32 characters long');
  });

  it('rejects unsupported file mime types', async () => {
    const invalidFile = { ...mockFile, mimetype: 'application/pdf' };
    await expect(
      service.createCustomEmoji('user_1', 'parrot', invalidFile),
    ).rejects.toThrow('Custom emoji must be an image');
  });

  it('rejects duplicate shortcode within scope', async () => {
    vi.spyOn(prisma.customEmoji, 'findFirst').mockResolvedValue({
      id: 'emoji_1',
      shortcode: 'parrot',
      imageUrl: '/uploads/parrot.gif',
      uploadedById: 'user_1',
      conversationId: null,
      createdAt: new Date(),
    } as any);

    await expect(
      service.createCustomEmoji('user_1', ':parrot:', mockFile),
    ).rejects.toThrow('Custom emoji :parrot: already exists');
  });

  it('successfully creates and returns custom emoji', async () => {
    vi.spyOn(prisma.customEmoji, 'findFirst').mockResolvedValue(null);
    vi.spyOn(uploadService, 'uploadFile').mockResolvedValue({
      id: 'att_1',
      fileName: 'party_parrot.gif',
      fileSize: 6,
      mimeType: 'image/gif',
      url: '/uploads/att_1-party_parrot.gif',
      storageKey: 'attachments/att_1-party_parrot.gif',
      createdAt: new Date().toISOString(),
    });

    vi.spyOn(prisma.customEmoji, 'create').mockResolvedValue({
      id: 'emoji_1',
      shortcode: 'party_parrot',
      imageUrl: '/uploads/att_1-party_parrot.gif',
      uploadedById: 'user_1',
      conversationId: null,
      createdAt: new Date(),
    } as any);

    const result = await service.createCustomEmoji('user_1', ':party_parrot:', mockFile);
    expect(result.id).toBe('emoji_1');
    expect(result.shortcode).toBe('party_parrot');
    expect(result.imageUrl).toBe('/uploads/att_1-party_parrot.gif');
  });

  it('lists custom emojis', async () => {
    vi.spyOn(prisma.customEmoji, 'findMany').mockResolvedValue([
      {
        id: 'emoji_1',
        shortcode: 'party_parrot',
        imageUrl: '/uploads/parrot.gif',
        uploadedById: 'user_1',
        conversationId: null,
        createdAt: new Date(),
      },
    ] as any);

    const emojis = await service.listCustomEmojis();
    expect(emojis).toHaveLength(1);
    expect(emojis[0].shortcode).toBe('party_parrot');
  });
});
