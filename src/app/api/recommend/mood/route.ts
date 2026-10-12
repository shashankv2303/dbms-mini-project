import { route } from '@/lib/api';
import { badRequest } from '@/lib/errors';
import { readJson } from '@/lib/validate';
import { MOOD_AXES } from '@/lib/mood';
import { moodToVector, nearestToVector } from '@/lib/vector';

// POST { mood: [8 numbers in -1..1], limit } -> nearest tracks to that mood point.
export const POST = route(async (req) => {
  const b = await readJson(req);
  const mood = b.mood;
  if (!Array.isArray(mood) || mood.length !== MOOD_AXES.length || mood.some((m) => typeof m !== 'number' || !Number.isFinite(m))) {
    throw badRequest(`mood must be an array of ${MOOD_AXES.length} numbers between -1 and 1`);
  }
  const limit = Math.min(30, Math.max(1, Number(b.limit ?? 12) || 12));
  return { tracks: await nearestToVector(moodToVector(mood as number[]), limit) };
});
