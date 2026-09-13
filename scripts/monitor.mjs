const base = new URL(process.env.MONITOR_URL || 'https://ops-studio.vercel.app');
if (base.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('HTTPS required');
if (!process.env.MONITOR_SECRET) throw new Error('MONITOR_SECRET missing: dependency monitoring cannot run');
const paths = ['/api/health', '/', '/api/readiness'];
for (const path of paths) {
  let success = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(new URL(path, base), {
        headers: path === '/api/readiness' ? { authorization: `Bearer ${process.env.MONITOR_SECRET}` } : {},
        signal: AbortSignal.timeout(15_000), redirect: 'error',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (path === '/') {
        if (!(await response.text()).includes('OpsStudio')) throw new Error('Unexpected homepage');
      } else {
        const data = await response.json();
        if (!['ok','ready'].includes(data.status)) throw new Error('Service degraded');
      }
      success = true;
      break;
    } catch { console.error(`${path}: attempt ${attempt + 1} failed`); }
  }
  if (!success) process.exitCode = 1;
  else console.log(`${path}: passed`);
}
