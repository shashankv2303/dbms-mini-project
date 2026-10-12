import { route, idParam } from '@/lib/api';
import { one, query, rows } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { notFound } from '@/lib/errors';
import { optInt, readJson, str } from '@/lib/validate';
import { TRACK_SELECT } from '@/lib/queries';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const id = idParam(params);
  const artist = await one(`SELECT * FROM artist WHERE artist_id = $1`, [id]);
  if (!artist) throw notFound('Artist not found');
  const albums = await rows(
    `SELECT al.album_id, al.title, al.release_date, g.name AS genre,
            (SELECT COUNT(*)::int FROM track t WHERE t.album_id = al.album_id) AS track_count
     FROM album al LEFT JOIN genre g ON g.genre_id = al.genre_id
     WHERE al.artist_id = $1 ORDER BY al.release_date DESC NULLS LAST`,
    [id],
  );
  const tracks = await rows(`${TRACK_SELECT} WHERE a.artist_id = $1 ORDER BY t.play_count DESC, t.title`, [id]);
  return { artist, albums, tracks };
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const b = await readJson(req);
  const artist = await one(
    `UPDATE artist SET name = $2, bio = $3, country = $4, formed_year = $5
     WHERE artist_id = $1 RETURNING *`,
    [idParam(params), str(b, 'name', { max: 120 }), str(b, 'bio', { optional: true }) ?? null,
     str(b, 'country', { optional: true, max: 60 }) ?? null, optInt(b.formed_year, 'formed_year', { min: 1800, max: 2100 })],
  );
  if (!artist) throw notFound('Artist not found');
  return { artist };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const r = await query(`DELETE FROM artist WHERE artist_id = $1`, [idParam(params)]);
  if (!r.rowCount) throw notFound('Artist not found');
  return { ok: true };
});
