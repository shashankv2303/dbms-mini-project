import { route } from '@/lib/api';
import { rows } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// The demo queries from sql/05_queries.sql, executed live for the admin dashboard.
const QUERIES = [
  {
    key: 'top-month',
    title: 'Most listened tracks (last 30 days)',
    concepts: 'JOIN, GROUP BY, ORDER BY, aggregate',
    sql: `SELECT t.title, a.name AS artist, COUNT(lh.history_id) AS plays
FROM listen_history lh
JOIN track t   ON lh.track_id = t.track_id
JOIN album al  ON t.album_id = al.album_id
JOIN artist a  ON al.artist_id = a.artist_id
WHERE lh.listened_at >= NOW() - INTERVAL '30 days'
GROUP BY t.track_id, t.title, a.name
ORDER BY plays DESC LIMIT 10`,
  },
  {
    key: 'rated-no-playlist',
    title: 'Users who rated tracks but never created a playlist',
    concepts: 'EXISTS / NOT EXISTS (correlated subqueries)',
    sql: `SELECT u.username FROM app_user u
WHERE EXISTS     (SELECT 1 FROM rating r   WHERE r.user_id = u.user_id)
  AND NOT EXISTS (SELECT 1 FROM playlist p WHERE p.user_id = u.user_id)
ORDER BY u.username`,
  },
  {
    key: 'genre-rating',
    title: 'Average rating per genre (more than 5 ratings)',
    concepts: 'JOIN, GROUP BY, HAVING, AVG',
    sql: `SELECT g.name AS genre, ROUND(AVG(r.rating), 2) AS avg_rating, COUNT(r.rating_id) AS total_ratings
FROM rating r
JOIN track t ON r.track_id = t.track_id
JOIN genre g ON t.genre_id = g.genre_id
GROUP BY g.genre_id, g.name
HAVING COUNT(r.rating_id) > 5
ORDER BY avg_rating DESC`,
  },
  {
    key: 'above-average',
    title: 'Tracks rated above the global average (min. 3 ratings)',
    concepts: 'Scalar subquery in HAVING',
    sql: `SELECT t.title, ROUND(AVG(r.rating), 2) AS avg_rating, COUNT(*) AS ratings
FROM track t JOIN rating r ON r.track_id = t.track_id
GROUP BY t.track_id, t.title
HAVING COUNT(*) >= 3 AND AVG(r.rating) > (SELECT AVG(rating) FROM rating)
ORDER BY avg_rating DESC, ratings DESC, t.title LIMIT 10`,
  },
  {
    key: 'genre-leaders',
    title: 'Top 3 most-played tracks inside each genre',
    concepts: 'Window function RANK() OVER (PARTITION BY ...)',
    sql: `SELECT genre, title, play_count, rnk FROM (
  SELECT g.name AS genre, t.title, t.play_count,
         RANK() OVER (PARTITION BY g.genre_id ORDER BY t.play_count DESC) AS rnk
  FROM track t JOIN genre g ON g.genre_id = t.genre_id
) ranked WHERE rnk <= 3 ORDER BY genre, rnk`,
  },
  {
    key: 'user-stats',
    title: 'Most active listeners (view: user_listening_stats)',
    concepts: 'VIEW with aggregates and scalar subqueries',
    sql: `SELECT username, total_listens, distinct_tracks, seconds_listened, playlist_count, rating_count
FROM user_listening_stats ORDER BY total_listens DESC LIMIT 10`,
  },
  {
    key: 'vector-nearest',
    title: 'pgvector: nearest neighbours of the #1 most-played track',
    concepts: 'Vector similarity search, cosine distance (<=>), ivfflat',
    sql: `SELECT t.track_id, t.title,
       te.embedding <=> (SELECT embedding FROM track_embedding
                         WHERE track_id = (SELECT track_id FROM track ORDER BY play_count DESC LIMIT 1)) AS distance
FROM track_embedding te JOIN track t ON t.track_id = te.track_id
ORDER BY distance LIMIT 6`,
  },
];

export const GET = route(async () => {
  await requireAdmin();
  const results = [];
  for (const q of QUERIES) {
    results.push({ ...q, rows: await rows(q.sql) });
  }
  return { queries: results };
});
