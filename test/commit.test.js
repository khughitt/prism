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
const { contextPath, readActive, readContext, writeActive, writeContext } = await import('../src/contexts.js');
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

test('save-as snapshots the screen, deltas included, strips only scratch keys from the delta, and loads the new profile', async () => {
  fs.writeFileSync(valuesPath(), 'glass.paneLip: 9\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.35, 'glass.noise': 0.2 } });
  writeActive({ profile: 'dusk', wallpaper: { id: 'w1', path: '/w.png' } });
  writeScratch({ 'glass.ior': 1.7 });
  await commitKeepsScreen(['commit', 'profile', 'noon']);
  const noon = readContext('profile', 'noon').values;
  assert.equal(Object.keys(noon).length, defs.size, 'a full snapshot');
  assert.equal(noon['glass.ior'], 1.7, "scratch's value");
  assert.equal(noon['glass.noise'], 0.2, "the delta's value, because it is what was on screen");
  assert.equal(noon['glass.paneLip'], 9, 'base shows through the sparse profile');
  assert.deepEqual(readContext('wallpaper', 'w1').values, { 'glass.noise': 0.2 }, 'an untouched nudge stays');
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

test('commit rejects a bad destination, a bad name, and stray arguments', async () => {
  for (const argv of [['commit'], ['commit', 'state'], ['commit', 'base', 'x'], ['commit', 'profile', 'a', 'b'],
    ['commit', 'wallpaper'], ['commit', 'profile', 'a b']]) {
    const failure = await runCaptured(argv);
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
  }
  assert.match((await runCaptured(['commit'])).stderr, /usage: prism commit base \| profile \[<name>\] \| wallpaper <id>/);
});
