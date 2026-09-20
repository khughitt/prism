import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parse, stringify } from 'yaml';
import { withLock } from '../src/lock.js';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

const worker = fileURLToPath(new URL('../test-support/lock-worker.js', import.meta.url));
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

// IPC coordinates only test processes. Commands still acquire the production lock.
function runCommand(env, argv) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { run } from ${JSON.stringify(new URL('../src/cli.js', import.meta.url).href)};
    process.send('ready');
    process.exitCode = await run(JSON.parse(process.argv[1]), { runner: () => {} });
    process.disconnect();
  `, JSON.stringify(argv)], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stdout = '', stderr = '', finished = false;
  child.stdout.on('data', (data) => { stdout += data; });
  child.stderr.on('data', (data) => { stderr += data; });
  const ready = new Promise((resolve, reject) => {
    child.once('message', resolve);
    child.once('error', reject);
    child.once('close', () => reject(new Error(`command exited before ready: ${stderr}`)));
  });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => { finished = true; resolve({ code, stdout, stderr }); });
  });
  return { child, ready, done, finished: () => finished };
}

function commandStore() {
  const root = dir();
  const config = join(root, 'config'), state = join(root, 'state'), integrations = join(root, 'integrations');
  for (const folder of [config, state, integrations, join(config, 'contexts/profile')]) mkdirSync(folder, { recursive: true });
  const env = { ...process.env, PRISM_CONFIG_DIR: config, PRISM_STATE_DIR: state, PRISM_INTEGRATIONS_DIR: integrations };
  const documents = {};
  for (const [look, roughness, ior] of [[null, 0.1, 1.2], ['Aurora', 0.3, 1.4], ['Dusk', 0.5, 1.6], ['Noon', 0.7, 1.8]]) {
    documents[look] = { 'glass.ior': ior, _wallpapers: {
      w1: { _source: '/one', 'glass.roughness': roughness },
      w2: { _source: '/two', 'glass.roughness': roughness + 0.05 },
    } };
    writeFileSync(look === null ? join(config, 'values.yaml') : join(config, 'contexts/profile', `${look}.yaml`), stringify(documents[look]));
  }
  const scratch = { 'glass.roughness': 0.73, 'terminal.background.opacity.inactive': 0.51 };
  const active = join(state, 'active.json');
  writeFileSync(active, JSON.stringify({ profile: 'Aurora', wallpaper: { id: 'w1', path: '/one' }, _scratch: scratch }));
  return { env, config, state, active, scratch, documents, lock: join(state, 'store.lock') };
}

async function contend(t, store, commands, publish = () => {}) {
  const processes = [];
  t.after(() => { for (const proc of processes) if (!proc.finished()) proc.child.kill(); });
  await withLock(store.lock, async () => {
    for (const command of commands) processes.push(runCommand(store.env, command));
    await Promise.all(processes.map((proc) => proc.ready));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.ok(processes.every((proc) => !proc.finished()), 'every command must wait for the real held lock');
    publish();
  });
  return Promise.all(processes.map((proc) => proc.done));
}

function assertDocuments(store, expected) {
  for (const [look, document] of Object.entries(expected)) {
    const file = look === 'null' ? join(store.config, 'values.yaml') : join(store.config, 'contexts/profile', `${look}.yaml`);
    assert.deepEqual(parse(readFileSync(file, 'utf8')), document, `${look} pair ownership`);
  }
}

async function assertResolved(store, runtime) {
  const command = runCommand(store.env, ['apply']);
  const result = await command.done;
  assert.equal(result.code, 0, result.stderr);
  const params = Object.fromEntries([...loadDefs(defsDir())].map(([key, def]) => [key, def.default]));
  const look = parse(readFileSync(join(store.config, 'contexts/profile', `${runtime.profile}.yaml`), 'utf8'));
  const { _source, ...pair } = look._wallpapers[runtime.wallpaper.id];
  Object.assign(params, { 'glass.ior': look['glass.ior'] }, pair, runtime._scratch);
  assert.deepEqual(JSON.parse(readFileSync(join(store.state, 'resolved.json'), 'utf8')).params, params);
}

test('competing selections and guarded Keep attribute pending keys to slots published under the real lock', { timeout: 30_000 }, async (t) => {
  const store = commandStore();
  const expected = structuredClone(store.documents);
  const commands = [
    ['context', 'activate', 'profile', 'Aurora'],
    ['context', 'activate', 'profile', 'Noon'],
    ['commit', 'wallpaper', 'w2', '--expect-look', 'profile:Dusk', '--expect-wallpaper', 'id:w2'],
    ['commit', 'wallpaper', 'w1', '--expect-look', 'profile:Aurora', '--expect-wallpaper', 'id:w1'],
  ];
  const results = await contend(t, store, commands, () => {
    // Another lock holder publishes a new ownership before queued commands execute.
    writeFileSync(store.active, JSON.stringify({ profile: 'Dusk', wallpaper: { id: 'w2', path: '/two' }, _scratch: store.scratch }));
  });
  assert.deepEqual(results.slice(0, 2).map(({ code }) => code), [0, 0]);
  assert.equal(results[3].code, 1);
  assert.match(results[3].stderr, /expected (look|wallpaper) slot is stale/);
  if (results[2].code !== 0) assert.match(results[2].stderr, /expected look slot is stale/);
  Object.assign(expected.Dusk._wallpapers.w2, store.scratch);
  assertDocuments(store, expected);
  const runtime = JSON.parse(readFileSync(store.active, 'utf8'));
  assert.ok(['Aurora', 'Noon'].includes(runtime.profile));
  assert.deepEqual(runtime, { profile: runtime.profile, wallpaper: { id: 'w2', path: '/two' } });
  await assertResolved(store, runtime);
});

test('two guarded pair commits serialize scratch consumption with one success and one completed refusal', { timeout: 30_000 }, async (t) => {
  const store = commandStore();
  const expected = structuredClone(store.documents);
  const command = ['commit', 'wallpaper', 'w1', '--expect-look', 'profile:Aurora', '--expect-wallpaper', 'id:w1'];
  const results = await contend(t, store, [command, command]);
  assert.deepEqual(results.map(({ code }) => code).sort(), [0, 1]);
  assert.match(results.find(({ code }) => code === 1).stderr, /nothing to commit/);
  Object.assign(expected.Aurora._wallpapers.w1, store.scratch);
  assertDocuments(store, expected);
  const runtime = JSON.parse(readFileSync(store.active, 'utf8'));
  assert.deepEqual(runtime, { profile: 'Aurora', wallpaper: { id: 'w1', path: '/one' } });
  await assertResolved(store, runtime);
});
