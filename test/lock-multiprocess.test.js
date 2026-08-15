import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const worker = fileURLToPath(new URL('./fixtures/lock-worker.js', import.meta.url));
const dir = () => mkdtempSync(join(tmpdir(), 'familiar-lock-mp-'));
const DEAD_PID = 0x7fffffff;

function runWorker(lockPath, counterPath, { iterations, retries, delayMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [worker, lockPath, counterPath, String(iterations), String(retries), String(delayMs)], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`worker exited with code ${code}`)));
  });
}

for (const [name, seed] of [
  ['real child processes serializing on the lock never lose a counter update', null],
  ['real child processes reclaim a lock pre-seeded with a dead pid, with no lost updates', `${DEAD_PID}:12345:stale-token`],
  ['real child processes racing on an EMPTY lock file still never lose an update', ''],
]) {
  test(name, { timeout: 30_000 }, async () => {
    const d = dir();
    const lockPath = join(d, 'agents.lock');
    const counterPath = join(d, 'counter');
    writeFileSync(counterPath, '0');
    if (seed !== null) writeFileSync(lockPath, seed);
    const processes = 8;
    const iterations = 3;
    await Promise.all(Array.from({ length: processes }, () => runWorker(lockPath, counterPath, { iterations, retries: 200, delayMs: 10 })));
    assert.equal(Number.parseInt(readFileSync(counterPath, 'utf8'), 10), processes * iterations, 'a lost update means the lock did not exclude across processes');
  });
}
