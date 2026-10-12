import { route, idParam } from '@/lib/api';
import { one, query } from '@/lib/db';
import { getSession, requireAdmin } from '@/lib/auth';
import { notFound } from '@/lib/errors';
import { TRACK_SELECT } from '@/lib/queries';
import { int, optInt, readJson, str } from '@/lib/validate';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const id = idParam(params);
  const track = await one(`${TRACK_SELECT} WHERE t.track_id = $1`, [id]);
  if (!track) throw notFound('Track not found');
  const emb = await one<{ model_version: string }>(
    `SELECT model_version FROM track_embedding WHERE track_id = $1`, [id]);
  const session = await getSession();
  const myRating = session
    ? await one(`SELECT rating_id, rating, review_text FROM rating WHERE user_id = $1 AND track_id = $2`,
        [session.userId, id])
    : null;
  return { track: { ...track, embedding_model: emb?.model_version ?? null }, myRating: myRating ?? null };
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const b = await readJson(req);
  const track = await one(
    `UPDATE track SET title = $2, duration_sec = $3, track_number = $4, album_id = $5, genre_id = $6
     WHERE track_id = $1 RETURNING *`,
    [idParam(params), str(b, 'title', { max: 160 }), int(b.duration_sec, 'duration_sec', { min: 1, max: 36000 }),
     optInt(b.track_number, 'track_number', { min: 1 }), int(b.album_id, 'album_id', { min: 1 }),
     optInt(b.genre_id, 'genre_id', { min: 1 })],
  );
  if (!track) throw notFound('Track not found');
  return { track };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const r = await query(`DELETE FROM track WHERE track_id = $1`, [idParam(params)]);
  if (!r.rowCount) throw notFound('Track not found');
  return { ok: true };
});
