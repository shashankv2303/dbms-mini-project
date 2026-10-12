import bcrypt from 'bcryptjs';
import { route } from '@/lib/api';
import { one, query, rows } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { HttpError, notFound } from '@/lib/errors';
import { readJson, str } from '@/lib/validate';

export const GET = route(async () => {
  const s = await requireUser();
  const user = await one(
    `SELECT user_id, username, email, role, created_at FROM app_user WHERE user_id = $1`, [s.userId]);
  if (!user) throw notFound('User no longer exists');

  const [stats, recent, ratings, topGenres] = await Promise.all([
    one(`SELECT * FROM user_listening_stats WHERE user_id = $1`, [s.userId]),
    rows(
      `SELECT lh.history_id, lh.listened_at, lh.duration_listened, t.track_id, t.title, a.name AS artist
       FROM listen_history lh
       JOIN track t ON t.track_id = lh.track_id
       JOIN album al ON al.album_id = t.album_id
       JOIN artist a ON a.artist_id = al.artist_id
       WHERE lh.user_id = $1 ORDER BY lh.listened_at DESC LIMIT 15`,
      [s.userId],
    ),
    rows(
      `SELECT r.rating_id, r.rating, r.review_text, r.created_at, t.track_id, t.title, a.name AS artist
       FROM rating r
       JOIN track t ON t.track_id = r.track_id
       JOIN album al ON al.album_id = t.album_id
       JOIN artist a ON a.artist_id = al.artist_id
       WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [s.userId],
    ),
    rows(
      `SELECT g.name AS genre, COUNT(*)::int AS plays
       FROM listen_history lh JOIN track t ON t.track_id = lh.track_id
       JOIN genre g ON g.genre_id = t.genre_id
       WHERE lh.user_id = $1 GROUP BY g.name ORDER BY plays DESC LIMIT 5`,
      [s.userId],
    ),
  ]);
  return { user, stats, recent, ratings, topGenres };
});

// Change password: PATCH { currentPassword, newPassword }
export const PATCH = route(async (req) => {
  const s = await requireUser();
  const b = await readJson(req);
  const current = str(b, 'currentPassword', { max: 72 });
  const next = str(b, 'newPassword', { min: 8, max: 72 });
  const u = await one<{ password_hash: string }>(`SELECT password_hash FROM app_user WHERE user_id = $1`, [s.userId]);
  if (!u || !(await bcrypt.compare(current, u.password_hash))) throw new HttpError(403, 'Current password is incorrect');
  await query(`UPDATE app_user SET password_hash = $2 WHERE user_id = $1`, [s.userId, await bcrypt.hash(next, 10)]);
  return { ok: true };
});
