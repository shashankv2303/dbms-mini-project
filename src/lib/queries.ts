// Shared SQL fragments.
export const TRACK_SELECT = `
  SELECT t.track_id, t.title, t.duration_sec, t.track_number, t.play_count,
         t.album_id, al.title AS album, al.release_date,
         a.artist_id, a.name AS artist,
         t.genre_id, g.name AS genre,
         r.avg_rating, COALESCE(r.rating_count, 0)::int AS rating_count
  FROM track t
  JOIN album  al ON al.album_id  = t.album_id
  JOIN artist a  ON a.artist_id  = al.artist_id
  LEFT JOIN genre g ON g.genre_id = t.genre_id
  LEFT JOIN (
      SELECT track_id, ROUND(AVG(rating)::numeric, 2)::float AS avg_rating, COUNT(*) AS rating_count
      FROM rating GROUP BY track_id
  ) r ON r.track_id = t.track_id`;
