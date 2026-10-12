import { route, idParam } from '@/lib/api';
import { one } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { badRequest, notFound } from '@/lib/errors';
import { readJson } from '@/lib/validate';
import { MOOD_AXES } from '@/lib/mood';
import { toVectorLiteral } from '@/lib/vector';

// PUT { mood?: [8 numbers] , vector?: [128 numbers] }
// Upserts the track's embedding. With `mood`, the 8 interpretable axes are set and the
// 120 remaining timbre dims are carried over from the current vector (or zeros).
export const PUT = route<{ trackId: string }>(async (req, { params }) => {
  await requireAdmin();
  const trackId = idParam(params, 'trackId');
  const b = await readJson(req);
  const exists = await one(`SELECT 1 AS x FROM track WHERE track_id = $1`, [trackId]);
  if (!exists) throw notFound('Track not found');

  let vec: number[];
  if (Array.isArray(b.vector)) {
    vec = b.vector as number[];
  } else if (Array.isArray(b.mood) && b.mood.length === MOOD_AXES.length) {
    const cur = await one<{ v: string }>(`SELECT embedding::text AS v FROM track_embedding WHERE track_id = $1`, [trackId]);
    vec = cur ? (JSON.parse(cur.v) as number[]) : new Array(128).fill(0);
    (b.mood as number[]).forEach((m, i) => (vec[i] = Math.max(-1, Math.min(1, Number(m)))));
  } else {
    throw badRequest('Provide `mood` (8 numbers) or `vector` (128 numbers)');
  }
  const row = await one(
    `INSERT INTO track_embedding (track_id, embedding, model_version)
     VALUES ($1, $2::vector, 'manual-v1')
     ON CONFLICT (track_id) DO UPDATE
       SET embedding = EXCLUDED.embedding, model_version = EXCLUDED.model_version, created_at = NOW()
     RETURNING track_id, model_version`,
    [trackId, toVectorLiteral(vec)],
  );
  return { embedding: row };
});
