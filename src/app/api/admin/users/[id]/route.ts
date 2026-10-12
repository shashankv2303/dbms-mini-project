import { route, idParam } from '@/lib/api';
import { one, query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { badRequest, notFound } from '@/lib/errors';
import { readJson, str } from '@/lib/validate';

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam(params);
  const role = str(await readJson(req), 'role');
  if (!['admin', 'artist', 'listener'].includes(role)) throw badRequest('role must be admin, artist or listener');
  if (id === admin.userId && role !== 'admin') throw badRequest('You cannot remove your own admin role');
  const user = await one(
    `UPDATE app_user SET role = $2 WHERE user_id = $1 RETURNING user_id, username, email, role`, [id, role]);
  if (!user) throw notFound('User not found');
  return { user };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam(params);
  if (id === admin.userId) throw badRequest('You cannot delete your own account');
  const r = await query(`DELETE FROM app_user WHERE user_id = $1`, [id]);
  if (!r.rowCount) throw notFound('User not found');
  return { ok: true };
});
