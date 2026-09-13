import pg from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const raw = process.env.MIGRATION_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!raw) throw new Error('MIGRATION_DATABASE_URL or POSTGRES_URL_NON_POOLING is required');
let url;
try { url = new URL(raw); } catch { throw new Error('Invalid database connection URL'); }
const local = ['localhost','127.0.0.1','::1'].includes(url.hostname);
for (const key of ['sslmode','sslcert','sslrootcert','sslkey']) url.searchParams.delete(key);
if (!local && !process.env.PGSSLROOTCERT) throw new Error('Verified TLS requires PGSSLROOTCERT');
const client = new pg.Client({ connectionString: url.href, ssl: local ? false : { rejectUnauthorized: true, ca: await readFile(process.env.PGSSLROOTCERT, 'utf8') }, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
const files = (await readdir('supabase/migrations')).filter(file => /^\d{14}_.*\.sql$/.test(file)).sort();
assert.equal(new Set(files.map(file => file.slice(0,14))).size, files.length, 'Duplicate migration versions');
await client.connect();
try {
  await client.query("set lock_timeout='5s'; select pg_advisory_lock(687135920);");
  const existing = (await client.query("select to_regclass('supabase_migrations.schema_migrations') present")).rows[0].present;
  if (!existing) {
    const applicationExists = (await client.query("select to_regclass('public.learner_progress') present")).rows[0].present;
    if (applicationExists) {
      if (!process.argv.includes('--baseline')) throw new Error('Existing untracked schema: verify baseline before applying migrations');
      const { queries, structural } = JSON.parse(await readFile('supabase/baseline-20260912.json','utf8'));
      for (const [name, query] of Object.entries(queries)) {
        const actual = (await client.query(query)).rows;
        assert.deepEqual(actual, structural[name], `Untracked schema drift in ${name}; migration stopped`);
      }
    }
    await client.query('begin');
    await client.query(`create schema if not exists supabase_migrations;
      revoke all on schema supabase_migrations from public,anon,authenticated;
      create table supabase_migrations.schema_migrations(version text primary key, statements text[], name text);
      revoke all on supabase_migrations.schema_migrations from public,anon,authenticated;`);
    if (applicationExists) {
      for (const file of files.filter(file => file.slice(0,14) <= '20260912230000')) {
        await client.query('insert into supabase_migrations.schema_migrations(version,statements,name) values($1,$2,$3)', [file.slice(0,14), [await readFile(`supabase/migrations/${file}`,'utf8')],file.slice(15,-4)]);
      }
      console.log('Existing schema matched the verified baseline; three original migrations recorded.');
    }
    await client.query('commit');
  }
  const history = new Map((await client.query('select version,statements from supabase_migrations.schema_migrations')).rows.map(row => [row.version,row.statements]));
  const localVersions = new Set(files.map(file => file.slice(0,14)));
  for (const version of history.keys()) if (!localVersions.has(version)) throw new Error(`Applied migration ${version} is missing from this checkout`);
  const latestApplied = [...history.keys()].sort().at(-1) || '';
  for (const file of files) if (!history.has(file.slice(0,14)) && file.slice(0,14) <= latestApplied)
    throw new Error(`Out-of-order migration ${file}; migration stopped`);
  for (const file of files) {
    const version = file.slice(0,14), sql = await readFile(`supabase/migrations/${file}`, 'utf8');
    if (!sql.trim()) throw new Error(`Empty migration ${file}`);
    if (history.has(version)) {
      assert.equal(history.get(version)?.join('\n'), sql, `Applied migration ${version} was edited`);
      continue;
    }
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into supabase_migrations.schema_migrations(version,statements,name) values($1,$2,$3)', [version,[sql],file.slice(15,-4)]);
    await client.query('commit');
    console.log(`Applied ${file}`);
  }
  await client.query("notify pgrst, 'reload schema'");
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.query('select pg_advisory_unlock(687135920)').catch(() => {});
  await client.end();
}
