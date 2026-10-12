-- =====================================================================
-- SoundTrail  |  01_schema.sql  |  DDL: CREATE, constraints, indexes, views
-- Target: PostgreSQL 14+ with the pgvector extension
-- Run order: 01_schema -> 02_alter -> 03_seed -> 04_procedures -> 05_queries
-- This script is idempotent: it can be re-run on a fresh database.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector (similarity search)
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- crypt()/gen_salt() for seeding bcrypt hashes

-- ---------------------------------------------------------------------
-- Core relational tables (9)
-- NOTE: TRACK.play_count is intentionally NOT created here; it is added in
-- 02_alter.sql with ALTER TABLE to demonstrate schema evolution.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS artist (
    artist_id    SERIAL PRIMARY KEY,
    name         VARCHAR(120) NOT NULL,
    bio          TEXT,
    country      VARCHAR(60),
    formed_year  INTEGER CHECK (formed_year BETWEEN 1800 AND 2100)
);

CREATE TABLE IF NOT EXISTS genre (
    genre_id  SERIAL PRIMARY KEY,
    name      VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS album (
    album_id      SERIAL PRIMARY KEY,
    title         VARCHAR(160) NOT NULL,
    release_date  DATE,
    artist_id     INTEGER NOT NULL REFERENCES artist(artist_id) ON DELETE CASCADE,
    genre_id      INTEGER REFERENCES genre(genre_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS track (
    track_id      SERIAL PRIMARY KEY,
    title         VARCHAR(160) NOT NULL,
    duration_sec  INTEGER NOT NULL CHECK (duration_sec > 0),
    track_number  INTEGER CHECK (track_number > 0),
    album_id      INTEGER NOT NULL REFERENCES album(album_id) ON DELETE CASCADE,
    genre_id      INTEGER REFERENCES genre(genre_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_user (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(40)  NOT NULL UNIQUE,
    email          VARCHAR(160) NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,
    role           VARCHAR(10)  NOT NULL DEFAULT 'listener'
                   CHECK (role IN ('admin', 'artist', 'listener')),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_email_format CHECK (email LIKE '%_@_%._%')
);

CREATE TABLE IF NOT EXISTS playlist (
    playlist_id  SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    is_public    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id      INTEGER NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playlist_track (
    playlist_id  INTEGER NOT NULL REFERENCES playlist(playlist_id) ON DELETE CASCADE,
    track_id     INTEGER NOT NULL REFERENCES track(track_id) ON DELETE CASCADE,
    position     INTEGER NOT NULL CHECK (position > 0),
    added_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS rating (
    rating_id    SERIAL PRIMARY KEY,
    rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text  TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id      INTEGER NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    track_id     INTEGER NOT NULL REFERENCES track(track_id) ON DELETE CASCADE,
    CONSTRAINT uq_rating_user_track UNIQUE (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS listen_history (
    history_id        SERIAL PRIMARY KEY,
    listened_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    duration_listened INTEGER NOT NULL DEFAULT 0 CHECK (duration_listened >= 0),
    user_id           INTEGER NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    track_id          INTEGER NOT NULL REFERENCES track(track_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- pgvector layer (second paradigm): one 128-dim mood/audio vector per track
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS track_embedding (
    track_id       INTEGER PRIMARY KEY REFERENCES track(track_id) ON DELETE CASCADE,
    embedding      vector(128) NOT NULL,
    model_version  VARCHAR(40) NOT NULL DEFAULT 'mock-mood-v1',
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Indexes (FK columns, filter/sort columns, full-text, vector)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_album_artist          ON album(artist_id);
CREATE INDEX IF NOT EXISTS idx_album_genre           ON album(genre_id);
CREATE INDEX IF NOT EXISTS idx_track_album           ON track(album_id);
CREATE INDEX IF NOT EXISTS idx_track_genre           ON track(genre_id);
CREATE INDEX IF NOT EXISTS idx_playlist_user         ON playlist(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_track_track  ON playlist_track(track_id);
CREATE INDEX IF NOT EXISTS idx_rating_track          ON rating(track_id);
CREATE INDEX IF NOT EXISTS idx_listen_user_time      ON listen_history(user_id, listened_at DESC);
CREATE INDEX IF NOT EXISTS idx_listen_track          ON listen_history(track_id);
CREATE INDEX IF NOT EXISTS idx_listen_time           ON listen_history(listened_at);

-- Full-text search (expression GIN indexes: no extra columns => schema unchanged)
CREATE INDEX IF NOT EXISTS idx_track_title_fts
    ON track USING GIN (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_artist_name_fts
    ON artist USING GIN (to_tsvector('english', name));

-- Approximate nearest-neighbour index for cosine distance.
-- NOTE: ivfflat builds its centroids from the rows present at build time, so
-- 03_seed.sql REINDEXes it after loading embeddings.
CREATE INDEX IF NOT EXISTS idx_track_embedding_ivfflat
    ON track_embedding USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------

-- popular_tracks: JOIN + aggregate over listen_history and rating.
-- The two aggregates are computed in separate derived tables so that the
-- listen x rating row multiplication cannot skew AVG(rating).
CREATE OR REPLACE VIEW popular_tracks AS
SELECT t.track_id,
       t.title,
       a.name                              AS artist,
       g.name                              AS genre,
       COALESCE(l.listen_count, 0)         AS listen_count,
       r.avg_rating,
       COALESCE(r.rating_count, 0)         AS rating_count
FROM track t
JOIN album  al ON al.album_id = t.album_id
JOIN artist a  ON a.artist_id = al.artist_id
LEFT JOIN genre g ON g.genre_id = t.genre_id
LEFT JOIN (SELECT track_id, COUNT(*) AS listen_count
           FROM listen_history GROUP BY track_id) l ON l.track_id = t.track_id
LEFT JOIN (SELECT track_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS rating_count
           FROM rating GROUP BY track_id) r ON r.track_id = t.track_id;

-- user_listening_stats: one row per user
CREATE OR REPLACE VIEW user_listening_stats AS
SELECT u.user_id,
       u.username,
       COUNT(lh.history_id)                          AS total_listens,
       COUNT(DISTINCT lh.track_id)                   AS distinct_tracks,
       COALESCE(SUM(lh.duration_listened), 0)        AS seconds_listened,
       MAX(lh.listened_at)                           AS last_listened_at,
       (SELECT COUNT(*) FROM playlist p WHERE p.user_id = u.user_id) AS playlist_count,
       (SELECT COUNT(*) FROM rating r   WHERE r.user_id = u.user_id) AS rating_count
FROM app_user u
LEFT JOIN listen_history lh ON lh.user_id = u.user_id
GROUP BY u.user_id, u.username;
