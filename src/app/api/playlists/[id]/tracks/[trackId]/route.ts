import { route, idParam } from '@/lib/api';
import { one, query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { forbidden, notFound } from '@/lib/errors';

// DELETE; the AFTER DELETE trigger re-packs the remaining positions.
export const DELETE = route<{ id: string; trackId: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const playlistId = idParam(params, 'id');
  const trackId = idParam(params, 'trackId');
  const p = await one<{ user_id: number }>(`SELECT user_id FROM playlist WHERE playlist_id = $1`, [playlistId]);
  if (!p) throw notFound('Playlist not found');
  if (p.user_id !== user.userId && user.role !== 'admin') throw forbidden();
  const r = await query(`DELETE FROM playlist_track WHERE playlist_id = $1 AND track_id = $2`, [playlistId, trackId]);
  if (!r.rowCount) throw notFound('Track is not in this playlist');
  return { ok: true };
});
