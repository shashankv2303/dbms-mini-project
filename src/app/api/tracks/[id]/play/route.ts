import { route, idParam } from '@/lib/api';
import { one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { notFound } from '@/lib/errors';
import { optInt } from '@/lib/validate';

// Records a listen. The AFTER INSERT trigger on listen_history bumps track.play_count.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const id = idParam(params);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const track = await one<{ duration_sec: number }>(`SELECT duration_sec FROM track WHERE track_id = $1`, [id]);
  if (!track) throw notFound('Track not found');
  const seconds = Math.min(optInt(body?.duration, 'duration', { min: 0 }) ?? track.duration_sec, track.duration_sec);

  const row = await one<{ history_id: number }>(
    `INSERT INTO listen_history (user_id, track_id, duration_listened)
     VALUES ($1, $2, $3) RETURNING history_id`,
    [user.userId, id, seconds],
  );
  // The trigger has already bumped the counter; read it back.
  const fresh = await one<{ play_count: number }>(`SELECT play_count FROM track WHERE track_id = $1`, [id]);
  return { history_id: row!.history_id, play_count: fresh!.play_count };
});
