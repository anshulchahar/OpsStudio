-- OpsStudio foundation. All learner-owned records are isolated by user identity.
create table public.learner_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.learner_progress enable row level security;
grant select, insert, update, delete on public.learner_progress to authenticated;
create policy "Own progress" on public.learner_progress for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.ai_generations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  mission_id text not null,
  model text not null,
  prompt text not null,
  answer jsonb,
  status text not null check (status in ('pending', 'complete', 'error')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_usd numeric(12,8) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_generations_owner_cache on public.ai_generations(user_id, cache_key, created_at desc);
alter table public.ai_generations enable row level security;
grant select, delete on public.ai_generations to authenticated;
create policy "Own answers" on public.ai_generations for select to authenticated using ((select auth.uid()) = user_id);
create policy "Delete own answers" on public.ai_generations for delete to authenticated using ((select auth.uid()) = user_id);

create table public.lab_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe text not null,
  status text not null check (status in ('pending', 'complete', 'error')),
  result jsonb,
  created_at timestamptz not null default now()
);
alter table public.lab_runs enable row level security;
grant select, delete on public.lab_runs to authenticated;
create policy "Own lab runs" on public.lab_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Delete own lab runs" on public.lab_runs for delete to authenticated using ((select auth.uid()) = user_id);

create table public.usage_buckets (
  scope text not null,
  kind text not null check (kind in ('mentor', 'lab')),
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (scope, kind, day)
);
alter table public.usage_buckets enable row level security;
revoke all on public.usage_buckets from anon, authenticated;

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text unique not null,
  subscription_id text unique,
  status text not null default 'none',
  live_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
grant select on public.subscriptions to authenticated;
create policy "Own subscription" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);

create table public.stripe_events (id text primary key, processed_at timestamptz not null default now());
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

grant all on public.learner_progress, public.ai_generations, public.lab_runs,
  public.usage_buckets, public.subscriptions, public.stripe_events to service_role;

-- Global lock first, then per-user lock: concurrent requests cannot exceed either ceiling.
create function public.reserve_usage(p_user uuid, p_kind text, p_user_limit integer, p_global_limit integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  global_used integer;
  user_used integer;
begin
  if p_user is null or p_kind not in ('mentor','lab') or p_user_limit < 1 or p_global_limit < 1 then
    return jsonb_build_object('allowed', false, 'remaining', 0);
  end if;
  insert into public.usage_buckets(scope, kind, day) values ('global',p_kind,today) on conflict do nothing;
  select used into global_used from public.usage_buckets where scope='global' and kind=p_kind and day=today for update;
  insert into public.usage_buckets(scope, kind, day) values (p_user::text,p_kind,today) on conflict do nothing;
  select used into user_used from public.usage_buckets where scope=p_user::text and kind=p_kind and day=today for update;
  if global_used >= p_global_limit or user_used >= p_user_limit then
    return jsonb_build_object('allowed', false, 'remaining', greatest(0, least(p_user_limit-user_used,p_global_limit-global_used)));
  end if;
  update public.usage_buckets set used=used+1 where kind=p_kind and day=today and scope in ('global',p_user::text);
  return jsonb_build_object('allowed', true, 'remaining', greatest(0, least(p_user_limit-user_used-1,p_global_limit-global_used-1)));
end;
$$;
revoke all on function public.reserve_usage(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.reserve_usage(uuid,text,integer,integer) to service_role;
