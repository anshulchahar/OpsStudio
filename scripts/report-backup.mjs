if (!process.env.MONITOR_SECRET) throw new Error('Monitoring secret is missing');
const base = new URL(process.env.MONITOR_URL || 'https://ops-studio.vercel.app');
if (base.protocol !== 'https:') throw new Error('HTTPS required');
const response = await fetch(new URL('/api/operations/backup', base), {
  method: 'POST', headers: { authorization: `Bearer ${process.env.MONITOR_SECRET}` },
  signal: AbortSignal.timeout(15000), redirect: 'error',
});
if (!response.ok) throw new Error(`Backup uploaded, but freshness reporting failed: HTTP ${response.status}`);
console.log('Offsite backup freshness recorded.');
