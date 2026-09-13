import { spawn } from 'node:child_process';
import { createCipheriv, randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, chmod, rm, stat } from 'node:fs/promises';
import path from 'node:path';

process.umask(0o077);

// Run with a production env file, never paste database credentials into argv.
const connection = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || '', 'base64');
if (!connection || key.length !== 32 || !process.env.PGSSLROOTCERT)
  throw new Error('POSTGRES_URL_NON_POOLING, PGSSLROOTCERT and a 32-byte base64 BACKUP_ENCRYPTION_KEY are required.');
let url;
try { url = new URL(connection); } catch { throw new Error('Invalid database connection URL'); }
const directory = path.resolve(process.env.BACKUP_DIRECTORY || 'work/backups');
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const stamp = new Date().toISOString().replaceAll(':', '-');
const plain = path.join(directory, `${stamp}.dump`);
const destination = `${plain}.aesgcm`;
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT: '10', PGSSLMODE: 'verify-full' };
const binary = path.join(process.env.PG_BIN || '/opt/homebrew/opt/postgresql@17/bin', 'pg_dump');
try {
  await new Promise((resolve, reject) => {
    const child = spawn(binary, ['--format=custom', '--no-owner', '--schema=public', '--schema=auth', '--schema=private', '--schema=supabase_migrations', '--file', plain], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.resume(); // Connection failures must not echo credentials.
    child.on('error', () => reject(new Error('Could not start pg_dump')));
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('pg_dump failed; no valid backup produced')));
  });
  await chmod(plain, 0o600);
  if ((await stat(plain)).size > 8 * 1024 * 1024) throw new Error('Backup exceeds the 8 MiB storage budget; increase the approved budget before uploading.');
  const bytes = await readFile(plain);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  await writeFile(destination, Buffer.concat([Buffer.from('OPSBAK01'), iv, cipher.getAuthTag(), ciphertext]), { mode: 0o600 });
  const manifest = { version: 1, createdAt: new Date().toISOString(), schemas: ['public', 'auth', 'private', 'supabase_migrations'], sha256: createHash('sha256').update(bytes).digest('hex'), encryptedBytes: ciphertext.length, limitations: 'Database records only. No Storage objects, provider configuration, Stripe or Gemini data. Store encryption key separately and copy encrypted backup off this device.' };
  await writeFile(`${destination}.json`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ backup: destination, bytes: ciphertext.length, encrypted: true }));
} finally { await rm(plain, { force: true }); }
