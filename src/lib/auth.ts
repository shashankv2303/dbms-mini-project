import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { one } from './db';
import { forbidden, unauthorized } from './errors';

export const COOKIE_NAME = 'st_token';
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type Role = 'admin' | 'artist' | 'listener';
export interface SessionUser {
  userId: number;
  username: string;
  role: Role;
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET must be set (>= 16 chars). See .env.example');
  return new TextEncoder().encode(s);
}

export async function signToken(u: SessionUser): Promise<string> {
  return new SignJWT({ username: u.username, role: u.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(u.userId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    const userId = Number(payload.sub);
    const role = payload.role as Role;
    if (!Number.isInteger(userId) || !['admin', 'artist', 'listener'].includes(role)) return null;
    return { userId, username: String(payload.username), role };
  } catch {
    return null;
  }
}

export function attachSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SEC,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw unauthorized();
  return s;
}

/** Admin guard: re-checks the role in the DB so a demoted admin loses access immediately. */
export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireUser();
  if (s.role !== 'admin') throw forbidden('Admin only');
  const row = await one<{ role: Role }>('SELECT role FROM app_user WHERE user_id = $1', [s.userId]);
  if (!row || row.role !== 'admin') throw forbidden('Admin only');
  return s;
}
