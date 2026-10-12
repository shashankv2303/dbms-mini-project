import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { route } from '@/lib/api';
import { one } from '@/lib/db';
import { attachSessionCookie, signToken } from '@/lib/auth';
import { readJson, str } from '@/lib/validate';
import { badRequest } from '@/lib/errors';

export const POST = route(async (req) => {
  const body = await readJson(req);
  const username = str(body, 'username', { min: 3, max: 40 });
  const email = str(body, 'email', { max: 160 }).toLowerCase();
  const password = str(body, 'password', { min: 8, max: 72 });
  if (!/^[A-Za-z0-9_.-]+$/.test(username)) throw badRequest('username may only contain letters, digits, _ . -');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('email is not valid');

  const hash = await bcrypt.hash(password, 10);
  // New accounts are always 'listener'; roles are elevated by an admin only.
  const user = await one<{ user_id: number; username: string; role: 'listener' }>(
    `INSERT INTO app_user (username, email, password_hash, role)
     VALUES ($1, $2, $3, 'listener') RETURNING user_id, username, role`,
    [username, email, hash],
  );
  const token = await signToken({ userId: user!.user_id, username: user!.username, role: user!.role });
  const res = NextResponse.json({ user: { userId: user!.user_id, username: user!.username, role: user!.role } }, { status: 201 });
  attachSessionCookie(res, token);
  return res;
});
