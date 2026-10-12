'use client';
import Link from 'next/link';
import { fmtDuration } from '@/lib/client';
import { Stars } from './Stars';

export interface TrackRow {
  track_id: number; title: string; artist: string; artist_id?: number; genre: string | null; album?: string;
  duration_sec?: number; play_count?: number; avg_rating?: number | null; distance?: number | null; rank?: number;
}

export default function TrackTable({ tracks, showSimilarity, actions }: {
  tracks: TrackRow[];
  showSimilarity?: boolean;
  actions?: (t: TrackRow) => React.ReactNode;
}) {
  if (!tracks.length) return <p className="muted">Nothing here yet.</p>;
  const hasDur = tracks.some((t) => t.duration_sec !== undefined);
  const hasPlays = tracks.some((t) => t.play_count !== undefined);
  const hasRating = tracks.some((t) => t.avg_rating !== undefined);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th><th>Artist</th><th>Genre</th>
            {hasRating && <th>Rating</th>}
            {hasPlays && <th className="num">Plays</th>}
            {hasDur && <th className="num">Time</th>}
            {showSimilarity && <th className="num">Match</th>}
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {tracks.map((t) => (
            <tr key={t.track_id}>
              <td><Link href={`/track/${t.track_id}`}>{t.title}</Link></td>
              <td>{t.artist_id ? <Link href={`/artist/${t.artist_id}`}>{t.artist}</Link> : t.artist}</td>
              <td className="muted">{t.genre ?? '—'}</td>
              {hasRating && <td><Stars value={t.avg_rating} /></td>}
              {hasPlays && <td className="num">{t.play_count ?? ''}</td>}
              {hasDur && <td className="num">{t.duration_sec ? fmtDuration(t.duration_sec) : ''}</td>}
              {showSimilarity && (
                <td className="num badge-sim">
                  {t.distance === null || t.distance === undefined ? '—' : `${Math.max(0, Math.round((1 - t.distance) * 100))}%`}
                </td>
              )}
              {actions && <td className="num">{actions(t)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
