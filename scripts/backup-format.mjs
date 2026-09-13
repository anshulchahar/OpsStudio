import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const BACKUP_LIMIT = 8 * 1024 * 1024;
const kinds = { r: 'TABLES', S: 'SEQUENCES', f: 'FUNCTIONS', T: 'TYPES', n: 'SCHEMAS' };
const privileges = new Set(['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN','USAGE','EXECUTE','CREATE']);
const quote = value => '"' + value.replaceAll('"','""') + '"';
const literal = value => "E'" + value.replaceAll('\\','\\\\').replaceAll("'","''") + "'";
function doBlock(body) {
  let index=0, delimiter='$opsstudio_acl$';
  while(body.includes(delimiter)) delimiter=`$opsstudio_acl_${++index}$`;
  return `DO ${delimiter}${body}${delimiter};`;
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function checkName(value) {
  if (typeof value !== 'string' || !value.length || value.length > 128 || value.includes('\0')) throw new Error('Invalid permission identity in backup');
}
export function validateMetadata(value) {
  if (value?.version !== 2 || !Array.isArray(value.globalDefaultAcls) || !Array.isArray(value.schemaAcls) || value.globalDefaultAcls.length > 500 || value.schemaAcls.length !== 4) throw new Error('Invalid backup permission metadata');
  if (!/^[a-f0-9]{64}$/.test(value.dumpSha256 ?? '') || !Number.isFinite(Date.parse(value.snapshotStartedAt))) throw new Error('Invalid backup snapshot metadata');
  const schemas = new Set(['public','auth','private','supabase_migrations']);
  const seenSchemas = new Set();
  const seenDefaults = new Set();
  for (const [items,isSchema] of [[value.schemaAcls,true],[value.globalDefaultAcls,false]]) {
    for (const item of items) {
      checkName(item.owner);
      if (isSchema) {
        if (!schemas.has(item.schema) || seenSchemas.has(item.schema)) throw new Error('Invalid or duplicate backup schema');
        seenSchemas.add(item.schema);
      } else {
        if (!kinds[item.objectType] || seenDefaults.has(`${item.owner}\0${item.objectType}`)) throw new Error('Invalid or duplicate global default permission');
        seenDefaults.add(`${item.owner}\0${item.objectType}`);
      }
      if (!Array.isArray(item.entries) || item.entries.length > 2000) throw new Error('Invalid permission entries');
      for (const entry of item.entries) {
        if (entry.grantee !== null) checkName(entry.grantee);
        if (!privileges.has(entry.privilege) || typeof entry.grantable !== 'boolean' || entry.grantor !== item.owner) throw new Error('Unsupported backup privilege or grantor');
        if (isSchema && !['USAGE','CREATE'].includes(entry.privilege)) throw new Error('Invalid schema privilege');
      }
    }
  }
  return value;
}

export function encodeBackup(dump, details, key) {
  if (key.length !== 32 || dump.subarray(0,5).toString() !== 'PGDMP') throw new Error('A PostgreSQL custom dump and 32-byte key are required');
  const metadata = validateMetadata({ ...details, version:2, dumpSha256:sha256(dump) });
  const json = Buffer.from(JSON.stringify(metadata));
  if (json.length > 1024*1024) throw new Error('Backup permission metadata is too large');
  const length = Buffer.alloc(4); length.writeUInt32BE(json.length);
  const payload = Buffer.concat([length,json,dump]);
  if (payload.length + 36 > BACKUP_LIMIT) throw new Error('Backup exceeds the 8 MiB storage budget');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('OPSBAK02'));
  const encrypted = Buffer.concat([cipher.update(payload),cipher.final()]);
  return { bytes:Buffer.concat([Buffer.from('OPSBAK02'),iv,cipher.getAuthTag(),encrypted]), metadata };
}

export function decodeBackup(bytes,key,manifest) {
  if (key.length !== 32 || bytes.length < 37) throw new Error('Invalid encrypted backup');
  const magic = bytes.subarray(0,8).toString();
  if (!['OPSBAK01','OPSBAK02'].includes(magic)) throw new Error('Unknown backup format');
  // V1 budgeted only the raw dump; its fixed encryption header was additional.
  if (bytes.length > BACKUP_LIMIT + (magic==='OPSBAK01'?36:0)) throw new Error('Invalid encrypted backup');
  const decipher = createDecipheriv('aes-256-gcm',key,bytes.subarray(8,20));
  if (magic === 'OPSBAK02') decipher.setAAD(Buffer.from('OPSBAK02'));
  decipher.setAuthTag(bytes.subarray(20,36));
  const payload = Buffer.concat([decipher.update(bytes.subarray(36)),decipher.final()]);
  let dump=payload, metadata=null;
  if (magic === 'OPSBAK02') {
    const length=payload.readUInt32BE(0);
    if (length < 2 || length > 1024*1024 || length+4 >= payload.length) throw new Error('Invalid authenticated backup envelope');
    metadata=validateMetadata(JSON.parse(payload.subarray(4,length+4).toString('utf8')));
    dump=payload.subarray(length+4);
  }
  if (dump.subarray(0,5).toString() !== 'PGDMP' || sha256(dump) !== manifest?.sha256 || (metadata && sha256(dump) !== metadata.dumpSha256)) throw new Error('Backup dump hash mismatch');
  return { dump, metadata, legacy:metadata===null };
}

// This is a required post-restore step in the same isolated destination. Every
// identifier is quoted; no arbitrary SQL is accepted from the metadata.
export function permissionRestoreSql(metadata) {
  validateMetadata(metadata);
  const statements = ['-- Required authenticated permission restoration for OpsStudio backup v2.', '-- Run only in the new isolated database, after pg_restore, with ON_ERROR_STOP.', 'BEGIN;', 'SET LOCAL standard_conforming_strings = on;'];
  for (const item of metadata.globalDefaultAcls) {
    const kind=kinds[item.objectType];
    statements.push(doBlock(`DECLARE p record; BEGIN FOR p IN SELECT a.grantee FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a WHERE d.defaclnamespace=0 AND d.defaclrole=pg_catalog.to_regrole(${literal(item.owner)}) AND d.defaclobjtype=${literal(item.objectType)} LOOP EXECUTE pg_catalog.format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON ${kind} FROM %s',${literal(item.owner)},CASE WHEN p.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(p.grantee)) END); END LOOP; END`));
    for (const recipient of ['PUBLIC',quote(item.owner)]) statements.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(item.owner)} REVOKE ALL ON ${kind} FROM ${recipient};`);
    for (const entry of item.entries) statements.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(item.owner)} GRANT ${entry.privilege} ON ${kind} TO ${entry.grantee===null?'PUBLIC':quote(entry.grantee)}${entry.grantable?' WITH GRANT OPTION':''};`);
  }
  for (const item of metadata.schemaAcls) {
    statements.push(doBlock(`DECLARE p record; BEGIN FOR p IN SELECT a.grantee FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a WHERE n.nspname=${literal(item.schema)} LOOP EXECUTE pg_catalog.format('REVOKE ALL ON SCHEMA %I FROM %s',${literal(item.schema)},CASE WHEN p.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(p.grantee)) END); END LOOP; END`));
    for (const recipient of ['PUBLIC',quote(item.owner)]) statements.push(`REVOKE ALL ON SCHEMA ${quote(item.schema)} FROM ${recipient};`);
    for (const entry of item.entries) statements.push(`GRANT ${entry.privilege} ON SCHEMA ${quote(item.schema)} TO ${entry.grantee===null?'PUBLIC':quote(entry.grantee)}${entry.grantable?' WITH GRANT OPTION':''};`);
  }
  statements.push('COMMIT;','');
  return statements.join('\n');
}
