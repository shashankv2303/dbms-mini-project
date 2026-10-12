import { route } from '@/lib/api';
import { rows } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const GET = route(async () => {
  await requireAdmin();
  return {
    users: await rows(
      `SELECT u.user_id, u.username, u.email, u.role, u.created_at,
              s.total_listens, s.playlist_count, s.rating_count
       FROM app_user u JOIN user_listening_stats s ON s.user_id = u.user_id
       ORDER BY u.user_id`,
    ),
  };
});
