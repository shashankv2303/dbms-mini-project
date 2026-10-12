// End-to-end API tests. Needs the app running:  BASE_URL=http://localhost:3000 npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, headers: res.headers };
}
async function login(username, password) {
  const r = await call('/api/auth/login', { method: 'POST', body: { username, password } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.headers.get('set-cookie').split(';')[0];
}

test('public catalog endpoints work without auth', async () => {
  assert.equal((await call('/api/genres')).status, 200);
  const t = await call('/api/tracks?limit=5');
  assert.equal(t.status, 200);
  assert.equal(t.json.tracks.length, 5);
  assert.ok((await call('/api/tracks/1/similar')).json.similar.length > 0);
});

test('full-text search endpoint', async () => {
  const r = await call('/api/tracks?q=midnight');
  assert.equal(r.status, 200);
  assert.ok(r.json.tracks.length > 0);
});

test('mood vector search', async () => {
  const r = await call('/api/recommend/mood', { method: 'POST', body: { mood: [0.9, 0.2, 0, -0.5, 0.8, -0.2, 0.9, -0.5] } });
  assert.equal(r.status, 200);
  assert.ok(r.json.tracks.length > 0);
  assert.equal((await call('/api/recommend/mood', { method: 'POST', body: { mood: [1, 2] } })).status, 400);
});

test('auth: bad credentials rejected, good accepted', async () => {
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { username: 'alice', password: 'nope' } })).status, 401);
  await login('alice', 'password123');
});

test('RBAC: listener cannot reach admin routes, admin can', async () => {
  const listener = await login('alice', 'password123');
  assert.equal((await call('/api/admin/stats')).status, 401);
  assert.equal((await call('/api/admin/stats', { cookie: listener })).status, 403);
  assert.equal((await call('/api/tracks', { method: 'POST', cookie: listener, body: { title: 'x', duration_sec: 10, album_id: 1 } })).status, 403);
  const admin = await login('admin', 'admin123');
  assert.equal((await call('/api/admin/stats', { cookie: admin })).status, 200);
});

test('listener flow: play, rate, playlist (transaction), vibe playlist', async () => {
  const c = await login('bob', 'password123');
  const before = (await call('/api/tracks/5')).json.track.play_count;
  assert.equal((await call('/api/tracks/5/play', { method: 'POST', cookie: c, body: {} })).status, 200);
  assert.equal((await call('/api/tracks/5')).json.track.play_count, before + 1);

  assert.equal((await call('/api/tracks/5/ratings', { method: 'POST', cookie: c, body: { rating: 9 } })).status, 400);
  assert.equal((await call('/api/tracks/5/ratings', { method: 'POST', cookie: c, body: { rating: 5, review_text: 'test' } })).status, 201);
  assert.equal((await call('/api/tracks/5/ratings', { method: 'POST', cookie: c, body: { rating: 3 } })).status, 201); // upsert
  assert.equal((await call('/api/tracks/5/ratings', { method: 'DELETE', cookie: c })).status, 200);

  const p = await call('/api/playlists', { method: 'POST', cookie: c, body: { name: 'api-test' } });
  assert.equal(p.status, 201);
  const pid = p.json.playlist.playlist_id;
  assert.equal((await call(`/api/playlists/${pid}/tracks`, { method: 'POST', cookie: c, body: { trackId: 7 } })).status, 201);
  assert.equal((await call(`/api/playlists/${pid}/tracks`, { method: 'POST', cookie: c, body: { trackId: 7 } })).status, 400); // dup
  const alice = await login('alice', 'password123');
  assert.equal((await call(`/api/playlists/${pid}/tracks`, { method: 'POST', cookie: alice, body: { trackId: 8 } })).status, 403);
  assert.equal((await call(`/api/playlists/${pid}`, { cookie: alice })).status, 404); // private
  assert.equal((await call(`/api/playlists/${pid}`, { method: 'DELETE', cookie: c })).status, 200);

  const v = await call('/api/playlists/from-track', { method: 'POST', cookie: c, body: { trackId: 3, size: 6 } });
  assert.equal(v.status, 201);
  assert.equal(v.json.tracks, 6);
  await call(`/api/playlists/${v.json.playlistId}`, { method: 'DELETE', cookie: c });
});

test('registration validates input and defaults role to listener', async () => {
  assert.equal((await call('/api/auth/register', { method: 'POST', body: { username: 'a', email: 'bad', password: 'x' } })).status, 400);
  const u = `tester_${Date.now()}`;
  const r = await call('/api/auth/register', { method: 'POST', body: { username: u, email: `${u}@x.io`, password: 'longenough1', role: 'admin' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.user.role, 'listener');
  assert.equal((await call('/api/auth/register', { method: 'POST', body: { username: u, email: `${u}@x.io`, password: 'longenough1' } })).status, 409);
});
