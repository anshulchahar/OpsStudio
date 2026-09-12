create table public.release_catalog (
 id text primary key, version text not null, source_url text not null,
 checked_at timestamptz not null default now(), recommendation text not null,
 candidate_title text not null
);
alter table public.release_catalog enable row level security;
revoke all on public.release_catalog from anon, authenticated;
grant all on public.release_catalog to service_role;
