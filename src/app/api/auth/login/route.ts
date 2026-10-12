import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { route } from '@/lib/api';
import { one } from '@/lib/db';
import { attachSessionCookie, signToken, Role } from '@/lib/auth';
import { readJson, str } from '@/lib/validate';
import { HttpError } from '@/lib/errors';

// Pre-computed hash used to equalise timing when the user does not exist.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8y3VZ1Y5oPzS0o4Xk7vKZ7r0m9bQXe';

export const POST = route(async (req) => {
  const body = await readJson(req);
  const identity = str(body, 'username', { max: 160 });
  const password = str(body, 'password', { max: 72 });

  const user = await one<{ user_id: number; username: string; role: Role; password_hash: string }>(
    `SELECT user_id, username, role, password_hash FROM app_user
     WHERE username = $1 OR email = LOWER($1)`,
    [identity],
  );
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Invalid username or password');

  const token = await signToken({ userId: user.user_id, username: user.username, role: user.role });
  const res = NextResponse.json({ user: { userId: user.user_id, username: user.username, role: user.role } });
  attachSessionCookie(res, token);
  return res;
});
