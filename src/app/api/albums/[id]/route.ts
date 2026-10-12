import { route, idParam } from '@/lib/api';
import { one, query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { notFound } from '@/lib/errors';
import { int, optInt, readJson, str } from '@/lib/validate';

export const PUT = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const b = await readJson(req);
  const album = await one(
    `UPDATE album SET title = $2, release_date = $3, artist_id = $4, genre_id = $5
     WHERE album_id = $1 RETURNING *`,
    [idParam(params), str(b, 'title', { max: 160 }), str(b, 'release_date', { optional: true }) ?? null,
     int(b.artist_id, 'artist_id', { min: 1 }), optInt(b.genre_id, 'genre_id', { min: 1 })],
  );
  if (!album) throw notFound('Album not found');
  return { album };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const r = await query(`DELETE FROM album WHERE album_id = $1`, [idParam(params)]);
  if (!r.rowCount) throw notFound('Album not found');
  return { ok: true };
});
