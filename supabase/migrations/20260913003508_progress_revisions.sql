-- Clients compare a server-owned revision; wall clocks never choose a winner.
alter table public.learner_progress add column if not exists revision bigint not null default 0 check (revision >= 0);
alter table public.learner_progress drop constraint if exists learner_progress_payload_bounded;
alter table public.learner_progress drop constraint if exists bounded_progress;
alter table public.learner_progress add constraint learner_progress_payload_bounded check (octet_length(payload::text) <= 3145728);
drop function if exists public.save_progress(jsonb);
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.save_progress_cas(p_payload jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_payload jsonb;
  v_revision bigint;
  v_next jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision > 9007199254740990 then
    raise exception 'Invalid progress revision' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 3145728 then
    raise exception 'Invalid progress payload' using errcode = '22023';
  end if;
  v_next := jsonb_set(p_payload, '{updatedAt}', to_jsonb(to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  select payload, revision into v_payload, v_revision from public.learner_progress where user_id = v_user for update;
  if not found then
    if p_expected_revision <> 0 then return jsonb_build_object('saved', false, 'revision', 0, 'payload', null); end if;
    insert into public.learner_progress(user_id, payload, updated_at, revision) values (v_user, v_next, now(), 1)
      on conflict (user_id) do nothing returning payload, revision into v_payload, v_revision;
    if found then return jsonb_build_object('saved', true, 'revision', v_revision, 'payload', v_payload); end if;
    select payload, revision into v_payload, v_revision from public.learner_progress where user_id = v_user for update;
  end if;
  if v_revision <> p_expected_revision then return jsonb_build_object('saved', false, 'revision', v_revision, 'payload', v_payload); end if;
  update public.learner_progress set payload = v_next, revision = revision + 1, updated_at = now()
    where user_id = v_user returning payload, revision into v_payload, v_revision;
  return jsonb_build_object('saved', true, 'revision', v_revision, 'payload', v_payload);
end;
$$;
revoke all on function private.save_progress_cas(jsonb, bigint) from public, anon;
grant execute on function private.save_progress_cas(jsonb, bigint) to authenticated;

create or replace function public.save_progress(p_payload jsonb, p_expected_revision bigint)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_progress_cas(p_payload, p_expected_revision);
$$;
revoke all on function public.save_progress(jsonb, bigint) from public, anon;
grant execute on function public.save_progress(jsonb, bigint) to authenticated;
-- All browser writes must go through compare-and-swap, including direct SDK calls.
revoke insert, update, delete, truncate, references, trigger on public.learner_progress from authenticated, anon;
grant select on public.learner_progress to authenticated;
