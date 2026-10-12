// Database-level tests (constraints, triggers, functions, vector search).
// Requires a seeded database:  DATABASE_URL=... npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL to run the DB tests');
const client = new pg.Client({ connectionString: url });

before(async () => { await client.connect(); });
after(async () => { await client.end(); });

// Every test runs inside a transaction that is rolled back => seed data untouched.
async function inTx(fn) {
  await client.query('BEGIN');
  try { await fn(); } finally { await client.query('ROLLBACK'); }
}
async function rejects(sql, params, code) {
  await client.query('SAVEPOINT s');
  await assert.rejects(client.query(sql, params), (e) => { assert.equal(e.code, code, e.message); return true; });
  await client.query('ROLLBACK TO SAVEPOINT s');
}

test('seed data is present (9 tables + embeddings)', async () => {
  const { rows: [r] } = await client.query(
    `SELECT (SELECT COUNT(*) FROM artist)::int a, (SELECT COUNT(*) FROM track)::int t,
            (SELECT COUNT(*) FROM track_embedding)::int e, (SELECT COUNT(*) FROM app_user)::int u`);
  assert.ok(r.a >= 20 && r.t >= 100 && r.u >= 10);
  assert.equal(r.e, r.t);
});

test('CHECK: rating must be 1..5', () => inTx(async () => {
  await rejects(`INSERT INTO rating (rating, user_id, track_id) VALUES (6, 1, 1)`, [], '23514');
  await rejects(`INSERT INTO rating (rating, user_id, track_id) VALUES (0, 1, 1)`, [], '23514');
}));

test('UNIQUE: one rating per user per track', () => inTx(async () => {
  await client.query(`INSERT INTO rating (rating, user_id, track_id) VALUES (4, 1, 1) ON CONFLICT DO NOTHING`);
  await rejects(`INSERT INTO rating (rating, user_id, track_id) VALUES (5, 1, 1)`, [], '23505');
}));

test('CHECK: role must be admin/artist/listener; username/email UNIQUE', () => inTx(async () => {
  await rejects(`INSERT INTO app_user (username,email,password_hash,role) VALUES ('zz','zz@x.yy','h','root')`, [], '23514');
  await rejects(`INSERT INTO app_user (username,email,password_hash) VALUES ('admin','new@x.yy','h')`, [], '23505');
}));

test('FK: playlist_track needs an existing track', () => inTx(async () => {
  await rejects(`INSERT INTO playlist_track (playlist_id, track_id, position) VALUES (1, 999999, 1)`, [], '23503');
}));

test('trigger: listen_history insert increments track.play_count', () => inTx(async () => {
  const before = (await client.query(`SELECT play_count FROM track WHERE track_id = 1`)).rows[0].play_count;
  await client.query(`INSERT INTO listen_history (user_id, track_id, duration_listened) VALUES (2, 1, 30)`);
  const after = (await client.query(`SELECT play_count FROM track WHERE track_id = 1`)).rows[0].play_count;
  assert.equal(after, before + 1);
}));

test('trigger: deleting a playlist track re-packs positions', () => inTx(async () => {
  const { rows } = await client.query(`SELECT track_id FROM playlist_track WHERE playlist_id = 1 ORDER BY position`);
  assert.ok(rows.length >= 3);
  await client.query(`DELETE FROM playlist_track WHERE playlist_id = 1 AND track_id = $1`, [rows[0].track_id]);
  const after = (await client.query(`SELECT position FROM playlist_track WHERE playlist_id = 1 ORDER BY position`)).rows;
  assert.deepEqual(after.map((r) => r.position), after.map((_, i) => i + 1));
}));

test('trigger: new track receives a genre-centroid embedding', () => inTx(async () => {
  const { rows: [t] } = await client.query(
    `INSERT INTO track (title, duration_sec, album_id, genre_id) VALUES ('Test', 100, 1, 1) RETURNING track_id`);
  const { rows } = await client.query(`SELECT model_version FROM track_embedding WHERE track_id = $1`, [t.track_id]);
  assert.equal(rows[0].model_version, 'genre-centroid-v1');
}));

test('function: add_track_to_playlist enforces ownership and appends', () => inTx(async () => {
  const { rows: [p] } = await client.query(`SELECT playlist_id, user_id FROM playlist LIMIT 1`);
  const { rows: [other] } = await client.query(`SELECT user_id FROM app_user WHERE user_id <> $1 LIMIT 1`, [p.user_id]);
  const { rows: [t] } = await client.query(
    `SELECT track_id FROM track WHERE track_id NOT IN (SELECT track_id FROM playlist_track WHERE playlist_id = $1) LIMIT 1`,
    [p.playlist_id]);
  await rejects(`SELECT add_track_to_playlist($1,$2,$3)`, [p.playlist_id, t.track_id, other.user_id], '42501');
  const { rows: [r] } = await client.query(`SELECT add_track_to_playlist($1,$2,$3) AS pos`, [p.playlist_id, t.track_id, p.user_id]);
  const { rows: [m] } = await client.query(`SELECT MAX(position)::int m FROM playlist_track WHERE playlist_id = $1`, [p.playlist_id]);
  assert.equal(r.pos, m.m);
}));

test('vector: similar_tracks is ordered by distance and excludes the seed', async () => {
  const { rows } = await client.query(`SELECT * FROM similar_tracks(1, 10)`);
  assert.equal(rows.length, 10);
  assert.ok(rows.every((r) => r.track_id !== 1));
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].distance >= rows[i - 1].distance);
});

test('vector: neighbours share the seed track genre (clustered embeddings)', async () => {
  const { rows: [seed] } = await client.query(`SELECT g.name FROM track t JOIN genre g USING (genre_id) WHERE t.track_id = 1`);
  const { rows } = await client.query(`SELECT genre FROM similar_tracks(1, 5)`);
  assert.ok(rows.filter((r) => r.genre === seed.name).length >= 4);
});

test('function: get_recommendations excludes already-heard tracks', async () => {
  const { rows } = await client.query(`SELECT * FROM get_recommendations(2, 10)`);
  assert.ok(rows.length > 0);
  const { rows: heard } = await client.query(`SELECT track_id FROM listen_history WHERE user_id = 2`);
  const set = new Set(heard.map((h) => h.track_id));
  assert.ok(rows.every((r) => !set.has(r.track_id)));
});

test('full-text: search_tracks ranks title/artist matches', async () => {
  const { rows } = await client.query(`SELECT * FROM search_tracks('neon', 10)`);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => /neon/i.test(r.title) || /neon/i.test(r.artist)));
});

test('views: popular_tracks and user_listening_stats', async () => {
  const a = await client.query(`SELECT * FROM popular_tracks ORDER BY listen_count DESC LIMIT 3`);
  assert.equal(a.rowCount, 3);
  const b = await client.query(`SELECT * FROM user_listening_stats WHERE user_id = 2`);
  assert.equal(b.rowCount, 1);
});

test('indexes: at least 5 non-PK indexes incl. GIN and ivfflat', async () => {
  const { rows } = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'`);
  assert.ok(rows.length >= 5);
  assert.ok(rows.some((r) => /USING gin/i.test(r.indexdef)));
  assert.ok(rows.some((r) => /USING ivfflat/i.test(r.indexdef)));
});
