export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const badRequest = (m: string) => new HttpError(400, m);
export const unauthorized = (m = 'Please sign in') => new HttpError(401, m);
export const forbidden = (m = 'You do not have access to this') => new HttpError(403, m);
export const notFound = (m = 'Not found') => new HttpError(404, m);

/** Translate PostgreSQL errors (SQLSTATE) into friendly HTTP errors. */
export function fromPgError(err: any): HttpError | null {
  if (!err || typeof err.code !== 'string') return null;
  switch (err.code) {
    case '23505': return new HttpError(409, 'That value already exists' + (err.constraint ? ` (${err.constraint})` : ''));
    case '23503': return new HttpError(409, 'Referenced record does not exist or is still in use');
    case '23502': return new HttpError(400, `Missing required field${err.column ? `: ${err.column}` : ''}`);
    case '23514': return new HttpError(400, `Value rejected by database constraint${err.constraint ? ` (${err.constraint})` : ''}`);
    case '22P02':
    case '22003':
    case '22001': return new HttpError(400, 'Invalid input value');
    case 'P0002': return new HttpError(404, err.message);
    case '42501': return new HttpError(403, err.message);
    default: return null;
  }
}
