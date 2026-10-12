import { NextRequest, NextResponse } from 'next/server';
import { HttpError, fromPgError } from './errors';

type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<unknown>;

/** Wraps a route handler: JSON-encodes the result, maps errors to HTTP statuses. */
export function route<P extends Record<string, string> = Record<string, string>>(fn: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const params = (ctx?.params ? await ctx.params : {}) as P;
      const out = await fn(req, { params });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (err: any) {
      const http = err instanceof HttpError ? err : fromPgError(err);
      if (http) return NextResponse.json({ error: http.message }, { status: http.status });
      console.error('[api] unhandled', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

export function idParam(params: Record<string, string>, key = 'id'): number {
  const n = Number(params[key]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${key}`);
  return n;
}
