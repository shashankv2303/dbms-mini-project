// Applies sql/01..04 to the database in DATABASE_URL (from env or .env.local).
//   npm run db:setup            run the scripts in order (idempotent)
//   npm run db:reset            DROP SCHEMA public CASCADE first, then run them
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, '.env'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
  process.exit(1);
}

const reset = process.argv.includes('--reset');
const files = ['01_schema.sql', '02_alter.sql', '03_seed.sql', '04_procedures.sql'];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  if (reset) {
    console.log('Dropping and recreating schema public ...');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  for (const f of files) {
    const started = Date.now();
    await client.query(fs.readFileSync(path.join(root, 'sql', f), 'utf8'));
    console.log(`✔ ${f}  (${Date.now() - started} ms)`);
  }
  const { rows } = await client.query(
    `SELECT (SELECT COUNT(*) FROM track) AS tracks, (SELECT COUNT(*) FROM track_embedding) AS embeddings,
            (SELECT COUNT(*) FROM app_user) AS users`);
  console.log('Loaded:', rows[0]);
} catch (e) {
  console.error('✘ Failed:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
