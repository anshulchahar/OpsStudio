-- A delayed save must not replace a newer reflection or checkpoint.
create function public.save_progress(p_payload jsonb) returns void
language sql security invoker set search_path='' as $$
 insert into public.learner_progress(user_id,payload,updated_at)
 values((select auth.uid()),p_payload,now())
 on conflict(user_id) do update set payload=excluded.payload,updated_at=now()
 where coalesce(excluded.payload->>'updatedAt','') >= coalesce(learner_progress.payload->>'updatedAt','');
$$;
revoke all on function public.save_progress(jsonb) from public, anon;
grant execute on function public.save_progress(jsonb) to authenticated;
alter table public.learner_progress add constraint bounded_progress check (octet_length(payload::text)<=131072);
