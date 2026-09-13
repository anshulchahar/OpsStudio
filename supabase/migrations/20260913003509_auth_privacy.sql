-- Revoke inherited broad grants before restoring the application's intended API.
-- Migrations run as postgres; future tables/functions must opt in explicitly.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
-- PUBLIC EXECUTE is a global PostgreSQL default. A schema-only REVOKE cannot
-- remove it; revoke globally as well, then opt individual application RPCs in.
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Writes must pass through the revision-checked RPC from the preceding migration.
grant select on public.learner_progress to authenticated;
grant select, delete on public.ai_generations, public.lab_runs to authenticated;
grant select on public.subscriptions to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- A generated ownership key keeps the existing global/user scope API while
-- preventing an in-flight request from recreating personal usage after erasure.
-- Only unowned historical user scopes are removed before adding the constraint.
delete from public.usage_buckets u
where u.scope <> 'global' and not exists (
  select 1 from auth.users a where a.id::text = u.scope
);
alter table public.usage_buckets add column user_id uuid
  generated always as (case when scope = 'global' then null else scope::uuid end) stored
  references auth.users(id) on delete cascade;
create index usage_buckets_owner on public.usage_buckets(user_id) where user_id is not null;

-- A short-lived, pseudonymous erasure ledger prevents a backup restore from
-- silently reopening deleted accounts. No email, notes or Auth token is stored.
-- A restore must reconcile this current ledger before allowing public access.
create table public.account_erasures (
  user_hash text primary key check (user_hash ~ '^[a-f0-9]{64}$'),
  erased_at timestamptz not null default now()
);
alter table public.account_erasures enable row level security;
revoke all on public.account_erasures from public, anon, authenticated;
grant select, insert, delete on public.account_erasures to service_role;

-- The usage key is deliberately separate from auth foreign keys. Remove only
-- the deleted user's scope, retaining aggregate global counters until expiry.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
-- The preceding CAS migration grants EXECUTE on its one private helper. The
-- invoker wrapper needs schema USAGE; other private functions remain revoked.
grant usage on schema private to authenticated;
create or replace function private.cleanup_account_usage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.usage_buckets where scope = old.id::text;
  insert into public.account_erasures(user_hash, erased_at)
  values (pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(old.id::text, 'UTF8')), 'hex'), now())
  on conflict (user_hash) do update set erased_at = excluded.erased_at;
  return old;
end;
$$;
revoke all on function private.cleanup_account_usage() from public, anon, authenticated;
drop trigger if exists opsstudio_cleanup_account_usage on auth.users;
create trigger opsstudio_cleanup_account_usage
  before delete on auth.users
  for each row execute function private.cleanup_account_usage();

-- Account-owned progress, generations, labs and subscription references already
-- cascade from auth.users. Auth session revocation happens before the Admin API
-- deletes the user. The trigger also covers an operator-initiated deletion.
-- Signup closure is an Auth-service setting, not a UI flag. The operator must
-- align disable_signup with PUBLIC_SIGNUP_ENABLED in the actual linked project.
