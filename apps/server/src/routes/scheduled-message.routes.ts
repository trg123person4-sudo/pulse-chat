import { Router, Request, Response, NextFunction } from 'express';
import { scheduleMessageSchema } from '@realtime-chat/shared';
import { scheduledMessageService } from '../services/scheduled-message.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const scheduledMessageRouter = Router();

// All scheduled message endpoints require authentication
scheduledMessageRouter.use(requireAuth);

// Schedule a new message
scheduledMessageRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = scheduleMessageSchema.parse(req.body);
      const scheduled = await scheduledMessageService.create(req.user!.userId, validated);
      res.status(201).json({
        ok: true,
        data: scheduled,
      });
    } catch (err) {
      next(err);
    }
  },
);

// List pending scheduled messages
scheduledMessageRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversationId = req.query.conversationId as string | undefined;
      const scheduled = await scheduledMessageService.list(req.user!.userId, conversationId);
      res.status(200).json({
        ok: true,
        data: scheduled,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Cancel a pending scheduled message
scheduledMessageRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await scheduledMessageService.cancel(req.params.id, req.user!.userId);
      res.status(200).json({
        ok: true,
        data: { id: req.params.id, cancelled: true },
      });
    } catch (err) {
      next(err);
    }
  },
);
