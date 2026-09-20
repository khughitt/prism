import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pair-mig-config-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pair-mig-state-'));
process.env.PRISM_INTEGRATIONS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pair-mig-sinks-'));
const cli = await import('../src/cli.js');
const { valuesPath, activePath, scratchPath, defsDir } = await import('../src/paths.js');
const { contextPath, readLook, readPair, readActive, writeLook, writeRuntime } = await import('../src/contexts.js');
const { readScratch } = await import('../src/scratch.js');
const { loadDefs } = await import('../src/defs.js');
const { planPairMigration, runPairMigration, assertPairLayout } = await import('../src/migrate.js');
const defs = loadDefs(defsDir());

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function runCaptured(argv, opts = {}) {
  let stdout = '', stderr = '';
  const code = await cli.run(argv, { runner: () => {}, ...opts,
    print: (text) => { stdout += text; }, eprint: (text) => { stderr += text; } });
  return { code, stdout, stderr };
}

function oldPair(id = 'w1', text = '_source: /w\nglass.roughness: 0.2\n') {
  const file = contextPath('wallpaper', id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

function bytes() {
  return Object.fromEntries([process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR].flatMap((root) =>
    fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()
      && entry.name !== 'store.lock').map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return [file, fs.readFileSync(file, 'utf8')];
    })));
}

function backups() {
  const dir = path.join(process.env.PRISM_STATE_DIR, 'migrations');
  return fs.existsSync(dir) ? fs.readdirSync(dir).map((name) => path.join(dir, name)) : [];
}

test('layout migration copies globals to every existing look and preserves pending scratch', async () => {
  fs.writeFileSync(valuesPath(), 'glass.roughness: 0.4 # original comments\n');
  writeLook('Aurora', { values: { 'glass.roughness': 0.6 }, wallpapers: {} });
  writeLook('Inactive', { values: {}, wallpapers: {} });
  const old = oldPair();
  fs.writeFileSync(activePath(), JSON.stringify({ profile: 'Aurora', wallpaper: { id: 'w1', path: '/w', pinned: false } }));
  fs.writeFileSync(scratchPath(), 'glass.roughness: 0.3\nterminal.background.opacity.inactive: 0.5\n');
  const original = bytes();
  const migrated = await runCaptured(['migrate', 'pairs']);
  assert.equal(migrated.code, 0, migrated.stderr);
  for (const name of [null, 'Aurora', 'Inactive']) assert.equal(readPair(name, 'w1').values['glass.roughness'], 0.2);
  assert.deepEqual(readScratch(), { 'glass.roughness': 0.3, 'terminal.background.opacity.inactive': 0.5 });
  assert.deepEqual(readActive(), { profile: 'Aurora', wallpaper: { id: 'w1', path: '/w' } });
  assert.equal(fs.existsSync(scratchPath()), false);
  assert.equal(fs.existsSync(old), false);
  const backup = backups()[0];
  for (const [file, text] of Object.entries(original)) {
    const relative = file.startsWith(process.env.PRISM_CONFIG_DIR + path.sep)
      ? path.relative(process.env.PRISM_CONFIG_DIR, file) : path.join('state', path.basename(file));
    assert.equal(fs.readFileSync(path.join(backup, relative), 'utf8'), text);
  }
  assert.match(migrated.stdout, /Default \/ wallpaper w1: copied/);
  writeLook('New', { values: {}, wallpapers: {} });
  assert.equal(readPair('New', 'w1'), null);
  const completed = bytes();
  assert.equal((await runCaptured(['migrate', 'pairs'])).stdout, 'migrate pairs: nothing to migrate\n');
  assert.deepEqual(bytes(), completed);
});

test('scratch-only migration creates runtime and records its original absence without creating base', async () => {
  fs.writeFileSync(scratchPath(), 'glass.roughness: 0.3\n');
  assert.equal((await runCaptured(['migrate', 'pairs'])).code, 0);
  assert.equal(fs.existsSync(valuesPath()), false);
  assert.deepEqual(readScratch(), { 'glass.roughness': 0.3 });
  assert.equal(fs.readFileSync(path.join(backups()[0], 'originally-absent.txt'), 'utf8'), 'state/active.json\n');
});

test('missing base is a new destination, and old runtime without edits is left byte-identical', async () => {
  oldPair();
  const original = '{"wallpaper":{"id":"w1","path":"/w"}}';
  fs.writeFileSync(activePath(), original);
  assert.equal((await runCaptured(['migrate', 'pairs'])).code, 0);
  assert.equal(fs.readFileSync(activePath(), 'utf8'), original);
  assert.equal(fs.readFileSync(path.join(backups()[0], 'originally-absent.txt'), 'utf8'), 'config/values.yaml\n');
});

for (const conflict of ['pair', 'scratch', 'explicit-empty-scratch', 'invalid-global', 'invalid-inactive-pair', 'malformed-inactive-pair']) {
  test(`${conflict} refuses migration without any backup or store write`, async () => {
    oldPair();
    writeLook(null, { values: {}, wallpapers: conflict === 'pair' ? {
      w1: { source: '/different', values: { 'glass.roughness': 0.9 } },
    } : {} });
    writeLook('Inactive', { values: {}, wallpapers: conflict === 'invalid-inactive-pair' ? {
      hidden: { source: '/hidden', values: { 'glass.roughness': 99 } },
    } : {} });
    if (conflict === 'malformed-inactive-pair') fs.writeFileSync(contextPath('profile', 'Inactive'), '_wallpapers:\n  hidden: []\n');
    if (conflict === 'invalid-global') oldPair('bad', '_source: /bad\nglass.roughness: 99\n');
    if (conflict.includes('scratch')) {
      fs.writeFileSync(scratchPath(), 'glass.roughness: 0.3\n');
      fs.writeFileSync(activePath(), JSON.stringify({ _scratch: conflict === 'scratch' ? { 'glass.roughness': 0.4 } : {} }));
    }
    const before = bytes();
    assert.equal((await runCaptured(['migrate', 'pairs'])).code, 1);
    assert.deepEqual(bytes(), before);
    assert.deepEqual(backups(), []);
  });
}

test('equal existing pairs and dual scratch sources are safe and keep all other pairs', async () => {
  oldPair();
  const pair = { source: '/w', values: { 'glass.roughness': 0.2 } };
  writeLook(null, { values: {}, wallpapers: { w1: pair, other: { source: '/other', values: { 'glass.roughness': 0.7 } } } });
  writeRuntime({ active: {}, scratch: { 'glass.roughness': 0.3 } });
  fs.writeFileSync(scratchPath(), 'glass.roughness: 0.3\n');
  const before = fs.readFileSync(valuesPath(), 'utf8');
  const result = await runCaptured(['migrate', 'pairs']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /already matching/);
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), before);
  assert.deepEqual(readScratch(), { 'glass.roughness': 0.3 });
});

test('replacement-era keys are copied unchanged and plain migration changes all logical maps once per file', async () => {
  oldPair('w1', '_source: /w\nglass.ring.driftHz: 0\n');
  writeLook('Inactive', { values: { 'glass.ring.driftHz': 25 }, wallpapers: {
    other: { source: '/other', values: { 'glass.ring.driftHz': 12 } },
  } });
  assert.equal((await runCaptured(['migrate', 'pairs'])).code, 0);
  assert.deepEqual(readPair('Inactive', 'w1').values, { 'glass.ring.driftHz': 0 });
  const rename = fs.renameSync;
  const writes = [];
  fs.renameSync = (from, to) => { writes.push(to); return rename(from, to); };
  try { assert.equal((await runCaptured(['migrate'])).code, 0); }
  finally { fs.renameSync = rename; }
  assert.equal(writes.filter((file) => file === contextPath('profile', 'Inactive')).length, 1);
  assert.deepEqual(readLook('Inactive'), { values: { 'glass.ring.sweepMs': 1500 }, wallpapers: {
    other: { source: '/other', values: { 'glass.ring.sweepMs': 1500 } },
    w1: { source: '/w', values: { 'glass.ring.sweepMs': 0 } },
  } });
});

test('read-only paths diagnose old sources without repairing or resolving them', async () => {
  oldPair();
  fs.writeFileSync(scratchPath(), 'glass.roughness: 0.3\n');
  fs.writeFileSync(activePath(), JSON.stringify({ wallpaper: { id: 'w1', path: '/w', pinned: false } }));
  const before = bytes();
  for (const argv of [['describe', '--json'], ['get', 'glass.roughness'], ['list'], ['context', 'list'], ['context', 'show', 'profile', 'Missing'], ['doctor']]) {
    const result = await runCaptured(argv);
    assert.match(result.stdout + result.stderr, /migrate pairs/);
    assert.deepEqual(bytes(), before, argv.join(' '));
  }
  assert.throws(() => assertPairLayout(), /migrate pairs/);
  assert.deepEqual(bytes(), before);
});

test('doctor identifies bad inactive pairs independently and continues through valid documents', async () => {
  for (const name of ['A', 'B']) writeLook(name, { values: {}, wallpapers: {
    bad: { source: '/w', values: { 'glass.roughness': 99 } },
  } });
  writeLook('Good', { values: {}, wallpapers: {} });
  const before = bytes();
  const result = await runCaptured(['doctor']);
  assert.equal(result.code, 1);
  for (const name of ['A', 'B']) assert.match(result.stdout, new RegExp(`profile ${name} / wallpaper bad`));
  assert.deepEqual(bytes(), before);
});

test('interrupted installation retains sources, and rerun uses fresh immutable backup and current files', () => {
  const old = oldPair();
  writeLook('A', { values: {}, wallpapers: {} });
  fs.writeFileSync(scratchPath(), 'glass.roughness: 0.3\n');
  const now = new Date('2026-09-20T12:00:00Z');
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (to === contextPath('profile', 'A')) throw new Error('interrupted install');
    return rename(from, to);
  };
  try { assert.throws(() => runPairMigration(defs, { print: () => {}, now }), /interrupted install/); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.existsSync(old), true);
  assert.equal(fs.existsSync(scratchPath()), true);
  const first = backups()[0];
  const firstBytes = Object.fromEntries(Object.entries(bytes()).filter(([file]) => file.startsWith(first + path.sep)));
  const current = readLook(null);
  writeLook(null, { ...current, values: { 'glass.roughness': 0.8 } });
  runPairMigration(defs, { print: () => {}, now });
  assert.equal(backups().length, 2);
  assert.equal(readLook(null).values['glass.roughness'], 0.8, 'rerun preserves unrelated current edits');
  for (const [file, text] of Object.entries(firstBytes)) assert.equal(fs.readFileSync(file, 'utf8'), text);
  assert.equal(planPairMigration(defs), null);
});

test('accepted saved ids that collide with Object prototype names migrate as ordinary own pairs', async () => {
  oldPair('__proto__');
  const result = await runCaptured(['migrate', 'pairs']);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(readPair(null, '__proto__'), { source: '/w', values: { 'glass.roughness': 0.2 } });
});
