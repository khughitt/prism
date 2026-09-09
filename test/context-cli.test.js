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
const { resolvedPath, valuesPath } = await import('../src/paths.js');
const { contextPath, readActive, readContext, writeActive, writeContext } = await import('../src/contexts.js');

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
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });
  writeActive({ profile: 'dusk', wallpaper: { id: 'ffff0000', path: '/walls/z.jpg' } });
  const { code, stdout } = await runCaptured(['context', 'list']);
  assert.equal(code, 0);
  assert.equal(stdout, [
    '  profile dawn',
    '* profile dusk',
    '  wallpaper abc12345  /walls/a.jpg',
    '* wallpaper ffff0000  /walls/z.jpg (untuned)',
    '',
  ].join('\n'));

  writeActive({ wallpaper: { id: 'abc12345', path: '/walls/a.jpg', pinned: true } });
  const pinned = await runCaptured(['context', 'list']);
  assert.equal(pinned.stdout.split('\n')[2], '* wallpaper abc12345  /walls/a.jpg (pinned)');
});

test('context show prints the file contents, _source first for a wallpaper', async () => {
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: { 'glass.ior': 1.3 } });
  const shown = await runCaptured(['context', 'show', 'wallpaper', 'abc12345']);
  assert.equal(shown.stdout, '_source: /walls/a.jpg\nglass.ior: 1.3\n');
  const missing = await runCaptured(['context', 'show', 'profile', 'nope']);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /profile nope: no such context/);
});

test('context list degrades on a broken context: the rest still lists and the broken one points at doctor', async () => {
  writeContext('profile', 'dawn', { source: null, values: {} });
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });
  fs.writeFileSync(contextPath('wallpaper', 'nosrc'), 'glass.ior: 1\n');
  fs.writeFileSync(contextPath('profile', 'dusk'), 'glass.ior: [\n');
  writeActive({ profile: 'dawn' });
  const { code, stdout, stderr } = await runCaptured(['context', 'list']);
  assert.equal(code, 0);
  assert.equal(stderr, '');
  const lines = stdout.split('\n');
  assert.equal(lines[0], '* profile dawn');
  assert.match(lines[1], /^! profile dusk  invalid YAML: .* — run 'prism doctor'$/);
  assert.equal(lines[2], '  wallpaper abc12345  /walls/a.jpg');
  assert.equal(lines[3], "! wallpaper nosrc  missing _source — run 'prism doctor'");
  assert.deepEqual(lines.slice(4), ['']);
});

test('context show prints a broken file as-is and says why on stderr', async () => {
  fs.mkdirSync(path.dirname(contextPath('wallpaper', 'nosrc')), { recursive: true });
  fs.writeFileSync(contextPath('wallpaper', 'nosrc'), 'glass.ior:   1   # untidy\n');
  const { code, stdout, stderr } = await runCaptured(['context', 'show', 'wallpaper', 'nosrc']);
  assert.equal(code, 0);
  assert.equal(stdout, 'glass.ior:   1   # untidy\n');
  assert.match(stderr, /wallpaper nosrc: missing _source — run 'prism doctor'/);
});

test('context save snapshots every effective parameter and touches neither resolved.json nor sinks', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ior': 1.5 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' } });
  await cli.run(['apply'], { runner: () => {} });
  const before = fs.readFileSync(resolvedPath(), 'utf8');

  const calls = [];
  assert.equal(await cli.run(['context', 'save', 'profile', 'dusk'], { runner: (m) => calls.push(m.sink) }), 0);
  assert.deepEqual(calls, []);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before);
  const saved = readContext('profile', 'dusk');
  assert.equal(saved.source, null);
  assert.equal(saved.values['glass.ior'], 1.5, 'the default-valued override is kept');
  assert.deepEqual(saved.values, JSON.parse(before).params, 'every effective parameter is written');
  assert.deepEqual(readActive(), { wallpaper: { id: 'abc12345', path: '/w' } }, 'save does not activate');
});

test('context save is for profiles: a wallpaper context holds only pinned edits', async () => {
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });
  writeActive({ wallpaper: { id: 'abc12345', path: '/walls/a.jpg', pinned: true } });
  const refused = await runCaptured(['context', 'save', 'wallpaper', 'abc12345']);
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /save is for profiles/);
  assert.deepEqual(readContext('wallpaper', 'abc12345').values, {}, 'nothing written');
});

test('saving a profile into itself while it is active is inert: effective values and sinks are unchanged', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.5 } });
  writeActive({ profile: 'dusk' });
  await cli.run(['apply'], { runner: () => {} });

  // Compare effective *values*, not the full describe shape: save writing the
  // full snapshot into the profile legitimately moves every default-valued
  // param's `layer` from `default` to `profile`, without changing any value.
  const before = JSON.parse((await runCaptured(['describe', '--json'])).stdout)
    .params.map(({ key, value }) => [key, value]);
  const resolvedBefore = fs.readFileSync(resolvedPath(), 'utf8');

  const calls = [];
  assert.equal(
    await cli.run(['context', 'save', 'profile', 'dusk'], { runner: (m) => calls.push(m.sink) }),
    0,
  );
  assert.deepEqual(calls, [], 'save must not run any sink');
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), resolvedBefore, 'save must not touch resolved.json');

  const after = JSON.parse((await runCaptured(['describe', '--json'])).stdout)
    .params.map(({ key, value }) => [key, value]);
  assert.deepEqual(after, before, 'saving the active, topmost context into itself changes no effective value');
});

test('context verbs reject the reserved kind, unknown kinds, bad names, and stray arguments', async () => {
  for (const argv of [
    ['context'], ['context', 'bogus'],
    ['context', 'list', 'extra'],
    ['context', 'show'], ['context', 'show', 'profile'], ['context', 'show', 'profile', 'a', 'b'],
    ['context', 'save', 'state', 'dark'], ['context', 'save', 'theme', 'x'], ['context', 'save', 'profile', 'a b'],
  ]) {
    const failure = await runCaptured(argv);
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
  }
  assert.match((await runCaptured(['context', 'save', 'state', 'dark'])).stderr, /kind state is reserved/);
  assert.match((await runCaptured(['context', 'save', 'theme', 'x'])).stderr, /unknown kind theme/);
  assert.match((await runCaptured(['context', 'save', 'profile', 'a b'])).stderr, /invalid context name/);
  assert.match((await runCaptured(['context'])).stderr, /usage: prism context/);
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

test('pin makes the active wallpaper the write target; a different wallpaper clears it, the same one keeps it', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');

  assert.match((await runCaptured(['context', 'pin', 'wallpaper'])).stderr, /no active wallpaper/);
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.match((await runCaptured(['context', 'unpin', 'wallpaper'])).stderr, /wallpaper is not pinned/);

  assert.equal(await cli.run(['context', 'pin', 'wallpaper'], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(a), path: a, pinned: true } });
  let out = '';
  await cli.run(['describe', '--json'], { print: (s) => { out += s; } });
  assert.equal(JSON.parse(out).target, 'wallpaper');

  // the same wallpaper arriving again (a second connector) keeps the pin
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(a), path: a, pinned: true } });

  // a different wallpaper is a new activation: the pin was about the old one
  assert.equal(await cli.run(['context', 'wallpaper', b], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(b), path: b } });
  out = '';
  await cli.run(['describe', '--json'], { print: (s) => { out += s; } });
  assert.equal(JSON.parse(out).target, 'base');

  assert.equal(await cli.run(['context', 'pin', 'wallpaper'], { runner: () => {} }), 0);
  assert.equal(await cli.run(['context', 'unpin', 'wallpaper'], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(b), path: b, pinned: false } });

  for (const argv of [['context', 'pin'], ['context', 'pin', 'profile'], ['context', 'pin', 'state'],
    ['context', 'unpin', 'wallpaper', 'extra']]) {
    const failure = await runCaptured(argv);
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
  }
  assert.match((await runCaptured(['context', 'pin', 'profile'])).stderr, /pin applies to automatic kinds/);
});

test('pinning under a loaded profile is refused, and loading a profile drops the pin', async () => {
  const a = wallpaperFile('a.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('profile', 'dusk', { source: null, values: {} });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.equal(await cli.run(['context', 'activate', 'profile', 'dusk'], { runner: () => {} }), 0);
  const refused = await runCaptured(['context', 'pin', 'wallpaper']);
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /profile dusk is active/);
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(a), path: a }, profile: 'dusk' });

  assert.equal(await cli.run(['context', 'deactivate', 'profile'], { runner: () => {} }), 0);
  assert.equal(await cli.run(['context', 'pin', 'wallpaper'], { runner: () => {} }), 0);
  assert.equal(await cli.run(['context', 'activate', 'profile', 'dusk'], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(a), path: a, pinned: false }, profile: 'dusk' },
    'the profile is now the target; the pin is a gesture about tuning the wallpaper and does not outlive it');
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
  assert.deepEqual(calls, [['terminal.background.opacity.inactive'], ['terminal.background.opacity.inactive']]);

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

// The panel has to decide whether a parameter's value comes from a layer above
// its write target. That ranking is the store's knowledge, so describe states
// it rather than leaving every client to hardcode a copy that goes stale when
// a layer is added to LAYER_ORDER.
test('describe reports the resolution order, low to high', async () => {
  const { RESOLUTION_ORDER } = await import('../src/layers.js');
  assert.deepEqual(RESOLUTION_ORDER, ['default', 'base', 'wallpaper', 'state', 'profile']);

  const wallpaper = wallpaperFile('order.jpg');
  assert.equal(await cli.run(['context', 'wallpaper', wallpaper], { runner: () => {} }), 0);
  const model = JSON.parse((await runCaptured(['describe', '--json'])).stdout);

  assert.deepEqual(model.layers, RESOLUTION_ORDER);
  assert.ok(model.layers.includes(model.target), 'the target must be rankable against the order');
  for (const param of model.params) {
    assert.ok(model.layers.includes(param.layer), `${param.key} reports unrankable layer ${param.layer}`);
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
