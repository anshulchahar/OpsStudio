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

Daily encrypted GitHub Actions backups retain 14 days. A custom-format PostgreSQL 17 dump includes `public`, `auth`, `private`, and `supabase_migrations`; AES-256-GCM encrypts it before upload. The encryption key and DB URL are GitHub Actions secrets. Only encrypted artifacts and their integrity manifest are uploaded; keep an independent recovery copy of the encryption key in your password manager. The initial snapshot was decrypted and restored into a separate local PostgreSQL 17 instance; all 30 original public/auth tables matched source row counts and content hashes.

The current backup upload budget is 8 MiB per snapshot; exceeding it fails visibly rather than growing storage without a budget decision. At most 14 scheduled snapshots fit within approximately 112 MiB. Manual runs also consume retention/storage and should be exceptional. GitHub availability and scheduling are separate failure domains; failed or stale backups must be investigated. Target recovery point: 24 hours, excluding delayed/failed jobs. Recovery-time objective: four hours, an operational target rather than a measured SLA.

Database dumps exclude Supabase provider configuration, custom role passwords, Storage objects, Stripe records, and Gemini records. Save infrastructure configuration separately. There are no application Storage objects today; adding uploads requires a corresponding object backup process.

Restore procedure:

1. Stop public writes and new billing operations; export the **current** `account_erasures` ledger before changing the database. Keep it private.
2. Download an encrypted backup and manifest. Decrypt with `scripts/decrypt-backup.mjs source destination`, passing `BACKUP_ENCRYPTION_KEY` via the private environment. Integrity/authentication failures must abort.
3. Restore into a separate isolated database/project, never over production as the first step. Use matching PostgreSQL major version, provision Supabase roles/extensions, and restore without legacy ownership where needed. Check every restore error.
4. Verify schema, counts, content hashes and key progress/authorization/lease tests. Reapply migrations using recorded history.
5. Reapply deletions by matching `encode(sha256(convert_to(auth.users.id::text,'UTF8')),'hex')` to the latest erasure ledger. Revoke all restored Auth sessions/refresh tokens and require a fresh sign-in. If the current deletion ledger is unavailable, quarantine restored account data; do not reopen public accounts until erasure reconciliation is complete.
6. Reconcile subscriptions against Stripe's current customer/subscription state; old database records never override the payment provider.
7. Switch production only after checks and operator approval. Remove plaintext dumps and the temporary recovery database. Keep the encrypted backups for their bounded retention period.

## Before opening paid public accounts

Publish the real legal operator, address, country, support/privacy email and reviewed commercial terms. Configure custom SMTP and verify confirmation and recovery delivery. Align Supabase Auth's actual signup setting with the app gate; hiding the form is insufficient. Complete Stripe account activation and live-price/webhook verification before enabling real billing. Vercel Hobby is for non-commercial personal use; obtain commercial-compatible hosting before monetization. These are explicit launch gates, not completed by a successful software deployment.
