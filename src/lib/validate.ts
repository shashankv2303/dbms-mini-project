import { badRequest } from './errors';

type Obj = Record<string, unknown>;

export async function readJson(req: Request): Promise<Obj> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Obj;
  } catch {
    /* fallthrough */
  }
  throw badRequest('Request body must be a JSON object');
}

export function str(o: Obj, key: string, opts: { min?: number; max?: number; optional?: boolean } = {}): string {
  const v = o[key];
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return undefined as unknown as string;
    throw badRequest(`${key} is required`);
  }
  if (typeof v !== 'string') throw badRequest(`${key} must be a string`);
  const s = v.trim();
  if (opts.min !== undefined && s.length < opts.min) throw badRequest(`${key} must be at least ${opts.min} characters`);
  if (opts.max !== undefined && s.length > opts.max) throw badRequest(`${key} must be at most ${opts.max} characters`);
  return s;
}

export function int(v: unknown, name: string, opts: { min?: number; max?: number } = {}): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw badRequest(`${name} must be an integer`);
  if (opts.min !== undefined && n < opts.min) throw badRequest(`${name} must be >= ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw badRequest(`${name} must be <= ${opts.max}`);
  return n;
}

export function optInt(v: unknown, name: string, opts: { min?: number; max?: number } = {}): number | null {
  if (v === undefined || v === null || v === '') return null;
  return int(v, name, opts);
}

export function bool(v: unknown, name: string): boolean {
  if (typeof v !== 'boolean') throw badRequest(`${name} must be true or false`);
  return v;
}

export function pageParams(url: URL, defLimit = 24, maxLimit = 100) {
  const limit = Math.min(maxLimit, Math.max(1, Number(url.searchParams.get('limit') ?? defLimit) || defLimit));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
  return { limit, offset };
}
