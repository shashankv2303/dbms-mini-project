import { route, idParam } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { badRequest, notFound } from '@/lib/errors';
import { int, readJson } from '@/lib/validate';

// TRANSACTION: lock playlist row -> verify owner -> append at next position.
// The same unit of work is available as the SQL function add_track_to_playlist(),
// which this route calls inside an explicit BEGIN/COMMIT block.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const playlistId = idParam(params);
  const b = await readJson(req);
  const trackId = int(b.trackId, 'trackId', { min: 1 });

  const position = await withTransaction(async (c) => {
    const t = await c.query(`SELECT 1 FROM track WHERE track_id = $1`, [trackId]);
    if (!t.rowCount) throw notFound('Track not found');
    const dup = await c.query(`SELECT 1 FROM playlist_track WHERE playlist_id = $1 AND track_id = $2`, [playlistId, trackId]);
    if (dup.rowCount) throw badRequest('Track is already in this playlist');
    const r = await c.query(`SELECT add_track_to_playlist($1, $2, $3) AS position`, [playlistId, trackId, user.userId]);
    return r.rows[0].position as number;
  });
  return Response.json({ position }, { status: 201 });
});
