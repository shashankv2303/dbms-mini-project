'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { useAuth } from '@/components/AuthProvider';
import TrackTable, { TrackRow } from '@/components/TrackTable';
import MoodSliders from '@/components/MoodSliders';
import AddToPlaylist from '@/components/AddToPlaylist';
import { useToast } from '@/components/Toast';
import { MOOD_PRESETS } from '@/lib/mood';

type Genre = { genre_id: number; name: string; track_count: number };

export default function DiscoverPage() {
  const { me } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'search' | 'mood'>('search');
  const [q, setQ] = useState('');
  const [genreId, setGenreId] = useState('');
  const [sort, setSort] = useState('popular');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [results, setResults] = useState<TrackRow[] | null>(null);
  const [searchMode, setSearchMode] = useState('');
  const [mood, setMood] = useState<number[]>(MOOD_PRESETS['Chill']);
  const [moodResults, setMoodResults] = useState<TrackRow[] | null>(null);
  const [trending, setTrending] = useState<TrackRow[]>([]);
  const [forYou, setForYou] = useState<TrackRow[]>([]);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState('');

  const search = useCallback(async () => {
    setError('');
    try {
      const p = new URLSearchParams({ sort, limit: '30' });
      if (q.trim()) p.set('q', q.trim());
      if (genreId) p.set('genreId', genreId);
      const r = await api(`/api/tracks?${p}`);
      setResults(r.tracks);
      setSearchMode(r.mode);
    } catch (e: any) { setError(e.message); }
  }, [q, genreId, sort]);

  async function findByMood() {
    setError('');
    try {
      const r = await api('/api/recommend/mood', { method: 'POST', json: { mood, limit: 15 } });
      setMoodResults(r.tracks);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => {
    api('/api/genres').then((r) => setGenres(r.genres)).catch(() => {});
    api('/api/popular?days=30&limit=8').then((r) => setTrending(r.tracks)).catch(() => {});
  }, []);
  useEffect(() => { search(); }, [genreId, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (me) api('/api/recommend?limit=8').then((r) => setForYou(r.tracks)).catch(() => {});
    else setForYou([]);
  }, [me]);

  const addAction = me ? (t: TrackRow) => <button className="small" onClick={() => setAdding(t.track_id)}>+ Playlist</button> : undefined;

  return (
    <div className="stack">
      <div className="hero">
        <h1>Find music that <em>feels</em> right</h1>
        <p className="muted">Search by title or artist, or dial in a mood and let vector similarity find the tracks that sound like it.</p>
      </div>

      <div className="tabs">
        <button className={mode === 'search' ? 'active' : ''} onClick={() => setMode('search')}>Search</button>
        <button className={mode === 'mood' ? 'active' : ''} onClick={() => setMode('mood')}>Mood explorer</button>
      </div>
      {error && <p className="error">{error}</p>}

      {mode === 'search' ? (
        <div className="card stack">
          <form className="row" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <input style={{ flex: 1, minWidth: 200 }} placeholder="Search tracks or artists (full-text)…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={genreId} onChange={(e) => setGenreId(e.target.value)} aria-label="Genre">
              <option value="">All genres</option>
              {genres.map((g) => <option key={g.genre_id} value={g.genre_id}>{g.name} ({g.track_count})</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" disabled={!!q.trim()}>
              <option value="popular">Most played</option>
              <option value="rating">Top rated</option>
              <option value="newest">Newest</option>
              <option value="title">Title A–Z</option>
            </select>
            <button className="primary" type="submit">Search</button>
          </form>
          {results && searchMode && q.trim() && (
            <p className="muted small">Matched via {searchMode === 'fulltext' ? 'PostgreSQL full-text search (tsvector, ranked)' : 'substring fallback'}.</p>
          )}
          {results && <TrackTable tracks={results} actions={addAction} />}
        </div>
      ) : (
        <div className="card stack">
          <h2>Describe the mood</h2>
          <MoodSliders value={mood} onChange={setMood} />
          <div><button className="primary" onClick={findByMood}>Find matching tracks</button></div>
          {moodResults && (
            <>
              <p className="muted small">Nearest neighbours by cosine distance in the 128-dim embedding space (pgvector).</p>
              <TrackTable tracks={moodResults} showSimilarity actions={addAction} />
            </>
          )}
        </div>
      )}

      <div className="grid cols-2">
        <div className="card">
          <h2>Trending (last 30 days)</h2>
          <TrackTable tracks={trending.map((t: any) => ({ ...t, play_count: t.listen_count }))} />
        </div>
        <div className="card">
          <h2>Picked for you</h2>
          {me ? (
            <TrackTable tracks={forYou} showSimilarity />
          ) : (
            <p className="muted">Sign in to get recommendations based on what you listen to and rate.</p>
          )}
        </div>
      </div>

      {adding !== null && <AddToPlaylist trackId={adding} onClose={() => setAdding(null)} onDone={toast.show} />}
      {toast.node}
    </div>
  );
}
