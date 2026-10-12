# SoundTrail — mood-based music discovery & playlist curation

DBMS Experiential Learning, Level 3 project · Team 15 · PES University

SoundTrail lets listeners discover music by *mood*. Track metadata lives in
**PostgreSQL** (9 relational tables); every track also has a 128-dimensional
mood/audio embedding stored with **pgvector**, so the app can answer
"what feels like this?" with nearest-neighbour search instead of exact tag
matching. The web app is **Next.js** (App Router) with route handlers as the
only path to the database.

Full write-up (ER diagram, data dictionary, queries, testing): [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md)

## Stack

| Layer | Choice |
|---|---|
| Frontend + API | Next.js 15 (App Router, route handlers), React 19, TypeScript |
| SQL database | PostgreSQL 14+ |
| Vector database | pgvector extension (`vector(128)`, cosine distance, ivfflat index) |
| Auth | bcrypt password hashes, JWT (HS256, `jose`) in an httpOnly cookie, role checks in middleware **and** handlers |
| DB access | raw `pg` queries (no ORM) |

## Prerequisites

* Node.js 20+
* PostgreSQL 14+ with the **pgvector** extension available
  (`brew install postgresql@17 pgvector` on macOS, or the `pgvector/pgvector` Docker image)
* A database named `soundtrail` and a role that may `CREATE EXTENSION`
  (the `vector` and `pgcrypto` extensions are both created by `01_schema.sql`)

```bash
createdb soundtrail
```

No local Postgres? Use Docker instead:

```bash
docker run -d --name soundtrail-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=soundtrail \
  -p 5432:5432 pgvector/pgvector:pg17
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/soundtrail
```

## Setup

```bash
npm install
cp .env.example .env.local        # then edit DATABASE_URL and JWT_SECRET
npm run db:setup                   # runs sql/01 → 04 (use db:reset to start over)
npm run dev                        # http://localhost:3000
```

`npm run db:setup` applies, in order:

| Script | Purpose |
|---|---|
| `sql/01_schema.sql` | extensions, 9 tables + `track_embedding`, constraints, indexes (B-tree, GIN full-text, ivfflat), views |
| `sql/02_alter.sql` | `ALTER TABLE` (adds `track.play_count`, constraint, rename/drop column) and `DROP` demos |
| `sql/03_seed.sql` | `INSERT` ~336 tracks, 28 artists, 30 users, playlists, ratings, 4 000 listens, 336 embeddings |
| `sql/04_procedures.sql` | triggers, functions (`similar_tracks`, `get_recommendations`, `search_tracks`, …), procedure |
| `sql/05_queries.sql` | demo queries for the viva (run by hand in `psql`) |

### Demo accounts (seed data)

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `alice`, `bob`, `carol` | `password123` | listener |
| `neon_artist`, `lofi_artist` | `password123` | artist |

## Using the app

* **Discover** (`/`) – full-text search (title/artist), genre filter and sort, or the
  **Mood explorer**: 8 sliders (energy, valence, danceability, …) are turned into a
  query vector and matched against all track embeddings with pgvector.
* **Track page** (`/track/:id`) – play (writes `listen_history`, trigger bumps
  `play_count`), rate/review, "tracks that feel like this", "Playlist with this vibe"
  (transactional: creates a playlist and fills it with the nearest neighbours).
* **Playlists** (`/playlists`, `/playlist/:id`) – create, rename, public/private,
  add/remove tracks (positions are kept dense by a trigger).
* **Profile** (`/profile`) – listening stats (view), top genres, history, ratings,
  personalised recommendations (`get_recommendations()`).
* **Admin** (`/admin`, role `admin` only) – counts, live analytics queries with their
  SQL, CRUD for artists/albums/tracks/genres, role management, per-track mood vector.

## Tests

```bash
# DB-level tests (constraints, triggers, functions, vector search) – seeded DB required
DATABASE_URL=postgresql://... npm test

# API tests – run `npm run dev` (or `npm start`) first
BASE_URL=http://localhost:3000 npm test
```

## Project layout

```
sql/                    DDL, ALTER/DROP, seed DML, triggers & functions, demo queries
scripts/db-setup.mjs    applies the SQL files via pg
src/lib/                db pool, auth (JWT), pgvector helpers, validation, error mapping
src/middleware.ts       route protection (admin / signed-in routes)
src/app/api/            route handlers: auth, tracks, artists, albums, genres, playlists,
                        recommend (vector), popular, search, users, admin
src/app/…               pages: discover, track, artist, playlists, profile, admin, auth
tests/                  node:test suites (DB + API)
docs/                   project documentation
```

## Configuration

All configuration is via environment variables (`.env.local`, git-ignored):

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_POOL_MAX` | optional pool size (default 10) |
| `JWT_SECRET` | ≥ 16 chars; signs the session cookie |
