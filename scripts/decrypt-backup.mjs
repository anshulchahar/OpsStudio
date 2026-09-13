import { readFile, writeFile, rm } from 'node:fs/promises';
import { decodeBackup, permissionRestoreSql } from './backup-format.mjs';
process.umask(0o077);
const [source,destination]=process.argv.slice(2);
const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY||'','base64');
if (!source || !destination || key.length!==32) throw new Error('Provide source and new destination paths and BACKUP_ENCRYPTION_KEY.');
const decoded=decodeBackup(await readFile(source),key,JSON.parse(await readFile(`${source}.json`,'utf8')));
const created=[];
try {
  await writeFile(destination,decoded.dump,{mode:0o600,flag:'wx'}); created.push(destination);
  if(decoded.metadata) {
    await writeFile(`${destination}.permissions.sql`,permissionRestoreSql(decoded.metadata),{mode:0o600,flag:'wx'}); created.push(`${destination}.permissions.sql`);
    await writeFile(`${destination}.metadata.json`,JSON.stringify(decoded.metadata,null,2),{mode:0o600,flag:'wx'}); created.push(`${destination}.metadata.json`);
    console.log('Backup v2 decrypted and authenticated. After pg_restore, apply the companion .permissions.sql with ON_ERROR_STOP. Delete all three plaintext files after isolated verification.');
  } else {
    console.warn('LEGACY V1: dump authenticated, but global default permissions were not captured. This is an incomplete permission backup. Keep the restore isolated until defaults are recovered from verified migrations/source metadata.');
  }
} catch(error) { await Promise.all(created.map(file=>rm(file,{force:true}))); throw error; }
