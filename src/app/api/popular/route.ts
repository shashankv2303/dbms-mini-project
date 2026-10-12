import { route } from '@/lib/api';
import { rows } from '@/lib/db';

// Reads the popular_tracks VIEW (join + aggregates over listen_history & rating).
export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit') ?? 10) || 10));
  const days = sp.get('days');
  if (days) {
    // "trending": same aggregate restricted to a recent window
    const d = Math.min(365, Math.max(1, Number(days) || 30));
    return {
      tracks: await rows(
        `SELECT t.track_id, t.title, a.name AS artist, g.name AS genre, COUNT(lh.history_id)::int AS listen_count
         FROM listen_history lh
         JOIN track t ON t.track_id = lh.track_id
         JOIN album al ON al.album_id = t.album_id
         JOIN artist a ON a.artist_id = al.artist_id
         LEFT JOIN genre g ON g.genre_id = t.genre_id
         WHERE lh.listened_at >= NOW() - ($1::int * INTERVAL '1 day')
         GROUP BY t.track_id, t.title, a.name, g.name
         ORDER BY listen_count DESC, t.track_id LIMIT $2`,
        [d, limit],
      ),
    };
  }
  return {
    tracks: await rows(`SELECT * FROM popular_tracks ORDER BY listen_count DESC, track_id LIMIT $1`, [limit]),
  };
});
