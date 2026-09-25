import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware.js';
import { customEmojiService } from '../services/custom-emoji.service.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

export const customEmojiRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_BYTES,
  },
});

customEmojiRouter.post(
  '/',
  requireAuth,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw AppError.unauthorized('Authentication required');

      const { shortcode, conversationId } = req.body;
      if (!shortcode) throw AppError.badRequest('shortcode is required');
      if (!req.file) throw AppError.badRequest('Image file is required');

      const emoji = await customEmojiService.createCustomEmoji(
        userId,
        shortcode,
        req.file,
        conversationId,
      );
      res.status(201).json(emoji);
    } catch (err) {
      next(err);
    }
  },
);

customEmojiRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const conversationId = req.query.conversationId as string | undefined;
    const emojis = await customEmojiService.listCustomEmojis(conversationId);
    res.json(emojis);
  } catch (err) {
    next(err);
  }
});
