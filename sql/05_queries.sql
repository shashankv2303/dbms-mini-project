-- =====================================================================
-- SoundTrail  |  05_queries.sql  |  Demo queries for the viva
-- Read-only except sections 8-9 (DML), which are wrapped in transactions
-- that ROLLBACK so the demo data is left untouched.
-- =====================================================================

-- 1. JOIN + GROUP BY + ORDER BY: most listened tracks in the last 30 days
SELECT t.title, a.name AS artist, COUNT(lh.history_id) AS plays
FROM listen_history lh
JOIN track  t  ON lh.track_id = t.track_id
JOIN album  al ON t.album_id  = al.album_id
JOIN artist a  ON al.artist_id = a.artist_id
WHERE lh.listened_at >= NOW() - INTERVAL '30 days'
GROUP BY t.track_id, t.title, a.name
ORDER BY plays DESC
LIMIT 10;

-- 2. Correlated EXISTS / NOT EXISTS: users who rated but never made a playlist
SELECT u.username
FROM app_user u
WHERE EXISTS     (SELECT 1 FROM rating   r WHERE r.user_id = u.user_id)
  AND NOT EXISTS (SELECT 1 FROM playlist p WHERE p.user_id = u.user_id)
ORDER BY u.username;

-- 3. GROUP BY + HAVING: average rating per genre (genres with > 5 ratings)
SELECT g.name AS genre,
       ROUND(AVG(r.rating), 2) AS avg_rating,
       COUNT(r.rating_id)      AS total_ratings
FROM rating r
JOIN track t ON r.track_id = t.track_id
JOIN genre g ON t.genre_id = g.genre_id
GROUP BY g.genre_id, g.name
HAVING COUNT(r.rating_id) > 5
ORDER BY avg_rating DESC;

-- 4. pgvector nearest-neighbour: tracks that feel like track #1 (cosine distance)
SELECT t.track_id, t.title,
       te.embedding <=> (SELECT embedding FROM track_embedding WHERE track_id = 1) AS distance
FROM track_embedding te
JOIN track t ON t.track_id = te.track_id
WHERE t.track_id <> 1
ORDER BY distance
LIMIT 10;

-- 4b. Same thing through the stored function
SELECT * FROM similar_tracks(1, 10);

-- 5. Scalar subquery in HAVING: tracks (>= 3 ratings) rated above the global average
SELECT t.title, ROUND(AVG(r.rating), 2) AS avg_rating
FROM track t
JOIN rating r ON r.track_id = t.track_id
GROUP BY t.track_id, t.title
HAVING COUNT(*) >= 3 AND AVG(r.rating) > (SELECT AVG(rating) FROM rating)
ORDER BY avg_rating DESC, t.title
LIMIT 10;

-- 6. Views
SELECT * FROM popular_tracks ORDER BY listen_count DESC LIMIT 10;
SELECT * FROM user_listening_stats ORDER BY total_listens DESC LIMIT 10;

-- 7. Full-text search (tsvector / GIN) and personalised recommendations
SELECT * FROM search_tracks('midnight neon', 10);
SELECT * FROM get_recommendations(2, 10);          -- user 2 = alice

-- 7b. Window function: rank tracks by plays inside each genre
SELECT genre, title, play_count, rnk
FROM (
    SELECT g.name AS genre, t.title, t.play_count,
           RANK() OVER (PARTITION BY g.genre_id ORDER BY t.play_count DESC) AS rnk
    FROM track t JOIN genre g ON g.genre_id = t.genre_id
) ranked
WHERE rnk <= 3
ORDER BY genre, rnk;

-- 8. DML inside a rolled-back transaction: INSERT -> trigger -> UPDATE -> DELETE
BEGIN;
    SELECT play_count FROM track WHERE track_id = 1;                         -- before
    INSERT INTO listen_history (user_id, track_id, duration_listened) VALUES (2, 1, 120);
    SELECT play_count FROM track WHERE track_id = 1;                         -- +1 via trigger

    UPDATE playlist SET name = 'Renamed in demo' WHERE playlist_id = 1;

    DELETE FROM playlist_track
    WHERE playlist_id = 1
      AND track_id = (SELECT track_id FROM playlist_track WHERE playlist_id = 1 AND position = 1);
    SELECT playlist_id, track_id, position FROM playlist_track
    WHERE playlist_id = 1 ORDER BY position;                                 -- positions re-packed

    DELETE FROM rating WHERE user_id = 2 AND track_id = (SELECT MIN(track_id) FROM rating WHERE user_id = 2);
ROLLBACK;

-- 9. Integrity: each of these must FAIL (run individually)
-- INSERT INTO rating (rating, user_id, track_id) VALUES (6, 2, 1);               -- CHECK 1..5
-- INSERT INTO app_user (username,email,password_hash,role) VALUES ('x','x@y.zz','h','root'); -- role CHECK
-- INSERT INTO rating (rating, user_id, track_id)
--   SELECT 4, user_id, track_id FROM rating LIMIT 1;                              -- UNIQUE(user_id, track_id)
-- INSERT INTO track (title, duration_sec, album_id) VALUES ('Bad', 0, 1);         -- duration > 0
-- DELETE FROM artist WHERE artist_id = 1;                                         -- cascades album -> track -> ...

-- 10. Query plan: confirm the ivfflat index is used
SET enable_seqscan = off;
EXPLAIN SELECT track_id FROM track_embedding
ORDER BY embedding <=> (SELECT embedding FROM track_embedding WHERE track_id = 1)
LIMIT 10;
RESET enable_seqscan;
