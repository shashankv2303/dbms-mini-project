'use client';
import { use, useEffect, useState } from 'react';
import { api, fmtDate } from '@/lib/client';
import TrackTable from '@/components/TrackTable';

export default function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/api/artists/${id}`).then(setData).catch((e) => setError(e.message)); }, [id]);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const { artist, albums, tracks } = data;
  return (
    <div className="stack">
      <div className="card">
        <h1>{artist.name}</h1>
        <p className="muted">{[artist.country, artist.formed_year && `formed ${artist.formed_year}`].filter(Boolean).join(' · ')}</p>
        {artist.bio && <p>{artist.bio}</p>}
      </div>
      <div className="card">
        <h2>Albums</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Title</th><th>Genre</th><th>Released</th><th className="num">Tracks</th></tr></thead>
          <tbody>{albums.map((a: any) => (
            <tr key={a.album_id}><td>{a.title}</td><td className="muted">{a.genre ?? '—'}</td><td>{fmtDate(a.release_date)}</td><td className="num">{a.track_count}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card"><h2>All tracks</h2><TrackTable tracks={tracks} /></div>
    </div>
  );
}
