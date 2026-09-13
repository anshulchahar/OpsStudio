-- Only for the isolated PostgreSQL CI service. The production restore drill also
-- verifies these migrations against the actual Supabase Auth schema.
-- Roles are cluster-wide. Reusing a local CI cluster must not require changing
-- its existing roles or any other database; reject incompatible roles instead.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if exists (
    select 1 from pg_roles
    where rolname in ('anon', 'authenticated', 'service_role')
      and (rolcanlogin or rolsuper or rolbypassrls <> (rolname = 'service_role'))
  ) then
    raise exception 'Existing test roles have incompatible privileges';
  end if;
end;
$$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;

grant usage on schema auth to authenticated,service_role;
grant usage on schema public to authenticated,anon,service_role;
