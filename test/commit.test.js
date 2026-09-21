import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
const integ = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-integ-'));
fs.mkdirSync(path.join(integ, 'fastsink'));
fs.writeFileSync(path.join(integ, 'fastsink', 'manifest.yaml'),
  'sink: fastsink\nbinds:\n  - {param: terminal.background.opacity.inactive, liveness: live}\n');
process.env.PRISM_INTEGRATIONS_DIR = integ;

const cli = await import('../src/cli.js');
const { resolvedPath, valuesPath, defsDir } = await import('../src/paths.js');
const { contextPath, readActive, readContext, writeActive, writeContext, writeLook, readPair } = await import('../src/contexts.js');
const { readScratch, writeScratch } = await import('../src/scratch.js');
const { readValues } = await import('../src/values.js');
const { loadDefs } = await import('../src/defs.js');
const { loadStore } = await import('../src/layers.js');

const defs = loadDefs(defsDir());

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(valuesPath(), '{}\n');
});

async function runCaptured(argv, opts = {}) {
  let stderr = '';
  const code = await cli.run(argv, { runner: () => {}, ...opts, eprint: (text) => { stderr += text; } });
  return { code, stderr };
}

function storeBytes() {
  return Object.fromEntries([process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR].flatMap((root) =>
    fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()
      && entry.name !== 'store.lock').map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return [file, fs.readFileSync(file)];
    })));
}

// Every commit keeps the screen: the values before and after are identical,
// resolved.json is untouched, and no sink runs.
async function commitKeepsScreen(argv) {
  await cli.run(['apply'], { runner: () => {} });
  const before = loadStore(defs).params;
  const bus = fs.readFileSync(resolvedPath(), 'utf8');
  const calls = [];
  const result = await runCaptured(argv, { runner: (m) => calls.push(m.sink) });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(loadStore(defs).params, before, `${argv.join(' ')} changed an effective value`);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), bus);
  assert.deepEqual(calls, []);
}

test('commit base folds scratch into values.yaml under the default rule and clears scratch', async () => {
  writeScratch({ 'glass.ior': 1.7, 'glass.paneLip': 6 });
  await commitKeepsScreen(['commit', 'base']);
  assert.deepEqual(readValues(), { 'glass.ior': 1.7 }, 'paneLip 6 equals the def default and is dropped');
  assert.deepEqual(readScratch(), {});
});

test('commit base is refused under a loaded profile, and a merging commit refuses empty scratch', async () => {
  writeContext('profile', 'dusk', { source: null, values: {} });
  writeActive({ profile: 'dusk' });
  writeScratch({ 'glass.ior': 1.7 });
  const refused = await runCaptured(['commit', 'base']);
  assert.match(refused.stderr, /profile dusk is loaded; commit profile, or deactivate it first/);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
  writeActive({});
  writeScratch({});
  for (const argv of [['commit', 'base'], ['commit', 'profile'], ['commit', 'wallpaper', 'abc12345']]) {
    writeActive(argv[1] === 'wallpaper' ? { wallpaper: { id: 'abc12345', path: '/w' } } : {});
    if (argv[1] === 'profile') { writeContext('profile', 'p', { source: null, values: {} }); writeActive({ profile: 'p' }); }
    const empty = await runCaptured(argv);
    assert.match(empty.stderr, /nothing to commit/, argv.join(' '));
  }
});

test('commit profile merges scratch into the loaded profile and strips those keys from the active wallpaper delta', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3, 'glass.paneLip': 9 } });
  writeActive({ profile: 'dusk' });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.35, 'glass.noise': 0.2 } });
  writeActive({ profile: 'dusk', wallpaper: { id: 'w1', path: '/w.png' } });
  writeScratch({ 'glass.ior': 1.7 });
  await commitKeepsScreen(['commit', 'profile']);
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ior': 1.7, 'glass.paneLip': 9 }, 'a merge keeps the rest');
  assert.deepEqual(readContext('wallpaper', 'w1').values, { 'glass.noise': 0.2 }, 'the committed key leaves the delta');
  assert.deepEqual(readScratch(), {});
  assert.equal(loadStore(defs).params['glass.ior'], 1.7);
});

test('a commit to the look deletes a delta it empties', async () => {
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.35 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  writeScratch({ 'glass.ior': 1.7 });
  await commitKeepsScreen(['commit', 'base']);
  assert.equal(readContext('wallpaper', 'w1'), null);
  assert.equal(fs.existsSync(contextPath('wallpaper', 'w1')), false);
});

test('commit profile with none loaded is refused', async () => {
  writeScratch({ 'glass.ior': 1.7 });
  assert.match((await runCaptured(['commit', 'profile'])).stderr, /no profile is loaded; commit profile <name> to save one/);
});

test('save-as snapshots the screen, deltas included, preserves the outgoing pair, and loads the new profile', async () => {
  fs.writeFileSync(valuesPath(), 'glass.paneLip: 9\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ profile: 'dusk' });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.35, 'glass.noise': 0.2 } });
  writeActive({ profile: 'dusk', wallpaper: { id: 'w1', path: '/w.png' } });
  writeScratch({ 'glass.ior': 1.7 });
  await commitKeepsScreen(['commit', 'profile', 'noon']);
  const noon = readContext('profile', 'noon').values;
  assert.equal(Object.keys(noon).length, defs.size, 'a full snapshot');
  assert.equal(noon['glass.ior'], 1.7, "scratch's value");
  assert.equal(noon['glass.noise'], 0.2, "the delta's value, because it is what was on screen");
  assert.equal(noon['glass.paneLip'], 9, 'base shows through the sparse profile');
  assert.equal(readPair('noon', 'w1'), null);
  assert.deepEqual(readPair('dusk', 'w1').values, { 'glass.ior': 1.35, 'glass.noise': 0.2 }, 'outgoing pair stays intact');
  assert.deepEqual(readActive(), { profile: 'noon', wallpaper: { id: 'w1', path: '/w.png' } });
  assert.deepEqual(readScratch(), {});
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ior': 1.3 }, 'the old profile is untouched');
});

test('save-as needs no edit, and saving the loaded profile under its own name is the merging commit', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ profile: 'dusk' });
  await commitKeepsScreen(['commit', 'profile', 'copy']);
  assert.equal(readContext('profile', 'copy').values['glass.ior'], 1.3);
  assert.deepEqual(readActive(), { profile: 'copy' });
  assert.match((await runCaptured(['commit', 'profile', 'copy'])).stderr, /nothing to commit/);
  writeActive({});
  await commitKeepsScreen(['commit', 'profile', 'Default-copy']);
  assert.equal(readContext('profile', 'Default-copy').values['glass.ior'], 1.5, 'naming the Default look: the shipped default, since base is empty');
});

test('neutral then save-as makes a neutral profile even when the wallpaper already quiets a key', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.roughness': 0.5 } });
  writeActive({ profile: 'dusk' });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.roughness': 0 } });
  writeActive({ profile: 'dusk', wallpaper: { id: 'w1', path: '/w.png' } });
  assert.equal(await cli.run(['reset', 'neutral'], { runner: () => {} }), 0);
  assert.equal('glass.roughness' in readScratch(), false, 'already neutral on screen, so no edit');
  await commitKeepsScreen(['commit', 'profile', 'quiet']);
  assert.equal(readContext('profile', 'quiet').values['glass.roughness'], 0);
});

test('commit wallpaper merges scratch into the on-screen delta and refuses a stale id or no wallpaper', async () => {
  writeScratch({ 'glass.ior': 1.7 });
  assert.match((await runCaptured(['commit', 'wallpaper', 'w1'])).stderr, /no active wallpaper/);
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  assert.match((await runCaptured(['commit', 'wallpaper', 'w2'])).stderr, /wallpaper w2 is not on screen/);
  await commitKeepsScreen(['commit', 'wallpaper', 'w1']);
  assert.deepEqual(readContext('wallpaper', 'w1'), { source: '/w.png', values: { 'glass.ior': 1.7 } }, 'created with _source');
  assert.deepEqual(readScratch(), {});
  writeScratch({ 'glass.noise': 0.3 });
  await commitKeepsScreen(['commit', 'wallpaper', 'w1']);
  assert.deepEqual(readContext('wallpaper', 'w1').values, { 'glass.ior': 1.7, 'glass.noise': 0.3 });
});

test('guarded commit refuses a stale look, wallpaper, or Default identity without changing files', async () => {
  for (const active of [
    { profile: 'Dark', wallpaper: { id: 'w1', path: '/w' } },
    { profile: 'Aurora', wallpaper: { id: 'w2', path: '/other' } },
    { profile: 'Default', wallpaper: { id: 'w1', path: '/w' } },
  ]) {
    writeLook(active.profile, { values: {}, wallpapers: {} });
    writeActive(active);
    writeScratch({ 'glass.ior': 1.6 });
    const before = storeBytes();
    const result = await runCaptured(['commit', 'wallpaper', 'w1', '--expect-look', 'profile:Aurora',
      '--expect-wallpaper', 'id:w1']);
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stderr, /expected .*slot/);
    assert.deepEqual(storeBytes(), before);
  }
  writeActive({ wallpaper: { id: 'w1', path: '/w' } });
  const wrongDefault = await runCaptured(['commit', 'wallpaper', 'w1', '--expect-look', 'profile:Default',
    '--expect-wallpaper', 'id:w1']);
  assert.equal(wrongDefault.code, 1);
  assert.match(wrongDefault.stderr, /expected .*slot/);
  for (const guards of [['--expect-look', 'default'], ['--expect-wallpaper', 'id:w1']]) {
    assert.equal((await runCaptured(['commit', 'wallpaper', 'w1', ...guards])).code, 1);
  }
});

test('commit rejects a bad destination, a bad name, and stray arguments', async () => {
  for (const argv of [['commit'], ['commit', 'state'], ['commit', 'base', 'x'], ['commit', 'profile', 'a', 'b'],
    ['commit', 'wallpaper'], ['commit', 'profile', 'a b']]) {
    const failure = await runCaptured(argv);
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
  }
  assert.match((await runCaptured(['commit'])).stderr, /missing destination; usage: prism commit/);
});

for (const source of [null, 'Aurora']) {
  for (const scratch of [{}, { 'glass.roughness': 0.3 }]) {
    test(`Save As replaces conflicting active destination pair from ${source ?? 'Default'}, ${Object.keys(scratch).length} edits`, async () => {
      writeLook(source, { values: { 'glass.roughness': 0.4 }, wallpapers: {
        w1: { source: '/w', values: { 'glass.roughness': 0.2 } },
      } });
      writeLook('Destination', { values: { 'glass.roughness': 0.9 }, wallpapers: {
        w1: { source: '/w', values: { 'glass.roughness': 0.8 } },
        w2: { source: '/other', values: { 'glass.roughness': 0.7 } },
      } });
      writeActive({ ...(source === null ? {} : { profile: source }), wallpaper: { id: 'w1', path: '/w' } });
      writeScratch(scratch);
      const old = readPair(source, 'w1');
      await commitKeepsScreen(['commit', 'profile', 'Destination']);
      assert.equal(readPair('Destination', 'w1'), null);
      assert.deepEqual(readPair('Destination', 'w2').values, { 'glass.roughness': 0.7 });
      assert.deepEqual(readPair(source, 'w1'), old);
    });
  }
}
