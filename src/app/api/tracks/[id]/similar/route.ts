import { route, idParam } from '@/lib/api';
import { one } from '@/lib/db';
import { notFound } from '@/lib/errors';
import { similarToTrack } from '@/lib/vector';

export const GET = route<{ id: string }>(async (req, { params }) => {
  const id = idParam(params);
  const limit = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get('limit') ?? 8) || 8));
  const has = await one(`SELECT 1 AS x FROM track_embedding WHERE track_id = $1`, [id]);
  if (!has) throw notFound('No embedding for this track');
  return { similar: await similarToTrack(id, limit) };
});
