'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate, fmtDuration } from '@/lib/client';
import TrackTable, { TrackRow } from '@/components/TrackTable';
import { Stars } from '@/components/Stars';
import { useToast } from '@/components/Toast';

export default function ProfilePage() {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [recs, setRecs] = useState<TrackRow[]>([]);
  const [error, setError] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });

  const load = useCallback(async () => {
    try {
      setD(await api('/api/users/me'));
      setRecs((await api('/api/recommend?limit=10')).tracks);
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function removeRating(trackId: number) {
    try { await api(`/api/tracks/${trackId}/ratings`, { method: 'DELETE' }); toast.show('Rating deleted'); load(); }
    catch (e: any) { toast.show(e.message, true); }
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    try { await api('/api/users/me', { method: 'PATCH', json: pw }); setPw({ currentPassword: '', newPassword: '' }); toast.show('Password changed'); }
    catch (err: any) { toast.show(err.message, true); }
  }

  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  const { user, stats, recent, ratings, topGenres } = d;

  return (
    <div className="stack">
      <div className="card">
        <h1>{user.username}</h1>
        <p className="muted">{user.email} · member since {fmtDate(user.created_at)} · <span className={`pill ${user.role}`}>{user.role}</span></p>
      </div>
      <div className="grid cols-4">
        {[
          ['Listens', stats.total_listens], ['Distinct tracks', stats.distinct_tracks],
          ['Time listened', fmtDuration(stats.seconds_listened)], ['Playlists', stats.playlist_count],
          ['Ratings', stats.rating_count],
        ].map(([label, val]) => (
          <div className="card" key={String(label)}><div className="stat">{val}</div><div className="muted small">{label}</div></div>
        ))}
      </div>
      <div className="grid cols-2">
        <div className="card"><h2>Recommended for you</h2><TrackTable tracks={recs} showSimilarity /></div>
        <div className="card">
          <h2>Top genres</h2>
          {topGenres.length === 0 ? <p className="muted">Play some tracks to see this.</p> : (
            <table><tbody>{topGenres.map((g: any) => (
              <tr key={g.genre}><td>{g.genre}</td><td className="num">{g.plays} plays</td></tr>
            ))}</tbody></table>
          )}
          <h2 style={{ marginTop: '1.2rem' }}>Recently played</h2>
          <table><tbody>{recent.map((r: any) => (
            <tr key={r.history_id}>
              <td><Link href={`/track/${r.track_id}`}>{r.title}</Link><div className="muted small">{r.artist}</div></td>
              <td className="num muted small">{fmtDate(r.listened_at)}</td>
            </tr>
          ))}</tbody></table>
        </div>
      </div>
      <div className="card">
        <h2>My ratings</h2>
        {ratings.length === 0 ? <p className="muted">No ratings yet.</p> : (
          <table><tbody>{ratings.map((r: any) => (
            <tr key={r.rating_id}>
              <td><Link href={`/track/${r.track_id}`}>{r.title}</Link> <span className="muted small">— {r.artist}</span></td>
              <td><Stars value={r.rating} /></td>
              <td className="muted small">{r.review_text}</td>
              <td className="num"><button className="small danger" onClick={() => removeRating(r.track_id)}>Delete</button></td>
            </tr>
          ))}</tbody></table>
        )}
      </div>
      <form className="card row" onSubmit={changePw}>
        <strong>Change password</strong>
        <input type="password" placeholder="Current" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
        <input type="password" placeholder="New (min 8)" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
        <button>Update</button>
      </form>
      {toast.node}
    </div>
  );
}
