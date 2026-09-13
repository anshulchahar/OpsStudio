import pg from 'pg'; import { readFile } from 'node:fs/promises';
const target = new URL(process.env.TEST_DATABASE_URL || '');
if (!['localhost','127.0.0.1'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Isolated test database required');
const client = new pg.Client({ connectionString: target.href });
await client.connect();
try { await client.query(await readFile('tests/fixtures/auth.sql','utf8')); }
finally { await client.end(); }
