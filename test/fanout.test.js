import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
const { fanOut, selectSinks } = await import('../src/fanout.js');
const { sinkStatusPath } = await import('../src/paths.js');

const manifests = [
  { sink: 'fast', dir: '/x/fast', binds: [{ param: 'a.x', liveness: 'live' }] },
  { sink: 'slow', dir: '/x/slow', binds: [{ param: 'a.x', liveness: 'reload' }] },
  { sink: 'other', dir: '/x/other', binds: [{ param: 'b.y', liveness: 'live' }] },
];
const resolved = { params: { 'a.x': 1, 'b.y': 2 } };

test('selects every sink binding a changed key, regardless of liveness class', () => {
  assert.deepEqual(selectSinks(manifests, ['a.x']).map((m) => m.sink), ['fast', 'slow']);
  assert.deepEqual(selectSinks(manifests, ['b.y']).map((m) => m.sink), ['other']);
  assert.deepEqual(selectSinks(manifests, ['nope.z']), []);
});

test('one failing sink neither blocks others nor throws; status snapshots bound params', async () => {
  const calls = [];
  const runner = (m) => {
    calls.push(m.sink);
    if (m.sink === 'fast') throw new Error('socket gone');
  };

  const out = await fanOut({ manifests, resolved, changedKeys: ['a.x'], runner });

  assert.deepEqual(calls, ['fast', 'slow']);
  assert.deepEqual(out.applied, ['slow']);
  assert.equal(out.failed[0].sink, 'fast');
  const status = JSON.parse(fs.readFileSync(sinkStatusPath(), 'utf8'));
  assert.equal(status.fast.ok, false);
  assert.match(status.fast.error, /socket gone/);
  assert.equal(status.slow.ok, true);
  assert.deepEqual(status.slow.params, { 'a.x': 1 });
});

test('concurrent fan-outs retain both status records', async () => {
  await Promise.all([
    fanOut({ manifests, resolved, changedKeys: ['a.x'], runner: () => {} }),
    fanOut({ manifests, resolved, changedKeys: ['b.y'], runner: () => {} }),
  ]);

  const status = JSON.parse(fs.readFileSync(sinkStatusPath(), 'utf8'));
  assert.deepEqual(status.slow.params, { 'a.x': 1 });
  assert.deepEqual(status.other.params, { 'b.y': 2 });
});
