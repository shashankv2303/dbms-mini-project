'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate } from '@/lib/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import MoodSliders from '@/components/MoodSliders';

type Tab = 'overview' | 'analytics' | 'tracks' | 'albums' | 'artists' | 'genres' | 'users';
type Notify = (msg: string, err?: boolean) => void;

export default function AdminPage() {
  const { me, loading } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  if (loading) return <p className="muted">Loading…</p>;
  if (me?.role !== 'admin') return <p className="error">Admin only.</p>;
  const tabs: Tab[] = ['overview', 'analytics', 'tracks', 'albums', 'artists', 'genres', 'users'];
  return (
    <div>
      <h1>Admin panel</h1>
      <div className="tabs">
        {tabs.map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'analytics' && <Analytics />}
      {tab === 'tracks' && <Tracks notify={toast.show} />}
      {tab === 'albums' && <Albums notify={toast.show} />}
      {tab === 'artists' && <Artists notify={toast.show} />}
      {tab === 'genres' && <Genres notify={toast.show} />}
      {tab === 'users' && <Users notify={toast.show} myId={me.userId} />}
      {toast.node}
    </div>
  );
}

function Overview() {
  const [c, setC] = useState<any>(null);
  useEffect(() => { api('/api/admin/stats').then((r) => setC(r.counts)); }, []);
  if (!c) return <p className="muted">Loading…</p>;
  return (
    <div className="grid cols-4">
      {Object.entries(c).map(([k, v]) => (
        <div className="card" key={k}><div className="stat">{String(v)}</div><div className="muted small">{k.replace(/_/g, ' ')}</div></div>
      ))}
    </div>
  );
}

function Analytics() {
  const [qs, setQs] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/api/admin/analytics').then((r) => setQs(r.queries)).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="error">{error}</p>;
  if (!qs) return <p className="muted">Running queries…</p>;
  return (
    <div className="stack">
      {qs.map((q) => (
        <div className="card" key={q.key}>
          <h2>{q.title}</h2>
          <span className="pill">{q.concepts}</span>
          <pre className="sql">{q.sql}</pre>
          {q.rows.length === 0 ? <p className="muted">No rows.</p> : (
            <div className="table-wrap"><table>
              <thead><tr>{Object.keys(q.rows[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
              <tbody>{q.rows.map((r: any, i: number) => (
                <tr key={i}>{Object.values(r).map((v: any, j) => <td key={j}>{typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(4) : String(v ?? '')}</td>)}</tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      ))}
    </div>
  );
}

function useList(url: string, key: string) {
  const [items, setItems] = useState<any[]>([]);
  const reload = useCallback(() => { api(url).then((r) => setItems(r[key])).catch(() => {}); }, [url, key]);
  useEffect(() => { reload(); }, [reload]);
  return [items, reload] as const;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Genres({ notify }: { notify: Notify }) {
  const [items, reload] = useList('/api/genres', 'genres');
  const [name, setName] = useState('');
  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { await api('/api/genres', { method: 'POST', json: { name } }); setName(''); reload(); notify('Genre added'); }
    catch (err: any) { notify(err.message, true); }
  }
  async function del(id: number) {
    if (!confirm('Delete genre? Tracks/albums keep existing with no genre.')) return;
    try { await api(`/api/genres/${id}`, { method: 'DELETE' }); reload(); } catch (err: any) { notify(err.message, true); }
  }
  return (
    <div className="stack">
      <form className="card row" onSubmit={add}>
        <input placeholder="New genre" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        <button className="primary">Add</button>
      </form>
      <div className="card"><table><tbody>{items.map((g) => (
        <tr key={g.genre_id}><td>{g.name}</td><td className="num muted">{g.track_count} tracks</td>
          <td className="num"><button className="small danger" onClick={() => del(g.genre_id)}>Delete</button></td></tr>
      ))}</tbody></table></div>
    </div>
  );
}

function Artists({ notify }: { notify: Notify }) {
  const [items, reload] = useList('/api/artists', 'artists');
  const empty = { name: '', country: '', formed_year: '', bio: '' };
  const [f, setF] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const json = { ...f, formed_year: f.formed_year === '' ? null : Number(f.formed_year) };
    try {
      if (editId) await api(`/api/artists/${editId}`, { method: 'PUT', json });
      else await api('/api/artists', { method: 'POST', json });
      setF(empty); setEditId(null); reload(); notify('Saved');
    } catch (err: any) { notify(err.message, true); }
  }
  async function edit(id: number) {
    const r = await api(`/api/artists/${id}`);
    setEditId(id); setF({ name: r.artist.name, country: r.artist.country ?? '', formed_year: r.artist.formed_year ?? '', bio: r.artist.bio ?? '' });
  }
  async function del(id: number) {
    if (!confirm('Delete artist and ALL their albums & tracks?')) return;
    try { await api(`/api/artists/${id}`, { method: 'DELETE' }); reload(); } catch (err: any) { notify(err.message, true); }
  }
  return (
    <div className="stack">
      <form className="card grid cols-2" onSubmit={save}>
        <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={120} /></Field>
        <Field label="Country"><input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} maxLength={60} /></Field>
        <Field label="Formed year"><input type="number" min={1800} max={2100} value={f.formed_year} onChange={(e) => setF({ ...f, formed_year: e.target.value })} /></Field>
        <Field label="Bio"><input value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <div className="row"><button className="primary">{editId ? 'Update artist' : 'Add artist'}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setF(empty); }}>Cancel</button>}</div>
      </form>
      <div className="card table-wrap"><table>
        <thead><tr><th>Name</th><th>Country</th><th className="num">Albums</th><th className="num">Tracks</th><th /></tr></thead>
        <tbody>{items.map((a) => (
          <tr key={a.artist_id}><td>{a.name}</td><td className="muted">{a.country}</td><td className="num">{a.album_count}</td><td className="num">{a.track_count}</td>
            <td className="num"><button className="small" onClick={() => edit(a.artist_id)}>Edit</button>{' '}
              <button className="small danger" onClick={() => del(a.artist_id)}>Delete</button></td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

function Albums({ notify }: { notify: Notify }) {
  const [items, reload] = useList('/api/albums', 'albums');
  const [artists] = useList('/api/artists', 'artists');
  const [genres] = useList('/api/genres', 'genres');
  const empty = { title: '', release_date: '', artist_id: '', genre_id: '' };
  const [f, setF] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const json = { title: f.title, release_date: f.release_date || null, artist_id: Number(f.artist_id), genre_id: f.genre_id ? Number(f.genre_id) : null };
    try {
      if (editId) await api(`/api/albums/${editId}`, { method: 'PUT', json });
      else await api('/api/albums', { method: 'POST', json });
      setF(empty); setEditId(null); reload(); notify('Saved');
    } catch (err: any) { notify(err.message, true); }
  }
  async function del(id: number) {
    if (!confirm('Delete album and its tracks?')) return;
    try { await api(`/api/albums/${id}`, { method: 'DELETE' }); reload(); } catch (err: any) { notify(err.message, true); }
  }
  return (
    <div className="stack">
      <form className="card grid cols-2" onSubmit={save}>
        <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={160} /></Field>
        <Field label="Release date"><input type="date" value={f.release_date} onChange={(e) => setF({ ...f, release_date: e.target.value })} /></Field>
        <Field label="Artist">
          <select value={f.artist_id} onChange={(e) => setF({ ...f, artist_id: e.target.value })} required>
            <option value="">Select…</option>{artists.map((a) => <option key={a.artist_id} value={a.artist_id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Genre">
          <select value={f.genre_id} onChange={(e) => setF({ ...f, genre_id: e.target.value })}>
            <option value="">None</option>{genres.map((g) => <option key={g.genre_id} value={g.genre_id}>{g.name}</option>)}
          </select>
        </Field>
        <div className="row"><button className="primary">{editId ? 'Update album' : 'Add album'}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setF(empty); }}>Cancel</button>}</div>
      </form>
      <div className="card table-wrap"><table>
        <thead><tr><th>Title</th><th>Artist</th><th>Genre</th><th>Released</th><th className="num">Tracks</th><th /></tr></thead>
        <tbody>{items.map((a) => (
          <tr key={a.album_id}><td>{a.title}</td><td>{a.artist}</td><td className="muted">{a.genre ?? '—'}</td><td>{fmtDate(a.release_date)}</td><td className="num">{a.track_count}</td>
            <td className="num"><button className="small" onClick={() => { setEditId(a.album_id); setF({ title: a.title, release_date: a.release_date ? String(a.release_date).slice(0, 10) : '', artist_id: String(a.artist_id), genre_id: a.genre_id ? String(a.genre_id) : '' }); }}>Edit</button>{' '}
              <button className="small danger" onClick={() => del(a.album_id)}>Delete</button></td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

function Tracks({ notify }: { notify: Notify }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [albums] = useList('/api/albums', 'albums');
  const [genres] = useList('/api/genres', 'genres');
  const empty = { title: '', duration_sec: '180', track_number: '', album_id: '', genre_id: '' };
  const [f, setF] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [moodFor, setMoodFor] = useState<any>(null);
  const [mood, setMood] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);

  const reload = useCallback(() => {
    api(`/api/tracks?limit=40&sort=newest${q ? `&q=${encodeURIComponent(q)}` : ''}`).then((r) => setItems(r.tracks)).catch(() => {});
  }, [q]);
  useEffect(() => { reload(); }, [reload]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const json = { title: f.title, duration_sec: Number(f.duration_sec), track_number: f.track_number ? Number(f.track_number) : null,
      album_id: Number(f.album_id), genre_id: f.genre_id ? Number(f.genre_id) : null };
    try {
      if (editId) await api(`/api/tracks/${editId}`, { method: 'PUT', json });
      else await api('/api/tracks', { method: 'POST', json });
      setF(empty); setEditId(null); reload(); notify(editId ? 'Track updated' : 'Track added (genre-centroid embedding assigned by trigger)');
    } catch (err: any) { notify(err.message, true); }
  }
  async function del(id: number) {
    if (!confirm('Delete track?')) return;
    try { await api(`/api/tracks/${id}`, { method: 'DELETE' }); reload(); } catch (err: any) { notify(err.message, true); }
  }
  async function saveMood() {
    try { await api(`/api/admin/embeddings/${moodFor.track_id}`, { method: 'PUT', json: { mood } }); notify('Embedding updated'); setMoodFor(null); }
    catch (err: any) { notify(err.message, true); }
  }
  return (
    <div className="stack">
      <form className="card grid cols-2" onSubmit={save}>
        <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={160} /></Field>
        <Field label="Duration (sec)"><input type="number" min={1} value={f.duration_sec} onChange={(e) => setF({ ...f, duration_sec: e.target.value })} required /></Field>
        <Field label="Album">
          <select value={f.album_id} onChange={(e) => setF({ ...f, album_id: e.target.value })} required>
            <option value="">Select…</option>{albums.map((a) => <option key={a.album_id} value={a.album_id}>{a.title} — {a.artist}</option>)}
          </select>
        </Field>
        <Field label="Genre">
          <select value={f.genre_id} onChange={(e) => setF({ ...f, genre_id: e.target.value })}>
            <option value="">None</option>{genres.map((g) => <option key={g.genre_id} value={g.genre_id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Track number"><input type="number" min={1} value={f.track_number} onChange={(e) => setF({ ...f, track_number: e.target.value })} /></Field>
        <div className="row"><button className="primary">{editId ? 'Update track' : 'Add track'}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setF(empty); }}>Cancel</button>}</div>
      </form>

      {moodFor && (
        <div className="card stack">
          <h2>Set mood vector — {moodFor.title}</h2>
          <MoodSliders value={mood} onChange={setMood} />
          <div className="row"><button className="primary" onClick={saveMood}>Save embedding</button><button onClick={() => setMoodFor(null)}>Cancel</button></div>
        </div>
      )}

      <div className="card stack">
        <input placeholder="Filter tracks…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="table-wrap"><table>
          <thead><tr><th>Title</th><th>Artist</th><th>Album</th><th>Genre</th><th className="num">Plays</th><th /></tr></thead>
          <tbody>{items.map((t) => (
            <tr key={t.track_id}><td>{t.title}</td><td>{t.artist}</td><td className="muted">{t.album}</td><td className="muted">{t.genre ?? '—'}</td><td className="num">{t.play_count}</td>
              <td className="num">
                <button className="small" onClick={() => { setEditId(t.track_id); setF({ title: t.title, duration_sec: String(t.duration_sec), track_number: t.track_number ? String(t.track_number) : '', album_id: String(t.album_id), genre_id: t.genre_id ? String(t.genre_id) : '' }); }}>Edit</button>{' '}
                <button className="small" onClick={() => { setMoodFor(t); setMood([0, 0, 0, 0, 0, 0, 0, 0]); }}>Mood</button>{' '}
                <button className="small danger" onClick={() => del(t.track_id)}>Delete</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}

function Users({ notify, myId }: { notify: Notify; myId: number }) {
  const [items, reload] = useList('/api/admin/users', 'users');
  async function setRole(id: number, role: string) {
    try { await api(`/api/admin/users/${id}`, { method: 'PATCH', json: { role } }); reload(); notify('Role updated'); }
    catch (err: any) { notify(err.message, true); reload(); }
  }
  async function del(id: number) {
    if (!confirm('Delete this user and all their playlists, ratings and history?')) return;
    try { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); reload(); } catch (err: any) { notify(err.message, true); }
  }
  return (
    <div className="card table-wrap"><table>
      <thead><tr><th>User</th><th>Email</th><th>Role</th><th className="num">Listens</th><th className="num">Playlists</th><th className="num">Ratings</th><th>Joined</th><th /></tr></thead>
      <tbody>{items.map((u) => (
        <tr key={u.user_id}>
          <td>{u.username}</td><td className="muted">{u.email}</td>
          <td><select value={u.role} disabled={u.user_id === myId} onChange={(e) => setRole(u.user_id, e.target.value)}>
            <option value="listener">listener</option><option value="artist">artist</option><option value="admin">admin</option></select></td>
          <td className="num">{u.total_listens}</td><td className="num">{u.playlist_count}</td><td className="num">{u.rating_count}</td>
          <td className="muted">{fmtDate(u.created_at)}</td>
          <td className="num">{u.user_id !== myId && <button className="small danger" onClick={() => del(u.user_id)}>Delete</button>}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}
