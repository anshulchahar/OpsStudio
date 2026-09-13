import { spawn } from 'node:child_process';
import pg from 'pg';
import { readFile, writeFile, mkdir, chmod, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { BACKUP_LIMIT, encodeBackup } from './backup-format.mjs';

process.umask(0o077);

// Pass a private environment file; never put credentials into process arguments.
const connection = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || '', 'base64');
if (!connection || key.length !== 32 || !process.env.PGSSLROOTCERT) throw new Error('Verified database TLS and a 32-byte backup key are required.');
let url;
try { url = new URL(connection); } catch { throw new Error('Invalid database connection URL'); }
const directory = path.resolve(process.env.BACKUP_DIRECTORY || 'work/backups');
await mkdir(directory, { recursive:true,mode:0o700 });
await chmod(directory,0o700);
const plain = path.join(directory,`${new Date().toISOString().replaceAll(':','-')}.dump`);
const destination = `${plain}.aesgcm`;
const env = { ...process.env, PGHOST:url.hostname, PGPORT:url.port||'5432', PGUSER:decodeURIComponent(url.username), PGPASSWORD:decodeURIComponent(url.password), PGDATABASE:decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT:'10', PGSSLMODE:'verify-full' };
for (const name of ['sslmode','sslcert','sslrootcert','sslkey']) url.searchParams.delete(name);
const client = new pg.Client({ connectionString:url.href,ssl:{rejectUnauthorized:true,ca:await readFile(process.env.PGSSLROOTCERT,'utf8')},connectionTimeoutMillis:10000,statement_timeout:30000 });
const schemas = ['public','auth','private','supabase_migrations'];
const entries = acl => `(select coalesce(jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then null else pg_get_userbyid(a.grantee) end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type),'[]'::jsonb) from aclexplode(${acl}) a)`;
try {
  await client.connect();
  await client.query("begin isolation level repeatable read read only; set local time zone 'UTC'");
  const { rows:[snapshot] } = await client.query('select pg_export_snapshot() snapshot,transaction_timestamp() started_at');
  if (!/^[0-9A-F]+-[0-9A-F]+-\d+$/i.test(snapshot.snapshot)) throw new Error('Unexpected database snapshot identifier');
  const globalDefaultAcls = (await client.query(`select pg_get_userbyid(d.defaclrole) owner,d.defaclobjtype "objectType",${entries('d.defaclacl')} entries from pg_default_acl d where d.defaclnamespace=0 order by 1,2`)).rows;
  const schemaAcls = (await client.query(`select n.nspname schema,pg_get_userbyid(n.nspowner) owner,${entries("coalesce(n.nspacl,acldefault('n',n.nspowner))")} entries from pg_namespace n where n.nspname=any($1) order by 1`,[schemas])).rows;
  // The dump and supplemental privileges share one read-only database snapshot.
  await new Promise((resolve,reject) => {
    const child=spawn(path.join(process.env.PG_BIN||'/opt/homebrew/opt/postgresql@17/bin','pg_dump'),['--format=custom',...schemas.map(schema=>`--schema=${schema}`),`--snapshot=${snapshot.snapshot}`,'--file',plain],{env,stdio:['ignore','ignore','pipe']});
    child.stderr.resume();
    child.on('error',()=>reject(new Error('Could not start pg_dump')));
    child.on('exit',code=>code===0?resolve():reject(new Error('pg_dump failed; no valid backup produced')));
  });
  await client.query('commit');
  await chmod(plain,0o600);
  if ((await stat(plain)).size > BACKUP_LIMIT) throw new Error('Backup exceeds the 8 MiB storage budget');
  const { bytes,metadata }=encodeBackup(await readFile(plain),{snapshotStartedAt:new Date(snapshot.started_at).toISOString(),schemas,globalDefaultAcls,schemaAcls},key);
  await writeFile(destination,bytes,{mode:0o600});
  const manifest={version:2,createdAt:new Date().toISOString(),snapshotStartedAt:metadata.snapshotStartedAt,schemas,sha256:metadata.dumpSha256,encryptedBytes:bytes.length,globalDefaultAclCount:globalDefaultAcls.length,schemaAclCount:schemaAcls.length,limitations:'Database records and selected-schema/global default permissions only. No role passwords, Storage objects, provider configuration, Stripe or Gemini records. Restore the authenticated permission SQL after the custom dump.'};
  await writeFile(`${destination}.json`,JSON.stringify(manifest,null,2),{mode:0o600});
  console.log(JSON.stringify({backup:destination,bytes:bytes.length,encrypted:true,formatVersion:2,globalDefaultAclCount:globalDefaultAcls.length,schemaAclCount:schemaAcls.length}));
} catch {
  throw new Error('Encrypted backup failed; no successful backup is claimed. Check database reachability, snapshot privileges, PostgreSQL client and size budget.');
} finally {
  await client.query('rollback').catch(()=>{});
  await client.end().catch(()=>{});
  await rm(plain,{force:true});
}
