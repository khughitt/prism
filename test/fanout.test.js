import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { fanOut, selectSinks } = await import('../src/fanout.js');
const { sinkStatusPath, statusLockPath } = await import('../src/paths.js');
const { withLock } = await import('../src/lock.js');

const worker = fileURLToPath(new URL('./fixtures/fanout-worker.js', import.meta.url));

function freshState() {
  process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
}

function runWorker(sink, param, value, onDone) {
  const child = fork(worker, [sink, param, String(value)], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  let ready;
  const readyPromise = new Promise((resolve, reject) => { ready = { resolve, reject }; });
  const done = new Promise((resolve, reject) => {
    child.on('error', (error) => {
      ready.reject(error);
      reject(error);
    });
    child.on('message', (message) => {
      if (message === 'ready') ready.resolve();
    });
    child.on('close', (code) => {
      if (code === 0) {
        onDone();
        resolve();
      }
      else {
        const error = new Error(`worker exited with code ${code}`);
        ready.reject(error);
        reject(error);
      }
    });
  });
  return { ready: readyPromise, done };
}

const manifests = [
  { sink: 'fast', dir: '/x/fast', binds: [{ param: 'a.x', liveness: 'live' }] },
  { sink: 'slow', dir: '/x/slow', binds: [{ param: 'a.x', liveness: 'reload' }] },
  { sink: 'other', dir: '/x/other', binds: [{ param: 'b.y', liveness: 'live' }] },
];
const resolved = { params: { 'a.x': 1, 'b.y': 2 } };

test('selects every sink binding a changed key, regardless of liveness class', () => {
  freshState();
  assert.deepEqual(selectSinks(manifests, ['a.x']).map((m) => m.sink), ['fast', 'slow']);
  assert.deepEqual(selectSinks(manifests, ['b.y']).map((m) => m.sink), ['other']);
  assert.deepEqual(selectSinks(manifests, ['nope.z']), []);
});

test('one failing sink neither blocks others nor throws; status snapshots bound params', async () => {
  freshState();
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

test('child fan-outs wait for the status lock and retain unique snapshots', { timeout: 10_000 }, async () => {
  freshState();
  let workers;
  let completed = 0;
  await withLock(statusLockPath(), async () => {
    workers = [
      runWorker('first', 'first.value', 101, () => { completed += 1; }),
      runWorker('second', 'second.value', 202, () => { completed += 1; }),
    ];
    await Promise.all(workers.map(({ ready }) => ready));
    assert.equal(completed, 0, 'no child can complete while the parent holds the status lock');
    assert.equal(fs.existsSync(sinkStatusPath()), false, 'no child can record while the parent holds the status lock');
  });
  await Promise.all(workers.map(({ done }) => done));
  const status = JSON.parse(fs.readFileSync(sinkStatusPath(), 'utf8'));
  assert.deepEqual(Object.keys(status).sort(), ['first', 'second']);
  assert.deepEqual(status.first.params, { 'first.value': 101 });
  assert.deepEqual(status.second.params, { 'second.value': 202 });
});
