import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, utimesSync, unlinkSync } from 'node:fs';
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
    withLock(lockPath, async () => {}, { retries: 2, delayMs: 1 }),
    /could not acquire lock/
  );
});

const sleep = async () => {};

test('an EMPTY lock file is reclaimed AT ONCE — no valid holder can leave one behind', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, '');
  let ran = false;
  await withLock(lockPath, async () => { ran = true; }, { retries: 3, delayMs: 1, isAlive, sleep });
  assert.equal(ran, true);
});

test('a token whose pid has been REUSED by a live process is reclaimed at once', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, `${process.pid}:${startTimeOf(process.pid) + 1}:recycled`);
  let ran = false;
  await withLock(lockPath, async () => { ran = true; }, { retries: 3, delayMs: 1, sleep });
  assert.equal(ran, true);
});

test('garbage in the lock file is debris, not a holder', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, 'not-a-token-at-all\n');
  let ran = false;
  await withLock(lockPath, async () => { ran = true; }, { retries: 3, delayMs: 1, isAlive, sleep });
  assert.equal(ran, true);
});

test('a lock is NEVER visible without its token — the window an empty lock came from is gone', async () => {
  const lockPath = join(dir(), 'agents.lock');
  let seen = null;
  await withLock(lockPath, async () => { seen = readFileSync(lockPath, 'utf8'); }, { delayMs: 1 });
  assert.match(seen, /^\d+:\d+:[0-9a-f-]{36}$/, `lock content inside the critical section: ${JSON.stringify(seen)}`);
});

test('a guard left by a crashed reclaimer is cleared AT ONCE', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, '999999:stale-token');
  writeFileSync(`${lockPath}.reclaim`, '999999:crashed-reclaimer');
  let ran = false;
  await withLock(lockPath, async () => { ran = true; }, { retries: 3, delayMs: 1, isAlive, sleep });
  assert.equal(ran, true);
});

const age = (path) => { const hourAgo = new Date(Date.now() - 3_600_000); utimesSync(path, hourAgo, hourAgo); };

test('a LIVE holder is never preempted, however old its lock looks — a frozen clock jump lost an update', async () => {
  const lockPath = join(dir(), 'agents.lock');
  let release;
  const held = withLock(lockPath, () => new Promise((resolve) => { release = resolve; }), { delayMs: 1 });
  while (!release) await new Promise((r) => setTimeout(r, 1));
  age(lockPath);
  let ran = false;
  await assert.rejects(
    withLock(lockPath, async () => { ran = true; }, { retries: 3, delayMs: 1 }),
    /could not acquire lock: .*held by pid \d+/
  );
  release();
  await held;
  assert.equal(ran, false, 'a contender ran inside a live holder');
});

test('a LIVE reclaimer\'s guard is never broken, however old it looks', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, '999999:stale-token');
  writeFileSync(`${lockPath}.reclaim`, liveToken());
  age(`${lockPath}.reclaim`);
  await assert.rejects(
    withLock(lockPath, async () => {}, { retries: 3, delayMs: 1, isAlive }),
    /could not acquire lock/
  );
  assert.equal(readFileSync(`${lockPath}.reclaim`, 'utf8'), liveToken());
});

test('reclaim never removes a lock planted after it judged the old one dead', async () => {
  const lockPath = join(dir(), 'agents.lock');
  writeFileSync(lockPath, '999999:stale-token');
  // The verdict on the dead holder is the last moment before removal: another process
  // reclaims the dead lock and plants a live one in exactly that window.
  let swapped = false;
  const racingIsAlive = (pid) => {
    if (pid === 999999 && !swapped) {
      swapped = true;
      unlinkSync(lockPath);
      writeFileSync(lockPath, liveToken());
    }
    return pid !== 999999;
  };
  let ran = false;
  await assert.rejects(
    withLock(lockPath, async () => { ran = true; }, { retries: 3, delayMs: 1, isAlive: racingIsAlive }),
    /could not acquire lock/
  );
  assert.equal(ran, false, 'the replacement lock was removed and its holder overlapped');
  assert.equal(readFileSync(lockPath, 'utf8'), liveToken());
});
