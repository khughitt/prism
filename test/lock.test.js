import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withLock } from '../src/lock.js';
import { startTimeOf } from '../src/proc.js';

const dir = () => mkdtempSync(join(tmpdir(), 'familiar-lock-'));
const liveToken = () => `${process.pid}:${startTimeOf(process.pid)}:held`;

test('serializes concurrent writers — no interleaving', async () => {
  const lockPath = join(dir(), 'agents.lock');
  const order = [];
  await Promise.all([1, 2, 3, 4, 5].map((n) => withLock(lockPath, async () => {
    order.push(`enter-${n}`);
    await new Promise((r) => setTimeout(r, 5));
    order.push(`exit-${n}`);
  }, { delayMs: 1 })));
  for (let i = 0; i < order.length; i += 2) {
    assert.equal(order[i].replace('enter-', ''), order[i + 1].replace('exit-', ''));
  }
});

test('releases the lock even when the critical section throws', async () => {
  const lockPath = join(dir(), 'agents.lock');
  await assert.rejects(withLock(lockPath, async () => { throw new Error('boom'); }), /boom/);
  assert.equal(existsSync(lockPath), false);
  await withLock(lockPath, async () => {});
});

const isAlive = (pid) => pid !== 999999;

test('reclaims a lock held by a dead process — a crashed hook must not wedge the bus', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, '999999:stale-token');
  let ran = false;
  await withLock(lockPath, async () => { ran = true; }, { retries: 5, delayMs: 1, isAlive });
  assert.equal(ran, true);
});

test('EIGHT racers reclaiming ONE stale lock do not overlap — that would lose a write', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, '999999:stale-token');
  let inside = 0;
  let overlapped = false;
  let ran = 0;
  const critical = async () => {
    inside += 1;
    if (inside > 1) overlapped = true;
    await new Promise((r) => setTimeout(r, 5));
    inside -= 1;
    ran += 1;
  };
  await Promise.all(Array.from({ length: 8 }, () =>
    withLock(lockPath, critical, { retries: 2000, delayMs: 1, isAlive })));
  assert.equal(overlapped, false, 'two holders were inside the lock at once');
  assert.equal(ran, 8, 'every racer eventually got its turn');
});

test('gives up rather than hanging forever on a live holder', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, liveToken());
  await assert.rejects(
    withLock(lockPath, async () => {}, { retries: 2, delayMs: 1, staleMs: 1_000_000 }),
    /could not acquire lock/
  );
});

function fakeClock(startMs) {
  let elapsed = 0;
  return { now: () => startMs + elapsed, sleep: async (ms) => { elapsed += ms; } };
}

test('an EMPTY lock file is reclaimed AT ONCE — no valid holder can leave one behind', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, '');
  let ran = false;
  const { now, sleep } = fakeClock(Date.now());
  await withLock(lockPath, async () => { ran = true; }, { retries: 3, delayMs: 1, isAlive, now, sleep });
  assert.equal(ran, true);
});

test('a token whose pid has been REUSED by a live process is reclaimed at once', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, `${process.pid}:${startTimeOf(process.pid) + 1}:recycled`);
  let ran = false;
  const { now, sleep } = fakeClock(Date.now());
  await withLock(lockPath, async () => { ran = true; }, { retries: 3, delayMs: 1, now, sleep });
  assert.equal(ran, true);
});

test('garbage in the lock file is debris, not a holder', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, 'not-a-token-at-all\n');
  let ran = false;
  const { now, sleep } = fakeClock(Date.now());
  await withLock(lockPath, async () => { ran = true; }, { retries: 3, delayMs: 1, isAlive, now, sleep });
  assert.equal(ran, true);
});

test('a lock is NEVER visible without its token — the window an empty lock came from is gone', async () => {
  const lockPath = join(dir(), 'agents.lock');
  let seen = null;
  await withLock(lockPath, async () => { seen = readFileSync(lockPath, 'utf8'); }, { delayMs: 1 });
  assert.match(seen, /^\d+:\d+:[0-9a-f-]{36}$/, `lock content inside the critical section: ${JSON.stringify(seen)}`);
});

test('a caller with DEFAULT options outlasts a guard left by a crashed reclaimer', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, '999999:stale-token');
  writeFileSync(`${lockPath}.reclaim`, '');
  const { now, sleep } = fakeClock(Date.now());
  let ran = false;
  await withLock(lockPath, async () => { ran = true; }, { isAlive, now, sleep });
  assert.equal(ran, true, 'default options must be able to reclaim past a stale guard');
});

test('OLD budget (100 x 20ms = 2000ms) cannot outlast the same guard — pins the bug', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, '999999:stale-token');
  writeFileSync(`${lockPath}.reclaim`, '');
  const { now, sleep } = fakeClock(Date.now());
  await assert.rejects(
    withLock(lockPath, async () => {}, { retries: 100, delayMs: 20, isAlive, now, sleep }),
    /could not acquire lock/
  );
});
