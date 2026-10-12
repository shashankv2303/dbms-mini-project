import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Edge middleware: coarse route protection using the role stored in the JWT.
// API handlers re-check authorisation themselves (defence in depth).
const COOKIE_NAME = 'st_token';

async function readRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET), {
      algorithms: ['HS256'],
    });
    return String(payload.role);
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await readRole(req);
  const isApi = pathname.startsWith('/api/');

  const deny = (status: 401 | 403) => {
    if (isApi) return NextResponse.json({ error: status === 401 ? 'Please sign in' : 'Admin only' }, { status });
    const url = req.nextUrl.clone();
    url.pathname = status === 401 ? '/login' : '/';
    url.search = status === 401 ? `?next=${encodeURIComponent(pathname)}` : '';
    return NextResponse.redirect(url);
  };

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!role) return deny(401);
    if (role !== 'admin') return deny(403);
  }
  if (!isApi && (pathname.startsWith('/profile') || pathname.startsWith('/playlists'))) {
    if (!role) return deny(401);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/profile/:path*', '/playlists/:path*'],
};
