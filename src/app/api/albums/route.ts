import { route } from '@/lib/api';
import { one, rows } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { int, optInt, readJson, str } from '@/lib/validate';

export const GET = route(async (req) => {
  const artistId = optInt(new URL(req.url).searchParams.get('artistId'), 'artistId');
  const albums = await rows(
    `SELECT al.album_id, al.title, al.release_date, al.artist_id, a.name AS artist,
            al.genre_id, g.name AS genre,
            (SELECT COUNT(*)::int FROM track t WHERE t.album_id = al.album_id) AS track_count
     FROM album al JOIN artist a ON a.artist_id = al.artist_id
     LEFT JOIN genre g ON g.genre_id = al.genre_id
     WHERE ($1::int IS NULL OR al.artist_id = $1)
     ORDER BY a.name, al.release_date DESC NULLS LAST`,
    [artistId],
  );
  return { albums };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const b = await readJson(req);
  const album = await one(
    `INSERT INTO album (title, release_date, artist_id, genre_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [str(b, 'title', { max: 160 }), str(b, 'release_date', { optional: true }) ?? null,
     int(b.artist_id, 'artist_id', { min: 1 }), optInt(b.genre_id, 'genre_id', { min: 1 })],
  );
  return Response.json({ album }, { status: 201 });
});
