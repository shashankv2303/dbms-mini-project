import { route, idParam } from '@/lib/api';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { notFound } from '@/lib/errors';

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const r = await query(`DELETE FROM genre WHERE genre_id = $1`, [idParam(params)]);
  if (!r.rowCount) throw notFound('Genre not found');
  return { ok: true };
});
