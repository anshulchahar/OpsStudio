-- Durable billing operations and metered generation claims. All writes are service-only.
create table public.billing_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  live_mode boolean not null,
  customer_id text,
  customer_started_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, live_mode),
  unique (customer_id, live_mode)
);
create table public.billing_customers (
  customer_id text not null,
  live_mode boolean not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, live_mode)
);
create index billing_customers_owner on public.billing_customers(user_id, live_mode);
create table public.billing_checkout_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  live_mode boolean not null,
  customer_id text not null,
  session_id text unique,
  params jsonb not null,
  status text not null default 'pending' check (status in ('pending','open','complete','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index billing_one_open_checkout on public.billing_checkout_attempts(user_id, live_mode)
  where status in ('pending','open');
create index billing_checkout_owner on public.billing_checkout_attempts(user_id, live_mode, created_at desc);
insert into public.billing_accounts(user_id,live_mode,customer_id)
select user_id,live_mode,customer_id from public.subscriptions;
insert into public.billing_customers(user_id,live_mode,customer_id)
select user_id,live_mode,customer_id from public.subscriptions;
alter table public.billing_accounts enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_checkout_attempts enable row level security;
revoke all on public.billing_accounts, public.billing_customers, public.billing_checkout_attempts from public, anon, authenticated;
grant all on public.billing_accounts, public.billing_customers, public.billing_checkout_attempts to service_role;

create function public.claim_billing_operation(p_user uuid, p_live boolean, p_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare account public.billing_accounts;
begin
  insert into public.billing_accounts(user_id,live_mode) values(p_user,p_live) on conflict do nothing;
  select * into account from public.billing_accounts where user_id=p_user and live_mode=p_live for update;
  if account.lease_token is not null and account.lease_expires_at > now() then
    return jsonb_build_object('claimed',false);
  end if;
  update public.billing_accounts set lease_token=p_token, lease_expires_at=now()+interval '2 minutes'
    where user_id=p_user and live_mode=p_live returning * into account;
  return jsonb_build_object('claimed',true,'account',to_jsonb(account));
end; $$;

-- A lease fences every post-provider write. A timed-out function cannot overwrite
-- the newer reconciler which acquired its expired lease.
create function public.write_billing_operation(p_user uuid, p_live boolean, p_token uuid, p_operation text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare account public.billing_accounts; attempt public.billing_checkout_attempts; customer text;
begin
  select * into account from public.billing_accounts where user_id=p_user and live_mode=p_live for update;
  if not found or account.lease_token is distinct from p_token or account.lease_expires_at <= now() then
    raise exception 'billing_lease_expired' using errcode='55000';
  end if;
  if p_operation='release' then
    update public.billing_accounts set lease_token=null,lease_expires_at=null where user_id=p_user and live_mode=p_live;
  elsif p_operation='customer_started' then
    update public.billing_accounts set customer_started_at=coalesce(customer_started_at,now())
      where user_id=p_user and live_mode=p_live returning * into account;
    return to_jsonb(account);
  elsif p_operation in ('customer_saved','register_customer') then
    customer := p_payload->>'customer_id';
    if customer is null or customer !~ '^cus_[a-zA-Z0-9]+$' then raise exception 'invalid_customer'; end if;
    insert into public.billing_customers(customer_id,live_mode,user_id) values(customer,p_live,p_user) on conflict do nothing;
    if not exists(select 1 from public.billing_customers where customer_id=customer and live_mode=p_live and user_id=p_user) then
      raise exception 'customer_owner_conflict';
    end if;
    update public.billing_accounts set customer_id=coalesce(customer_id,customer)
      where user_id=p_user and live_mode=p_live returning * into account;
    return to_jsonb(account);
  elsif p_operation='checkout_reserved' then
    if account.customer_id is distinct from p_payload->>'customer_id' then raise exception 'customer_owner_conflict'; end if;
    insert into public.billing_checkout_attempts(id,user_id,live_mode,customer_id,params,expires_at)
      values((p_payload->>'id')::uuid,p_user,p_live,p_payload->>'customer_id',p_payload->'params',(p_payload->>'expires_at')::timestamptz)
      returning * into attempt;
    return to_jsonb(attempt);
  elsif p_operation='checkout_saved' then
    update public.billing_checkout_attempts set session_id=p_payload->>'session_id',status=p_payload->>'status',expires_at=(p_payload->>'expires_at')::timestamptz
      where id=(p_payload->>'id')::uuid and user_id=p_user and live_mode=p_live returning * into attempt;
    if not found then raise exception 'checkout_attempt_missing'; end if;
    return to_jsonb(attempt);
  elsif p_operation='reconciled' then
    if p_payload->>'customer_id' is not null then
      if not exists(select 1 from public.billing_customers where customer_id=p_payload->>'customer_id' and live_mode=p_live and user_id=p_user) then
        raise exception 'customer_owner_conflict';
      end if;
      insert into public.subscriptions(user_id,customer_id,subscription_id,status,live_mode,updated_at)
        values(p_user,p_payload->>'customer_id',p_payload->>'subscription_id',coalesce(p_payload->>'status','none'),p_live,now())
      on conflict(user_id) do update set customer_id=excluded.customer_id,subscription_id=excluded.subscription_id,status=excluded.status,live_mode=excluded.live_mode,updated_at=excluded.updated_at;
    end if;
    if p_payload->>'event_id' is not null then
      insert into public.stripe_events(id) values(p_payload->>'event_id') on conflict do nothing;
    end if;
  else raise exception 'invalid_billing_operation';
  end if;
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.claim_billing_operation(uuid,boolean,uuid),public.write_billing_operation(uuid,boolean,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_billing_operation(uuid,boolean,uuid),public.write_billing_operation(uuid,boolean,uuid,text,jsonb) to service_role;

alter table public.ai_generations
  add column lease_expires_at timestamptz,
  add column finished_at timestamptz,
  add column usage_known boolean not null default false,
  add column error_category text,
  add column finish_reason text,
  alter column estimated_usd drop not null,
  alter column estimated_usd drop default;
-- Old failure rows did not record usage: NULL explicitly means unknown cost.
update public.ai_generations set usage_known=(status='complete'),
  estimated_usd=case when status='complete' and model in ('gemini-3.1-flash-lite','gemini-2.5-flash-lite') then estimated_usd else null end,
  lease_expires_at=case when status='pending' then created_at+interval '2 minutes' else null end,
  finished_at=case when status<>'pending' then created_at else null end;
alter table public.lab_runs add column lease_expires_at timestamptz, add column finished_at timestamptz, add column error_category text;
update public.lab_runs set lease_expires_at=case when status='pending' then created_at+interval '2 minutes' else null end,
  finished_at=case when status<>'pending' then created_at else null end;
create index ai_pending_lease on public.ai_generations(lease_expires_at) where status='pending';
create index labs_pending_lease on public.lab_runs(lease_expires_at) where status='pending';

create function public.claim_mentor_generation(p_user uuid,p_cache text,p_id uuid,p_mission text,p_model text,p_prompt text,p_user_limit integer,p_global_limit integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.ai_generations; quota jsonb;
begin
  if p_user is null or p_cache !~ '^[a-f0-9]{64}$' or length(p_prompt)>1200 or length(p_mission)>130 or length(p_model)>120 then
    raise exception 'invalid_generation_claim';
  end if;
  -- Cross-instance lock covers cache, pending claim and quota in one transaction.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text||':'||p_cache,0));
  select * into existing from public.ai_generations where user_id=p_user and cache_key=p_cache and status='complete' and created_at>now()-interval '24 hours' order by created_at desc limit 1;
  if found then return jsonb_build_object('status','cached','id',existing.id,'answer',existing.answer); end if;
  select * into existing from public.ai_generations where user_id=p_user and cache_key=p_cache and status='pending' and coalesce(lease_expires_at,created_at+interval '2 minutes')>now() order by created_at desc limit 1;
  if found then return jsonb_build_object('status','pending','id',existing.id); end if;
  update public.ai_generations set status='error',finished_at=now(),error_category='lease_expired'
    where user_id=p_user and cache_key=p_cache and status='pending' and coalesce(lease_expires_at,created_at+interval '2 minutes')<=now();
  quota := public.reserve_usage(p_user,'mentor',p_user_limit,p_global_limit);
  if not coalesce((quota->>'allowed')::boolean,false) then return jsonb_build_object('status','quota'); end if;
  insert into public.ai_generations(id,user_id,cache_key,mission_id,model,prompt,status,lease_expires_at,estimated_usd)
    values(p_id,p_user,p_cache,p_mission,p_model,p_prompt,'pending',now()+interval '2 minutes',null);
  return jsonb_build_object('status','claimed','id',p_id,'remaining',quota->'remaining');
end; $$;

create function public.claim_lab_run(p_user uuid,p_id uuid,p_recipe text,p_user_limit integer,p_global_limit integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare quota jsonb;
begin
  if p_recipe not in ('health','authorization') then raise exception 'invalid_lab_recipe'; end if;
  quota := public.reserve_usage(p_user,'lab',p_user_limit,p_global_limit);
  if not coalesce((quota->>'allowed')::boolean,false) then return jsonb_build_object('status','quota'); end if;
  insert into public.lab_runs(id,user_id,recipe,status,lease_expires_at) values(p_id,p_user,p_recipe,'pending',now()+interval '2 minutes');
  return jsonb_build_object('status','claimed','id',p_id,'remaining',quota->'remaining');
end; $$;
revoke all on function public.claim_mentor_generation(uuid,text,uuid,text,text,text,integer,integer),public.claim_lab_run(uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_mentor_generation(uuid,text,uuid,text,text,text,integer,integer),public.claim_lab_run(uuid,uuid,text,integer,integer) to service_role;
