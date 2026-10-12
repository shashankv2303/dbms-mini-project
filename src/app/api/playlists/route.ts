import { route } from '@/lib/api';
import { one, rows } from '@/lib/db';
import { getSession, requireUser } from '@/lib/auth';
import { bool, readJson, str } from '@/lib/validate';

const LIST_SQL = `
  SELECT p.playlist_id, p.name, p.description, p.is_public, p.created_at,
         p.user_id, u.username AS owner,
         COUNT(pt.track_id)::int AS track_count,
         COALESCE(SUM(t.duration_sec), 0)::int AS total_seconds
  FROM playlist p
  JOIN app_user u ON u.user_id = p.user_id
  LEFT JOIN playlist_track pt ON pt.playlist_id = p.playlist_id
  LEFT JOIN track t ON t.track_id = pt.track_id`;

// ?scope=mine (default, needs sign-in) | public
export const GET = route(async (req) => {
  const scope = new URL(req.url).searchParams.get('scope') ?? 'mine';
  if (scope === 'public') {
    const session = await getSession();
    return {
      playlists: await rows(
        `${LIST_SQL} WHERE p.is_public GROUP BY p.playlist_id, u.username
         ORDER BY (p.user_id = $1) DESC, p.created_at DESC LIMIT 60`,
        [session?.userId ?? 0],
      ),
    };
  }
  const user = await requireUser();
  return {
    playlists: await rows(
      `${LIST_SQL} WHERE p.user_id = $1 GROUP BY p.playlist_id, u.username ORDER BY p.created_at DESC`,
      [user.userId],
    ),
  };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const b = await readJson(req);
  const playlist = await one(
    `INSERT INTO playlist (name, description, is_public, user_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [str(b, 'name', { min: 1, max: 100 }), str(b, 'description', { optional: true, max: 1000 }) ?? null,
     b.is_public === undefined ? false : bool(b.is_public, 'is_public'), user.userId],
  );
  return Response.json({ playlist }, { status: 201 });
});
