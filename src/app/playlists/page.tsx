'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDuration } from '@/lib/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';

export default function PlaylistsPage() {
  const { me } = useAuth();
  const toast = useToast();
  const [mine, setMine] = useState<any[]>([]);
  const [pub, setPub] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api('/api/playlists'), api('/api/playlists?scope=public')]);
      setMine(a.playlists); setPub(b.playlists);
    } catch (e: any) { toast.show(e.message, true); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, me]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/playlists', { method: 'POST', json: { name, is_public: isPublic } });
      setName(''); toast.show('Playlist created'); load();
    } catch (err: any) { toast.show(err.message, true); }
  }

  const list = (items: any[], showOwner: boolean) => items.length === 0 ? <p className="muted">Nothing here yet.</p> : (
    <div className="grid cols-3">
      {items.map((p) => (
        <Link key={p.playlist_id} href={`/playlist/${p.playlist_id}`} className="card" style={{ color: 'inherit' }}>
          <h3>{p.name}</h3>
          <div className="muted small">{p.track_count} tracks · {fmtDuration(p.total_seconds)}{showOwner && ` · by ${p.owner}`}</div>
          <div style={{ marginTop: '.4rem' }}><span className="pill">{p.is_public ? 'public' : 'private'}</span></div>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="stack">
      <h1>Playlists</h1>
      <form className="card row" onSubmit={create}>
        <input placeholder="New playlist name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} style={{ flex: 1, minWidth: 200 }} />
        <label className="row small"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Public</label>
        <button className="primary">Create</button>
      </form>
      <h2>Mine</h2>
      {list(mine, false)}
      <h2>Public playlists</h2>
      {list(pub, true)}
      {toast.node}
    </div>
  );
}
