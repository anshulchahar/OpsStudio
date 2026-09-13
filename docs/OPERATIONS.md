# Operating OpsStudio

## Deployment and release gates

Vercel runs `npm run check && npm run build` for every build. GitHub Quality gate independently runs type/lint/unit/route checks and a PostgreSQL 17 job that creates the schema from migrations and tests concurrent progress, billing leases, AI quotas, RLS/default privileges and erasure. A green build is necessary, not a claim that operator/email/commercial requirements are satisfied.

Production Supabase and Stripe Marketplace resources are connected to **production only**. Preview/development have no credentials by default and support guest practice. Use a separate Supabase project for authenticated staging. Never reconnect production resources to all environments or copy production credentials into routine development.

The existing schema was compared with the three original migrations across columns, constraints, indexes, policies, RLS and functions. `scripts/migrate.mjs --baseline` records that verified history once. Later runs refuse edited migrations and unknown schema drift. It uses verified TLS for remote hosts. Take and test a backup first. Keep the production environment in a private operations file; pass it with Node `--env-file`, never credentials in command arguments.

```
PGSSLROOTCERT=scripts/certs/supabase-ca.crt node --env-file=work/production-operations.env scripts/migrate.mjs --baseline
```

Only the initial known untracked schema needs `--baseline`; subsequent releases omit it. Rehearse against an isolated restored database before applying to production. Do not revert to the old progress-saving deployment after the revision migration: its timestamp-based protocol is intentionally rejected. Prefer a forward fix; guest/local drafts remain recoverable in the browser.

## Monitoring and response

`/api/health` is public liveness. `/api/readiness` requires `MONITOR_SECRET` and checks database/Auth availability, fresh release data, maintenance, and the last successful offsite backup. It exposes booleans, never credentials or learner data. GitHub Production availability runs every 15 minutes (scheduled jobs may be delayed). A failed workflow is the operational alert; configure GitHub's Actions notification destination for the responsible operator and keep the repository active because GitHub can disable schedules in inactive public repositories.

Server errors use Next instrumentation and redacted operational codes. Authenticated browser error reports aggregate into two daily counters, capped at 1,000 each; no stack, URL, prompt, account ID or note is persisted. Vercel runtime logs contain structured failure codes. Performance sampling uses Vercel Speed Insights at 10%, stripping query strings and excluding account/auth/saved-answer pages. Review real traffic metrics before making latency guarantees.

Daily Vercel jobs refresh release references at 06:00 UTC and run maintenance at 07:00 UTC. Source attempts retain status separately from the last verified release. The UI flags failures and releases older than 48 hours. Interrupted AI/lab jobs become errors after their two-minute leases expire; no provider request is automatically replayed. This conservatively preserves quota usage. Completed AI/lab records, usage and processed webhook IDs default to 90 days. Browser aggregates and the erasure ledger use 30 days. Learner progress and billing identities survive scheduled cleanup. Retention environment values must match the privacy notice.

For an outage: check the failed Actions run, Vercel logs, protected readiness, and `operational_checks`. Disable `AI_ENABLED` or `LABS_ENABLED` to contain provider cost. Keep `BILLING_LIVE_ENABLED=false` when investigating checkout creation; cancellation and existing-account management remain available. An unresolved external billing operation older than 23 hours requires reconciliation with Stripe before another checkout can be created.

## Backups and restore

Daily encrypted GitHub Actions backups retain 14 days. Backup format v2 contains a custom-format PostgreSQL 17 dump of `public`, `auth`, `private`, and `supabase_migrations`, plus global default privileges and effective privileges for those four schemas. The permission metadata and dump share one exported, read-only database snapshot and are encrypted together with AES-256-GCM. A schema-filtered `pg_dump` alone omits global defaults and can lose the public schema's initial grants; the supplemental permissions are required for a complete restoration.

The encryption key and DB URL are GitHub Actions secrets. Dependencies are installed from the lockfile with lifecycle scripts disabled before the backup step receives secrets. Only the encrypted envelope and its integrity manifest are uploaded; keep an independent recovery copy of the encryption key in your password manager. The decrypted permission metadata is authenticated by the same encryption tag as the dump. The external manifest does not supply executable restore instructions.

The current encrypted-envelope budget is 8 MiB per snapshot, including permission metadata and encryption overhead; exceeding it fails visibly rather than growing storage without a budget decision. At most 14 scheduled snapshots fit within approximately 112 MiB. Manual runs also consume retention/storage and should be exceptional. GitHub availability and scheduling are separate failure domains; failed or stale backups must be investigated. Target recovery point: 24 hours, excluding delayed/failed jobs. Recovery-time objective: four hours, an operational target rather than a measured SLA.

Database dumps exclude Supabase provider configuration, custom role passwords, Storage objects, Stripe records, and Gemini records. Save infrastructure configuration separately. There are no application Storage objects today; adding uploads requires a corresponding object backup process.

Restore procedure:

1. Stop public writes and new billing operations; export the **current** `account_erasures` ledger before changing the database. Keep it private.
2. Download only the selected encrypted artifact and manifest. Decrypt with `scripts/decrypt-backup.mjs source destination`, passing `BACKUP_ENCRYPTION_KEY` via the private environment. Format v2 creates the custom dump, `destination.permissions.sql`, and `destination.metadata.json`. Integrity/authentication failures must abort. A v1 archive remains readable but emits an explicit warning: it did not capture global defaults, so it cannot establish complete permission recovery on its own.
3. Restore into a **new isolated database**, never over production as the first step. Use PostgreSQL 17 and provision matching Supabase roles/extensions without copying role passwords. Preserve recorded object ownership; do not suppress owners or grants to make errors disappear. If the dump creates the `public` schema, remove only the new empty database's initial public schema before restoring. Run `pg_restore --exit-on-error --single-transaction --dbname="$PGDATABASE" destination`, with host/user/password supplied privately through PostgreSQL environment variables.
4. **Required:** run `psql --set=ON_ERROR_STOP=1 --file=destination.permissions.sql` against that same isolated database. The companion script restores global defaults and schema grants in a transaction. Verify schema, functions, ownership, effective grants, RLS, constraints, indexes, triggers, sequences, counts, content hashes, and all recorded migrations. Check `private.save_progress_cas(jsonb,bigint)` and verify a newly created function owned by `postgres` does not grant anonymous or authenticated execution. Compare logical column order rather than dropped-column physical gaps, and effective owner privileges rather than equivalent explicit/NULL ACL representations. Explain any operational records changed after the authenticated snapshot using their timestamps and hashes; unexplained or user-record differences block acceptance. Apply later migrations using recorded history, then rerun the relevant checks.
5. Reapply deletions by matching `encode(sha256(convert_to(auth.users.id::text,'UTF8')),'hex')` to the latest erasure ledger. Revoke all restored Auth sessions/refresh tokens and require a fresh sign-in. If the current deletion ledger is unavailable, quarantine restored account data; do not reopen public accounts until erasure reconciliation is complete.
6. Reconcile subscriptions against Stripe's current customer/subscription state; old database records never override the payment provider.
7. Switch production only after checks and operator approval. Remove all three plaintext files and the temporary recovery database. Keep the encrypted backups for their bounded retention period. Unit tests cover format authentication, tampering, quoting, size limits, and explicit v1 limitations; the offsite download-and-restore drill is a separate required operational check.

## Before opening paid public accounts

Publish the real legal operator, address, country, support/privacy email and reviewed commercial terms. Configure custom SMTP and verify confirmation and recovery delivery. Align Supabase Auth's actual signup setting with the app gate; hiding the form is insufficient. Complete Stripe account activation and live-price/webhook verification before enabling real billing. Vercel Hobby is for non-commercial personal use; obtain commercial-compatible hosting before monetization. These are explicit launch gates, not completed by a successful software deployment.
