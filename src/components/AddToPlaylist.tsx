'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

export default function AddToPlaylist({ trackId, onClose, onDone }: {
  trackId: number; onClose: () => void; onDone: (msg: string, err?: boolean) => void;
}) {
  const [lists, setLists] = useState<{ playlist_id: number; name: string }[] | null>(null);
  const [selected, setSelected] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/playlists').then((r) => {
      setLists(r.playlists);
      if (r.playlists[0]) setSelected(String(r.playlists[0].playlist_id));
    }).catch((e) => { onDone(e.message, true); onClose(); });
  }, [onClose, onDone]);

  async function add() {
    setBusy(true);
    try {
      let id = Number(selected);
      if (!lists?.length || selected === 'new') {
        const r = await api('/api/playlists', { method: 'POST', json: { name: newName || 'My playlist' } });
        id = r.playlist.playlist_id;
      }
      const r = await api(`/api/playlists/${id}/tracks`, { method: 'POST', json: { trackId } });
      onDone(`Added at position ${r.position}`);
      onClose();
    } catch (e: any) {
      onDone(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <h2>Add to playlist</h2>
        {lists === null ? <p className="muted">Loading…</p> : (
          <>
            {lists.length > 0 && (
              <label className="field"><span>Playlist</span>
                <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                  {lists.map((l) => <option key={l.playlist_id} value={l.playlist_id}>{l.name}</option>)}
                  <option value="new">+ New playlist…</option>
                </select>
              </label>
            )}
            {(lists.length === 0 || selected === 'new') && (
              <label className="field"><span>New playlist name</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100} placeholder="My playlist" />
              </label>
            )}
            <div className="row">
              <button className="primary" disabled={busy} onClick={add}>Add</button>
              <button onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
