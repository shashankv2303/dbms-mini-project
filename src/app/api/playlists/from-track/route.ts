import { route } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { notFound } from '@/lib/errors';
import { int, readJson, str } from '@/lib/validate';

// TRANSACTION + VECTOR: "Make a playlist with this vibe".
//   BEGIN; INSERT playlist; INSERT seed track; INSERT N nearest neighbours; COMMIT.
// Any failure rolls the whole playlist back - no half-built playlists.
export const POST = route(async (req) => {
  const user = await requireUser();
  const b = await readJson(req);
  const trackId = int(b.trackId, 'trackId', { min: 1 });
  const size = Math.min(30, Math.max(1, b.size === undefined ? 10 : int(b.size, 'size', { min: 1 })));

  const result = await withTransaction(async (c) => {
    const seed = await c.query(`SELECT title FROM track WHERE track_id = $1`, [trackId]);
    if (!seed.rowCount) throw notFound('Track not found');
    const name = str(b, 'name', { optional: true, max: 100 }) ?? `Vibes like ${seed.rows[0].title}`;

    const pl = await c.query(
      `INSERT INTO playlist (name, description, is_public, user_id)
       VALUES ($1, $2, FALSE, $3) RETURNING playlist_id`,
      [name, `Generated from the mood of "${seed.rows[0].title}" via pgvector similarity`, user.userId],
    );
    const playlistId = pl.rows[0].playlist_id as number;

    await c.query(
      `INSERT INTO playlist_track (playlist_id, track_id, position) VALUES ($1, $2, 1)`,
      [playlistId, trackId],
    );
    const added = await c.query(
      `INSERT INTO playlist_track (playlist_id, track_id, position)
       SELECT $1, s.track_id, 1 + ROW_NUMBER() OVER (ORDER BY s.distance)
       FROM similar_tracks($2, $3) s
       RETURNING track_id`,
      [playlistId, trackId, size - 1],
    );
    return { playlistId, tracks: added.rowCount! + 1 };
  });
  return Response.json(result, { status: 201 });
});
