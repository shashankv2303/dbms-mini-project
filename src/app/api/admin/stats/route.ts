import { route } from '@/lib/api';
import { one } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const GET = route(async () => {
  await requireAdmin();
  const counts = await one(
    `SELECT (SELECT COUNT(*) FROM app_user)::int       AS users,
            (SELECT COUNT(*) FROM artist)::int         AS artists,
            (SELECT COUNT(*) FROM album)::int          AS albums,
            (SELECT COUNT(*) FROM track)::int          AS tracks,
            (SELECT COUNT(*) FROM playlist)::int       AS playlists,
            (SELECT COUNT(*) FROM rating)::int         AS ratings,
            (SELECT COUNT(*) FROM listen_history)::int AS listens,
            (SELECT COUNT(*) FROM track_embedding)::int AS embeddings,
            (SELECT COUNT(*) FROM track t WHERE NOT EXISTS
                (SELECT 1 FROM track_embedding te WHERE te.track_id = t.track_id))::int AS tracks_without_embedding`,
  );
  return { counts };
});
