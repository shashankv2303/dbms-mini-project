'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDuration } from '@/lib/client';
import { useToast } from '@/components/Toast';

export default function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/playlists/${id}`);
      setData(d); setName(d.playlist.name);
    } catch (e: any) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function rename() {
    try { await api(`/api/playlists/${id}`, { method: 'PATCH', json: { name } }); setEditing(false); toast.show('Renamed'); load(); }
    catch (e: any) { toast.show(e.message, true); }
  }
  async function togglePublic() {
    try { await api(`/api/playlists/${id}`, { method: 'PATCH', json: { is_public: !data.playlist.is_public } }); load(); }
    catch (e: any) { toast.show(e.message, true); }
  }
  async function removeTrack(trackId: number) {
    try { await api(`/api/playlists/${id}/tracks/${trackId}`, { method: 'DELETE' }); toast.show('Removed'); load(); }
    catch (e: any) { toast.show(e.message, true); }
  }
  async function del() {
    if (!confirm('Delete this playlist?')) return;
    try { await api(`/api/playlists/${id}`, { method: 'DELETE' }); window.location.href = '/playlists'; }
    catch (e: any) { toast.show(e.message, true); }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const { playlist, tracks, canEdit } = data;
  const total = tracks.reduce((s: number, t: any) => s + t.duration_sec, 0);

  return (
    <div className="stack">
      <div className="card">
        {editing ? (
          <div className="row">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            <button className="primary" onClick={rename}>Save</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : <h1>{playlist.name}</h1>}
        {playlist.description && <p className="muted">{playlist.description}</p>}
        <div className="row">
          <span className="pill">{playlist.is_public ? 'public' : 'private'}</span>
          <span className="muted small">by {playlist.owner} · {tracks.length} tracks · {fmtDuration(total)}</span>
          <span className="spacer" />
          {canEdit && (
            <>
              <button className="small" onClick={() => setEditing(true)}>Rename</button>
              <button className="small" onClick={togglePublic}>Make {playlist.is_public ? 'private' : 'public'}</button>
              <button className="small danger" onClick={del}>Delete</button>
            </>
          )}
        </div>
      </div>
      <div className="card">
        {tracks.length === 0 ? <p className="muted">No tracks yet. Browse <Link href="/">Discover</Link> and add some.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th className="num">#</th><th>Title</th><th>Artist</th><th>Genre</th><th className="num">Time</th>{canEdit && <th />}</tr></thead>
            <tbody>{tracks.map((t: any) => (
              <tr key={t.track_id}>
                <td className="num">{t.position}</td>
                <td><Link href={`/track/${t.track_id}`}>{t.title}</Link></td>
                <td><Link href={`/artist/${t.artist_id}`}>{t.artist}</Link></td>
                <td className="muted">{t.genre ?? '—'}</td>
                <td className="num">{fmtDuration(t.duration_sec)}</td>
                {canEdit && <td className="num"><button className="small danger" onClick={() => removeTrack(t.track_id)}>Remove</button></td>}
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {toast.node}
    </div>
  );
}
