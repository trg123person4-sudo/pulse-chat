import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';

export const giphyRouter = Router();

const CURATED_GIFS: Record<string, string[]> = {
  celebrate: [
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
  ],
  thumbsup: [
    'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  ],
  party: [
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
  ],
};

giphyRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const q = ((req.query.q as string) || 'celebrate').trim();
    const apiKey = process.env.GIPHY_API_KEY;

    if (apiKey) {
      try {
        const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=10&rating=g`;
        const response = await fetch(url);
        if (response.ok) {
          const data = (await response.json()) as any;
          const results = (data?.data || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            url: item.images?.original?.url || item.images?.fixed_height?.url,
            previewUrl: item.images?.fixed_height_small?.url,
          }));
          res.json({ results, source: 'giphy' });
          return;
        }
      } catch {
        // Fall back gracefully to curated gifs
      }
    }

    const key = Object.keys(CURATED_GIFS).find((k) => q.toLowerCase().includes(k)) || 'celebrate';
    const urls = CURATED_GIFS[key] || CURATED_GIFS.celebrate;
    const results = urls.map((url, idx) => ({
      id: `curated-${idx}`,
      title: q,
      url,
      previewUrl: url,
    }));

    res.json({ results, source: 'curated' });
  } catch (err) {
    next(err);
  }
});
