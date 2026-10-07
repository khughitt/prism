import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));

// Fixture sinks: real integrations/ is empty until Task 10, so fan-out
// would otherwise select nothing and every calls-length assertion would fail.
const integ = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-integ-'));
fs.mkdirSync(path.join(integ, 'fastsink'));
fs.writeFileSync(path.join(integ, 'fastsink', 'manifest.yaml'),
  'sink: fastsink\nbinds:\n  - {param: terminal.background.opacity.inactive, liveness: live}\n');
fs.mkdirSync(path.join(integ, 'slowsink'));
fs.writeFileSync(path.join(integ, 'slowsink', 'manifest.yaml'),
  'sink: slowsink\nbinds:\n  - {param: terminal.background.opacity.inactive, liveness: reload}\n');
// A sink that declares a generated target, for the bootstrap check. It binds a
// param no other test touches, so it never perturbs the fan-out call counts.
fs.mkdirSync(path.join(integ, 'gensink'));
fs.writeFileSync(path.join(integ, 'gensink', 'manifest.yaml'),
  'sink: gensink\nbinds:\n  - {param: glass.paneLip, liveness: reload}\ngenerates: [gen.out]\n');
process.env.PRISM_INTEGRATIONS_DIR = integ;

const cli = await import('../src/cli.js');
const { readValues } = await import('../src/values.js');
const { readScratch, writeScratch } = await import('../src/scratch.js');
const { lockPath, resolvedPath, valuesPath, generatedPath, scratchPath, activePath, stateDir } = await import('../src/paths.js');
const { writeActive, writeContext, contextPath, readContext } = await import('../src/contexts.js');
const { VERB_KINDS } = await import('../src/contexts.js');
const { MODES } = await import('../src/reset.js');
const { findCommand } = await import('../src/commands.js');
const prismBin = fileURLToPath(new URL('../bin/prism', import.meta.url));

// Every test starts from an identical clean store and arranges what it needs.
// Node runs a file's top-level tests sequentially, so implicit ordering
// "works" — right up until someone runs one test with --test-name-pattern and
// it fails for a reason that has nothing to do with the code. Shared setup
// belongs here; per-test preconditions belong in the test.
const genFile = generatedPath('gen.out');
beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(valuesPath(), '{}\n');     // sparse store: no overrides
  fs.mkdirSync(path.dirname(genFile), { recursive: true });
  fs.writeFileSync(genFile, 'generated\n');   // gensink's declared target
});

async function runCaptured(argv, opts = {}) {
  let stderr = '';
  const code = await cli.run(argv, { ...opts, eprint: (text) => { stderr += text; } });
  return { code, stderr };
}

test('set writes values, resolves, and reports the changed key to fan-out', async () => {
  const calls = [];
  const code = await cli.run(['set', 'terminal.background.opacity.inactive', '0.6'],
    { runner: (m, f, keys) => calls.push([m.sink, keys]) });
  assert.equal(code, 0);
  const resolved = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8'));
  assert.equal(resolved.params['terminal.background.opacity.inactive'], 0.6);
  assert.deepEqual(calls.map(([s]) => s).sort(), ['fastsink', 'slowsink']);
  for (const [, keys] of calls) assert.deepEqual(keys, ['terminal.background.opacity.inactive']);
});

test('set fans out to every bound sink regardless of liveness class', async () => {
  const calls = [];
  await cli.run(['set', 'terminal.background.opacity.inactive', '0.55'],
    { runner: (m) => calls.push(m.sink) });
  assert.deepEqual(calls.sort(), ['fastsink', 'slowsink']);
});

test('set with unchanged value still fans out (release contract)', async () => {
  await cli.run(['set', 'terminal.background.opacity.inactive', '0.55'], { runner: () => {} });
  const calls = [];   // now set the SAME value again: the drag-then-release case
  await cli.run(['set', 'terminal.background.opacity.inactive', '0.55'],
    { runner: (m) => calls.push(m.sink) });
  assert.equal(calls.length, 2, 'unchanged set must still fan out');
});

test('set back to the default deletes the override but still fans out', async () => {
  const calls = [];
  await cli.run(['set', 'terminal.background.opacity.inactive', '0'], // 0 IS the default
    { runner: (m) => calls.push(m.sink) });
  assert.equal(calls.length, 2);
  let out = '';
  await cli.run(['describe', '--json'], { runner: () => {}, print: (s) => { out += s; } });
  const p = JSON.parse(out).params.find((x) => x.key === 'terminal.background.opacity.inactive');
  assert.equal(p.layer, 'default', 'values.yaml must stay sparse');
});

test('set rejects out-of-range values, unknown keys, and stray flags without touching state', async () => {
  await cli.run(['set', 'terminal.background.opacity.inactive', '0.5'], { runner: () => {} });
  const before = fs.readFileSync(resolvedPath(), 'utf8');   // a known-good baseline to compare against
  const outOfRange = await runCaptured(
    ['set', 'terminal.background.opacity.inactive', '1.5'], { runner: () => {} });
  assert.notEqual(outOfRange.code, 0);
  assert.match(outOfRange.stderr, /outside range/);
  const unknown = await runCaptured(['set', 'no.such.key', '1'], { runner: () => {} });
  assert.notEqual(unknown.code, 0);
  assert.match(unknown.stderr, /unknown param no\.such\.key/);
  // the removed --liveness flag must be an error, not silently ignored: a caller
  // still passing it is running against an older contract and should hear about it
  const stray = await runCaptured(
    ['set', 'terminal.background.opacity.inactive', '0.5', '--liveness', 'live'],
    { runner: () => {} });
  assert.notEqual(stray.code, 0);
  assert.match(stray.stderr, /usage: prism set/);
  const missing = await runCaptured(
    ['set', 'terminal.background.opacity.inactive'], { runner: () => {} });
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /usage: prism set/);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before);
});

test('describe emits bindings and slowest effectiveLiveness', async (t) => {
  t.after(() => {
    fs.rmSync(path.join(integ, 'draglive'), { recursive: true, force: true });
    fs.rmSync(path.join(integ, 'dragreload'), { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(integ, 'draglive'));
  fs.writeFileSync(path.join(integ, 'draglive', 'manifest.yaml'),
    'sink: draglive\nbinds:\n'
    + '  - {param: glass.jellyRipple, liveness: live}\n'
    + '  - {param: terminal.background.opacity.active, liveness: live, drag: release}\n'
    + '  - {param: glass.ior, liveness: live}\n');
  fs.mkdirSync(path.join(integ, 'dragreload'));
  fs.writeFileSync(path.join(integ, 'dragreload', 'manifest.yaml'),
    'sink: dragreload\nbinds:\n'
    + '  - {param: glass.ior, liveness: reload}\n');

  await cli.run(['set', 'terminal.background.opacity.inactive', '0.6'], { runner: () => {} });
  let out = '';
  await cli.run(['describe', '--json'], { runner: () => {}, print: (s) => { out += s; } });
  const d = JSON.parse(out);
  const p = d.params.find((x) => x.key === 'terminal.background.opacity.inactive');
  assert.equal(p.layer, 'scratch');
  assert.equal(p.value, 0.6);
  assert.equal(p.effectiveLiveness, 'reload'); // slowest of live+reload
  assert.deepEqual(d.params.find((x) => x.key === 'glass.jellyRipple').effectiveDrag, 'live');
  assert.deepEqual(d.params.find((x) => x.key === 'terminal.background.opacity.active').effectiveDrag, 'release');
  assert.deepEqual(d.params.find((x) => x.key === 'glass.ior').effectiveDrag, 'release');
  const unbound = d.params.find((x) => x.key === 'glass.thickness');
  assert.equal(unbound.effectiveDrag, null);
  assert.equal(unbound.effectiveLiveness, null);
  assert.equal(d.params.find((x) => x.key === 'glass.jellyRipple').effectiveLiveness, 'live');
  assert.equal(d.params.find((x) => x.key === 'terminal.background.opacity.active').effectiveLiveness, 'live');
  assert.equal(d.params.find((x) => x.key === 'glass.ior').effectiveLiveness, 'reload');
  assert.deepEqual(d.params.find((x) => x.key === 'terminal.background.opacity.active').bindings,
    [{ sink: 'draglive', liveness: 'live' }]);
});

test('describe emits only the public counter-free JSON shape', async () => {
  let out = '';
  assert.equal(await cli.run(['describe', '--json'], { print: (s) => { out += s; } }), 0);
  const described = JSON.parse(out);
  assert.deepEqual(Object.keys(described), ['active', 'profiles', 'layers', 'rack', 'params']);
  assert.deepEqual(described.active, { wallpaper: null, profile: null });
  assert.deepEqual(described.profiles, [], 'no saved profiles is an empty list, not an absent field');
  assert.deepEqual(described.layers, ['default', 'base', 'profile', 'wallpaper', 'state', 'scratch']);
  const p = described.params.find((item) => item.key === 'glass.ior');
  assert.deepEqual(Object.keys(p), [
    'key', 'type', 'range', 'default', 'neutral', 'held', 'value', 'layer', 'fallback', 'ui', 'description',
    'bindings', 'effectiveLiveness', 'effectiveDrag',
  ]);
  assert.equal(p.layer, 'default');
  assert.equal(p.fallback, p.value);
});

test('describe carries the resolved rack', async (t) => {
  // requires and the ownership checks come from the sinks' dry tables and
  // manifest nodes, so this one reads the real integrations.
  const restore = process.env.PRISM_INTEGRATIONS_DIR;
  process.env.PRISM_INTEGRATIONS_DIR = fileURLToPath(new URL('../integrations/', import.meta.url));
  t.after(() => { process.env.PRISM_INTEGRATIONS_DIR = restore; });
  let out = '';
  await cli.run(['describe', '--json'], { runner: () => {}, print: (s) => { out += s; } });
  const { rack } = JSON.parse(out);
  assert.equal(rack.group, 'Focus');
  assert.deepEqual(rack.shared, ['slab', 'ripple', 'ring']);
  assert.deepEqual(rack.devices.map((d) => d.device), [
    'backdrop', 'distortion', 'refraction', 'fringing', 'directionalBlur', 'saturation', 'noise', 'tint', 'aurora',
    'reflection', 'edgeHighlight', 'iridescence',
  ]);
  assert.deepEqual(rack.devices[3], {
    device: 'fringing', label: 'Fringing', stage: 'fringing', mix: 'Fringing',
    rows: [], shared: [], bypass: 'glass.bypass.fringing',
    site: 'taps', scope: 'material', family: 'transmission', requires: 'refraction',
    interactions: [{ kind: 'requires', device: 'refraction', why: 'the glass.bypass.refraction dry entry writes chromatic-aberration', source: 'dry' }],
  });
  assert.equal(Object.hasOwn(rack.devices[0], 'requires'), false);
  assert.deepEqual(rack.devices[0].interactions, [{
    kind: 'attenuates', device: 'refraction',
    why: rack.devices[0].interactions[0].why,
    source: 'schema',
  }]);
  assert.match(rack.devices[0].interactions[0].why, /roughness/);
});

test('get, list, and describe read through the active layers', async () => {
  fs.writeFileSync(valuesPath(), 'glass.paneLip: 8\nglass.ior: 1.24\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.paneLip': 6 } });
  writeActive({ profile: 'dusk' });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ior': 1.3 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });

  let out = '';
  assert.equal(await cli.run(['get', 'glass.ior'], { print: (s) => { out += s; } }), 0);
  assert.equal(out, '1.3\n');
  out = '';
  assert.equal(await cli.run(['list'], { print: (s) => { out += s; } }), 0);
  assert.match(out, /^glass\.paneLip = 6$/m);
  assert.match(out, /^glass\.ior = 1\.3$/m);

  out = '';
  await cli.run(['describe', '--json'], { print: (s) => { out += s; } });
  const d = JSON.parse(out);
  assert.deepEqual(d.active, { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  assert.equal(d.target, undefined, 'the target is always scratch and is not stated');
  assert.deepEqual(d.layers, ['default', 'base', 'profile', 'wallpaper', 'state', 'scratch']);
  const lip = d.params.find((x) => x.key === 'glass.paneLip');
  assert.deepEqual([lip.value, lip.layer, lip.fallback, lip.held], [6, 'profile', 6, ['base', 'profile']]);
  const ior = d.params.find((x) => x.key === 'glass.ior');
  assert.deepEqual([ior.value, ior.layer, ior.fallback, ior.held], [1.3, 'wallpaper', 1.3, ['base', 'wallpaper']]);
});

test('a missing active profile fails every reading verb, describe included', async () => {
  writeActive({ profile: 'gone' });
  for (const argv of [['get', 'glass.ior'], ['list'], ['describe', '--json'], ['apply']]) {
    const failure = await runCaptured(argv, { runner: () => {}, print: () => {} });
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
    assert.match(failure.stderr, /profile gone: active context is missing/);
  }
});

test('apply resolves through the layers', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.paneLip': 11 } });
  writeActive({ profile: 'dusk' });
  assert.equal(await cli.run(['apply'], { runner: () => {} }), 0);
  const resolved = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8'));
  assert.equal(resolved.params['glass.paneLip'], 11);
});

test('doctor reports a missing active profile, a broken context file, and context orphans', async () => {
  await cli.run(['apply'], { runner: () => {} });
  let out = '';
  writeActive({ profile: 'gone' });
  assert.equal(await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } }), 1);
  assert.match(out, /doctor: profile gone: active context is missing — run 'prism context deactivate profile'/);

  writeActive({});
  fs.mkdirSync(path.dirname(contextPath('profile', 'bad')), { recursive: true });
  fs.writeFileSync(contextPath('profile', 'bad'), '- not\n- flat\n');
  writeActive({});
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'gone.away': 1 } });
  writeActive({ profile: 'vanished' });
  // an inactive context with a known key holding an invalid value must not pass diagnosis
  writeContext('profile', 'hot', { source: null, values: { 'glass.ior': 99 } });
  out = '';
  assert.equal(await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } }), 1);
  assert.match(out, /doctor: profile bad: .*look must be a mapping/);
  assert.match(out, /doctor: orphan value gone\.away in base \/ wallpaper abc12345: no definition — edit /);
  assert.match(out, /doctor: profile hot: glass\.ior: 99 outside range/);
});

test('doctor screens values.yaml for invalid values, naming the file the way it names a context', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 99\n');
  let out = '';
  assert.equal(await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } }), 1);
  assert.match(out, /doctor: base: glass\.ior: 99 outside range/);
});

test('reading verbs take the store lock, so they wait for an in-flight write', async () => {
  const { withLock } = await import('../src/lock.js');
  let release;
  const held = withLock(lockPath(), () => new Promise((resolve) => { release = resolve; }));
  await new Promise((r) => setTimeout(r, 20)); // let the holder acquire
  let finished = false;
  const reader = cli.run(['describe', '--json'], { print: () => {} }).then(() => { finished = true; });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(finished, false, 'describe must not read past the lock');
  release();
  await held;
  await reader;
  assert.equal(finished, true);
});

test('requirements takes the store lock too, so the pinned repair never writes outside it', async () => {
  const { withLock } = await import('../src/lock.js');
  let order = [];
  const holding = withLock(lockPath(), async () => {
    order.push('locked');
    await new Promise((resolve) => setTimeout(resolve, 60));
    order.push('released');
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const reading = cli.run(['requirements'], { print: () => {} }).then(() => order.push('read'));
  await Promise.all([holding, reading]);
  assert.deepEqual(order, ['locked', 'released', 'read']);
});

test('entrypoint flushes complete describe JSON to piped stdout', () => {
  const reader = "let s=''; process.stdin.on('data', d => s += d); "
    + "process.stdin.on('end', () => JSON.parse(s));";
  const child = spawnSync('/bin/sh', [
    '-c', '"$1" "$2" describe --json | "$1" -e "$3"',
    'sh', process.execPath, prismBin, reader,
  ], {
    encoding: 'utf8',
    env: process.env,
  });

  assert.equal(child.status, 0, child.stderr);
});

test('apply re-resolves from values.yaml alone (recovery contract)', async () => {
  await cli.run(['set', 'terminal.background.opacity.inactive', '0.6'], { runner: () => {} });
  fs.rmSync(resolvedPath()); // simulate crash / fresh checkout: only values.yaml survives
  const code = await cli.run(['apply'], { runner: () => {} });
  assert.equal(code, 0);
  const resolved = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8'));
  assert.equal(resolved.params['terminal.background.opacity.inactive'], 0.6);
});

test('apply targets only validated sink names and passes every bound target key', async () => {
  const calls = [];
  assert.equal(await cli.run(['apply', 'fastsink'], {
    runner: (m, f, keys) => calls.push([m.sink, keys]),
  }), 0);
  assert.deepEqual(calls, [[
    'fastsink',
    ['terminal.background.opacity.inactive'],
  ]]);

  fs.writeFileSync(valuesPath(), 'glass.paneLip: 10\n');
  const before = fs.readFileSync(resolvedPath(), 'utf8');
  const missing = await runCaptured(['apply', 'missing-sink'], { runner: () => {} });
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /unknown sink missing-sink/);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before,
    'an invalid target must fail before recovery state changes');
});

test('store commits happen under the store lock and fan-out happens after it', async () => {
  for (const argv of [
    ['set', 'terminal.background.opacity.inactive', '0.6'],
    ['apply', 'fastsink'],
  ]) {
    const lockStates = [];
    assert.equal(await cli.run(argv, {
      runner: () => lockStates.push(fs.existsSync(lockPath())),
    }), 0);
    assert.ok(lockStates.length > 0);
    assert.equal(lockStates.every((locked) => !locked), true,
      `${argv[0]} fan-out ran under the store lock`);
  }
});

test('failed fan-out reports every sink error after committing state', async () => {
  const { code, stderr } = await runCaptured(
    ['set', 'terminal.background.opacity.inactive', '0.42'], {
      runner: (m) => { throw new Error(`${m.sink} down`); },
    });
  assert.equal(code, 1);
  assert.match(stderr, /fastsink: fastsink down/);
  assert.match(stderr, /slowsink: slowsink down/);
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8'))
    .params['terminal.background.opacity.inactive'], 0.42);
});

test('doctor: healthy sink stays healthy after an unrelated change', async () => {
  await cli.run(['apply'], { runner: () => {} });            // all fixture sinks now current
  await cli.run(['set', 'compositor.gaps', '30'], { runner: () => {} }); // touches no fixture sink
  const code = await cli.run(['doctor'], { runner: () => {}, print: () => {} });
  assert.equal(code, 0, 'unbound-param change must not mark sinks stale');
});

test('doctor: a never-applied sink is unhealthy', async () => {
  let out = '';
  const code = await cli.run(['doctor'], { print: (s) => { out += s; } });
  assert.equal(code, 1);
  assert.match(out, /fastsink: never applied/);
  assert.match(out, /slowsink: never applied/);
  assert.match(out, /gensink: never applied/);
});

test('doctor: a sink whose apply failed reports its error', async () => {
  await cli.run(['apply'], { runner: () => {} });   // every sink has a current, ok record
  const failedApply = await runCaptured(['set', 'terminal.background.opacity.inactive', '0.42'],
    { runner: (m) => { if (m.sink === 'slowsink') throw new Error('down'); } });
  assert.equal(failedApply.code, 1);
  assert.match(failedApply.stderr, /slowsink: down/);
  let out = '';
  const code = await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } });
  assert.equal(code, 1);
  assert.match(out, /slowsink: failed/);
  assert.match(out, /down/, 'the sink error text must survive to the report');
  // fastsink applied cleanly and gensink was not selected: exactly one problem
  assert.doesNotMatch(out, /fastsink/);
  assert.doesNotMatch(out, /gensink/);
});

// requirements is doctor's requirement pass on its own: dotfiles' setup preflight
// runs it before ~/.config/prism is linked or any sink has applied, when doctor
// would stop at missing generated files first. A missing store resolves to the
// defaults, so `when` still evaluates on a fresh machine.
test('requirements reports only unmet declared requirements and exits 1 on any', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-req-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'reqsink'));
  fs.writeFileSync(path.join(dir, 'reqsink', 'manifest.yaml'), [
    'sink: reqsink',
    'requires:',
    '  - {command: definitely-not-installed, when: debug.backdrop, fix: install it}',
    'binds:',
    '  - {param: debug.backdrop, liveness: live}',
    '',
  ].join('\n'));

  const restore = process.env.PRISM_INTEGRATIONS_DIR;
  process.env.PRISM_INTEGRATIONS_DIR = dir;
  t.after(() => { process.env.PRISM_INTEGRATIONS_DIR = restore; });

  const requirements = async () => {
    let out = '';
    const code = await cli.run(['requirements'], { runner: () => {}, print: (text) => { out += text; } });
    return { code, out };
  };

  // No store yet: debug.backdrop takes its default, false, so nothing applies.
  let result = await requirements();
  assert.equal(result.code, 0);
  assert.equal(result.out, 'requirements: ok\n');

  await cli.run(['set', 'debug.backdrop', 'true'], { runner: () => {} });
  result = await requirements();
  assert.equal(result.code, 1);
  assert.equal(result.out, 'requirements: reqsink: definitely-not-installed is not installed — install it\n');
  assert.doesNotMatch(result.out, /generated file missing/);
});

// doctor exists so a machine learns what it is missing without first
// provoking a failed apply.
test('doctor reports an unmet requirement, and says nothing when its when is false', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-req-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'reqsink'));
  fs.writeFileSync(path.join(dir, 'reqsink', 'manifest.yaml'), [
    'sink: reqsink',
    'requires:',
    '  - {command: definitely-not-installed, when: debug.backdrop, fix: install it}',
    'binds:',
    '  - {param: debug.backdrop, liveness: live}',
    '',
  ].join('\n'));

  const restore = process.env.PRISM_INTEGRATIONS_DIR;
  process.env.PRISM_INTEGRATIONS_DIR = dir;
  t.after(() => { process.env.PRISM_INTEGRATIONS_DIR = restore; });

  const doctorOutput = async () => {
    let out = '';
    await cli.run(['doctor'], { runner: () => {}, print: (text) => { out += text; } });
    return out;
  };

  // debug.backdrop defaults to false, so the requirement does not apply.
  assert.doesNotMatch(await doctorOutput(), /definitely-not-installed/);

  await cli.run(['set', 'debug.backdrop', 'true'], { runner: () => {} });
  assert.match(await doctorOutput(),
    /doctor: reqsink: definitely-not-installed is not installed — install it/);
});

test('doctor: a sink whose snapshot drifted is stale', async () => {
  await cli.run(['apply'], { runner: () => {} });   // every sink current at the defaults
  // A pulled values.yaml changes a canonical value with no fan-out behind it —
  // the only way to reach the stale branch, since a failed apply is reported as
  // failed and never gets as far as comparing snapshots.
  fs.writeFileSync(valuesPath(), 'glass.paneLip: 10\n');   // default is 6
  let out = '';
  const code = await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } });
  assert.equal(code, 1);
  assert.match(out, /gensink: stale/);
  // the drift is confined to gensink's bound param: nothing else may be flagged
  assert.doesNotMatch(out, /fastsink/);
  assert.doesNotMatch(out, /slowsink/);
});

test('doctor: a missing generated target is a distinct, hard failure', async (t) => {
  // Register restoration BEFORE the delete: an assertion below that throws must
  // not leave the fixture missing for whatever runs next.
  t.after(() => fs.writeFileSync(genFile, 'generated\n'));

  await cli.run(['apply'], { runner: () => {} });   // everything current and materialized
  assert.equal(await cli.run(['doctor'], { runner: () => {}, print: () => {} }), 0);
  fs.rmSync(genFile);                               // simulates a fresh host / wiped state dir
  let out = '';
  const code = await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } });
  assert.equal(code, 1);
  assert.match(out, /gensink/);
  assert.match(out, /gen\.out/);
  assert.match(out, /missing/i, 'must not read as an ordinary stale-sink report');
});

test('doctor: an orphan values key is reported by name with its remedy', async () => {
  // written wholesale, not appended — appending to a `{}` values file would
  // produce invalid YAML and fail for the wrong reason
  fs.writeFileSync(valuesPath(), 'gone.away: 1\n');
  let out = '';
  const code = await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } });
  assert.equal(code, 1);
  assert.match(out, /doctor: orphan value gone\.away: no definition — run 'prism unset --base gone\.away'/);
});

test('doctor screens scratch.yaml for orphans and invalid values, naming the file', async () => {
  await cli.run(['apply'], { runner: () => {} });
  writeScratch({ 'gone.away': 1, 'glass.ior': 99 });
  let out = '';
  const code = await cli.run(['doctor'], { print: (t) => { out += t; }, runner: () => {} });
  assert.equal(code, 1);
  assert.match(out, /doctor: orphan value gone\.away in scratch: no definition — run 'prism unset gone\.away'/);
  assert.match(out, /doctor: scratch: glass\.ior: 99 outside range/);
});

test('orphan keys: unset digs out, every other verb fails loudly', async () => {
  fs.writeFileSync(valuesPath(), 'gone.away: 1\n');

  // resolution throws on the orphan, so these cannot work — and must not pretend to
  for (const argv of [
    ['list'],
    ['describe', '--json'],
    ['apply'],
    ['set', 'glass.paneLip', '10'],
  ]) {
    const failure = await runCaptured(argv, { runner: () => {}, print: () => {} });
    assert.notEqual(failure.code, 0);
    assert.match(failure.stderr, /unknown param gone\.away in values/);
  }

  // the one escape hatch
  assert.equal(await cli.run(['unset', '--base', 'gone.away'], { runner: () => {} }), 0);
  assert.equal(fs.readFileSync(valuesPath(), 'utf8').includes('gone.away'), false);
  assert.equal(await cli.run(['list'], { runner: () => {}, print: () => {} }), 0);

  // but unset does NOT invent keys: an undefined key absent from values.yaml is still an error
  const absent = await runCaptured(['unset', 'never.existed'], { runner: () => {} });
  assert.notEqual(absent.code, 0);
  assert.match(absent.stderr, /unknown param never\.existed/);
});

test('orphan unset validates the whole next base state before writing', async () => {
  await cli.run(['apply'], { runner: () => {} });
  const resolvedBefore = fs.readFileSync(resolvedPath(), 'utf8');
  fs.writeFileSync(valuesPath(), 'first.orphan: 1\nsecond.orphan: 2\n');

  const blocked = await runCaptured(['set', 'glass.paneLip', '10'], { runner: () => {} });
  assert.notEqual(blocked.code, 0);
  assert.match(blocked.stderr, /unknown param first\.orphan in values/);
  assert.deepEqual(fs.readFileSync(valuesPath(), 'utf8'), 'first.orphan: 1\nsecond.orphan: 2\n');
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), resolvedBefore);

  const firstUnset = await runCaptured(['unset', '--base', 'first.orphan'], { runner: () => {} });
  assert.notEqual(firstUnset.code, 0);
  assert.match(firstUnset.stderr, /unknown param second\.orphan in values/);
  assert.deepEqual(fs.readFileSync(valuesPath(), 'utf8'), 'first.orphan: 1\nsecond.orphan: 2\n');
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), resolvedBefore);

  fs.writeFileSync(valuesPath(), 'second.orphan: 2\n');
  assert.equal(await cli.run(['unset', '--base', 'second.orphan'], { runner: () => {} }), 0);
  assert.deepEqual(fs.readFileSync(valuesPath(), 'utf8'), '{}\n');
});

test('every public verb enforces its required and stray arguments as usage errors', async () => {
  const invalid = [
    ['unset'], ['unset', 'compositor.gaps', 'extra'],
    ['get'], ['get', 'compositor.gaps', 'extra'],
    ['list', 'extra'],
    ['describe', '--json', 'extra'], ['describe', '--yaml'],
    ['doctor', 'extra'],
    ['requirements', 'extra'],
    ['set', '--base'], ['set', '--base', 'glass.ior'], ['unset', '--base'],
  ];
  for (const argv of invalid) {
    let stdout = '';
    const failure = await runCaptured(argv, { print: (text) => { stdout += text; } });
    assert.equal(failure.code, 2, `${argv.join(' ')}: ${failure.stderr}`);
    assert.equal(stdout, '');
    assert.match(failure.stderr, /usage: prism/);
  }
  // describe no longer needs --json: the global output mode picks the rendering
  let pretty = '';
  assert.equal(await cli.run(['describe'], { print: (text) => { pretty += text; } }), 0);
  assert.match(pretty, /^wallpaper: none\nprofile: none\nedits: 0\n/);
  assert.throws(() => JSON.parse(pretty));
});

test('set writes scratch above every layer, and a wallpaper on screen never captures it', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/walls/a.jpg' }, profile: 'dusk' });
  const calls = [];
  assert.equal(await cli.run(['set', 'glass.ior', '1.7'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
  assert.equal(readContext('wallpaper', 'abc12345'), null, 'no wallpaper file appears');
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ior': 1.3 }, 'the profile is untouched');
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), 'glass.ior: 1.24\n', 'base untouched');
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.7);
  assert.deepEqual(calls, [], 'no fixture sink binds glass.ior');
});

test('set normalizes: a value the fold beneath already shows is no edit', async () => {
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.3 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  assert.equal(await cli.run(['set', 'glass.ior', '1.5'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.5 });
  assert.equal(await cli.run(['set', 'glass.ior', '1.3'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), {});
  assert.equal(fs.existsSync(scratchPath()), false);
  assert.equal(await cli.run(['set', 'glass.ior', '1.5'], { runner: () => {} }), 0);
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.4 } });
  assert.equal(await cli.run(['set', 'glass.ior', '1.5'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.5 });
});

test('set --base writes through to values.yaml, bypassing scratch', async () => {
  writeContext('profile', 'dusk', { source: null, values: {} });
  writeActive({ profile: 'dusk' });
  assert.equal(await cli.run(['set', '--base', 'glass.ior', '1.1'], { runner: () => {} }), 0);
  assert.match(fs.readFileSync(valuesPath(), 'utf8'), /glass\.ior: 1\.1/);
  assert.deepEqual(readScratch(), {});
  assert.deepEqual(readContext('profile', 'dusk').values, {});
});

test('unset removes the edit from scratch and refuses a key that is not edited', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ profile: 'dusk' });
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });

  const calls = [];
  assert.equal(await cli.run(['unset', 'glass.ior'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readScratch(), {});
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.3, 'the profile shows through');
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ior': 1.3 }, 'a revert never touches the profile');

  const absent = await runCaptured(['unset', 'glass.ior'], { runner: () => {} });
  assert.notEqual(absent.code, 0);
  assert.match(absent.stderr, /glass\.ior: not edited/);

  await cli.run(['set', '--base', 'glass.ior', '1.1'], { runner: () => {} });
  assert.equal(await cli.run(['unset', '--base', 'glass.ior'], { runner: () => {} }), 0);
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), '{}\n');
  const absentBaseFlag = await runCaptured(['unset', '--base', 'glass.ior'], { runner: () => {} });
  assert.match(absentBaseFlag.stderr, /glass\.ior: not set in base/);
});

test('unset digs an orphan out of scratch the way it does for base', async () => {
  writeScratch({ 'gone.away': 1 });
  const blocked = await runCaptured(['set', 'glass.paneLip', '10'], { runner: () => {} });
  assert.match(blocked.stderr, /unknown param gone\.away in scratch null/);
  assert.equal(await cli.run(['unset', 'gone.away'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), {});
});

test('orphan unset validates the next scratch state before writing', async () => {
  writeScratch({ 'gone.away': 1, 'still.gone': 2 });
  const before = fs.readFileSync(activePath(), 'utf8');
  const blocked = await runCaptured(['unset', 'gone.away'], { runner: () => {} });
  assert.match(blocked.stderr, /unknown param still\.gone in scratch null/);
  assert.equal(fs.readFileSync(activePath(), 'utf8'), before);
});

// Every machine runs bin/prism before `npm ci` has ever run there: node_modules
// is gitignored and carries com.dropbox.ignored, so it never arrives with a
// sync. The entry point owes that machine the install command, not a trace.
test('entrypoint names the dependency install when node_modules is absent', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-nodeps-'));
  fs.mkdirSync(path.join(fixture, 'bin'));
  fs.mkdirSync(path.join(fixture, 'src'));
  fs.writeFileSync(path.join(fixture, 'package.json'), '{"type":"module"}\n');
  fs.copyFileSync(prismBin, path.join(fixture, 'bin', 'prism'));
  fs.writeFileSync(path.join(fixture, 'src', 'cli.js'),
    "import 'yaml';\nexport const run = () => 0;\n");

  const child = spawnSync(process.execPath, [path.join(fixture, 'bin', 'prism')], {
    encoding: 'utf8',
  });

  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /Node dependencies are not installed/);
  assert.match(child.stderr, /npm ci --prefix/);
  assert.doesNotMatch(child.stderr, /ERR_MODULE_NOT_FOUND/);
});

test('describe carries the neutral contract and held layers', async () => {
  let out = '';
  await cli.run(['set', '--base', 'glass.paneLip', '9'], { runner: () => {} });
  const code = await cli.run(['describe', '--json'], { print: (t) => { out += t; }, runner: () => {} });
  assert.equal(code, 0);
  const model = JSON.parse(out);
  const byKey = Object.fromEntries(model.params.map((param) => [param.key, param]));

  assert.equal(byKey['glass.paneLip'].neutral, 8);
  assert.equal(byKey['glass.paneLip'].neutralize, undefined);
  assert.equal(byKey['glass.focusSplit'].neutralize, false);
  assert.equal(byKey['glass.focusSplit'].neutral, undefined);
  assert.equal(byKey['terminal.apps'].neutral, undefined);

  assert.deepEqual(byKey['glass.paneLip'].held, ['base']);
  assert.deepEqual(byKey['glass.paneShiftX'].held, []);
  assert.equal(byKey['glass.paneLip'].heldInTarget, undefined);
});

test('an edited key reports every layer holding it, scratch last, and its fallback is the fold beneath', async () => {
  await cli.run(['set', '--base', 'glass.paneLip', '9'], { runner: () => {} });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.paneLip': 30 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  await cli.run(['set', 'glass.paneLip', '12'], { runner: () => {} });

  let out = '';
  await cli.run(['describe', '--json'], { print: (t) => { out += t; }, runner: () => {} });
  const param = JSON.parse(out).params.find((p) => p.key === 'glass.paneLip');
  assert.equal(param.layer, 'scratch');
  assert.equal(param.value, 12);
  assert.deepEqual(param.held, ['base', 'wallpaper', 'scratch']);
  assert.equal(param.fallback, 30, 'revert reveals the wallpaper, not base');
});

test('reset neutral writes the curated values once and fans out once', async () => {
  const calls = [];
  await cli.run(['set', '--base', 'glass.paneLip', '30'], { runner: () => {} });
  const code = await cli.run(['reset', 'neutral', '--group', 'Glass'],
    { runner: (m, f, keys) => calls.push([m.sink, keys]) });
  assert.equal(code, 0);
  const values = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params;
  assert.equal(values['glass.paneLip'], 8);
  assert.equal(values['glass.jellyRipple'], 0);
  assert.equal(values['compositor.gaps'], 24);
  // gensink binds glass.paneLip; each affected sink is called at most once.
  assert.deepEqual(calls.map(([sink]) => sink), ['gensink']);
  assert.equal(calls[0][1].includes('glass.paneLip'), true);
});

test('reset neutral leaves the exempt parameter alone', async () => {
  await cli.run(['set', '--base', 'glass.focusSplit', 'false'], { runner: () => {} });
  await cli.run(['reset', 'neutral'], { runner: () => {} });
  assert.equal(readValues()['glass.focusSplit'], false);
});

test('reset symmetric mirrors focused onto unfocused', async () => {
  await cli.run(['set', '--base', 'glass.roughness', '0.3'], { runner: () => {} });
  await cli.run(['reset', 'symmetric', '--group', 'Focus'], { runner: () => {} });
  const values = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params;
  assert.equal(values['glass.inactive.roughness'], 0.3);
  assert.equal(values['glass.roughness'], 0.3);
});

test('symmetric copies what is on screen, or the base value under --base', async () => {
  await cli.run(['set', '--base', 'glass.roughness', '0.3'], { runner: () => {} });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.roughness': 0.7 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });

  // The source is the on-screen wallpaper; --base selects the base value instead.
  await cli.run(['reset', 'symmetric', '--group', 'Focus'], { runner: () => {} });
  assert.equal(readScratch()['glass.inactive.roughness'], 0.7, 'mirrors the resolved value into scratch');

  await cli.run(['reset', 'symmetric', '--base', '--group', 'Focus'], { runner: () => {} });
  assert.equal(readValues()['glass.inactive.roughness'], 0.3, 'mirrors the base value alone');
});

test('reset revert removes scratch keys in scope and leaves every persisted layer alone', async () => {
  fs.writeFileSync(valuesPath(), 'glass.paneLip: 9\n');
  writeContext('profile', 'p1', { source: null, values: { 'glass.paneLip': 12 } });
  writeActive({ profile: 'p1' });
  await cli.run(['set', 'glass.paneLip', '30'], { runner: () => {} });
  await cli.run(['set', 'glass.roughness', '0.4'], { runner: () => {} });
  await cli.run(['reset', 'revert', '--group', 'Glass'], { runner: () => {} });
  assert.deepEqual(readScratch(), { 'glass.roughness': 0.4 }, 'only the Glass edit is reverted');
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.paneLip'], 12, 'the profile shows through');
  assert.deepEqual(readContext('profile', 'p1').values, { 'glass.paneLip': 12 });
  assert.equal(readValues()['glass.paneLip'], 9);
});

test('reset revert --base removes base overrides: the way back to the shipped defaults', async () => {
  await cli.run(['set', '--base', 'glass.paneLip', '9'], { runner: () => {} });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.paneLip': 30 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  await cli.run(['reset', 'revert', '--base', '--group', 'Glass'], { runner: () => {} });
  assert.equal('glass.paneLip' in readValues(), false);
  assert.equal(readContext('wallpaper', 'w1').values['glass.paneLip'], 30, 'a base reset leaves the delta alone');
});

test('neutral writes scratch above a loaded profile and leaves its file byte-identical', async () => {
  fs.writeFileSync(valuesPath(), 'glass.roughness: 0.3\n');
  writeContext('profile', 'p1', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ profile: 'p1' });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.roughness': 0.7 } });
  writeActive({ profile: 'p1', wallpaper: { id: 'w1', path: '/w.png' } });
  const before = fs.readFileSync(contextPath('profile', 'p1'), 'utf8');
  const result = await runCaptured(['reset', 'neutral', '--group', 'Focus'], { runner: () => {} });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(readScratch()['glass.roughness'], 0);
  assert.equal(readScratch()['glass.ior'], 1, 'the profile value is not neutral, so scratch overrides it');
  assert.equal(fs.readFileSync(contextPath('profile', 'p1'), 'utf8'), before);
  assert.equal(readContext('wallpaper', 'w1').values['glass.roughness'], 0.7);
  assert.equal(readValues()['glass.roughness'], 0.3);
});

test('a neutral value the fold beneath already supplies is not stored in scratch', async () => {
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.roughness': 0 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  await cli.run(['set', 'glass.roughness', '0.4'], { runner: () => {} });
  await cli.run(['reset', 'neutral', '--group', 'Focus'], { runner: () => {} });
  assert.equal('glass.roughness' in readScratch(), false, 'the delta is already neutral, so the edit simply goes');
});

test('a reset that changes no contents writes nothing and calls no sink', async () => {
  // Nothing is edited, so revert has nothing to remove.
  writeContext('wallpaper', 'w1', {
    source: '/w.png',
    values: { 'glass.paneLip': 30 },
  });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  fs.rmSync(resolvedPath(), { force: true });

  const calls = [];
  const code = await cli.run(['reset', 'revert', '--group', 'Glass'],
    { runner: (m) => calls.push(m.sink) });
  assert.equal(code, 0);
  assert.deepEqual(calls, []);
  assert.equal(fs.existsSync(resolvedPath()), false, 'resolved.json is not rewritten');
});

test('reset refuses a store it cannot resolve, and writes nothing', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 99\n');   // out of range
  const before = fs.readFileSync(valuesPath(), 'utf8');
  const calls = [];
  const out = await runCaptured(['reset', 'neutral'], { runner: (m) => calls.push(m.sink) });
  assert.equal(out.code, 1);
  assert.match(out.stderr, /glass\.ior/);
  // The whole mutation is computed before anything is written, so a refusal
  // leaves no partial batch behind.
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), before);
  assert.deepEqual(calls, []);
});

// The declared value sets are what the parser enforces, so they must be the same lists
// the verbs implement against, or the table would admit a mode or kind the code refuses.
test('the declared enums are the runtime constants', () => {
  assert.deepEqual(findCommand(['reset']).args[0].values, MODES);
  for (const verb of ['show', 'activate', 'deactivate', 'delete', 'rename']) {
    assert.deepEqual(findCommand(['context', verb]).args[0].values, VERB_KINDS, verb);
  }
  assert.deepEqual(findCommand(['context', 'clear']).args[0].values, ['wallpaper']);
});

test('reset rejects an unknown group and a bad mode', async () => {
  const bad = await runCaptured(['reset', 'neutral', '--group', 'Nope'], { runner: () => {} });
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /unknown group Nope/);
  assert.match(bad.stderr, /Focus/);

  const mode = await runCaptured(['reset', 'sideways'], { runner: () => {} });
  assert.equal(mode.code, 2);
  assert.match(mode.stderr, /mode must be one of revert, symmetric, neutral, got "sideways"/);
});

test('reset --base writes beneath an overlay', async () => {
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.paneLip': 8 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  await cli.run(['set', '--base', 'glass.paneLip', '30'], { runner: () => {} });
  // The overlay already sits at the neutral; --base must still act on base.
  await cli.run(['reset', 'neutral', '--base', '--group', 'Glass'], { runner: () => {} });
  // paneLip neutralizes to 8 against a default of 6, so base holds 8 rather
  // than losing the key.
  assert.equal(readValues()['glass.paneLip'], 8);
});

test('reset rejects a group with only hidden parameters', async () => {
  const result = await runCaptured(['reset', 'neutral', '--group', 'Terminal']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /unknown group Terminal; groups with visible parameters:/);
  assert.match(result.stderr, /Glass/);
});

test('reset visits each affected sink once and leaves hidden values alone', async () => {
  await cli.run(['set', 'glass.paneLip', '30'], { runner: () => {} });
  await cli.run(['set', 'debug.backdrop', 'true'], { runner: () => {} });
  const calls = [];
  const result = await runCaptured(['reset', 'revert'], {
    runner: (manifest, file, keys) => calls.push({ sink: manifest.sink, keys }),
  });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(calls.map((call) => call.sink), ['gensink']);
  for (const call of calls) assert.deepEqual(call.keys, ['glass.paneLip']);
  assert.deepEqual(readScratch(), { 'debug.backdrop': true });
});


for (const mode of ['neutral', 'symmetric']) {
  test(`an already-${mode} reset leaves both files and sinks untouched`, async () => {
    const first = await runCaptured(['reset', mode], { runner: () => {} });
    assert.equal(first.code, 0, first.stderr);
    const before = [valuesPath(), resolvedPath()].map((file) => ({
      text: fs.readFileSync(file, 'utf8'), inode: fs.statSync(file).ino,
    }));
    const calls = [];
    const result = await runCaptured(['reset', mode], { runner: (manifest) => calls.push(manifest.sink) });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(calls, []);
    assert.deepEqual([valuesPath(), resolvedPath()].map((file) => ({
      text: fs.readFileSync(file, 'utf8'), inode: fs.statSync(file).ino,
    })), before);
  });
}

test('migrate rewrites the replaced ring key everywhere, backs the files up, reports, and is idempotent', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ring.sweepMs: 9000\nglass.ior: 1.3\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.sweepMs': 0 } });
  writeContext('profile', 'plain', { source: null, values: { 'glass.ior': 1.4 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.sweepMs': 1200, 'glass.ring.beamSpeed': 450 } });
  const base = fs.readFileSync(valuesPath());
  const originals = [
    [valuesPath(), base, 'values.yaml'],
    [contextPath('profile', 'dusk'), fs.readFileSync(contextPath('profile', 'dusk')), 'contexts/profile/dusk.yaml'],
  ];

  let out = '';
  assert.equal(await cli.run(['migrate'], { print: (s) => {
    out += s;
    const backup = s.match(/^migrate: backup (.+)$/)?.[1];
    if (!backup) return;
    for (const [original, text, relative] of originals) {
      assert.deepEqual(fs.readFileSync(original), text, `${relative} changed before migration`);
      assert.deepEqual(fs.readFileSync(path.join(backup, relative)), text, `${relative} missing from backup`);
    }
  } }), 0);
  const backup = out.match(/^migrate: backup (.+)$/m)[1];
  assert.ok(backup.startsWith(path.join(process.env.PRISM_STATE_DIR, 'migrations', '')), backup);
  assert.match(out, /^migrate: base: glass\.ring\.sweepMs 9000 -> glass\.ring\.beamSpeed 4350$/m);
  assert.match(out, /^migrate: profile dusk: glass\.ring\.sweepMs 0 -> glass\.ring\.beamSpeed 0$/m);
  assert.match(out, /^migrate: base \/ wallpaper abc12345: glass\.ring\.sweepMs 1200 removed; glass\.ring\.beamSpeed 450 kept$/m);
  assert.match(out, /^migrate: done — run 'prism apply' to hand the new keys to the sinks$/m);
  assert.doesNotMatch(out, /plain/);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'values.yaml')), base);
  assert.deepEqual(readValues(), { 'glass.ring.beamSpeed': 4350, 'glass.ior': 1.3 });
  assert.deepEqual(readContext('wallpaper', 'abc12345').values, { 'glass.ring.beamSpeed': 450 });

  out = '';
  assert.equal(await cli.run(['migrate'], { print: (s) => { out += s; } }), 0);
  assert.equal(out, 'migrate: nothing to migrate\n');
  assert.equal(fs.readdirSync(path.join(process.env.PRISM_STATE_DIR, 'migrations')).length, 1);
});

test('migrate includes scratch with a backup inside the migration directory', async () => {
  writeScratch({ 'glass.ring.sweepMs': 0, 'glass.ior': 1.4 });
  const original = fs.readFileSync(activePath(), 'utf8');
  let doctor = '';
  assert.equal(await cli.run(['doctor'], { print: (s) => { doctor += s; }, runner: () => {} }), 1);
  assert.match(doctor, /pending migration: glass\.ring\.sweepMs in scratch is replaced by glass\.ring\.beamSpeed/);

  let out = '';
  assert.equal(await cli.run(['migrate'], { print: (s) => { out += s; } }), 0);
  const backup = out.match(/^migrate: backup (.+)$/m)[1];
  assert.deepEqual(fs.readFileSync(path.join(backup, 'state', 'active.json'), 'utf8'), original);
  assert.deepEqual(readScratch(), { 'glass.ring.beamSpeed': 0, 'glass.ior': 1.4 });
  assert.match(out, /^migrate: scratch: glass\.ring\.sweepMs 0 -> glass\.ring\.beamSpeed 0$/m);
  assert.deepEqual(fs.readdirSync(backup), ['state']);
});

test('scratch-only migration failure names only its state restore destination', async (t) => {
  writeScratch({ 'glass.ring.sweepMs': 0 });
  const originalWrite = fs.writeFileSync;
  t.after(() => { fs.writeFileSync = originalWrite; });

  let backup;
  const failure = await runCaptured(['migrate'], { print: (s) => {
    backup = s.match(/^migrate: backup ([^\n]+)/)?.[1] ?? backup;
    if (backup) fs.writeFileSync = (file, ...args) => {
      if (path.basename(String(file)).startsWith('.active.json.')) throw new Error('injected scratch write failure');
      return originalWrite(file, ...args);
    };
  } });
  assert.equal(failure.code, 1);
  assert.ok(backup);
  assert.ok(failure.stderr.includes('copy state/active.json back to the runtime document to undo'), failure.stderr);
  assert.doesNotMatch(failure.stderr, /copy config files/);
});

test('migrate takes no arguments and aborts whole on a context that does not parse', async () => {
  const usage = await runCaptured(['migrate', 'now']);
  assert.equal(usage.code, 2);
  assert.match(usage.stderr, /target must be one of pairs, got "now"/);

  fs.writeFileSync(valuesPath(), 'glass.ring.sweepMs: 9000\n');
  fs.mkdirSync(path.dirname(contextPath('profile', 'bad')), { recursive: true });
  fs.writeFileSync(contextPath('profile', 'bad'), '- not\n- flat\n');
  const failure = await runCaptured(['migrate'], { print: () => {} });
  assert.equal(failure.code, 1);
  assert.match(failure.stderr, /look must be a mapping/);
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), 'glass.ring.sweepMs: 9000\n', 'base untouched');
  assert.equal(fs.existsSync(path.join(process.env.PRISM_STATE_DIR, 'migrations')), false, 'no backup made');
});

test('migrate reports the backup before a later physical-file write fails', async (t) => {
  fs.writeFileSync(valuesPath(), 'glass.ring.sweepMs: 9000\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.sweepMs': 0 } });
  const original = fs.readFileSync(contextPath('profile', 'dusk'));
  const rename = fs.renameSync;
  t.after(() => { fs.renameSync = rename; });
  fs.renameSync = (from, to) => {
    if (to === contextPath('profile', 'dusk')) throw new Error('injected profile failure');
    return rename(from, to);
  };
  let out = '';
  const failure = await runCaptured(['migrate'], { print: (s) => { out += s; } });
  assert.equal(failure.code, 1);
  const backup = out.match(/^migrate: backup (.+)$/m)[1];
  assert.match(out, /^migrate: base: glass\.ring\.sweepMs 9000 -> glass\.ring\.beamSpeed 4350$/m);
  assert.match(failure.stderr, /migrate: profile dusk: injected profile failure/);
  assert.ok(failure.stderr.includes(backup));
  assert.deepEqual(readValues(), { 'glass.ring.beamSpeed': 4350 });
  assert.deepEqual(fs.readFileSync(contextPath('profile', 'dusk')), original);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'values.yaml'), 'utf8'), 'glass.ring.sweepMs: 9000\n');
});

test('doctor names a pending migration in base and in a context, and is quiet once it has run', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ring.sweepMs: 9000\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.sweepMs': 0 } });
  let out = '';
  assert.equal(await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } }), 1);
  assert.match(out, /^doctor: pending migration: glass\.ring\.sweepMs in base is replaced by glass\.ring\.beamSpeed — run 'prism migrate'$/m);
  assert.match(out, /^doctor: pending migration: glass\.ring\.sweepMs in profile dusk is replaced by glass\.ring\.beamSpeed — run 'prism migrate'$/m);
  assert.doesNotMatch(out, /orphan value glass\.ring\.sweepMs/);

  assert.equal(await cli.run(['migrate'], { print: () => {} }), 0);
  assert.equal(await cli.run(['apply'], { runner: () => {} }), 0);
  out = '';
  await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } });
  assert.doesNotMatch(out, /pending migration/);
});

test('Focus neutral overrides profile tint through scratch without rewriting saved tuning', async () => {
  fs.writeFileSync(valuesPath(), 'glass.tintSource: manual\nglass.tintAccentMix: 0.2\n');
  writeContext('profile', 'Dusk', { source: null, values: {
    'glass.tintSource': 'noctalia', 'glass.tintAccentMix': 0.4 } });
  writeActive({ profile: 'Dusk' });
  const saved = contextPath('profile', 'Dusk');
  const beforeBase = fs.readFileSync(valuesPath(), 'utf8');
  const beforeProfile = fs.readFileSync(saved, 'utf8');
  let described = '';
  assert.equal(await cli.run(['describe', '--json'],
    { print: (text) => { described += text; } }), 0);
  const byKey = Object.fromEntries(JSON.parse(described).params.map((p) => [p.key, p]));
  assert.equal(byKey['glass.tintSource'].value, 'noctalia');
  assert.equal(byKey['glass.tintAccentMix'].value, 0.4);
  const out = await runCaptured(['reset', 'neutral', '--group', 'Focus'], { runner: () => {} });
  assert.equal(out.code, 0, out.stderr);
  assert.equal(readScratch()['glass.tintSource'], 'manual');
  assert.equal(readScratch()['glass.tintAccentMix'], 0);
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), beforeBase);
  assert.equal(fs.readFileSync(saved, 'utf8'), beforeProfile);
});

test('describe carries a sink-reported color as effective on that param only', async () => {
  fs.mkdirSync(path.join(stateDir(), 'effective'), { recursive: true });
  fs.writeFileSync(path.join(stateDir(), 'effective', 'niri.json'),
    JSON.stringify({ 'glass.ring.color': { value: '#a1b2c3', from: 'the Noctalia palette' } }));
  try {
    let out = '';
    await cli.run(['describe', '--json'], { print: (s) => { out += s; } });
    const params = JSON.parse(out).params;
    assert.deepEqual(params.find((p) => p.key === 'glass.ring.color').effective,
      { value: '#a1b2c3', from: 'the Noctalia palette' });
    assert.equal(Object.hasOwn(params.find((p) => p.key === 'glass.attenuationColor'), 'effective'), false);
  } finally {
    fs.rmSync(path.join(stateDir(), 'effective'), { recursive: true, force: true });
  }
});
