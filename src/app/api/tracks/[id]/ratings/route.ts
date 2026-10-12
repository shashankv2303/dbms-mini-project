import { route, idParam } from '@/lib/api';
import { one, query, rows } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { notFound } from '@/lib/errors';
import { int, readJson, str } from '@/lib/validate';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const id = idParam(params);
  const reviews = await rows(
    `SELECT r.rating_id, r.rating, r.review_text, r.created_at, u.username
     FROM rating r JOIN app_user u ON u.user_id = r.user_id
     WHERE r.track_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
    [id],
  );
  const summary = await one(
    `SELECT COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 2)::float AS avg FROM rating WHERE track_id = $1`,
    [id],
  );
  return { reviews, summary };
});

// Upsert the signed-in user's rating (UNIQUE(user_id, track_id)).
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const id = idParam(params);
  const b = await readJson(req);
  const rating = int(b.rating, 'rating', { min: 1, max: 5 });
  const review = str(b, 'review_text', { optional: true, max: 2000 }) ?? null;
  const exists = await one(`SELECT 1 AS x FROM track WHERE track_id = $1`, [id]);
  if (!exists) throw notFound('Track not found');
  const row = await one(
    `INSERT INTO rating (rating, review_text, user_id, track_id) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, track_id)
     DO UPDATE SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text, created_at = NOW()
     RETURNING *`,
    [rating, review, user.userId, id],
  );
  return Response.json({ rating: row }, { status: 201 });
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const r = await query(`DELETE FROM rating WHERE user_id = $1 AND track_id = $2`, [user.userId, idParam(params)]);
  if (!r.rowCount) throw notFound('You have not rated this track');
  return { ok: true };
});
