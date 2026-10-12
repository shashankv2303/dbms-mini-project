import { route } from '@/lib/api';
import { one, rows } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { readJson, str } from '@/lib/validate';

export const GET = route(async () => {
  return {
    genres: await rows(
      `SELECT g.genre_id, g.name, COUNT(t.track_id)::int AS track_count
       FROM genre g LEFT JOIN track t ON t.genre_id = g.genre_id
       GROUP BY g.genre_id, g.name ORDER BY g.name`,
    ),
  };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req);
  const genre = await one(`INSERT INTO genre (name) VALUES ($1) RETURNING *`, [str(body, 'name', { max: 60 })]);
  return Response.json({ genre }, { status: 201 });
});
