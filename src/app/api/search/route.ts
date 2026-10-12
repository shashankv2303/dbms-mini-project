import { route } from '@/lib/api';
import { rows } from '@/lib/db';

// Lightweight typeahead over artists + tracks (full-text, GIN-indexed).
export const GET = route(async (req) => {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q) return { tracks: [], artists: [] };
  const [tracks, artists] = await Promise.all([
    rows(`SELECT track_id, title, artist, genre, rank FROM search_tracks($1, 8)`, [q]),
    rows(
      `SELECT artist_id, name, country FROM artist
       WHERE to_tsvector('english', name) @@ plainto_tsquery('english', $1) OR name ILIKE '%' || $1 || '%'
       ORDER BY name LIMIT 5`,
      [q],
    ),
  ]);
  return { tracks, artists };
});
