import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
const target = process.env.TEST_DATABASE_URL;
if (!target) throw new Error('TEST_DATABASE_URL required');
const url = new URL(target);
if (!['127.0.0.1','localhost'].includes(url.hostname) || !url.pathname.includes('test')) throw new Error('These fixtures are restricted to an isolated local test database');
const connect = async (role, user) => {
  const c = new pg.Client({ connectionString: target }); await c.connect();
  if (role) await c.query(`set role ${role}`);
  if (user) await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({ sub:user,role:'authenticated' })]);
  return c;
};
const root = await connect(), userA = randomUUID(), userB = randomUUID();
const clients = [];
try {
  await root.query('insert into auth.users(id) values($1),($2)',[userA,userB]);
  const a = await connect('authenticated',userA), a2=await connect('authenticated',userA), b=await connect('authenticated',userB), service=await connect('service_role'), service2=await connect('service_role');
  clients.push(a,a2,b,service,service2);
  const payload = { version:1, notes:'Concurrent test', updatedAt:'9999-01-01T00:00:00.000Z' };
  const saves=await Promise.all([a,a2].map(c=>c.query('select public.save_progress($1,0) result',[payload])));
  const results=saves.map(r=>r.rows[0].result);
  assert.equal(results.filter(r=>r.saved).length,1); assert.ok(results.every(r=>r.revision===1));
  assert.ok(results.find(r=>r.saved).payload.updatedAt.startsWith(String(new Date().getUTCFullYear())));
  assert.equal((await b.query('select * from public.learner_progress')).rowCount,0);
  await assert.rejects(a.query("update public.learner_progress set revision=999 where user_id=$1",[userA]),e=>e.code==='42501');
  assert.equal((await root.query("select has_function_privilege('anon','public.save_progress(jsonb,bigint)','execute') allowed")).rows[0].allowed,false);
  console.log('PASS: concurrent progress CAS, server time, owner isolation and direct-write denial');

  const lease1=randomUUID(), lease2=randomUUID();
  const leases=(await Promise.all([[service,lease1],[service2,lease2]].map(([c,lease])=>c.query('select public.claim_billing_operation($1,false,$2) result',[userA,lease])))).map(r=>r.rows[0].result);
  assert.equal(leases.filter(r=>r.claimed).length,1);
  await root.query("update public.billing_accounts set lease_expires_at=now()-interval '1 second' where user_id=$1",[userA]);
  const oldToken=leases[0].claimed?lease1:lease2;
  await service.query('select public.claim_billing_operation($1,false,$2)',[userA,randomUUID()]);
  await assert.rejects(service.query("select public.write_billing_operation($1,false,$2,'release','{}')",[userA,oldToken]),e=>e.code==='55000');
  console.log('PASS: serialized billing lease and stale-writer fencing');

  const cache=createHash('sha256').update(userA).digest('hex');
  const claim = c=>c.query("select public.claim_mentor_generation($1,$2,$3,'fixture','fixture-model','short fixture',8,100) result",[userA,cache,randomUUID()]);
  const ai=(await Promise.all([claim(service),claim(service2)])).map(r=>r.rows[0].result);
  assert.deepEqual(ai.map(r=>r.status).sort(),['claimed','pending']); assert.equal(ai[0].id,ai[1].id);
  assert.equal((await root.query("select used from public.usage_buckets where scope=$1 and kind='mentor'",[userA])).rows[0].used,1);
  await root.query("update public.ai_generations set lease_expires_at=now()-interval '1 second' where id=$1",[ai[0].id]);
  await service.query('select public.maintain_operations()');
  const expired=(await root.query('select status,estimated_usd,error_category from public.ai_generations where id=$1',[ai[0].id])).rows[0];
  assert.equal(expired.status,'error'); assert.equal(expired.estimated_usd,null); assert.equal(expired.error_category,'lease_expired');
  assert.equal((await claim(service)).rows[0].result.status,'claimed');
  console.log('PASS: atomic AI claim spends one allowance; expired leases reconcile without guessed cost');

  const grants=(await root.query("select table_name,privilege_type from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public'")).rows;
  assert.ok(grants.every(row=>['SELECT','DELETE'].includes(row.privilege_type)));
  assert.equal((await root.query("select count(*)::int count from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity")).rows[0].count,0);
  assert.equal((await root.query("select has_table_privilege('authenticated','public.account_erasures','select') allowed")).rows[0].allowed,false);
  await root.query('delete from auth.users where id=$1',[userA]);
  assert.equal((await root.query('select * from public.usage_buckets where scope=$1',[userA])).rowCount,0);
  assert.equal((await root.query('select * from public.learner_progress where user_id=$1',[userA])).rowCount,0);
  assert.equal((await root.query('select * from public.ai_generations where user_id=$1',[userA])).rowCount,0);
  assert.equal((await root.query('select * from public.billing_accounts where user_id=$1',[userA])).rowCount,0);
  assert.equal((await root.query('select * from public.account_erasures where user_hash=$1',[createHash('sha256').update(userA).digest('hex')])).rowCount,1);
  await assert.rejects(service.query("select public.reserve_usage($1,'mentor',8,100)",[userA]),e=>e.code==='23503');
  await root.query('begin; set local role postgres; create table public.default_privilege_probe(id integer); create function public.default_function_probe() returns integer language sql as $$select 1$$;');
  assert.equal((await root.query("select has_table_privilege('anon','public.default_privilege_probe','select') allowed")).rows[0].allowed,false);
  assert.equal((await root.query("select has_table_privilege('authenticated','public.default_privilege_probe','insert') allowed")).rows[0].allowed,false);
  assert.equal((await root.query("select has_function_privilege('anon','public.default_function_probe()','execute') allowed")).rows[0].allowed,false);
  await root.query('rollback');
  console.log('PASS: least privilege and future defaults, RLS, erasure cascade/ledger and post-delete resurrection denial');
} finally {
  await root.query('delete from auth.users where id=any($1::uuid[])',[[userA,userB]]);
  await Promise.all(clients.map(c=>c.end())); await root.end();
}
