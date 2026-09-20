import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));

// Fixture sinks with known bindings, so the fan-out call counts these tests
// assert on are deterministic.
const integ = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-integ-'));
fs.mkdirSync(path.join(integ, 'fastsink'));
fs.writeFileSync(path.join(integ, 'fastsink', 'manifest.yaml'),
  'sink: fastsink\nbinds:\n  - {param: terminal.background.opacity.inactive, liveness: live}\n');
fs.mkdirSync(path.join(integ, 'slowsink'));
fs.writeFileSync(path.join(integ, 'slowsink', 'manifest.yaml'),
  'sink: slowsink\nbinds:\n  - {param: terminal.background.opacity.inactive, liveness: reload}\n');
process.env.PRISM_INTEGRATIONS_DIR = integ;

const cli = await import('../src/cli.js');
const { activePath, scratchPath, resolvedPath, valuesPath, defsDir } = await import('../src/paths.js');
const { contextPath, readActive, readContext, writeActive, writeContext, writeLook, readPair, writeRuntime } = await import('../src/contexts.js');
const { readScratch, writeScratch } = await import('../src/scratch.js');
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

// The wallpaper verb canonicalises its path with realpath, so it needs a real
// file. Each call makes a fresh one under the config dir, wiped per test.
function wallpaperFile(name) {
  const dir = path.join(process.env.PRISM_CONFIG_DIR, 'walls');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, '');
  return file;
}

async function runCaptured(argv, opts = {}) {
  let stdout = '';
  let stderr = '';
  const code = await cli.run(argv, {
    runner: () => {}, ...opts,
    print: (text) => { stdout += text; }, eprint: (text) => { stderr += text; },
  });
  return { code, stdout, stderr };
}

test('context list shows every context by kind, marks the active ones, and shows the untuned active wallpaper', async () => {
  writeContext('profile', 'dusk', { source: null, values: {} });
  writeContext('profile', 'dawn', { source: null, values: {} });
  writeActive({ profile: 'dusk' });
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });
  writeActive({ profile: 'dusk', wallpaper: { id: 'ffff0000', path: '/walls/z.jpg' } });
  const { code, stdout } = await runCaptured(['context', 'list']);
  assert.equal(code, 0);
  assert.equal(stdout, [
    '  profile dawn',
    '* profile dusk',
    '  wallpaper profile:dusk abc12345  /walls/a.jpg',
    '* wallpaper profile:dusk ffff0000  /walls/z.jpg (untuned)',
    '',
  ].join('\n'));

  writeScratch({ 'glass.ior': 1.3, 'glass.paneLip': 9 });
  const edited = await runCaptured(['context', 'list']);
  assert.equal(edited.stdout.split('\n').at(-2), '  scratch  2 edits');
});

test('context show prints the file contents, _source first for a wallpaper', async () => {
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: { 'glass.ior': 1.3 } });
  const shown = await runCaptured(['context', 'show', 'wallpaper', 'abc12345']);
  assert.equal(shown.stdout, '_source: /walls/a.jpg\nglass.ior: 1.3\n');
  const missing = await runCaptured(['context', 'show', 'profile', 'nope']);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /profile nope: no such context/);
});

test('list discovers identical ids in every look and show can inspect an inactive pair', async () => {
  writeLook(null, { values: {}, wallpapers: { w1: { source: '/default', values: { 'glass.ior': 1.2 } } } });
  writeLook('Aurora', { values: {}, wallpapers: { w1: { source: '/aurora', values: { 'glass.ior': 1.3 } } } });
  writeLook('Dark', { values: {}, wallpapers: { w1: { source: '/dark', values: { 'glass.ior': 1.4 } } } });
  writeActive({ profile: 'Aurora', wallpaper: { id: 'w1', path: '/aurora' } });
  const listed = await runCaptured(['context', 'list']);
  assert.equal(listed.code, 0, listed.stderr);
  assert.match(listed.stdout, /^  wallpaper default w1  \/default$/m);
  assert.match(listed.stdout, /^\* wallpaper profile:Aurora w1  \/aurora$/m);
  assert.match(listed.stdout, /^  wallpaper profile:Dark w1  \/dark$/m);
  assert.equal((await runCaptured(['context', 'show', 'wallpaper', 'w1', '--look', 'profile:Dark'])).stdout,
    '_source: /dark\nglass.ior: 1.4\n');
  assert.equal((await runCaptured(['context', 'show', 'wallpaper', 'w1', '--look', 'default'])).stdout,
    '_source: /default\nglass.ior: 1.2\n');
  assert.match((await runCaptured(['context', 'show', 'profile', 'Aurora'])).stdout, /_wallpapers:\n  w1:/);
});

test('malformed selected look leaves healthy profiles and pairs discoverable', async () => {
  writeLook('Good', { values: {}, wallpapers: { w1: { source: '/good', values: {} } } });
  writeLook('Broken', { values: {}, wallpapers: {} });
  fs.writeFileSync(contextPath('profile', 'Broken'), 'glass.ior: [\n');
  writeActive({ profile: 'Broken', wallpaper: { id: 'w1', path: '/broken' } });
  const result = await runCaptured(['context', 'list']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /! profile Broken.*invalid YAML/);
  assert.match(result.stdout, /  profile Good/);
  assert.match(result.stdout, /  wallpaper profile:Good w1  \/good/);
  assert.doesNotMatch(result.stdout, /untuned/);
});

test('context list and show keep diagnosing malformed inactive profile documents', async () => {
  writeLook('dawn', { values: {}, wallpapers: {} });
  const raw = 'glass.ior: [\n';
  fs.writeFileSync(contextPath('profile', 'dusk'), raw);
  writeActive({ profile: 'dawn' });
  const listed = await runCaptured(['context', 'list']);
  assert.equal(listed.code, 0);
  assert.match(listed.stdout, /\* profile dawn/);
  assert.match(listed.stdout, /! profile dusk.*invalid YAML/);
  const shown = await runCaptured(['context', 'show', 'profile', 'dusk']);
  assert.equal(shown.code, 0);
  assert.equal(shown.stdout, raw);
  assert.match(shown.stderr, /invalid YAML.*prism doctor/);
});

test('context verbs reject the reserved kind, unknown kinds, bad names, and stray arguments', async () => {
  for (const argv of [
    ['context'], ['context', 'bogus'],
    ['context', 'list', 'extra'],
    ['context', 'show'], ['context', 'show', 'profile'], ['context', 'show', 'profile', 'a', 'b'],
    ['context', 'delete', 'state', 'dark'], ['context', 'delete', 'theme', 'x'], ['context', 'delete', 'profile', 'a b'],
    ['context', 'save', 'profile', 'x'], ['context', 'pin', 'wallpaper'],
    ['context', 'unpin', 'wallpaper'], ['context', 'clear'], ['context', 'clear', 'profile', 'x'],
  ]) {
    const failure = await runCaptured(argv);
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
  }
  assert.match((await runCaptured(['context', 'delete', 'state', 'dark'])).stderr, /kind state is reserved/);
  assert.match((await runCaptured(['context', 'delete', 'theme', 'x'])).stderr, /unknown kind theme/);
  assert.match((await runCaptured(['context', 'delete', 'profile', 'a b'])).stderr, /invalid context name/);
  assert.match((await runCaptured(['context'])).stderr, /usage: prism context/);
  assert.match((await runCaptured(['context', 'pin', 'wallpaper'])).stderr,
    /usage: prism context list\|show\|rename\|activate\|deactivate\|delete\|clear\|wallpaper/);
});

test('activate profile fans out only the keys whose effective value changed', async () => {
  fs.writeFileSync(valuesPath(), 'terminal.background.opacity.inactive: 0.6\n');
  await cli.run(['apply'], { runner: () => {} });
  writeContext('profile', 'dusk', { source: null,
    values: { 'terminal.background.opacity.inactive': 0.4, 'glass.ior': 1.24 } });

  const calls = [];
  assert.equal(await cli.run(['context', 'activate', 'profile', 'dusk'],
    { runner: (m, f, keys) => calls.push([m.sink, keys]) }), 0);
  assert.deepEqual(readActive(), { profile: 'dusk' });
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['terminal.background.opacity.inactive'], 0.4);
  // both fixture sinks bind the opacity key; glass.ior changed too but no fixture sink binds it
  assert.deepEqual(calls.map(([s]) => s).sort(), ['fastsink', 'slowsink']);
  for (const [, keys] of calls) {
    assert.deepEqual(keys.sort(), ['glass.ior', 'terminal.background.opacity.inactive']);
  }
});

test('activate profile requires the file; activate wallpaper copies _source into the slot', async () => {
  const missing = await runCaptured(['context', 'activate', 'profile', 'nope']);
  assert.match(missing.stderr, /profile nope: no such context/);
  assert.deepEqual(readActive(), {});

  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });
  assert.equal(await cli.run(['context', 'activate', 'wallpaper', 'abc12345'], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { wallpaper: { id: 'abc12345', path: '/walls/a.jpg' } });
});

test('an empty diff runs no sink and a repeated wallpaper is a no-op', async () => {
  await cli.run(['apply'], { runner: () => {} });
  const before = fs.readFileSync(resolvedPath(), 'utf8');
  const untuned = wallpaperFile('untuned.jpg');
  const calls = [];
  assert.equal(await cli.run(['context', 'wallpaper', untuned], { runner: (m) => calls.push(m.sink) }), 0);
  assert.deepEqual(calls, []);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before);
  const { wallpaperId } = await import('../src/contexts.js');
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(untuned), path: untuned } });

  const again = await runCaptured(['context', 'wallpaper', untuned]);
  assert.equal(again.code, 0);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before);
  assert.match((await runCaptured(['context', 'wallpaper', ''])).stderr, /wallpaper path must not be empty/);
  const missing = await runCaptured(['context', 'wallpaper', path.join(process.env.PRISM_CONFIG_DIR, 'walls', 'nope.jpg')]);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /wallpaper path does not exist/);
});

test('the wallpaper verb canonicalises the path: a symlink and its target are one wallpaper', async () => {
  const real = wallpaperFile('real.jpg');
  const link = path.join(process.env.PRISM_CONFIG_DIR, 'walls', 'link.jpg');
  fs.symlinkSync(real, link);
  assert.equal(await cli.run(['context', 'wallpaper', link], { runner: () => {} }), 0);
  const { wallpaperId } = await import('../src/contexts.js');
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(real), path: real } });
});

test('deactivate and delete clear the slot and restore the layer below', async () => {
  fs.writeFileSync(valuesPath(), 'terminal.background.opacity.inactive: 0.6\n');
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'terminal.background.opacity.inactive': 0.5 } });
  writeContext('profile', 'dusk', { source: null, values: { 'terminal.background.opacity.inactive': 0.4 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  await cli.run(['apply'], { runner: () => {} });

  let calls = [];
  assert.equal(await cli.run(['context', 'deactivate', 'profile'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readActive(), { wallpaper: { id: 'abc12345', path: '/w' } });
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['terminal.background.opacity.inactive'], 0.5);
  assert.equal(calls.length, 2, 'Default loads its own saved pair');

  calls = [];
  assert.equal(await cli.run(['context', 'delete', 'wallpaper', 'abc12345'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readActive(), {});
  assert.equal(readContext('wallpaper', 'abc12345'), null);
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['terminal.background.opacity.inactive'], 0.6);
  assert.equal(calls.length, 2);

  // deleting an inactive context never touches the bus
  const before = fs.readFileSync(resolvedPath(), 'utf8');
  calls = [];
  assert.equal(await cli.run(['context', 'delete', 'profile', 'dusk'], { runner: (m) => calls.push(m.sink) }), 0);
  assert.deepEqual(calls, []);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before);
  assert.match((await runCaptured(['context', 'delete', 'profile', 'dusk'])).stderr, /profile dusk: no such context/);
});

test('a broken previous state does not block recovery: the result is applied with a full fan-out', async () => {
  fs.writeFileSync(valuesPath(), 'terminal.background.opacity.inactive: 0.6\n');
  await cli.run(['apply'], { runner: () => {} });
  writeActive({ profile: 'vanished' });
  assert.notEqual((await runCaptured(['list'])).code, 0, 'precondition: the store is broken');

  const calls = [];
  assert.equal(await cli.run(['context', 'deactivate', 'profile'], { runner: (m, f, keys) => calls.push([m.sink, keys]) }), 0);
  assert.deepEqual(readActive(), {});
  assert.deepEqual(calls.map(([s]) => s).sort(), ['fastsink', 'slowsink']);
  for (const [, keys] of calls) assert.deepEqual(keys, ['terminal.background.opacity.inactive']);
  assert.equal((await runCaptured(['list'])).code, 0);

  // switching straight to a valid profile works too
  writeActive({ profile: 'vanished' });
  writeContext('profile', 'dusk', { source: null, values: {} });
  assert.equal(await cli.run(['context', 'activate', 'profile', 'dusk'], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { profile: 'dusk' });
});

test('a result that cannot resolve is refused and leaves the slots unchanged', async () => {
  writeContext('profile', 'bad', { source: null, values: { 'glass.ior': 99 } });
  const failure = await runCaptured(['context', 'activate', 'profile', 'bad']);
  assert.notEqual(failure.code, 0);
  assert.match(failure.stderr, /glass\.ior: 99 outside range/);
  assert.deepEqual(readActive(), {});
});

test('an unchanged slot is still validated: re-activating a broken context fails loudly', async () => {
  writeContext('profile', 'bad', { source: null, values: { 'glass.ior': 99 } });
  writeActive({ profile: 'bad' });
  const again = await runCaptured(['context', 'activate', 'profile', 'bad']);
  assert.notEqual(again.code, 0);
  assert.match(again.stderr, /glass\.ior: 99 outside range/);

  const { wallpaperId } = await import('../src/contexts.js');
  const a = wallpaperFile('a.jpg');
  const id = wallpaperId(a);
  writeActive({});
  writeContext('wallpaper', id, { source: a, values: { 'glass.ior': 99 } });
  writeActive({ wallpaper: { id, path: a } });
  const repeat = await runCaptured(['context', 'wallpaper', a]);
  assert.notEqual(repeat.code, 0);
  assert.match(repeat.stderr, /glass\.ior: 99 outside range/);
});

test('a refused delete keeps both the file and the slots', async () => {
  // the profile sits above a broken wallpaper; removing the profile exposes the
  // broken layer, so the delete must be refused without touching anything
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ior': 99 } });
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.2 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  const failure = await runCaptured(['context', 'delete', 'profile', 'dusk']);
  assert.notEqual(failure.code, 0);
  assert.match(failure.stderr, /glass\.ior: 99 outside range/);
  assert.notEqual(readContext('profile', 'dusk'), null, 'file preserved');
  assert.deepEqual(readActive(), { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' }, 'slots preserved');
});

test('interrupted active profile deletion leaves a valid slot before file removal', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ profile: 'dusk' });
  const file = contextPath('profile', 'dusk');
  const unlink = fs.unlinkSync;
  fs.unlinkSync = (target) => {
    if (target === file) {
      assert.deepEqual(readActive(), {}, 'the slot is cleared before deleting the profile');
      throw new Error('simulated interruption');
    }
    return unlink(target);
  };
  try {
    const stopped = await runCaptured(['context', 'delete', 'profile', 'dusk']);
    assert.equal(stopped.code, 1);
    assert.match(stopped.stderr, /simulated interruption/);
  } finally {
    fs.unlinkSync = unlink;
  }
  assert.deepEqual(readActive(), {});
  assert.notEqual(readContext('profile', 'dusk'), null);
  assert.equal(loadStore(defs).params['glass.ior'], 1.5, 'the interrupted store still resolves');
});

test('delete recovers from malformed active context files with a full fan-out', async () => {
  const { contextPath } = await import('../src/contexts.js');
  fs.writeFileSync(valuesPath(), 'terminal.background.opacity.inactive: 0.6\n');
  for (const contents of ['- invalid\n- shape\n', 'glass.ior: [\n']) {
    writeContext('profile', 'broken', { source: null, values: {} });
    fs.writeFileSync(contextPath('profile', 'broken'), contents);
    writeActive({ profile: 'broken' });
    const calls = [];
    assert.equal(await cli.run(['context', 'delete', 'profile', 'broken'],
      { runner: (m, f, keys) => calls.push([m.sink, keys]) }), 0);
    assert.equal(readContext('profile', 'broken'), null);
    assert.deepEqual(readActive(), {});
    assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['terminal.background.opacity.inactive'], 0.6);
    assert.deepEqual(calls.map(([sink]) => sink).sort(), ['fastsink', 'slowsink']);
    for (const [, keys] of calls) assert.deepEqual(keys, ['terminal.background.opacity.inactive']);
  }
});

// The panel reports the held layers for each parameter. Their ranking is the
// store's knowledge, so describe states it instead of copying it into clients.
test('describe reports the resolution order, low to high', async () => {
  const { RESOLUTION_ORDER } = await import('../src/layers.js');
  assert.deepEqual(RESOLUTION_ORDER, ['default', 'base', 'profile', 'wallpaper', 'state', 'scratch']);

  const wallpaper = wallpaperFile('order.jpg');
  assert.equal(await cli.run(['context', 'wallpaper', wallpaper], { runner: () => {} }), 0);
  const model = JSON.parse((await runCaptured(['describe', '--json'])).stdout);

  assert.deepEqual(model.layers, RESOLUTION_ORDER);
  for (const param of model.params) {
    assert.ok(model.layers.includes(param.layer), `${param.key} reports unrankable layer ${param.layer}`);
    for (const layer of param.held) assert.ok(model.layers.includes(layer), `${param.key} held in unrankable ${layer}`);
  }
});

// The panel populates its profile selector from describe, so the names ride in
// the same locked snapshot as `active` and the parameters: a list read
// separately could disagree with the active slot it is drawn beside.
test('describe lists the saved profile names, including ones it cannot read', async () => {
  writeContext('profile', 'noon', { source: null, values: {} });
  writeContext('profile', 'dusk', { source: null, values: {} });
  // Listing a name does not read it. A profile whose file is broken stays
  // listed and fails loudly when it is activated, rather than quietly missing
  // from a selector the user saved it into.
  fs.writeFileSync(contextPath('profile', 'broken'), 'values: [oops\n');

  const model = JSON.parse((await runCaptured(['describe', '--json'])).stdout);
  assert.deepEqual(model.profiles, ['broken', 'dusk', 'noon'], 'sorted, and the unreadable one is kept');

  // A wallpaper context is keyed by hash and never offered as a profile.
  writeContext('wallpaper', 'abc12345', { source: '/w', values: {} });
  const after = JSON.parse((await runCaptured(['describe', '--json'])).stdout);
  assert.deepEqual(after.profiles, ['broken', 'dusk', 'noon']);
});

test('context rename moves the profile file, repoints the active slot, and touches neither resolved.json nor sinks', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.5 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  await cli.run(['apply'], { runner: () => {} });
  const before = fs.readFileSync(resolvedPath(), 'utf8');

  const calls = [];
  assert.equal(await cli.run(['context', 'rename', 'profile', 'dusk', 'dawn'], { runner: (m) => calls.push(m.sink) }), 0);
  assert.deepEqual(calls, [], 'rename must not run any sink');
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before, 'rename must not touch resolved.json');
  assert.equal(readContext('profile', 'dusk'), null, 'the old file is gone');
  assert.deepEqual(readContext('profile', 'dawn'), { source: null, values: { 'glass.ior': 1.5 } });
  assert.deepEqual(readActive(), { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dawn' },
    'the loaded profile follows its new name; the wallpaper slot is untouched');
});

test('context rename of a profile that is not loaded leaves the active slots alone', async () => {
  writeContext('profile', 'dusk', { source: null, values: {} });
  writeContext('profile', 'noon', { source: null, values: {} });
  writeActive({ profile: 'noon' });
  assert.equal(await cli.run(['context', 'rename', 'profile', 'dusk', 'dawn'], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { profile: 'noon' });
  assert.equal(readContext('profile', 'dusk'), null);
  assert.notEqual(readContext('profile', 'dawn'), null);
});

test('context rename refuses a missing source, an existing target, the wallpaper kind, and a bad shape', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.5 } });
  writeContext('profile', 'noon', { source: null, values: { 'glass.ior': 1.1 } });
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });

  const missing = await runCaptured(['context', 'rename', 'profile', 'nope', 'dawn']);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /profile nope: no such context/);
  assert.equal(readContext('profile', 'dawn'), null);

  const taken = await runCaptured(['context', 'rename', 'profile', 'dusk', 'noon']);
  assert.notEqual(taken.code, 0);
  assert.match(taken.stderr, /profile noon already exists/);
  assert.deepEqual(readContext('profile', 'noon').values, { 'glass.ior': 1.1 }, 'the existing profile is untouched');
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ior': 1.5 }, 'the source is untouched');

  const wallpaper = await runCaptured(['context', 'rename', 'wallpaper', 'abc12345', 'deadbeef']);
  assert.notEqual(wallpaper.code, 0);
  assert.match(wallpaper.stderr, /rename is for profiles/);
  assert.notEqual(readContext('wallpaper', 'abc12345'), null);

  for (const argv of [
    ['context', 'rename'], ['context', 'rename', 'profile', 'dusk'], ['context', 'rename', 'profile', 'dusk', 'a', 'b'],
    ['context', 'rename', 'profile', 'dusk', 'bad name'], ['context', 'rename', 'state', 'a', 'b'],
  ]) {
    const failure = await runCaptured(argv);
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
  }
  assert.match((await runCaptured(['context', 'rename'])).stderr, /usage: prism context rename <kind> <old> <new>/);
  assert.match((await runCaptured(['context', 'rename', 'profile', 'dusk', 'bad name'])).stderr, /invalid context name/);
});

test('the hook folds scratch into the wallpaper that leaves, in one locked step', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', wallpaperId(a), { source: a, values: { 'glass.paneLip': 9 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  await cli.run(['set', 'glass.paneLip', '12'], { runner: () => {} });

  const calls = [];
  assert.equal(await cli.run(['context', 'wallpaper', b], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readContext('wallpaper', wallpaperId(a)),
    { source: a, values: { 'glass.paneLip': 12, 'glass.ior': 1.7 } }, 'the leaving delta absorbs scratch');
  assert.deepEqual(readScratch(), {});
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(b), path: b } });
  const params = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params;
  assert.equal(params['glass.ior'], 1.5, 'the edit left with its wallpaper; the shipped default shows');
  assert.equal(params['glass.paneLip'], 6, 'the shipped default');

  // rotating back brings the nudges back
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.7);
});

test('the first activation keeps scratch: there is no wallpaper to receive it; the next rotation folds it', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
  assert.equal(readContext('wallpaper', wallpaperId(a)), null);
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.7);
  assert.equal(await cli.run(['context', 'wallpaper', b], { runner: () => {} }), 0);
  assert.deepEqual(readContext('wallpaper', wallpaperId(a)), { source: a, values: { 'glass.ior': 1.7 } });
  assert.deepEqual(readScratch(), {});
});

test('activate and deactivate wallpaper fold like the hook; the same wallpaper again folds nothing', async () => {
  const a = wallpaperFile('a.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', 'other001', { source: '/o.jpg', values: {} });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 }, 'a repeat is a no-op, fold included');

  assert.equal(await cli.run(['context', 'activate', 'wallpaper', 'other001'], { runner: () => {} }), 0);
  assert.deepEqual(readContext('wallpaper', wallpaperId(a)).values, { 'glass.ior': 1.7 });
  assert.deepEqual(readScratch(), {});

  await cli.run(['set', 'glass.ior', '1.6'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'deactivate', 'wallpaper'], { runner: () => {} }), 0);
  assert.deepEqual(readContext('wallpaper', 'other001').values, { 'glass.ior': 1.6 });
  assert.deepEqual(readScratch(), {});
  assert.deepEqual(readActive(), {});
});

test('an invalid incoming delta is refused before anything is written', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', wallpaperId(b), { source: b, values: { 'glass.ior': 99 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  const before = {
    scratch: readScratch(),
    active: fs.readFileSync(activePath(), 'utf8'),
    resolved: fs.readFileSync(resolvedPath(), 'utf8'),
  };
  const calls = [];
  const refused = await runCaptured(['context', 'wallpaper', b], { runner: (m) => calls.push(m.sink) });
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /wallpaper .*glass\.ior: 99 outside range/);
  assert.deepEqual(calls, []);
  assert.deepEqual(readScratch(), before.scratch);
  assert.equal(fs.readFileSync(activePath(), 'utf8'), before.active);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before.resolved);
  assert.equal(readContext('wallpaper', wallpaperId(a)), null, 'the leaving delta was not written either');
});

test('deleting the active wallpaper clears the slot and leaves scratch: the fold has nowhere to go', async () => {
  const a = wallpaperFile('a.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', wallpaperId(a), { source: a, values: { 'glass.paneLip': 9 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'delete', 'wallpaper', wallpaperId(a)], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), {});
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
});

test('profile activate and deactivate discard scratch without a wallpaper', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'activate', 'profile', 'dusk'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), {});
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.3, 'the selected profile loads without pending edits');
  assert.equal(await cli.run(['context', 'deactivate', 'profile'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), {});
});

test('clear wallpaper removes the on-screen delta, resolves, fans out, and refuses a stale or untuned id', async () => {
  const a = wallpaperFile('a.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  const id = wallpaperId(a);
  assert.match((await runCaptured(['context', 'clear', 'wallpaper', id])).stderr, /no active wallpaper/);
  writeContext('wallpaper', id, { source: a, values: { 'terminal.background.opacity.inactive': 0.5 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.match((await runCaptured(['context', 'clear', 'wallpaper', 'deadbeef'])).stderr, /wallpaper deadbeef is not on screen/);

  const calls = [];
  assert.equal(await cli.run(['context', 'clear', 'wallpaper', id], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.equal(readContext('wallpaper', id), null);
  assert.deepEqual(readActive(), { wallpaper: { id, path: a } }, 'the slot stays');
  // The bus and the fan-out reflect the delta's removal, not the values it
  // held: the next state is computed with the file already gone.
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['terminal.background.opacity.inactive'], 0);
  assert.deepEqual(calls, [['terminal.background.opacity.inactive'], ['terminal.background.opacity.inactive']]);
  assert.deepEqual(loadStore(defs).params, JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params,
    'the store and the bus agree after a clear');
  assert.match((await runCaptured(['context', 'clear', 'wallpaper', id])).stderr, new RegExp(`wallpaper ${id}: untuned`));
});

test('clear can remove a parameter-invalid on-screen pair', async () => {
  const a = wallpaperFile('broken.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  const id = wallpaperId(a);
  writeContext('wallpaper', id, { source: a, values: {} });
  writeActive({ wallpaper: { id, path: a } });
  writeContext('wallpaper', id, { source: a, values: { 'glass.ior': 99 } });
  const cleared = await runCaptured(['context', 'clear', 'wallpaper', id]);
  assert.equal(cleared.code, 0, cleared.stderr);
  assert.equal(readContext('wallpaper', id), null);
  assert.deepEqual(readActive(), { wallpaper: { id, path: a } });
  assert.equal(loadStore(defs).params['glass.ior'], 1.5);
});

test('select saves outgoing edits to its pair and returns with no pending edits', async () => {
  writeLook('Aurora', { values: { 'glass.roughness': 0.4 }, wallpapers: {} });
  writeLook('Dark', { values: { 'glass.roughness': 0.8 }, wallpapers: {} });
  writeRuntime({ active: { profile: 'Aurora', wallpaper: { id: 'w1', path: '/w' } },
    scratch: { 'glass.roughness': 0.2, 'terminal.background.opacity.inactive': 0.5 } });
  assert.equal((await runCaptured(['context', 'activate', 'profile', 'Dark'])).code, 0);
  assert.deepEqual(readScratch(), {});
  assert.equal(loadStore(defs).params['glass.roughness'], 0.8);
  assert.equal(readPair('Dark', 'w1'), null);
  assert.equal(readPair('Aurora', 'w1').values['glass.roughness'], 0.2);
  assert.equal(Object.keys(readPair('Aurora', 'w1').values).length, 2);
  assert.equal((await runCaptured(['context', 'activate', 'profile', 'Aurora'])).code, 0);
  assert.deepEqual(readScratch(), {});
  assert.equal(loadStore(defs).params['glass.roughness'], 0.2);
});

function storeBytes() {
  return Object.fromEntries([process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR].flatMap((root) =>
    fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()
      && entry.name !== 'store.lock').map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return [file, fs.readFileSync(file, 'utf8')];
    })));
}

const expected = (look, wallpaper) => ['--expect-look', look, '--expect-wallpaper', wallpaper];

for (const command of [
  ['clear', 'wallpaper', 'w1'], ['delete', 'wallpaper', 'w1'],
  ['delete', 'profile', 'Aurora'], ['rename', 'profile', 'Aurora', 'Morning'],
]) {
  test(`stale ${command.join(' ')} refuses changed look or wallpaper without writing`, async () => {
    writeLook('Aurora', { values: {}, wallpapers: { w1: { source: '/w', values: { 'glass.roughness': 0.2 } } } });
    writeLook('Dark', { values: {}, wallpapers: { w1: { source: '/w', values: { 'glass.roughness': 0.7 } } } });
    for (const active of [
      { profile: 'Dark', wallpaper: { id: 'w1', path: '/w' } },
      { profile: 'Aurora', wallpaper: { id: 'w2', path: '/other' } },
    ]) {
      writeRuntime({ active, scratch: { 'glass.ior': 1.6 } });
      const before = storeBytes();
      const failure = await runCaptured(['context', ...command, ...expected('profile:Aurora', 'id:w1')]);
      assert.equal(failure.code, 1, failure.stderr);
      assert.match(failure.stderr, /expected .*slot/);
      assert.deepEqual(storeBytes(), before);
    }
  });
}

test('expected slots distinguish Default, named Default, no wallpaper and require both valid flags', async () => {
  writeLook('Default', { values: {}, wallpapers: { w1: { source: '/w', values: { 'glass.roughness': 0.2 } } } });
  writeRuntime({ active: { profile: 'Default', wallpaper: { id: 'w1', path: '/w' } }, scratch: {} });
  for (const guards of [expected('default', 'id:w1'), expected('profile:Default', 'none'),
    ['--expect-look', 'profile:Default'], ['--expect-wallpaper', 'id:w1'],
    expected('profile:Default', 'id:w1').concat(['--expect-look', 'profile:Default']),
    expected('Default', 'id:w1')]) {
    const before = storeBytes();
    const failure = await runCaptured(['context', 'delete', 'profile', 'Default', ...guards]);
    assert.equal(failure.code, 1, guards.join(' '));
    assert.deepEqual(storeBytes(), before);
  }
  assert.equal((await runCaptured(['context', 'rename', 'profile', 'Default', 'Saved',
    ...expected('profile:Default', 'id:w1')])).code, 0);
});

test('guarded clear and delete affect only the current look pair and preserve scratch', async () => {
  for (const look of [null, 'Aurora', 'Dark']) writeLook(look, { values: {}, wallpapers: {
    w1: { source: `/${look ?? 'default'}`, values: { 'glass.roughness': 0.2 } },
  } });
  writeRuntime({ active: { profile: 'Aurora', wallpaper: { id: 'w1', path: '/Aurora' } },
    scratch: { 'glass.ior': 1.6 } });
  const guards = expected('profile:Aurora', 'id:w1');
  assert.equal((await runCaptured(['context', 'clear', 'wallpaper', 'w1', ...guards])).code, 0);
  assert.equal(readPair('Aurora', 'w1'), null);
  assert.ok(readPair(null, 'w1'));
  assert.ok(readPair('Dark', 'w1'));
  assert.deepEqual(readScratch(), { 'glass.ior': 1.6 });
  writeLook('Aurora', { values: {}, wallpapers: { w1: { source: '/Aurora', values: { 'glass.roughness': 0.2 } } } });
  assert.equal((await runCaptured(['context', 'delete', 'wallpaper', 'w1', ...guards])).code, 0);
  assert.equal(readPair('Aurora', 'w1'), null);
  assert.deepEqual(readActive(), { profile: 'Aurora' });
  assert.deepEqual(readScratch(), { 'glass.ior': 1.6 });
});

test('guarded active profile delete removes its entire document and preserves scratch', async () => {
  writeLook('Aurora', { values: {}, wallpapers: {
    w1: { source: '/w1', values: { 'glass.roughness': 0.2 } },
    w2: { source: '/w2', values: { 'glass.roughness': 0.3 } },
  } });
  writeRuntime({ active: { profile: 'Aurora', wallpaper: { id: 'w1', path: '/w1' } },
    scratch: { 'glass.ior': 1.6 } });
  const result = await runCaptured(['context', 'delete', 'profile', 'Aurora', ...expected('profile:Aurora', 'id:w1')]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(fs.existsSync(contextPath('profile', 'Aurora')), false);
  assert.deepEqual(readActive(), { wallpaper: { id: 'w1', path: '/w1' } });
  assert.deepEqual(readScratch(), { 'glass.ior': 1.6 });
});

for (const destination of ['Aurora', null]) {
  test(`explicit ${destination ?? 'Default'} selection saves every pending key, including same-look selection`, async () => {
    writeLook(null, { values: { 'glass.roughness': 0.6 }, wallpapers: {} });
    writeLook('Aurora', { values: { 'glass.roughness': 0.4 }, wallpapers: {} });
    const scratch = { 'glass.roughness': 0.2, 'terminal.background.opacity.inactive': 0.5 };
    writeRuntime({ active: { profile: 'Aurora', wallpaper: { id: 'w1', path: '/w' } }, scratch });
    const args = destination === null ? ['deactivate', 'profile'] : ['activate', 'profile', destination];
    const selected = await runCaptured(['context', ...args]);
    assert.equal(selected.code, 0, selected.stderr);
    assert.deepEqual(readPair('Aurora', 'w1').values, scratch);
    assert.deepEqual(readScratch(), {});
    assert.equal(loadStore(defs).params['glass.roughness'], destination === null ? 0.6 : 0.2);
    assert.equal(readPair(null, 'w1'), null);
  });
}

for (const broken of ['missing', 'malformed', 'invalid-pair']) {
  for (const wallpaper of [undefined, { id: 'w1', path: '/w' }]) {
    test(`doctor remedy preserves scratch for ${broken} named look ${wallpaper ? 'with' : 'without'} wallpaper`, async () => {
      writeLook(null, { values: { 'glass.roughness': 0.4 }, wallpapers: {} });
      const file = contextPath('profile', 'Broken');
      if (broken !== 'missing') {
        writeLook('Broken', { values: {}, wallpapers: {} });
        if (broken === 'malformed') fs.writeFileSync(file, 'glass.roughness: [\n');
        else writeLook('Broken', { values: wallpaper ? {} : { 'glass.roughness': 99 },
          wallpapers: { w1: { source: '/w', values: { 'glass.roughness': 99 } } } });
      }
      const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      const scratch = { 'glass.roughness': 0.3 };
      writeRuntime({ active: { profile: 'Broken', ...(wallpaper ? { wallpaper } : {}) }, scratch });
      const diagnosis = await runCaptured(['doctor']);
      assert.equal(diagnosis.code, 1);
      assert.match(diagnosis.stdout, /prism context deactivate profile/);
      const calls = [];
      const recovered = await runCaptured(['context', 'deactivate', 'profile'], { runner: (m, f, keys) => calls.push(keys) });
      assert.equal(recovered.code, 0, recovered.stderr);
      assert.deepEqual(readScratch(), scratch);
      assert.deepEqual(readActive(), wallpaper ? { wallpaper } : {});
      assert.equal(loadStore(defs).params['glass.roughness'], 0.3);
      assert.equal(readPair(null, 'w1'), null);
      assert.deepEqual(calls, [['terminal.background.opacity.inactive'], ['terminal.background.opacity.inactive']],
        'all bound keys fan out even when their incoming value is the default');
      assert.equal(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null, original);
    });
  }
}

for (const invalid of ['base', 'scratch', 'incoming-pair', 'incoming-look']) {
  test(`recovery refuses invalid ${invalid} with zero writes`, async () => {
    writeLook(null, { values: invalid === 'base' ? { 'glass.roughness': 99 } : {},
      wallpapers: invalid === 'incoming-pair' ? { w1: { source: '/w', values: { 'glass.roughness': 99 } } } : {} });
    writeLook('Destination', { values: {}, wallpapers: {} });
    if (invalid === 'incoming-look') fs.writeFileSync(contextPath('profile', 'Destination'), '- invalid\n');
    writeRuntime({ active: { profile: 'Missing', wallpaper: { id: 'w1', path: '/w' } },
      scratch: { 'glass.roughness': invalid === 'scratch' ? 99 : 0.3 } });
    const before = storeBytes();
    const args = invalid === 'incoming-look' ? ['activate', 'profile', 'Destination'] : ['deactivate', 'profile'];
    assert.equal((await runCaptured(['context', ...args])).code, 1);
    assert.deepEqual(storeBytes(), before);
  });
}

test('named selection recovers but wallpaper rotation cannot leave a broken selected look', async () => {
  writeLook('Good', { values: { 'glass.roughness': 0.8 }, wallpapers: {} });
  writeRuntime({ active: { profile: 'Missing', wallpaper: { id: 'w1', path: '/w' } }, scratch: { 'glass.roughness': 0.3 } });
  const next = wallpaperFile('next.jpg');
  const before = storeBytes();
  assert.equal((await runCaptured(['context', 'wallpaper', next])).code, 1);
  assert.deepEqual(storeBytes(), before);
  assert.equal((await runCaptured(['context', 'activate', 'profile', 'Good'])).code, 0);
  assert.deepEqual(readScratch(), { 'glass.roughness': 0.3 });
  assert.equal(loadStore(defs).params['glass.roughness'], 0.3);
});

test('malformed incoming and outgoing pair documents are byte-preserving refusals', async () => {
  for (const bad of ['incoming', 'outgoing']) {
    writeLook(null, { values: {}, wallpapers: {} });
    writeLook('Good', { values: {}, wallpapers: {} });
    writeRuntime({ active: { wallpaper: { id: 'w1', path: '/w' } }, scratch: { 'glass.roughness': 0.3 } });
    fs.writeFileSync(bad === 'incoming' ? contextPath('profile', 'Good') : valuesPath(), '_wallpapers:\n  w1: []\n');
    const before = storeBytes();
    assert.equal((await runCaptured(['context', 'activate', 'profile', 'Good'])).code, 1);
    assert.deepEqual(storeBytes(), before);
  }
});

test('profile selection and wallpaper rotation commute with empty scratch', async () => {
  const { wallpaperId } = await import('../src/contexts.js');
  const w = wallpaperFile('next.jpg');
  const id = wallpaperId(w);
  writeLook('Aurora', { values: { 'glass.roughness': 0.4 }, wallpapers: {} });
  writeLook('Dark', { values: { 'glass.roughness': 0.8 }, wallpapers: { [id]: { source: w, values: { 'glass.roughness': 0.1 } } } });
  const initial = { active: { profile: 'Aurora', wallpaper: { id: 'old', path: '/old' } }, scratch: {} };
  writeRuntime(initial);
  assert.equal((await runCaptured(['context', 'activate', 'profile', 'Dark'])).code, 0);
  assert.equal((await runCaptured(['context', 'wallpaper', w])).code, 0);
  const first = loadStore(defs).params;
  writeRuntime(initial);
  assert.equal((await runCaptured(['context', 'wallpaper', w])).code, 0);
  assert.equal((await runCaptured(['context', 'activate', 'profile', 'Dark'])).code, 0);
  assert.deepEqual(loadStore(defs).params, first);
  assert.deepEqual(readScratch(), {});
});
