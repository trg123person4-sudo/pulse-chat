import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { reminderService } from '../services/reminder.service.js';
import { AppError } from '../errors/app-error.js';

export const reminderRouter = Router();

reminderRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const { text, dueAt, durationMinutes, conversationId } = req.body;
    let targetDate: Date;

    if (dueAt) {
      targetDate = new Date(dueAt);
    } else if (durationMinutes && typeof durationMinutes === 'number') {
      targetDate = new Date(Date.now() + durationMinutes * 60 * 1000);
    } else {
      throw AppError.badRequest('Either dueAt or durationMinutes must be provided');
    }

    const reminder = await reminderService.createReminder(
      userId,
      text,
      targetDate,
      conversationId,
    );
    res.status(201).json(reminder);
  } catch (err) {
    next(err);
  }
});

reminderRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const reminders = await reminderService.listReminders(userId);
    res.json(reminders);
  } catch (err) {
    next(err);
  }
});

reminderRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const { id } = req.params;
    await reminderService.cancelReminder(id, userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
