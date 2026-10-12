'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate, fmtDuration } from '@/lib/client';
import { useAuth } from '@/components/AuthProvider';
import TrackTable, { TrackRow } from '@/components/TrackTable';
import { Stars, StarInput } from '@/components/Stars';
import AddToPlaylist from '@/components/AddToPlaylist';
import { useToast } from '@/components/Toast';

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useAuth();
  const toast = useToast();
  const [track, setTrack] = useState<any>(null);
  const [myRating, setMyRating] = useState<any>(null);
  const [similar, setSimilar] = useState<TrackRow[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await api(`/api/tracks/${id}`);
      setTrack(t.track);
      setMyRating(t.myRating);
      setStars(t.myRating?.rating ?? 0);
      setText(t.myRating?.review_text ?? '');
      const [s, r] = await Promise.all([api(`/api/tracks/${id}/similar?limit=8`), api(`/api/tracks/${id}/ratings`)]);
      setSimilar(s.similar);
      setReviews(r.reviews);
    } catch (e: any) { setError(e.message); }
  }, [id]);

  useEffect(() => { load(); }, [load, me]);

  async function play() {
    try {
      const r = await api(`/api/tracks/${id}/play`, { method: 'POST', json: {} });
      setTrack((t: any) => ({ ...t, play_count: r.play_count }));
      toast.show('Listen recorded — play_count updated by trigger');
    } catch (e: any) { toast.show(e.message, true); }
  }
  async function saveRating() {
    if (!stars) return toast.show('Pick a star rating first', true);
    try {
      await api(`/api/tracks/${id}/ratings`, { method: 'POST', json: { rating: stars, review_text: text || undefined } });
      toast.show('Rating saved'); load();
    } catch (e: any) { toast.show(e.message, true); }
  }
  async function removeRating() {
    try { await api(`/api/tracks/${id}/ratings`, { method: 'DELETE' }); toast.show('Rating removed'); load(); }
    catch (e: any) { toast.show(e.message, true); }
  }
  async function vibePlaylist() {
    try {
      const r = await api('/api/playlists/from-track', { method: 'POST', json: { trackId: Number(id), size: 10 } });
      window.location.href = `/playlist/${r.playlistId}`;
    } catch (e: any) { toast.show(e.message, true); }
  }

  if (error) return <p className="error">{error}</p>;
  if (!track) return <p className="muted">Loading…</p>;

  return (
    <div className="stack">
      <div className="card">
        <h1>{track.title}</h1>
        <p>
          <Link href={`/artist/${track.artist_id}`}>{track.artist}</Link>
          <span className="muted"> · {track.album} · {track.genre ?? 'No genre'} · {fmtDuration(track.duration_sec)} · {fmtDate(track.release_date)}</span>
        </p>
        <div className="row">
          <Stars value={track.avg_rating} /><span className="muted small">({track.rating_count} ratings)</span>
          <span className="pill">{track.play_count} plays</span>
          {track.embedding_model && <span className="pill">embedding: {track.embedding_model}</span>}
        </div>
        <div className="row" style={{ marginTop: '.9rem' }}>
          {me ? (
            <>
              <button className="primary" onClick={play}>▶ Play</button>
              <button onClick={() => setAdding(true)}>+ Add to playlist</button>
              <button onClick={vibePlaylist}>✨ Playlist with this vibe</button>
            </>
          ) : <span className="muted">Sign in to play, rate and save tracks.</span>}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card stack">
          <h2>Tracks that feel like this</h2>
          <p className="muted small">Nearest neighbours by cosine distance (pgvector <code>&lt;=&gt;</code>).</p>
          <TrackTable tracks={similar} showSimilarity />
        </div>
        <div className="card stack">
          <h2>Your rating</h2>
          {me ? (
            <>
              <StarInput value={stars} onChange={setStars} />
              <textarea rows={3} placeholder="Write a short review (optional)" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
              <div className="row">
                <button className="primary" onClick={saveRating}>{myRating ? 'Update rating' : 'Save rating'}</button>
                {myRating && <button className="danger" onClick={removeRating}>Delete rating</button>}
              </div>
            </>
          ) : <p className="muted">Sign in to rate this track.</p>}
          <h2 style={{ marginTop: '1rem' }}>Reviews</h2>
          {reviews.length === 0 ? <p className="muted">No ratings yet.</p> : reviews.map((r) => (
            <div key={r.rating_id}>
              <Stars value={r.rating} /> <span className="muted small">by {r.username} · {fmtDate(r.created_at)}</span>
              {r.review_text && <div>{r.review_text}</div>}
            </div>
          ))}
        </div>
      </div>
      {adding && <AddToPlaylist trackId={Number(id)} onClose={() => setAdding(false)} onDone={toast.show} />}
      {toast.node}
    </div>
  );
}
