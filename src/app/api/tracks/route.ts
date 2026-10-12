import { route } from '@/lib/api';
import { one, rows } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { TRACK_SELECT } from '@/lib/queries';
import { int, optInt, pageParams, readJson, str } from '@/lib/validate';

const SORTS: Record<string, string> = {
  popular: 't.play_count DESC, t.track_id',
  rating: 'r.avg_rating DESC NULLS LAST, r.rating_count DESC, t.track_id',
  newest: 'al.release_date DESC NULLS LAST, t.track_id',
  title: 't.title, t.track_id',
};

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const q = sp.get('q')?.trim() || null;
  const genreId = optInt(sp.get('genreId'), 'genreId');
  const artistId = optInt(sp.get('artistId'), 'artistId');
  const { limit, offset } = pageParams(new URL(req.url));
  const sort = SORTS[sp.get('sort') ?? 'popular'] ?? SORTS.popular;

  const filters = `($1::int IS NULL OR t.genre_id = $1) AND ($2::int IS NULL OR a.artist_id = $2)`;

  if (q) {
    // 1) full-text search (tsvector + GIN) ranked by ts_rank
    const fts = await rows(
      `WITH hits AS (SELECT track_id, rank FROM search_tracks($3, 500))
       ${TRACK_SELECT.replace('FROM track t', 'FROM hits h JOIN track t ON t.track_id = h.track_id')}
       WHERE ${filters}
       ORDER BY h.rank DESC, t.play_count DESC
       LIMIT $4 OFFSET $5`,
      [genreId, artistId, q, limit, offset],
    );
    if (fts.length || offset > 0) return { tracks: fts, mode: 'fulltext' };

    // 2) fallback for partial words ("neo" -> "Neon"): substring match
    const like = await rows(
      `${TRACK_SELECT}
       WHERE ${filters} AND (t.title ILIKE '%' || $3 || '%' OR a.name ILIKE '%' || $3 || '%')
       ORDER BY t.play_count DESC LIMIT $4 OFFSET $5`,
      [genreId, artistId, q, limit, offset],
    );
    return { tracks: like, mode: 'substring' };
  }

  const tracks = await rows(
    `${TRACK_SELECT} WHERE ${filters} ORDER BY ${sort} LIMIT $3 OFFSET $4`,
    [genreId, artistId, limit, offset],
  );
  return { tracks, mode: 'browse' };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const b = await readJson(req);
  const track = await one(
    `INSERT INTO track (title, duration_sec, track_number, album_id, genre_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [str(b, 'title', { max: 160 }), int(b.duration_sec, 'duration_sec', { min: 1, max: 36000 }),
     optInt(b.track_number, 'track_number', { min: 1 }), int(b.album_id, 'album_id', { min: 1 }),
     optInt(b.genre_id, 'genre_id', { min: 1 })],
  );
  return Response.json({ track }, { status: 201 });
});
