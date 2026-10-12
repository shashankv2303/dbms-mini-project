import { rows } from './db';
import { EMBEDDING_DIM, MOOD_AXES } from './mood';

export interface NeighbourTrack {
  track_id: number;
  title: string;
  artist: string;
  genre: string | null;
  distance: number | null;
}

/** pgvector text literal: '[0.1,0.2,...]' (always passed as a bind parameter). */
export function toVectorLiteral(values: number[]): string {
  if (values.length !== EMBEDDING_DIM) {
    throw new Error(`embedding must have ${EMBEDDING_DIM} dimensions, got ${values.length}`);
  }
  if (values.some((v) => !Number.isFinite(v))) throw new Error('embedding contains a non-finite value');
  return '[' + values.map((v) => Number(v.toFixed(6))).join(',') + ']';
}

/** Mood slider values (8 axes in [-1,1]) -> 128-dim query vector (rest zero). */
export function moodToVector(mood: number[]): number[] {
  if (mood.length !== MOOD_AXES.length) throw new Error(`mood must have ${MOOD_AXES.length} values`);
  const v = new Array<number>(EMBEDDING_DIM).fill(0);
  mood.forEach((m, i) => {
    v[i] = Math.max(-1, Math.min(1, m));
  });
  return v;
}

/** Raw pgvector query: cosine nearest neighbours of an arbitrary vector. */
export async function nearestToVector(vec: number[], limit = 10, exclude: number[] = []) {
  return rows<NeighbourTrack>(
    `SELECT * FROM tracks_near_vector($1::vector, $2::int, $3::int[])`,
    [toVectorLiteral(vec), limit, exclude],
  );
}

/** Raw pgvector query: tracks that "feel like" a reference track. */
export async function similarToTrack(trackId: number, limit = 10) {
  return rows<NeighbourTrack>(`SELECT * FROM similar_tracks($1::int, $2::int)`, [trackId, limit]);
}

/** Personalised: taste-centroid recommendations (stored function). */
export async function recommendForUser(userId: number, limit = 10) {
  return rows<NeighbourTrack>(`SELECT * FROM get_recommendations($1::int, $2::int)`, [userId, limit]);
}
