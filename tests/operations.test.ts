import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseFreshness, RELEASE_STALE_MS } from '../src/lib/release-freshness.ts';

test('release radar never calls missing, failed, future or stale data current', () => {
  const now = Date.parse('2026-09-13T12:00:00Z');
  assert.equal(releaseFreshness(null, false, now).stale, true);
  assert.equal(releaseFreshness(new Date(now).toISOString(), true, now).stale, true);
  assert.equal(releaseFreshness(new Date(now - RELEASE_STALE_MS - 1).toISOString(), false, now).stale, true);
  assert.equal(releaseFreshness(new Date(now + 120000).toISOString(), false, now).stale, true);
  assert.equal(releaseFreshness(new Date(now - 1000).toISOString(), false, now).stale, false);
});
