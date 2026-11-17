# SoundTrail — Presentation Guide (≈12 min + Q&A)

The spec's evaluation list, in the order you should show it:
ER diagram → relational schema → DB implementation → important queries → Next.js interface →
DB integration → advanced features → test cases → individual contribution.

## 0. Before you start (do this 15 minutes early)

Start Docker Desktop and wait until it says "running". Then, in a terminal:

```bash
cd "/Users/vinayak.hm/Desktop/labs/dbms/mini project"
docker start soundtrail-pg
npm run dev
```

The app is then at http://localhost:3000. (Don't paste `# comments` into zsh — it treats them as arguments.)

Open these **before** presenting so nothing loads cold:

| Tab / window | What |
|---|---|
| Browser tab 1 | http://localhost:3000, signed in as **alice** / `password123` |
| Browser tab 2 | a private window, signed in as **admin** / `admin123` → `/admin` |
| Terminal | `docker exec -it soundtrail-pg psql -U postgres -d soundtrail` (leave it open) |
| Editor | `docs/PROJECT_DOCUMENTATION.md` preview (for the ER diagram) and `sql/` folder |

Sanity check: in psql run `SELECT COUNT(*) FROM track;` → **336**. If the data is missing: `npm run db:reset`.
Turn off notifications; set browser zoom to ~110 %; font size in terminal large.

## 1. Opening — what and why (1 min)

> "SoundTrail lets you discover music by *mood*. The interesting part isn't CRUD — it's that every track has a
> 128-dimensional mood vector in pgvector, so we can answer 'what feels like this?' with nearest-neighbour search
> instead of matching genre tags. Relational data is in PostgreSQL, vectors are in the same Postgres via pgvector."

Say the stack in one breath: **PostgreSQL + pgvector, Next.js route handlers as the only DB path, JWT auth with two+ roles.**

## 2. Database design (2 min) — show `docs/PROJECT_DOCUMENTATION.md`

1. **ER diagram** (§4). Walk it: Artist → Album → Track; Playlist ↔ Track is many-to-many resolved by `PLAYLIST_TRACK`
   (composite PK); Rating is unique per (user, track); Listen_history is many per pair; Track_embedding is 1-to-1.
2. **Why this split of databases** (§3): structured, relational, transactional data → SQL; "feels like" is a
   similarity question that equality/B-tree can't answer → vectors. Same instance means one JOIN, one transaction, no sync problem.
3. Mention **3NF**, and the one deliberate denormalisation: `track.play_count`, kept correct by a trigger.

In psql, show it's real:

```sql
\dt                      -- 10 tables
\d track                 -- columns, PK, FKs, CHECKs, indexes
\di                      -- 14+ indexes incl. GIN and ivfflat
\dv                      -- popular_tracks, user_listening_stats
```

## 3. DDL / DML (1 min) — show the `sql/` folder

| File | Say |
|---|---|
| `01_schema.sql` | CREATE tables, constraints, indexes, views |
| `02_alter.sql` | **ALTER** adds `play_count` after creation (+ rename/drop column), **DROP** of a scratch table/index |
| `03_seed.sql` | **INSERT** 336 tracks, 30 users (bcrypt via `crypt()`), 4 000 listens, 336 embeddings; **UPDATE** reconciles counters |
| `04_procedures.sql` | triggers + functions + procedure |
| `05_queries.sql` | demo queries |

## 4. Live app demo (4 min)

**As alice (tab 1):**

1. **Search** — type `midnight`, Search. Point at the note *"Matched via PostgreSQL full-text search (tsvector, ranked)"*.
   → *Full-text search, GIN index, `ts_rank`.*
2. **Mood explorer** — click the tab, press the **Party** preset, **Find matching tracks**. Then try the **Chill** or **Focus** preset (or drag *Energy* left) and search again; the results should shift to quieter genres. Try this once beforehand so you know what it shows. → *The 8 sliders become a 128-dim query vector; pgvector returns nearest neighbours by cosine distance; "Match %" = 1 − distance.*
3. **Track page** (click any track) — show "Tracks that feel like this".
   Click **▶ Play**: the toast says play_count updated. → *Inserts into `listen_history`; an AFTER INSERT trigger bumps `track.play_count`.*
4. **Rate** the track 4★ with a comment, then change it to 5★ (upsert), then delete it.
   → *UNIQUE(user_id, track_id) + `ON CONFLICT DO UPDATE`.*
5. Click **✨ Playlist with this vibe** → lands on a new 10-track playlist.
   → *One database **transaction**: create playlist, insert seed track, insert 9 nearest neighbours; any failure rolls everything back.*
6. On that playlist **Remove** the first track → positions re-number 1..n. → *AFTER DELETE trigger re-packs positions.*
7. **Profile** — stats (view `user_listening_stats`), "Recommended for you" (function `get_recommendations`:
   centroid of what the user listened to/liked, nearest tracks they haven't heard).

**As admin (tab 2):**

8. **Admin → Analytics** — scroll: each card shows the SQL and its result (JOIN/GROUP BY/HAVING, EXISTS/NOT EXISTS, scalar subquery, window function, view, vector query).
9. **Users** — change a user's role; try changing your own → blocked.
10. **Tracks** → *Mood* button sets a track's embedding by sliders.
11. Role demo: in tab 1 (alice) open `/admin` → redirected away. → *Middleware checks the JWT role, and every admin API handler re-checks the role in the database.*

## 5. Advanced features, shown in psql (2 min)

Paste these one at a time.

```sql
-- TRIGGER: play_count follows listen_history (rolled back so data stays clean)
BEGIN;
SELECT play_count FROM track WHERE track_id = 1;
INSERT INTO listen_history (user_id, track_id, duration_listened) VALUES (2, 1, 30);
SELECT play_count FROM track WHERE track_id = 1;      -- +1
ROLLBACK;
```

```sql
-- VECTOR search through the stored function, and the ivfflat index being used
SELECT * FROM similar_tracks(1, 5);
SET enable_seqscan = off;
EXPLAIN SELECT track_id FROM track_embedding
ORDER BY embedding <=> (SELECT embedding FROM track_embedding WHERE track_id = 1) LIMIT 10;
-- look for: Index Scan using idx_track_embedding_ivfflat
RESET enable_seqscan;
```

```sql
-- CONSTRAINTS: the database itself rejects bad data (run each; each must fail)
INSERT INTO rating (rating, user_id, track_id) VALUES (6, 2, 1);                -- CHECK 1..5
INSERT INTO app_user (username, email, password_hash, role)
VALUES ('x', 'x@y.zz', 'h', 'root');                                            -- role CHECK
INSERT INTO track (title, duration_sec, album_id) VALUES ('Bad', 0, 1);          -- duration > 0
```

```sql
-- FULL-TEXT + VIEWS + FUNCTION
SELECT * FROM search_tracks('neon', 5);
SELECT * FROM popular_tracks ORDER BY listen_count DESC LIMIT 5;
SELECT * FROM get_recommendations(2, 5);
```

Tick off the "at least 4 advanced concepts" list out loud:
**Transactions · Triggers (3) · Stored functions/procedure · Views (2) · Indexing (B-tree, GIN, ivfflat) · Full-text search · Vector similarity.**

## 6. Testing (1 min)

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/soundtrail   # Windows PowerShell: $env:DATABASE_URL="..."
npm test
```

Say: **15 database tests** (constraints, triggers, functions, vector ordering/clustering, indexes) and
**7 API tests** (RBAC, validation, listener flow, transactions). All pass. API tests need `npm run dev` running and `BASE_URL=http://localhost:3000`.

## 7. Closing (30 s)

> "Database integrity lives in the database — constraints, triggers, transactions — not in the app. The app layer
> only validates, authorises and translates errors. And the vector layer turns 'mood' into a query."

Mention the repo: https://github.com/shashankv2303/dbms-mini-project and the individual-contribution split.

---

## Likely viva questions and answers

**Why PostgreSQL + pgvector rather than a separate vector DB (Qdrant, Pinecone)?**
Vectors describe rows that already exist in SQL. In one instance I can JOIN similarity results with metadata, update both in one transaction, and operate one system. A separate DB adds a sync problem with no benefit at 336 vectors, or even at millions with HNSW.

**What is stored as an embedding, and which model?**
One 128-dim vector per track. They are **mock embeddings** (the spec allowed this): dims 1–8 are interpretable mood axes (energy, valence, danceability, acousticness, tempo, instrumentalness, intensity, warmth) from a genre profile plus noise; dims 9–128 are a genre-specific "timbre" signature plus noise. The `model_version` column and the `track_embedding` table mean real audio features can be dropped in with no code changes.

**Why cosine distance, not Euclidean?**
Cosine compares direction, not magnitude — it measures "same character" regardless of vector scale. The operator is `<=>`; the index uses `vector_cosine_ops`.

**What is ivfflat? Why not HNSW?**
IVF clusters vectors into `lists` (10 here) and searches only the nearest clusters, so it's approximate but fast. It must be **built after data is loaded** (that's why the seed script ends with `REINDEX`). HNSW gives better recall/speed at larger scale at the cost of build time/memory; for 336 rows either works, and I'd move to HNSW at scale (listed as future work).

**Is the mood search exact?**
Approximate with ivfflat (`probes` trade recall for speed); on a table this small the planner could use an exact scan. Results are deterministic enough for the demo.

**What does `get_recommendations` do?**
Averages the embeddings of tracks the user listened to or rated ≥ 4 (a taste centroid), finds nearest tracks, excludes tracks they already heard/rated. New users with no history get the most-played tracks.

**Where are transactions used and why?**
Adding to a playlist: lock the playlist row (`FOR UPDATE`), check ownership, compute next position, insert — prevents two concurrent adds taking the same position. "Playlist with this vibe": playlist + seed + N neighbours all-or-nothing.

**Why is `play_count` stored when you could COUNT(*)?**
Listings need it on every row; counting a growing history table each time is expensive. It's a controlled denormalisation maintained by a trigger and rebuildable with `CALL recalc_play_counts()`.

**Is it in 3NF?**
Yes; every non-key attribute depends on the key only. The only denormalisation is `play_count`.

**What indexes did you add and why?**
FK columns for joins (`album.artist_id`, `track.album_id`, `playlist.user_id`, …), `(user_id, listened_at DESC)` for a user's history, GIN on `to_tsvector(title/name)` for full-text, ivfflat for vectors. Expression indexes avoided adding a tsvector column, so the schema stayed as specified.

**How do you prevent SQL injection?**
Every query is parameterised (`$1, $2…`); user input is never concatenated. Sort options come from a fixed whitelist.

**How does authentication work?**
bcrypt password hashes; on login a JWT (HS256) is stored in an httpOnly, SameSite cookie. Middleware blocks `/admin` and `/api/admin` by role; every admin handler also re-reads the role from the database, so a demoted admin loses access immediately. New accounts are always `listener`; only an admin can change roles.

**Where are credentials kept?**
`.env.local` (git-ignored): `DATABASE_URL`, `JWT_SECRET`. Nothing hard-coded.

**What happens when you delete an artist?**
`ON DELETE CASCADE` removes albums → tracks → playlist entries, ratings, history and embeddings. Genre deletion uses `SET NULL`.

**What is the `artist` role for?**
Reserved for future artist self-service; currently it has listener rights. Minimum two roles (admin, listener) are fully enforced.

**What are the limitations / future work?**
Mock embeddings (real audio features next), `artist` portal, HNSW at scale, playlist drag-and-drop reordering.

**What did *you* contribute?** (answer honestly for your split — e.g. "SQL schema, triggers and functions" vs "Next.js app and API")

## If something goes wrong

| Problem | Fix |
|---|---|
| App shows errors / empty | Docker not running → start Docker Desktop, `docker start soundtrail-pg` |
| Data looks wrong | `npm run db:reset` (≈5 s) then reload |
| Login fails | seed users: `admin`/`admin123`, `alice`/`password123` (re-run `db:reset` if changed) |
| Page won't load | restart `npm run dev`; check `.env.local` exists |
| Total meltdown | show `docs/screenshots/` and the SQL in psql — they cover everything |
