-- =====================================================================
-- SoundTrail  |  03_seed.sql  |  DML: INSERT sample data (+ UPDATE)
-- Deterministic (setseed) and re-runnable: it wipes the tables first.
--
-- Demo logins (seed data only):
--   admin  / admin123       (role admin)
--   alice  / password123    (role listener)   bob, carol also listeners
--   others / password123
-- =====================================================================

SELECT setseed(0.42);

TRUNCATE listen_history, rating, playlist_track, playlist, track_embedding,
         track, album, genre, artist, app_user RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------- genres
INSERT INTO genre (name) VALUES
 ('Pop'), ('Rock'), ('Hip-Hop'), ('Electronic'), ('Jazz'), ('Classical'),
 ('Lo-Fi'), ('Ambient'), ('Indie Folk'), ('R&B'), ('Metal'), ('Reggae');

-- --------------------------------------------------------------- artists
INSERT INTO artist (name, bio, country, formed_year) VALUES
 ('Neon Harbor',        'Synth-pop duo painting city nights in bright colour.',       'USA',     2014),
 ('The Paper Lanterns', 'Four-piece guitar band with a taste for big choruses.',       'UK',      2009),
 ('Marlowe Quinn',      'Rapper-producer blending boom-bap with modern trap.',         'USA',     2016),
 ('Circuit Bloom',      'Electronic producer building festival-sized drops.',          'Germany', 2012),
 ('Blue Hour Quartet',  'Late-night jazz quartet from the Lisbon club scene.',         'Portugal',2005),
 ('Elena Voss',         'Contemporary classical pianist and composer.',                'Austria', 2010),
 ('Static Bloom',       'Lo-fi beatmaker making music to study and sleep to.',         'Japan',   2018),
 ('Aurora Fields',      'Ambient soundscapes recorded in open landscapes.',            'Iceland', 2011),
 ('Willow & Ash',       'Indie-folk duo of acoustic guitar and close harmonies.',      'Canada',  2013),
 ('Velvet Mirage',      'Smooth R&B vocalist with a neo-soul band.',                   'USA',     2015),
 ('Iron Cathedral',     'Heavy metal quintet; thunderous riffs, gothic themes.',       'Sweden',  2003),
 ('Sunny Dub Collective','Roots reggae and dub, sunshine guaranteed.',                 'Jamaica', 2001),
 ('Pastel Skies',       'Dreamy bedroom-pop project.',                                 'Australia',2019),
 ('Wolfpack Avenue',    'Stadium rock with a blues backbone.',                         'USA',     1998),
 ('DJ Kaleido',         'Club DJ and remixer.',                                        'Brazil',  2008),
 ('Orchid Sound',       'Cinematic jazz-fusion ensemble.',                             'France',  2007),
 ('Midnight Parade',    'Retro-pop with brass and big hooks.',                         'USA',     2017),
 ('Glass Animals Club', 'Experimental electronic trio.',                               'UK',      2015),
 ('Hollow Pines',       'Folk storytellers from Appalachia.',                          'USA',     2006),
 ('Nocturne Ensemble',  'Chamber orchestra specialising in nocturnes.',                'Poland',  1995),
 ('Rhyme Cartel',       'Hip-hop collective from Lagos.',                              'Nigeria', 2014),
 ('Tidal Drift',        'Chillhop and downtempo beats.',                               'Portugal',2016),
 ('Crimson Forge',      'Thrash metal revivalists.',                                   'Germany', 2010),
 ('Honey Static',       'Alt R&B with hazy production.',                               'UK',      2020),
 ('Lionheart Riddim',   'Dancehall and reggae fusion.',                                'Jamaica', 2012),
 ('Silver Lining',      'Pop songwriter with confessional lyrics.',                    'USA',     2013),
 ('Echo Valley',        'Post-rock instrumental band.',                                'Norway',  2008),
 ('Mono Sakura',        'Minimal piano and ambient textures.',                         'Japan',   2014);

-- ---------------------------------------------------------------- albums
-- 2 albums per artist; genre follows the artist's "home" genre.
WITH artist_genre(artist_id, genre_name) AS (
  VALUES (1,'Pop'),(2,'Rock'),(3,'Hip-Hop'),(4,'Electronic'),(5,'Jazz'),(6,'Classical'),
         (7,'Lo-Fi'),(8,'Ambient'),(9,'Indie Folk'),(10,'R&B'),(11,'Metal'),(12,'Reggae'),
         (13,'Pop'),(14,'Rock'),(15,'Electronic'),(16,'Jazz'),(17,'Pop'),(18,'Electronic'),
         (19,'Indie Folk'),(20,'Classical'),(21,'Hip-Hop'),(22,'Lo-Fi'),(23,'Metal'),
         (24,'R&B'),(25,'Reggae'),(26,'Pop'),(27,'Ambient'),(28,'Ambient')
),
words AS (
  SELECT ARRAY['Midnight','Golden','Silent','Electric','Velvet','Broken','Paper','Crystal','Hollow','Wild',
               'Distant','Neon','Faded','Burning','Gentle','Lonely','Endless','Hidden','Rising','Scarlet'] AS adj,
         ARRAY['Skyline','Echoes','Rivers','Dreams','Machines','Gardens','Horizons','Letters','Shadows','Sunsets',
               'Voices','Highways','Oceans','Memories','Stars','Mirrors','Flames','Roads','Tides','Whispers'] AS noun
)
INSERT INTO album (title, release_date, artist_id, genre_id)
SELECT w.adj[1 + ((a.artist_id * 3 + n) % 20)] || ' ' || w.noun[1 + ((a.artist_id * 5 + n * 7) % 20)],
       DATE '2016-01-01' + ((a.artist_id * 97 + n * 431) % 3000),
       a.artist_id,
       g.genre_id
FROM artist a
JOIN artist_genre ag ON ag.artist_id = a.artist_id
JOIN genre g ON g.name = ag.genre_name
CROSS JOIN generate_series(1, 2) AS n
CROSS JOIN words w;

-- ---------------------------------------------------------------- tracks
-- 6 tracks per album (336 total); ~every 4th track is a genre cross-over.
WITH words AS (
  SELECT ARRAY['Falling','Burning','Dancing','Running','Waiting','Chasing','Drifting','Breaking','Floating','Calling',
               'Dreaming','Lost in','Under','Beyond','Waking','Holding','Fading','Leaving','Finding','Climbing'] AS verb,
         ARRAY['the Light','Tomorrow','the Rain','Fire','the Night','Gravity','the Sun','Silence','the Wind','Home',
               'the Moon','Thunder','the Dark','Neon','Daylight','the Storm','Cold Air','Summer','Midnight','the Stars'] AS obj
)
INSERT INTO track (title, duration_sec, track_number, album_id, genre_id)
SELECT w.verb[1 + ((al.album_id * 7  + n * 3)  % 20)] || ' ' ||
       w.obj [1 + ((al.album_id * 11 + n * 13) % 20)],
       150 + ((al.album_id * 37 + n * 53) % 210),
       n,
       al.album_id,
       CASE WHEN (al.album_id + n) % 4 = 0
            THEN 1 + ((al.genre_id + n) % 12)      -- cross-over track
            ELSE al.genre_id END
FROM album al
CROSS JOIN generate_series(1, 6) AS n
CROSS JOIN words w;

-- ------------------------------------------------------------ embeddings
-- 128-dim mock "mood/audio" vectors.
--   dims 1-8 : interpretable mood axes  (energy, valence, danceability,
--              acousticness, tempo, instrumentalness, intensity, warmth)
--              = genre profile + per-track noise
--   dims 9-128: genre-specific "timbre" signature + noise
-- Tracks of the same genre therefore cluster; cross-over tracks sit between.
WITH genre_mood(genre_name, profile) AS (
  VALUES
   ('Pop',        ARRAY[ .6, .7, .8,-.4, .5,-.8, .3, .4]::float8[]),
   ('Rock',       ARRAY[ .8, .2, .1,-.2, .6,-.5, .7, .0]::float8[]),
   ('Hip-Hop',    ARRAY[ .5, .1, .8,-.7, .2,-.9, .5, .0]::float8[]),
   ('Electronic', ARRAY[ .8, .4, .9,-.9, .8, .3, .6,-.4]::float8[]),
   ('Jazz',       ARRAY[-.1, .3,-.1, .7,-.2, .5,-.4, .7]::float8[]),
   ('Classical',  ARRAY[-.4, .0,-.8, .9,-.4, .9,-.3, .5]::float8[]),
   ('Lo-Fi',      ARRAY[-.6, .2, .0, .2,-.5, .7,-.7, .8]::float8[]),
   ('Ambient',    ARRAY[-.8, .0,-.7, .3,-.8, .9,-.8, .6]::float8[]),
   ('Indie Folk', ARRAY[-.2, .1,-.3, .9,-.2,-.3,-.4, .8]::float8[]),
   ('R&B',        ARRAY[ .1, .4, .5,-.3,-.1,-.8, .0, .8]::float8[]),
   ('Metal',      ARRAY[ .9,-.7,-.2,-.6, .9,-.2, .95,-.6]::float8[]),
   ('Reggae',     ARRAY[ .0, .8, .6, .3,-.2,-.5,-.2, .7]::float8[])
),
vals AS (
  SELECT t.track_id,
         d,
         CASE WHEN d <= 8
              THEN gm.profile[d] + (random() - 0.5) * 0.5
              ELSE 0.35 * sin(g.genre_id * 12.9898 + d * 78.233) + (random() - 0.5) * 0.3
         END AS v
  FROM track t
  JOIN genre g       ON g.genre_id = t.genre_id
  JOIN genre_mood gm ON gm.genre_name = g.name
  CROSS JOIN generate_series(1, 128) AS d
)
INSERT INTO track_embedding (track_id, embedding, model_version)
SELECT track_id,
       ('[' || string_agg(round(v::numeric, 4)::text, ',' ORDER BY d) || ']')::vector(128),
       'mock-mood-v1'
FROM vals
GROUP BY track_id;

-- ----------------------------------------------------------------- users
INSERT INTO app_user (username, email, password_hash, role, created_at)
SELECT u.username,
       u.username || '@soundtrail.test',
       crypt(CASE WHEN u.username = 'admin' THEN 'admin123' ELSE 'password123' END, gen_salt('bf', 8)),
       u.role,
       NOW() - (random() * 365 || ' days')::interval
FROM (
  VALUES ('admin','admin'), ('alice','listener'), ('bob','listener'), ('carol','listener'),
         ('neon_artist','artist'), ('lofi_artist','artist')
) AS u(username, role);

INSERT INTO app_user (username, email, password_hash, role, created_at)
SELECT 'listener' || lpad(n::text, 2, '0'),
       'listener' || lpad(n::text, 2, '0') || '@soundtrail.test',
       crypt('password123', gen_salt('bf', 8)),
       'listener',
       NOW() - (random() * 365 || ' days')::interval
FROM generate_series(1, 24) AS n;

-- ------------------------------------------------------------- playlists
-- Every third user deliberately has no playlist (feeds demo query #2).
WITH names AS (
  SELECT ARRAY['Morning Run','Study Session','Late Night Drive','Rainy Day','Workout Fuel','Chill Vibes',
               'Road Trip','Focus Mode','Sunday Coffee','Party Starters','Sleep Well','Throwback Mix'] AS n
)
INSERT INTO playlist (name, description, is_public, user_id, created_at)
SELECT nm.n[1 + ((u.user_id * 5 + k) % 12)],
       'Curated by ' || u.username,
       (u.user_id + k) % 2 = 0,
       u.user_id,
       NOW() - (random() * 120 || ' days')::interval
FROM app_user u
CROSS JOIN generate_series(1, 3) AS k
CROSS JOIN names nm
WHERE u.user_id % 3 <> 0
  AND k <= 1 + (u.user_id % 3);

INSERT INTO playlist_track (playlist_id, track_id, position)
SELECT p.playlist_id,
       s.track_id,
       ROW_NUMBER() OVER (PARTITION BY p.playlist_id ORDER BY random())
FROM playlist p
CROSS JOIN LATERAL (
    SELECT t.track_id FROM track t ORDER BY random() LIMIT (4 + p.playlist_id % 6)
) s;

-- -------------------------------------------------------- listen history
-- 4000 plays, skewed towards low track ids so a "popular" head emerges.
INSERT INTO listen_history (listened_at, duration_listened, user_id, track_id)
SELECT NOW() - (random() * 60 || ' days')::interval,
       FLOOR(t.duration_sec * (0.3 + 0.7 * random()))::int,
       x.user_id,
       t.track_id
FROM (
  SELECT 2 + FLOOR(random() * 29)::int                              AS user_id,
         1 + FLOOR(power(random(), 2) * (SELECT COUNT(*) FROM track))::int AS track_id
  FROM generate_series(1, 4000)
) x
JOIN track t ON t.track_id = x.track_id;

-- --------------------------------------------------------------- ratings
-- Users rate (a subset of) tracks they have actually listened to.
INSERT INTO rating (rating, review_text, user_id, track_id, created_at)
SELECT LEAST(5, GREATEST(1, ROUND(3.6 + (random() - 0.5) * 3.4)))::int,
       CASE WHEN random() < 0.3 THEN
            (ARRAY['Instant favourite.','Great for focus.','Not really my vibe.','On repeat all week.',
                   'Perfect mood music.','Solid, but a bit long.','Gorgeous production.'])[1 + floor(random() * 7)::int]
       END,
       u.user_id,
       s.track_id,
       NOW() - (random() * 60 || ' days')::interval
FROM app_user u
CROSS JOIN LATERAL (
    SELECT d.track_id
    FROM (SELECT DISTINCT lh.track_id FROM listen_history lh WHERE lh.user_id = u.user_id) d
    ORDER BY random()
    LIMIT (10 + u.user_id % 12)
) s;

-- UPDATE: reconcile the denormalised counter with the history we just loaded
-- (the trigger from 04_procedures.sql keeps it correct from here on).
UPDATE track t
SET play_count = COALESCE((SELECT COUNT(*) FROM listen_history lh WHERE lh.track_id = t.track_id), 0);

-- Rebuild the IVF index now that real vectors are present, refresh stats.
REINDEX INDEX idx_track_embedding_ivfflat;
ANALYZE;
