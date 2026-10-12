import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { clearSessionCookie } from '@/lib/auth';

export const POST = route(async () => {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
