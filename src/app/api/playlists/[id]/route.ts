import { route, idParam } from '@/lib/api';
import { one, query, rows } from '@/lib/db';
import { getSession, requireUser } from '@/lib/auth';
import { forbidden, notFound } from '@/lib/errors';
import { bool, readJson, str } from '@/lib/validate';

async function loadPlaylist(id: number) {
  return one<{ playlist_id: number; user_id: number; is_public: boolean; owner: string; [k: string]: any }>(
    `SELECT p.*, u.username AS owner FROM playlist p JOIN app_user u ON u.user_id = p.user_id
     WHERE p.playlist_id = $1`,
    [id],
  );
}

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const id = idParam(params);
  const playlist = await loadPlaylist(id);
  if (!playlist) throw notFound('Playlist not found');
  const session = await getSession();
  const canEdit = !!session && (session.userId === playlist.user_id || session.role === 'admin');
  if (!playlist.is_public && !canEdit) throw notFound('Playlist not found'); // do not leak existence

  const tracks = await rows(
    `SELECT pt.position, pt.added_at, t.track_id, t.title, t.duration_sec, t.play_count,
            a.name AS artist, a.artist_id, g.name AS genre
     FROM playlist_track pt
     JOIN track t   ON t.track_id  = pt.track_id
     JOIN album al  ON al.album_id = t.album_id
     JOIN artist a  ON a.artist_id = al.artist_id
     LEFT JOIN genre g ON g.genre_id = t.genre_id
     WHERE pt.playlist_id = $1 ORDER BY pt.position`,
    [id],
  );
  return { playlist, tracks, canEdit };
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const id = idParam(params);
  const existing = await loadPlaylist(id);
  if (!existing) throw notFound('Playlist not found');
  if (existing.user_id !== user.userId && user.role !== 'admin') throw forbidden();

  const b = await readJson(req);
  const row = await one(
    `UPDATE playlist SET
        name        = COALESCE($2, name),
        description = CASE WHEN $3::boolean THEN $4 ELSE description END,
        is_public   = COALESCE($5, is_public)
     WHERE playlist_id = $1 RETURNING *`,
    [id, str(b, 'name', { optional: true, min: 1, max: 100 }) ?? null,
     b.description !== undefined, b.description === null ? null : str(b, 'description', { optional: true, max: 1000 }) ?? null,
     b.is_public === undefined ? null : bool(b.is_public, 'is_public')],
  );
  return { playlist: row };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const id = idParam(params);
  const existing = await loadPlaylist(id);
  if (!existing) throw notFound('Playlist not found');
  if (existing.user_id !== user.userId && user.role !== 'admin') throw forbidden();
  await query(`DELETE FROM playlist WHERE playlist_id = $1`, [id]);
  return { ok: true };
});
