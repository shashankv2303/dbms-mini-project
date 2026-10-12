# SoundTrail — DBMS Level 3 Project Context

## Project Overview

**Title:** SoundTrail — Mood-Based Music Discovery & Playlist Curation Platform  
**Team:** Team 15  
**Course:** DBMS Experiential Learning — Level 3 Project, PES University  
**Stack:** Next.js frontend + API routes, PostgreSQL (primary SQL), pgvector (vector DB for mood similarity search)

SoundTrail lets users discover music by mood. The core non-CRUD feature is vector-similarity search: track embeddings (audio/mood features) are stored in pgvector and queried with nearest-neighbour search so the app can recommend tracks that "feel like" a reference track without exact genre/tag matching.

---

## Database Design

### Option chosen: SQL + Vector Database
- **SQL:** PostgreSQL
- **Vector:** PostgreSQL with pgvector extension

### Relational Schema (9 tables)

```
ARTIST(artist_id PK, name, bio, country, formed_year)

GENRE(genre_id PK, name)

ALBUM(album_id PK, title, release_date, artist_id FK→ARTIST, genre_id FK→GENRE)

TRACK(track_id PK, title, duration_sec, track_number, play_count,
      album_id FK→ALBUM, genre_id FK→GENRE)

APP_USER(user_id PK, username UNIQUE, email UNIQUE, password_hash,
         role CHECK IN ('admin','artist','listener'), created_at)

PLAYLIST(playlist_id PK, name, description, is_public, created_at,
         user_id FK→APP_USER)

PLAYLIST_TRACK(playlist_id FK→PLAYLIST, track_id FK→TRACK,  ← composite PK
               position, added_at)

RATING(rating_id PK, rating CHECK 1–5, review_text, created_at,
       user_id FK→APP_USER, track_id FK→TRACK,
       UNIQUE(user_id, track_id))

LISTEN_HISTORY(history_id PK, listened_at, duration_listened,
               user_id FK→APP_USER, track_id FK→TRACK)
```

### pgvector Layer (second paradigm)

Table: `TRACK_EMBEDDING`
```
track_id FK→TRACK (PK)
embedding vector(128)      -- mood/audio feature vector
model_version varchar
created_at timestamp
```

Index: `CREATE INDEX ON track_embedding USING ivfflat (embedding vector_cosine_ops)`

Retrieval: `SELECT track_id FROM track_embedding ORDER BY embedding <=> $query_vector LIMIT 10`

---

## Requirements Checklist (from spec)

### SQL DDL to implement
- [ ] CREATE for all 9 tables + track_embedding
- [ ] ALTER TABLE (e.g. add play_count to TRACK after initial creation)
- [ ] DROP (demonstrate in dev/migration scripts)
- [ ] Primary keys, foreign keys, UNIQUE constraints, CHECK constraints
- [ ] At least 5 indexes (on FK columns and embedding)
- [ ] At least 1 VIEW (e.g. `popular_tracks` — JOIN + aggregate over listen_history)

### DML operations to demonstrate
- [ ] INSERT — seed artists, tracks, users, playlists
- [ ] UPDATE — update play_count, update playlist name
- [ ] DELETE — remove a track from a playlist, delete a rating
- [ ] SELECT with JOIN, GROUP BY, HAVING, ORDER BY, aggregate functions, subqueries

### Advanced SQL features (need at least 4)
- [ ] Transactions — e.g. adding a track to playlist + updating play_count atomically
- [ ] Views — `popular_tracks`, `user_listening_stats`
- [ ] Stored procedures/functions — e.g. `get_recommendations(user_id)`
- [ ] Triggers — e.g. auto-increment play_count on LISTEN_HISTORY insert
- [ ] Indexing — on FK cols + ivfflat on embedding
- [ ] Full-text search — on track title / artist name (pg `tsvector`)

### Vector (need at least 1)
- [ ] pgvector similarity search — nearest-neighbour mood query

### Authentication & Roles (minimum 2)
- `listener` — browse, create playlists, rate tracks
- `admin` — manage artists, albums, tracks, users

### Web App (Next.js)
- [ ] API routes for all DB operations (no direct DB calls from client)
- [ ] Env vars for DB credentials (`.env.local`, never hardcoded)
- [ ] Pages: home/discover, track detail, playlist view, user profile, admin panel
- [ ] Search with mood/vector similarity
- [ ] Auth (JWT or NextAuth)

---

## File Structure (suggested)

```
soundtrail/
├── CLAUDE.md                  ← this file
├── .env.local                 ← DB creds (gitignored)
├── sql/
│   ├── 01_schema.sql          ← DDL: CREATE TABLE, indexes, views
│   ├── 02_alter.sql           ← ALTER TABLE examples
│   ├── 03_seed.sql            ← INSERT sample data
│   ├── 04_procedures.sql      ← stored procedures, triggers
│   └── 05_queries.sql         ← demo queries (joins, aggregates, subqueries)
├── src/
│   ├── app/                   ← Next.js app router
│   │   ├── api/               ← API routes
│   │   │   ├── tracks/
│   │   │   ├── playlists/
│   │   │   ├── users/
│   │   │   └── recommend/     ← vector similarity endpoint
│   │   ├── (auth)/
│   │   ├── discover/
│   │   ├── playlist/[id]/
│   │   └── admin/
│   ├── lib/
│   │   ├── db.ts              ← pg Pool setup
│   │   └── vector.ts          ← pgvector query helpers
│   └── components/
└── README.md
```

---

## Key Queries to Implement (for demo)

```sql
-- 1. Most listened tracks this month
SELECT t.title, a.name AS artist, COUNT(lh.history_id) AS plays
FROM listen_history lh
JOIN track t ON lh.track_id = t.track_id
JOIN album al ON t.album_id = al.album_id
JOIN artist a ON al.artist_id = a.artist_id
WHERE lh.listened_at >= NOW() - INTERVAL '30 days'
GROUP BY t.track_id, t.title, a.name
ORDER BY plays DESC LIMIT 10;

-- 2. Users who rated but never created a playlist
SELECT u.username FROM app_user u
WHERE EXISTS (SELECT 1 FROM rating r WHERE r.user_id = u.user_id)
  AND NOT EXISTS (SELECT 1 FROM playlist p WHERE p.user_id = u.user_id);

-- 3. Average rating per genre
SELECT g.name AS genre, AVG(r.rating) AS avg_rating, COUNT(r.rating_id) AS total_ratings
FROM rating r
JOIN track t ON r.track_id = t.track_id
JOIN genre g ON t.genre_id = g.genre_id
GROUP BY g.genre_id, g.name
HAVING COUNT(r.rating_id) > 5
ORDER BY avg_rating DESC;

-- 4. Vector similarity search (mood-based recommendation)
SELECT t.track_id, t.title, te.embedding <=> $1 AS distance
FROM track_embedding te
JOIN track t ON te.track_id = t.track_id
ORDER BY distance LIMIT 10;
```

---

## Notes for Claude Code

- PostgreSQL is already running locally. DB name: `soundtrail`
- The schema already exists in MySQL Workbench (9 tables: album, app_user, artist, genre, listen_history, playlist, playlist_track, rating, track — confirmed working). The MySQL version is at `/mnt/user-data/outputs/schema_mysql.sql`. The PostgreSQL version is at `/mnt/user-data/outputs/schema.sql`.
- pgvector extension must be enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- Do not use an ORM for the vector queries; use raw `pg` queries for those
- For the Next.js auth, use NextAuth.js with credentials provider and JWT strategy
- Role is stored in the JWT and checked in middleware for admin routes
- Embedding model: use a lightweight sentence-transformer or mock 128-dim float arrays for now; the vector infra should work regardless of embedding source
- Mac is Intel (`/usr/local/opt/mysql`), MySQL accessible via terminal after PATH fix in `~/.zprofile`
