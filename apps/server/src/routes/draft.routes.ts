import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { draftService } from '../services/draft.service.js';
import { AppError } from '../errors/app-error.js';

export const draftRouter = Router();

draftRouter.get('/:conversationId', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const { conversationId } = req.params;
    const draft = await draftService.getDraft(userId, conversationId);
    res.json(draft || { conversationId, text: '', updatedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

draftRouter.put('/:conversationId', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const { conversationId } = req.params;
    const { text } = req.body;
    const draft = await draftService.saveDraft(userId, conversationId, typeof text === 'string' ? text : '');
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

draftRouter.delete('/:conversationId', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const { conversationId } = req.params;
    await draftService.deleteDraft(userId, conversationId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
