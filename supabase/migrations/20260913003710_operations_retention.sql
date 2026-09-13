-- Minimal operational state: no prompts, personal data, paths or stack traces.
create table public.operational_checks (
  id text primary key check (length(id) <= 80),
  status text not null check (status in ('ok','error')),
  code text not null check (length(code) <= 80),
  checked_at timestamptz not null default now()
);
alter table public.operational_checks enable row level security;
revoke all on public.operational_checks from public, anon, authenticated;
grant select, insert, update, delete on public.operational_checks to service_role;

create table public.browser_error_counts (
  day date not null,
  kind text not null check (kind in ('runtime','promise')),
  occurrences integer not null default 1 check (occurrences between 1 and 1000),
  last_seen_at timestamptz not null default now(),
  primary key(day,kind)
);
alter table public.browser_error_counts enable row level security;
revoke all on public.browser_error_counts from public, anon, authenticated;
grant select, insert, update, delete on public.browser_error_counts to service_role;

create function public.record_browser_error(p_kind text)
returns void language sql security invoker set search_path = '' as $$
  insert into public.browser_error_counts(day,kind)
  values ((now() at time zone 'utc')::date,p_kind)
  on conflict(day,kind) do update set occurrences=least(1000,public.browser_error_counts.occurrences+1), last_seen_at=now();
$$;
revoke all on function public.record_browser_error(text) from public, anon, authenticated;
grant execute on function public.record_browser_error(text) to service_role;

-- Never remove learner progress or subscription state. Expired provider leases are
-- conservatively charged against the original request quota; no automatic replay.
create function public.maintain_operations(p_ai_days integer default 90, p_lab_days integer default 90, p_usage_days integer default 90, p_event_days integer default 90, p_operation_days integer default 30)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare ai_count integer; lab_count integer; usage_count integer; events_count integer;
begin
  if least(p_ai_days,p_lab_days,p_usage_days,p_event_days,p_operation_days) < 1
    or greatest(p_ai_days,p_lab_days,p_usage_days,p_event_days,p_operation_days) > 3650 then
    raise exception 'invalid_retention';
  end if;
  update public.ai_generations set status='error', finished_at=now(), error_category='lease_expired'
    where status='pending' and coalesce(lease_expires_at,created_at + interval '10 minutes') < now();
  update public.lab_runs set status='error', finished_at=now(), error_category='lease_expired'
    where status='pending' and coalesce(lease_expires_at,created_at + interval '10 minutes') < now();
  delete from public.ai_generations where created_at < now() - make_interval(days => p_ai_days);
  get diagnostics ai_count = row_count;
  delete from public.lab_runs where created_at < now() - make_interval(days => p_lab_days);
  get diagnostics lab_count = row_count;
  delete from public.usage_buckets where day < (now() at time zone 'utc')::date - p_usage_days;
  get diagnostics usage_count = row_count;
  delete from public.stripe_events where processed_at < now() - make_interval(days => p_event_days);
  get diagnostics events_count = row_count;
  delete from public.account_erasures where erased_at < now() - interval '30 days';
  delete from public.browser_error_counts where day < (now() at time zone 'utc')::date - p_operation_days;
  return jsonb_build_object('ai',ai_count,'labs',lab_count,'usage',usage_count,'events',events_count);
end;
$$;
revoke all on function public.maintain_operations(integer,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.maintain_operations(integer,integer,integer,integer,integer) to service_role;
