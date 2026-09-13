import assert from "node:assert/strict";
import test from "node:test";
import { createCipheriv, randomBytes } from "node:crypto";
import { BACKUP_LIMIT, decodeBackup, encodeBackup, permissionRestoreSql, sha256 } from "../scripts/backup-format.mjs";

const key = Buffer.alloc(32, 7);
const dump = Buffer.from("PGDMPsynthetic-custom-dump-fixture");
const schemas = ["public", "auth", "private", "supabase_migrations"];
const details = {
  snapshotStartedAt: "2026-09-13T07:10:33.454Z", schemas,
  globalDefaultAcls: [{ owner: "postgres", objectType: "f", entries: [{ grantee: "postgres", grantor: "postgres", privilege: "EXECUTE", grantable: false }] }],
  schemaAcls: schemas.map(schema => ({ schema, owner: "postgres", entries: [{ grantee: "postgres" as string | null, grantor: "postgres", privilege: "USAGE", grantable: false }, ...(schema === "public" ? [{ grantee: null, grantor: "postgres", privilege: "USAGE", grantable: false }] : [])] })),
};

test("backup v2 authenticates custom dump and omitted global/schema permissions together", () => {
  const { bytes, metadata } = encodeBackup(dump, details, key);
  assert.equal(bytes.subarray(0, 8).toString(), "OPSBAK02");
  const restored = decodeBackup(bytes, key, { sha256: sha256(dump) });
  assert.deepEqual(restored.dump, dump);
  assert.deepEqual(restored.metadata, metadata);
  assert.equal(restored.legacy, false);
  assert.equal(restored.metadata.globalDefaultAcls[0].entries[0].grantee, "postgres");
  assert.equal(restored.metadata.schemaAcls.find((schema: { schema: string }) => schema.schema === "public").entries[1].grantee, null);
});

test("tampered permission payload, wrong key, and modified format header are rejected", () => {
  const { bytes } = encodeBackup(dump, details, key);
  const changed = Buffer.from(bytes); changed[45] ^= 1;
  assert.throws(() => decodeBackup(changed, key, { sha256: sha256(dump) }));
  assert.throws(() => decodeBackup(bytes, Buffer.alloc(32, 8), { sha256: sha256(dump) }));
  const downgrade = Buffer.from(bytes); Buffer.from("OPSBAK01").copy(downgrade);
  assert.throws(() => decodeBackup(downgrade, key, { sha256: sha256(dump) }));
  assert.throws(() => decodeBackup(bytes, key, { sha256: "0".repeat(64) }), /hash mismatch/);
});

test("legacy v1 remains readable but cannot claim that permission metadata was captured", () => {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(dump), cipher.final()]);
  const bytes = Buffer.concat([Buffer.from("OPSBAK01"), iv, cipher.getAuthTag(), ciphertext]);
  const restored = decodeBackup(bytes, key, { version: 1, sha256: sha256(dump) });
  assert.deepEqual(restored.dump, dump);
  assert.equal(restored.legacy, true);
  assert.equal(restored.metadata, null);
  assert.throws(() => permissionRestoreSql(restored.metadata), /Invalid backup permission metadata/);
});

test("restoration explicitly removes default PUBLIC execution and restores public-schema usage", () => {
  const { metadata } = encodeBackup(dump, details, key);
  const sql = permissionRestoreSql(metadata);
  assert.ok(sql.includes('ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS FROM PUBLIC;'));
  assert.ok(sql.includes('ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" GRANT EXECUTE ON FUNCTIONS TO "postgres";'));
  assert.ok(sql.includes('GRANT USAGE ON SCHEMA "public" TO PUBLIC;'));
  assert.ok(sql.includes('d.defaclnamespace=0'));
  assert.ok(sql.startsWith('-- Required authenticated permission restoration'));
  assert.ok(sql.endsWith('COMMIT;\n'));
});

test("permission rendering quotes identities and rejects malformed privilege instructions", () => {
  const special = structuredClone(details);
  const owner = 'role"with;punctuation$opsstudio_acl$\\name';
  special.globalDefaultAcls[0].owner = owner;
  special.globalDefaultAcls[0].entries[0].grantor = owner;
  special.globalDefaultAcls[0].entries[0].grantee = owner;
  const { metadata } = encodeBackup(dump, special, key);
  const quotedSql = permissionRestoreSql(metadata);
  assert.ok(quotedSql.includes('FOR ROLE "role""with;punctuation$opsstudio_acl$\\name"'));
  assert.ok(quotedSql.includes('DO $opsstudio_acl_1$'));
  assert.ok(quotedSql.includes('SET LOCAL standard_conforming_strings = on;'));
  const bad = structuredClone(details);
  bad.globalDefaultAcls[0].entries[0].privilege = 'EXECUTE; DROP SCHEMA public CASCADE';
  assert.throws(() => encodeBackup(dump, bad, key), /Unsupported backup privilege/);
  const missing = { ...details, schemaAcls: details.schemaAcls.slice(1) };
  assert.throws(() => encodeBackup(dump, missing, key), /Invalid backup permission metadata/);
});

test("backup size budget includes authenticated metadata and encryption overhead", () => {
  const large = Buffer.alloc(BACKUP_LIMIT); Buffer.from("PGDMP").copy(large);
  assert.throws(() => encodeBackup(large, details, key), /8 MiB storage budget/);
});
