import { route } from '@/lib/api';
import { one, rows } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { optInt, readJson, str } from '@/lib/validate';

export const GET = route(async (req) => {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  const artists = await rows(
    `SELECT a.artist_id, a.name, a.country, a.formed_year,
            COUNT(DISTINCT al.album_id)::int AS album_count,
            COUNT(t.track_id)::int AS track_count
     FROM artist a
     LEFT JOIN album al ON al.artist_id = a.artist_id
     LEFT JOIN track t  ON t.album_id = al.album_id
     WHERE ($1::text IS NULL OR a.name ILIKE '%' || $1 || '%')
     GROUP BY a.artist_id ORDER BY a.name`,
    [q || null],
  );
  return { artists };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const b = await readJson(req);
  const artist = await one(
    `INSERT INTO artist (name, bio, country, formed_year) VALUES ($1,$2,$3,$4) RETURNING *`,
    [str(b, 'name', { max: 120 }), str(b, 'bio', { optional: true }) ?? null,
     str(b, 'country', { optional: true, max: 60 }) ?? null, optInt(b.formed_year, 'formed_year', { min: 1800, max: 2100 })],
  );
  return Response.json({ artist }, { status: 201 });
});
