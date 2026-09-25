import { prisma } from '../db/client.js';
import { uploadService } from './upload.service.js';
import { AppError } from '../errors/app-error.js';
import { CustomEmojiDto } from '@realtime-chat/shared';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export class CustomEmojiService {
  async createCustomEmoji(
    userId: string,
    shortcode: string,
    file: Express.Multer.File,
    conversationId?: string,
  ): Promise<CustomEmojiDto> {
    const cleanShortcode = shortcode.trim().replace(/^:|:$/g, '').toLowerCase();
    if (!cleanShortcode || !/^[a-z0-9_-]{2,32}$/.test(cleanShortcode)) {
      throw AppError.badRequest(
        'Shortcode must be 2-32 characters long and contain only letters, numbers, hyphens, and underscores',
      );
    }

    if (!file || !file.buffer) {
      throw AppError.badRequest('No image file provided');
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw AppError.badRequest('Custom emoji must be an image (PNG, JPEG, GIF, or WebP)');
    }

    // Check unique shortcode per workspace/conversation
    const existing = await prisma.customEmoji.findFirst({
      where: {
        shortcode: cleanShortcode,
        conversationId: conversationId || null,
      },
    });

    if (existing) {
      throw AppError.conflict(`Custom emoji :${cleanShortcode}: already exists`);
    }

    // Upload via uploadService
    const attachment = await uploadService.uploadFile(userId, file, conversationId);

    const emoji = await prisma.customEmoji.create({
      data: {
        shortcode: cleanShortcode,
        imageUrl: attachment.url,
        uploadedById: userId,
        conversationId: conversationId || null,
      },
    });

    return {
      id: emoji.id,
      shortcode: emoji.shortcode,
      imageUrl: emoji.imageUrl,
      uploadedById: emoji.uploadedById,
      conversationId: emoji.conversationId,
      createdAt: emoji.createdAt.toISOString(),
    };
  }

  async listCustomEmojis(conversationId?: string): Promise<CustomEmojiDto[]> {
    const emojis = await prisma.customEmoji.findMany({
      where: conversationId
        ? { OR: [{ conversationId }, { conversationId: null }] }
        : {},
      orderBy: { shortcode: 'asc' },
    });

    return emojis.map((e) => ({
      id: e.id,
      shortcode: e.shortcode,
      imageUrl: e.imageUrl,
      uploadedById: e.uploadedById,
      conversationId: e.conversationId,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}

export const customEmojiService = new CustomEmojiService();
