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

## Running the project (macOS and Windows)

The steps are the same on both systems except where marked. The easiest route is
**Docker for the database**, because it works identically everywhere and needs no
Postgres/pgvector install.

### 1. Install the prerequisites

| Tool | macOS | Windows 10/11 |
|---|---|---|
| Node.js 20+ | [nodejs.org](https://nodejs.org) installer, or `brew install node` | [nodejs.org](https://nodejs.org) installer (LTS) |
| Docker Desktop | [docker.com](https://www.docker.com/products/docker-desktop) (Intel or Apple Silicon build) | same; keep the default **WSL 2** backend and restart if asked |
| Git | `xcode-select --install` or `brew install git` | [git-scm.com](https://git-scm.com/download/win) |

Check them (Terminal on macOS, **PowerShell** on Windows):

```
node -v        # v20 or newer
docker -v
git --version
```

Open Docker Desktop and wait until it says it is running.

### 2. Get the code

```
git clone https://github.com/shashankv2303/dbms-mini-project.git
cd dbms-mini-project
npm install
```

### 3. Start PostgreSQL + pgvector

One line, works in macOS Terminal **and** Windows PowerShell:

```
docker run -d --name soundtrail-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=soundtrail -p 5432:5432 -v soundtrail-pgdata:/var/lib/postgresql/data pgvector/pgvector:pg17
```

Later, after a reboot: `docker start soundtrail-pg`. If port 5432 is already used by
another Postgres, change `-p 5432:5432` to `-p 5433:5432` and use `5433` in `DATABASE_URL`.

### 4. Configure environment variables

Create `.env.local` from the template:

| | macOS / Linux | Windows PowerShell |
|---|---|---|
| copy | `cp .env.example .env.local` | `Copy-Item .env.example .env.local` |

Then open `.env.local` in any editor. `DATABASE_URL` already matches the Docker
command above. Replace `JWT_SECRET` with a long random string. Generate one with
(works on both systems, uses Node):

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. Create the schema and load the data

```
npm run db:setup
```

(`npm run db:reset` wipes the schema first, useful to start over.)

### 6. Start the app

```
npm run dev
```

Open <http://localhost:3000> and sign in with a demo account (below).
For a production-style run: `npm run build` then `npm start`.

### Using your own PostgreSQL instead of Docker

Install PostgreSQL 14+ **and the pgvector extension**
(macOS: `brew install postgresql@17 pgvector`; Windows: the EDB installer plus a
[pgvector Windows build](https://github.com/pgvector/pgvector#windows), or simply use Docker).
Create the database (`createdb soundtrail`, or `CREATE DATABASE soundtrail;` in pgAdmin),
put its URL in `DATABASE_URL`, then continue from step 5. The connecting role must be
allowed to `CREATE EXTENSION` (`vector` and `pgcrypto` are created by `01_schema.sql`).

### Open a SQL shell (for the viva / demo queries)

```
docker exec -it soundtrail-pg psql -U postgres -d soundtrail
```

Inside it, paste queries from `sql/05_queries.sql`, or use `\dt` (tables), `\di` (indexes),
`\dv` (views), `\df` (functions).

### Troubleshooting

| Symptom | Fix |
|---|---|
| `docker: command not found` / cannot connect to daemon | Start Docker Desktop and wait for it to finish starting |
| `ECONNREFUSED 127.0.0.1:5432` | Container not running: `docker start soundtrail-pg` (check with `docker ps`) |
| `password authentication failed` | `DATABASE_URL` must match the `POSTGRES_PASSWORD` you used (`postgres` above) |
| `extension "vector" is not available` | You are on a Postgres without pgvector. Use the Docker image above |
| `JWT_SECRET must be set` | `.env.local` is missing or `JWT_SECRET` is under 16 characters; restart `npm run dev` after editing |
| `Port 3000 is in use` | `npm run dev -- -p 3001` |
| PowerShell blocks `npm` ("running scripts is disabled") | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use Command Prompt |
| Reset everything | `docker rm -f soundtrail-pg && docker volume rm soundtrail-pgdata`, then redo step 3 and 5 |

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
