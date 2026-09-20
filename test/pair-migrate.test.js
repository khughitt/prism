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

function reset() {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}

beforeEach(reset);

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

// Inject at real durable boundaries; never add failure hooks to production code.
async function interruptedMigration({ stop = Infinity, before = false } = {}) {
  const real = { copyFileSync: fs.copyFileSync, writeFileSync: fs.writeFileSync,
    renameSync: fs.renameSync, unlinkSync: fs.unlinkSync };
  const events = [];
  for (const name of Object.keys(real)) {
    fs[name] = (...args) => {
      const target = ['copyFileSync', 'renameSync'].includes(name) ? args[1] : args[0];
      const tracked = name !== 'writeFileSync' || path.basename(target) === 'originally-absent.txt';
      if (tracked && before && events.length + 1 === stop) throw new Error(`interrupted migration ${stop}`);
      const result = real[name](...args);
      if (tracked) {
        events.push({ name, target });
        if (!before && events.length === stop) throw new Error(`interrupted migration ${stop}`);
      }
      return result;
    };
  }
  try { return { ...await runCaptured(['migrate', 'pairs']), events }; }
  finally { Object.assign(fs, real); }
}

function migrationFixture(absent) {
  if (!absent) {
    fs.writeFileSync(valuesPath(), 'glass.roughness: 0.4 # keep these exact original bytes\n');
    fs.writeFileSync(activePath(), '{"profile":"Aurora","wallpaper":{"id":"w1","path":"/one","pinned":true}}');
  }
  writeLook('Aurora', { values: { 'glass.ior': 1.4 }, wallpapers: {} });
  writeLook('Dusk', { values: { 'glass.roughness': 0.6 }, wallpapers: {
    unrelated: { source: '/unrelated', values: { 'glass.roughness': 0.8 } },
  } });
  oldPair('w1', '_source: /one\nglass.roughness: 0.2 # global one\n');
  oldPair('w2', '_source: /two\nglass.roughness: 0.7\n');
  fs.writeFileSync(scratchPath(), 'glass.roughness: 0.3 # pending\nterminal.background.opacity.inactive: 0.51\n');
}

function storeBytes(config = process.env.PRISM_CONFIG_DIR, state = process.env.PRISM_STATE_DIR) {
  const result = {};
  for (const [prefix, root] of [['config', config], ['state', state]]) {
    for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
      const file = path.join(entry.parentPath, entry.name);
      const relative = path.relative(root, file);
      if (entry.isFile() && !relative.startsWith('migrations' + path.sep)
          && entry.name !== 'store.lock' && !entry.name.endsWith('.tmp')) {
        result[`${prefix}/${relative}`] = fs.readFileSync(file, 'utf8');
      }
    }
  }
  return result;
}

function backupBytes(backup) {
  return Object.fromEntries(Object.entries(bytes()).filter(([file]) => file.startsWith(backup + path.sep)));
}

function verifyFirstBackup(backup, original, absent) {
  for (const [file, content] of Object.entries(original)) {
    const relative = file.startsWith('config/') ? file.slice(7) : file;
    assert.equal(fs.readFileSync(path.join(backup, relative), 'utf8'), content, `original backup ${file}`);
  }
  const list = fs.readFileSync(path.join(backup, 'originally-absent.txt'), 'utf8');
  assert.equal(list, absent ? 'config/values.yaml\nstate/active.json\n' : '');

  // Manual rollback: start with the migrated store, copy the first backup, remove
  // only the plain absent-output list. No migration plan or helper performs restore.
  const restored = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pair-restore-'));
  const config = path.join(restored, 'config'), state = path.join(restored, 'state');
  fs.mkdirSync(config); fs.mkdirSync(state);
  for (const [file, content] of Object.entries(storeBytes())) {
    const target = path.join(restored, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  for (const entry of fs.readdirSync(backup, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name === 'originally-absent.txt') continue;
    const source = path.join(entry.parentPath, entry.name);
    const relative = path.relative(backup, source);
    const target = path.join(relative.startsWith('state/') ? restored : config, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  for (const file of list.trim().split('\n').filter(Boolean)) fs.unlinkSync(path.join(restored, file));
  assert.deepEqual(storeBytes(config, state), original, 'first-backup rollback restores exact present/absent files');
  fs.rmSync(restored, { recursive: true });
}

for (const absent of [false, true]) {
  test(`migration ${absent ? 'with absent outputs' : 'with existing outputs'}: every backup/install/delete boundary retries and restores`, async () => {
    migrationFixture(absent);
    const original = storeBytes();
    const plan = planPairMigration(defs);
    const clean = await interruptedMigration();
    assert.equal(clean.code, 0, clean.stderr);
    const final = storeBytes();
    assert.deepEqual(clean.events.map(({ name }) => name), [
      ...plan.originals.map(() => 'copyFileSync'), 'writeFileSync',
      ...plan.outputs.map(() => 'renameSync'), ...plan.removals.map(() => 'unlinkSync'),
    ]);
    assert.deepEqual(clean.events.filter(({ name }) => name === 'renameSync').map(({ target }) => target), plan.outputs.map(({ path }) => path));
    assert.deepEqual(clean.events.filter(({ name }) => name === 'unlinkSync').map(({ target }) => target), plan.removals);
    const firstInstall = plan.originals.length + 2;

    for (const before of [true, false]) {
      for (let stop = 1; stop <= clean.events.length; stop += 1) {
        reset(); migrationFixture(absent);
        const interrupted = await interruptedMigration({ stop, before });
        assert.equal(interrupted.code, 1, `boundary ${stop}, before=${before}`);
        assert.match(interrupted.stderr, /interrupted migration/);
        const completed = stop - Number(before);
        if (completed < firstInstall) assert.deepEqual(storeBytes(), original, 'backup failure never mutates the store');
        // Sources cannot disappear until every destination and runtime is installed.
        if (completed < firstInstall + plan.outputs.length) {
          for (const source of plan.removals) assert.equal(fs.existsSync(source), true);
        }
        const first = backups()[0];
        const firstBytes = backupBytes(first);
        const firstComplete = fs.existsSync(path.join(first, 'originally-absent.txt'));
        const retry = await runCaptured(['migrate', 'pairs']);
        assert.equal(retry.code, 0, retry.stderr);
        assert.deepEqual(storeBytes(), final, `boundary ${stop}, before=${before}: current-store retry diverged`);
        assert.deepEqual(backupBytes(first), firstBytes, 'retry never changes even a partial first backup');
        if (completed === clean.events.length) {
          assert.equal(retry.stdout, 'migrate pairs: nothing to migrate\n');
          assert.deepEqual(backups(), [first]);
        } else {
          assert.equal(backups().length, 2, 'every modifying retry creates a fresh backup');
          assert.ok(backups().some((backup) => backup !== first));
        }
        const firstCompleteBackup = firstComplete ? first : backups().find((backup) => backup !== first);
        verifyFirstBackup(firstCompleteBackup, original, absent);
        const complete = bytes();
        assert.equal((await runCaptured(['migrate', 'pairs'])).stdout, 'migrate pairs: nothing to migrate\n');
        assert.deepEqual(bytes(), complete, 'completed rerun is byte-identical, including backups');
      }
    }
  });
}

for (const conflict of ['pair', 'scratch']) {
  test(`manual ${conflict} conflict between migration attempts refuses before backup; intentional resolution finishes`, async () => {
    migrationFixture(false);
    const original = storeBytes();
    const plan = planPairMigration(defs);
    const target = conflict === 'pair' ? contextPath('profile', 'Aurora') : activePath();
    const stop = plan.originals.length + 2 + plan.outputs.findIndex((output) => output.path === target);
    assert.equal((await interruptedMigration({ stop })).code, 1);
    assert.ok(fs.existsSync(contextPath('wallpaper', 'w1')));
    assert.ok(fs.existsSync(scratchPath()));
    const first = backups()[0];
    const immutable = backupBytes(first);
    if (conflict === 'pair') {
      const look = readLook('Aurora');
      look.wallpapers.w1.values['glass.roughness'] = 0.7;
      writeLook('Aurora', look);
    } else {
      writeRuntime({ active: readActive(), scratch: { 'glass.roughness': 0.7 } });
    }
    const manual = bytes();
    const refused = await runCaptured(['migrate', 'pairs']);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /conflict/);
    assert.deepEqual(bytes(), manual, 'refusal preserves the manual edit and all backups');
    if (conflict === 'pair') {
      const look = readLook('Aurora');
      look.wallpapers.w1.values['glass.roughness'] = 0.2;
      writeLook('Aurora', look);
    } else {
      writeRuntime({ active: readActive(), scratch: { 'glass.roughness': 0.3, 'terminal.background.opacity.inactive': 0.51 } });
    }
    // Hand edits that do not conflict must be preserved, never replayed over.
    const current = readLook('Dusk');
    current.values['glass.ior'] = 1.8;
    current.wallpapers.unrelated.values['glass.roughness'] = 0.9;
    writeLook('Dusk', current);
    const retry = await runCaptured(['migrate', 'pairs']);
    assert.equal(retry.code, 0, retry.stderr);
    assert.equal(readLook('Dusk').values['glass.ior'], 1.8);
    assert.equal(readPair('Dusk', 'unrelated').values['glass.roughness'], 0.9);
    for (const look of [null, 'Aurora', 'Dusk']) {
      assert.deepEqual(readPair(look, 'w1'), { source: '/one', values: { 'glass.roughness': 0.2 } });
      assert.deepEqual(readPair(look, 'w2'), { source: '/two', values: { 'glass.roughness': 0.7 } });
    }
    assert.deepEqual(backupBytes(first), immutable);
    assert.equal(backups().length, 2);
    verifyFirstBackup(first, original, false);
  });
}
