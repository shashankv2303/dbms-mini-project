import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { badRequest } from '@/lib/errors';
import { recommendForUser, similarToTrack } from '@/lib/vector';

// GET /api/recommend?trackId=12   -> tracks that feel like track 12   (pgvector)
// GET /api/recommend              -> personalised picks for the user  (get_recommendations())
export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(30, Math.max(1, Number(sp.get('limit') ?? 10) || 10));
  const trackId = sp.get('trackId');
  if (trackId !== null) {
    const id = Number(trackId);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('trackId must be a positive integer');
    return { kind: 'similar', tracks: await similarToTrack(id, limit) };
  }
  const user = await requireUser();
  return { kind: 'personal', tracks: await recommendForUser(user.userId, limit) };
});
