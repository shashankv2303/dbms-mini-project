# SoundTrail — Project Documentation

**Mood-Based Music Discovery & Playlist Curation Platform**
DBMS Experiential Learning · Level 3 · Team 15 · PES University

---

## 1. Objectives

1. Design and implement a normalised relational schema for a music catalogue with users, playlists, ratings and listening history.
2. Go beyond CRUD: let users discover music by **mood** using **vector similarity search** over track embeddings (pgvector), rather than exact genre/tag matching.
3. Demonstrate DDL (CREATE / ALTER / DROP), DML, constraints, indexes, views, triggers, functions/procedures, transactions, full-text search and vector search.
4. Deliver a role-based Next.js web application whose only path to the database is a server-side API layer.

## 2. Functional requirements

| # | Requirement | Role |
|---|---|---|
| F1 | Register / sign in / sign out (bcrypt + JWT cookie) | all |
| F2 | Browse and filter the catalogue (genre, sort), full-text search on track title / artist | all |
| F3 | Mood explorer: choose mood sliders → nearest tracks by cosine distance | all |
| F4 | "Tracks that feel like this" on every track page | all |
| F5 | Play a track (records listen history, updates play counter) | listener |
| F6 | Rate (1–5) and review a track; update or delete own rating | listener |
| F7 | Create / rename / delete playlists, public or private; add / remove tracks | listener |
| F8 | Generate a playlist from a track's vibe (transactional) | listener |
| F9 | Profile: listening stats, top genres, history, personalised recommendations | listener |
| F10 | Admin dashboard: counts, live analytics queries, CRUD for artists / albums / tracks / genres, change user roles, delete users, set a track's mood vector | admin |

Roles: `listener` (default for new accounts), `artist` (reserved, same rights as listener), `admin`.

## 3. Database choice and justification

| Data | Store | Why |
|---|---|---|
| Artists, albums, tracks, users, playlists, ratings, listen history | **PostgreSQL** (relational) | Strongly structured, many-to-many relations (playlist ↔ track), integrity rules (FK, UNIQUE, CHECK), aggregation-heavy reporting, transactions |
| Track mood/audio embeddings (128-dim float vectors) | **pgvector** inside the same PostgreSQL instance | "Feels like" is a *similarity* question; B-tree/equality cannot answer it. Keeping vectors beside the rows they describe allows one query to JOIN similarity results with metadata, one transaction to update both, and one system to operate. A separate vector DB would add a sync problem with no benefit at this scale |

## 4. Entity–relationship diagram

```mermaid
erDiagram
    ARTIST ||--o{ ALBUM : releases
    GENRE  ||--o{ ALBUM : classifies
    GENRE  ||--o{ TRACK : classifies
    ALBUM  ||--o{ TRACK : contains
    TRACK  ||--|| TRACK_EMBEDDING : "has vector"
    APP_USER ||--o{ PLAYLIST : owns
    PLAYLIST ||--o{ PLAYLIST_TRACK : holds
    TRACK  ||--o{ PLAYLIST_TRACK : "appears in"
    APP_USER ||--o{ RATING : writes
    TRACK  ||--o{ RATING : receives
    APP_USER ||--o{ LISTEN_HISTORY : generates
    TRACK  ||--o{ LISTEN_HISTORY : "is played in"

    ARTIST { int artist_id PK
            varchar name
            text bio
            varchar country
            int formed_year }
    GENRE { int genre_id PK
            varchar name UK }
    ALBUM { int album_id PK
            varchar title
            date release_date
            int artist_id FK
            int genre_id FK }
    TRACK { int track_id PK
            varchar title
            int duration_sec
            int track_number
            int play_count
            int album_id FK
            int genre_id FK }
    APP_USER { int user_id PK
            varchar username UK
            varchar email UK
            varchar password_hash
            varchar role
            timestamp created_at }
    PLAYLIST { int playlist_id PK
            varchar name
            text description
            bool is_public
            timestamp created_at
            int user_id FK }
    PLAYLIST_TRACK { int playlist_id PK_FK
            int track_id PK_FK
            int position
            timestamp added_at }
    RATING { int rating_id PK
            int rating
            text review_text
            timestamp created_at
            int user_id FK
            int track_id FK }
    LISTEN_HISTORY { int history_id PK
            timestamp listened_at
            int duration_listened
            int user_id FK
            int track_id FK }
    TRACK_EMBEDDING { int track_id PK_FK
            vector128 embedding
            varchar model_version
            timestamp created_at }
```

Relationships: ARTIST 1—N ALBUM, ALBUM 1—N TRACK, GENRE 1—N ALBUM/TRACK, APP_USER 1—N PLAYLIST, PLAYLIST M—N TRACK (resolved by PLAYLIST_TRACK), APP_USER M—N TRACK via RATING (one per pair) and via LISTEN_HISTORY (many per pair), TRACK 1—1 TRACK_EMBEDDING.

## 5. Relational schema

```
ARTIST(artist_id PK, name, bio, country, formed_year)
GENRE(genre_id PK, name UNIQUE)
ALBUM(album_id PK, title, release_date, artist_id FK→ARTIST, genre_id FK→GENRE)
TRACK(track_id PK, title, duration_sec, track_number, play_count,
      album_id FK→ALBUM, genre_id FK→GENRE)
APP_USER(user_id PK, username UNIQUE, email UNIQUE, password_hash,
         role CHECK IN ('admin','artist','listener'), created_at)
PLAYLIST(playlist_id PK, name, description, is_public, created_at, user_id FK→APP_USER)
PLAYLIST_TRACK(playlist_id FK→PLAYLIST, track_id FK→TRACK, position, added_at,
               PK(playlist_id, track_id))
RATING(rating_id PK, rating CHECK 1–5, review_text, created_at,
       user_id FK→APP_USER, track_id FK→TRACK, UNIQUE(user_id, track_id))
LISTEN_HISTORY(history_id PK, listened_at, duration_listened,
               user_id FK→APP_USER, track_id FK→TRACK)
TRACK_EMBEDDING(track_id PK/FK→TRACK, embedding vector(128), model_version, created_at)
```

All tables are in 3NF. `track.play_count` is a deliberate denormalisation (a counter that would otherwise require `COUNT(*)` over `listen_history` for every listing); it is kept consistent by a trigger and can be rebuilt with `CALL recalc_play_counts()`.

Foreign-key delete behaviour: `album→artist`, `track→album`, `playlist→user`, `playlist_track→*`, `rating→*`, `listen_history→*`, `track_embedding→track` are `ON DELETE CASCADE`; `album.genre_id` / `track.genre_id` are `ON DELETE SET NULL`.

## 6. Data dictionary (constraints)

| Table | Column | Type | Constraints |
|---|---|---|---|
| artist | artist_id | SERIAL | PK |
| | name | VARCHAR(120) | NOT NULL |
| | formed_year | INTEGER | CHECK 1800–2100 |
| genre | name | VARCHAR(60) | NOT NULL, UNIQUE |
| album | title | VARCHAR(160) | NOT NULL |
| | artist_id | INTEGER | NOT NULL, FK artist, CASCADE |
| | genre_id | INTEGER | FK genre, SET NULL |
| track | title | VARCHAR(160) | NOT NULL |
| | duration_sec | INTEGER | NOT NULL, CHECK > 0 |
| | track_number | INTEGER | CHECK > 0 |
| | play_count | INTEGER | NOT NULL DEFAULT 0, CHECK ≥ 0 (added by ALTER) |
| | album_id | INTEGER | NOT NULL, FK album, CASCADE |
| app_user | username | VARCHAR(40) | NOT NULL, UNIQUE |
| | email | VARCHAR(160) | NOT NULL, UNIQUE, CHECK format |
| | password_hash | VARCHAR(100) | NOT NULL (bcrypt) |
| | role | VARCHAR(10) | NOT NULL DEFAULT 'listener', CHECK IN (admin, artist, listener) |
| playlist | name | VARCHAR(100) | NOT NULL |
| | is_public | BOOLEAN | NOT NULL DEFAULT FALSE |
| | user_id | INTEGER | NOT NULL, FK app_user, CASCADE |
| playlist_track | (playlist_id, track_id) | | composite PK |
| | position | INTEGER | NOT NULL, CHECK > 0 |
| rating | rating | INTEGER | NOT NULL, CHECK 1–5 |
| | (user_id, track_id) | | UNIQUE |
| listen_history | duration_listened | INTEGER | NOT NULL DEFAULT 0, CHECK ≥ 0 |
| track_embedding | embedding | vector(128) | NOT NULL (dimension enforced by type) |

Integrity is enforced **in the database** (CHECK / UNIQUE / FK / NOT NULL); the API layer additionally validates input to give friendly messages and maps PostgreSQL error codes (23505, 23503, 23514, …) to HTTP 409 / 400.

## 7. Implementation

### 7.1 DDL (`sql/01_schema.sql`, `sql/02_alter.sql`)

* **CREATE**: 9 relational tables + `track_embedding`, extensions `vector`, `pgcrypto`.
* **ALTER**: `ADD COLUMN play_count` (+ `ADD CONSTRAINT` CHECK, index), `ADD / RENAME / DROP COLUMN` round trip.
* **DROP**: `DROP INDEX`, `DROP TABLE` (scratch table), `DROP COLUMN`; `npm run db:reset` drops the whole schema.
* **Indexes (14 non-PK, non-UNIQUE)**: FK columns (`album.artist_id`, `album.genre_id`, `track.album_id`, `track.genre_id`, `playlist.user_id`, `playlist_track.track_id`, `rating.track_id`, `listen_history.track_id`), composite `(user_id, listened_at DESC)`, `listened_at`, `track.play_count DESC`, two **GIN** full-text indexes (`to_tsvector('english', title/name)`), and the **ivfflat** vector index.
* **Views**: `popular_tracks` (JOIN + aggregates over listen_history and rating), `user_listening_stats` (per-user aggregates with scalar subqueries).

### 7.2 DML (`sql/03_seed.sql`)

INSERT of 12 genres, 28 artists, 56 albums, 336 tracks, 336 embeddings, 30 users (bcrypt via `crypt()`), 50 playlists (323 playlist tracks), 442 ratings, 4 000 listens; UPDATE to reconcile `play_count`. The application issues INSERT / UPDATE / DELETE through its API (ratings upsert, playlist rename, track removal, role change, …).

### 7.3 Advanced features (4 required for SQL + 1 vector — all delivered)

| Feature | Where |
|---|---|
| **Transactions** | `POST /api/playlists/:id/tracks` (lock row → ownership check → append) and `POST /api/playlists/from-track` (create playlist + seed + N nearest neighbours; all-or-nothing) via `withTransaction()` in `src/lib/db.ts` |
| **Triggers** | `trg_listen_play_count` (INSERT/DELETE on listen_history keeps `track.play_count` in sync), `trg_playlist_track_pos_ins/_del` (auto position; re-pack on delete), `trg_track_default_embedding` (cold-start genre-centroid vector for new tracks) |
| **Stored functions / procedures** | `similar_tracks`, `tracks_near_vector`, `get_recommendations(user_id)`, `search_tracks`, `add_track_to_playlist`, `PROCEDURE recalc_play_counts()` |
| **Views** | `popular_tracks`, `user_listening_stats` |
| **Indexing** | B-tree on FKs / sort keys, GIN (full-text), ivfflat (vector) |
| **Full-text search** | `search_tracks()` — `tsvector`/`tsquery` with `ts_rank`, GIN-indexed, used by `GET /api/tracks?q=` |
| **Vector similarity** | pgvector, see §8 |

## 8. Vector database / semantic search

| Question | Answer |
|---|---|
| What is converted to embeddings? | Each **track** → one 128-dim vector describing its mood / audio character |
| Which model? | The vector infrastructure is model-agnostic (`model_version` column). The seeded vectors are **mock** embeddings designed to be meaningful: dims 1–8 are interpretable mood axes (energy, valence, danceability, acousticness, tempo, instrumentalness, intensity, warmth) = genre profile + per-track noise; dims 9–128 are a genre-specific timbre signature + noise. Swapping in real audio features only requires writing new rows to `track_embedding` |
| How are vectors stored? | `track_embedding.embedding vector(128)`, 1-to-1 with `track`, ivfflat index (`vector_cosine_ops`, `lists = 10`) |
| Similarity metric | **Cosine distance** (`<=>`); the UI shows `(1 − distance)` as a match % |
| How is relevance retrieved? | `ORDER BY embedding <=> $query LIMIT k`. Three query vectors: (a) another track's embedding (`similar_tracks`), (b) the 8 mood sliders padded with zeros (`POST /api/recommend/mood`), (c) the **centroid of the user's liked/listened tracks** (`get_recommendations`), excluding already-heard tracks. Cold-start users fall back to most-played tracks |

## 9. System architecture

```
┌──────────────┐  fetch (JSON, cookie)  ┌────────────────────────────┐   pg (raw SQL)   ┌───────────────────────────┐
│  Next.js UI  │ ─────────────────────▶ │  Next.js Route Handlers    │ ───────────────▶ │ PostgreSQL                │
│ React pages  │ ◀───────────────────── │  /api/*  (validation,      │ ◀─────────────── │  relational tables, views │
│ (client)     │                        │  auth, RBAC, error mapping)│                  │  triggers, functions      │
└──────────────┘                        └─────────────┬──────────────┘                  │  + pgvector (embeddings)  │
        ▲                                             │ JWT verify                      └───────────────────────────┘
        │  middleware.ts (edge): /admin, /api/admin → role from JWT
```

* The browser never talks to the database; pages call `/api/*` only.
* Credentials and the JWT secret come from environment variables (`.env.local`, git-ignored).
* Passwords are bcrypt-hashed; the session is an `httpOnly`, `SameSite=Lax` JWT cookie; admin handlers re-check the role in the DB so a demoted admin loses access immediately.
* All SQL is parameterised (`$1…`); user input is never concatenated into statements.

### API summary

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register · login · logout`, `GET /api/auth/me` |
| Catalogue | `GET/POST /api/tracks`, `GET/PUT/DELETE /api/tracks/:id`, `/api/artists`, `/api/albums`, `/api/genres` (writes admin only) |
| Engagement | `POST /api/tracks/:id/play`, `GET/POST/DELETE /api/tracks/:id/ratings` |
| Vector | `GET /api/tracks/:id/similar`, `GET /api/recommend[?trackId=]`, `POST /api/recommend/mood` |
| Playlists | `GET/POST /api/playlists`, `GET/PATCH/DELETE /api/playlists/:id`, `POST /api/playlists/:id/tracks`, `DELETE /api/playlists/:id/tracks/:trackId`, `POST /api/playlists/from-track` |
| Reports | `GET /api/popular`, `GET /api/search`, `GET /api/users/me`, `GET /api/admin/{stats,users,analytics}`, `PATCH/DELETE /api/admin/users/:id`, `PUT /api/admin/embeddings/:trackId` |

## 10. Important queries

All are in `sql/05_queries.sql` and run live (with their SQL shown) on the **Admin → Analytics** tab.

```sql
-- Most listened tracks this month  (JOIN, GROUP BY, ORDER BY)
SELECT t.title, a.name AS artist, COUNT(lh.history_id) AS plays
FROM listen_history lh
JOIN track t ON lh.track_id = t.track_id
JOIN album al ON t.album_id = al.album_id
JOIN artist a ON al.artist_id = a.artist_id
WHERE lh.listened_at >= NOW() - INTERVAL '30 days'
GROUP BY t.track_id, t.title, a.name
ORDER BY plays DESC LIMIT 10;

-- Users who rated but never created a playlist  (EXISTS / NOT EXISTS)
SELECT u.username FROM app_user u
WHERE EXISTS (SELECT 1 FROM rating r WHERE r.user_id = u.user_id)
  AND NOT EXISTS (SELECT 1 FROM playlist p WHERE p.user_id = u.user_id);

-- Average rating per genre  (GROUP BY, HAVING)
SELECT g.name, ROUND(AVG(r.rating),2) AS avg_rating, COUNT(*) AS total_ratings
FROM rating r JOIN track t USING (track_id) JOIN genre g USING (genre_id)
GROUP BY g.genre_id, g.name HAVING COUNT(*) > 5 ORDER BY avg_rating DESC;

-- Vector similarity  (pgvector, cosine)
SELECT t.track_id, t.title,
       te.embedding <=> (SELECT embedding FROM track_embedding WHERE track_id = 1) AS distance
FROM track_embedding te JOIN track t USING (track_id)
WHERE t.track_id <> 1 ORDER BY distance LIMIT 10;

-- Window function: top 3 tracks per genre
SELECT * FROM (
  SELECT g.name AS genre, t.title, t.play_count,
         RANK() OVER (PARTITION BY g.genre_id ORDER BY t.play_count DESC) AS rnk
  FROM track t JOIN genre g USING (genre_id)) x WHERE rnk <= 3;
```

## 11. Testing results

Automated suites live in `tests/`; both ran green against PostgreSQL + pgvector.

**Database tests (`tests/db.test.mjs`) — 15 / 15 passed**

| Test | Verifies |
|---|---|
| seed present | 9 tables + embedding per track |
| CHECK rating 1..5 | rating 0 and 6 rejected (SQLSTATE 23514) |
| UNIQUE(user, track) | second rating rejected (23505) |
| CHECK role / UNIQUE username | invalid role and duplicate username rejected |
| FK | playlist_track with a non-existent track rejected (23503) |
| trigger play_count | listen insert → counter +1 |
| trigger positions | delete re-packs `1..n` |
| trigger embedding | new track gets `genre-centroid-v1` vector |
| add_track_to_playlist | non-owner rejected (42501); owner appended at next position |
| similar_tracks | 10 rows, ascending distance, seed excluded |
| clustering | ≥ 4 of 5 neighbours share the seed's genre |
| get_recommendations | never returns already-heard tracks |
| full-text | `search_tracks('neon')` returns only title/artist matches |
| views | `popular_tracks`, `user_listening_stats` return rows |
| indexes | ≥ 5 non-PK indexes incl. GIN and ivfflat |

**API tests (`tests/api.test.mjs`) — 7 / 7 passed**: public catalogue, full-text search, mood vector search (+ 400 on bad input), login success/failure, RBAC (401 anonymous, 403 listener, 200 admin), listener flow (play → counter, rating validation + upsert + delete, playlist add / duplicate 400 / non-owner 403 / private 404, vibe playlist transaction), registration (validation, forced `listener` role, duplicate 409).

**Manual UI checks**: sign-in, Discover search table, track page with "feels like" list, Admin → Analytics with live SQL.

> Screenshots to include in the submitted copy: Discover (search), Mood explorer, Track detail, Playlist view, Profile, Admin → Overview, Admin → Analytics, Admin → Users.

## 12. Conclusion

SoundTrail combines a conventional, integrity-checked relational model with vector similarity search in the same PostgreSQL instance. The database does real work — triggers keep derived data consistent, functions encapsulate recommendation and search logic, transactions make multi-step playlist operations atomic, and indexes (B-tree, GIN, ivfflat) support each access pattern — while the Next.js API layer stays thin and validates, authorises and translates errors. Future work: real audio-feature embeddings, an `artist` self-service portal, HNSW indexing at larger scale, and playlist drag-and-drop reordering.
