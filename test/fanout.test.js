import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { fanOut, runApply, selectSinks } = await import('../src/fanout.js');
const { sinkStatusPath, statusLockPath } = await import('../src/paths.js');
const { withLock } = await import('../src/lock.js');

const worker = fileURLToPath(new URL('../test-support/fanout-worker.js', import.meta.url));

function freshState() {
  return process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
}

function watchClaims(t, dir) {
  const observed = new Set();
  const waiters = new Set();
  const watcher = fs.watch(dir, (_event, filename) => {
    const match = String(filename).match(/^status\.lock\.tmp\.(\d+)\./);
    if (match) observed.add(Number(match[1]));
    for (const check of waiters) check();
  });
  t.after(() => watcher.close());

  return (pids) => new Promise((resolve, reject) => {
    const check = () => {
      if (pids.every((pid) => observed.has(pid))) {
        clearTimeout(timeout);
        waiters.delete(check);
        resolve();
      }
    };
    const timeout = setTimeout(() => {
      waiters.delete(check);
      reject(new Error(`timed out waiting for status-lock claims from ${pids.join(', ')}`));
    }, 1_000);
    waiters.add(check);
    check();
  });
}

function runWorker(t, sink, param, value, onDone) {
  const child = fork(worker, [sink, param, String(value)], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        onDone();
        resolve();
      }
      else {
        const error = new Error(`worker exited with code ${code}`);
        reject(error);
      }
    });
  });
  void done.catch(() => {});
  t.after(async () => {
    if (child.exitCode === null) child.kill();
    await Promise.allSettled([done]);
  });
  return { pid: child.pid, done };
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

test('a timed-out apply is recorded and does not block the next sink', { timeout: 2_000 }, async () => {
  freshState();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-sinks-'));
  const marker = path.join(root, 'later-ran');
  const makeSink = (name, body) => {
    const dir = path.join(root, name);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'apply'), `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });
    return { sink: name, dir, binds: [{ param: 'a.x', liveness: 'live' }] };
  };
  const timedOut = makeSink('timed-out',
    "process.on('SIGTERM', () => {}); setTimeout(() => process.exit(0), 750);");
  const later = makeSink('later', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'yes');`);

  const started = Date.now();
  const out = await fanOut({
    manifests: [timedOut, later],
    resolved,
    changedKeys: ['a.x'],
    runner: (manifest, resolvedFile, keys) => runApply(manifest, resolvedFile, keys, 100),
  });

  assert.ok(Date.now() - started < 500, 'SIGTERM handling must not defeat the timeout');
  assert.deepEqual(out.applied, ['later']);
  assert.equal(out.failed[0].sink, 'timed-out');
  assert.match(out.failed[0].error, /ETIMEDOUT/);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'yes');
  const status = JSON.parse(fs.readFileSync(sinkStatusPath(), 'utf8'));
  assert.equal(status['timed-out'].ok, false);
  assert.match(status['timed-out'].error, /ETIMEDOUT/);
  assert.equal(status.later.ok, true);
});

test('child fan-outs wait for the status lock and retain unique snapshots', { timeout: 10_000 }, async (t) => {
  const dir = freshState();
  let workers;
  let completed = 0;
  await withLock(statusLockPath(), async () => {
    const waitForClaims = watchClaims(t, dir);
    workers = [
      runWorker(t, 'first', 'first.value', 101, () => { completed += 1; }),
      runWorker(t, 'second', 'second.value', 202, () => { completed += 1; }),
    ];
    await waitForClaims(workers.map(({ pid }) => pid));
    assert.equal(completed, 0, 'no child can complete while the parent holds the status lock');
    assert.equal(fs.existsSync(sinkStatusPath()), false, 'no child can record while the parent holds the status lock');
  });
  await Promise.all(workers.map(({ done }) => done));
  const status = JSON.parse(fs.readFileSync(sinkStatusPath(), 'utf8'));
  assert.deepEqual(Object.keys(status).sort(), ['first', 'second']);
  assert.deepEqual(status.first.params, { 'first.value': 101 });
  assert.deepEqual(status.second.params, { 'second.value': 202 });
});
