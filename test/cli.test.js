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
  'sink: gensink\nbinds:\n  - {param: terminal.blur, liveness: reload}\ngenerates: [gen.out]\n');
process.env.PRISM_INTEGRATIONS_DIR = integ;

const cli = await import('../src/cli.js');
const { lockPath, resolvedPath, valuesPath, generatedPath } = await import('../src/paths.js');
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
  await cli.run(['set', 'terminal.background.opacity.inactive', '0.65'], // 0.65 IS the default
    { runner: (m) => calls.push(m.sink) });
  assert.equal(calls.length, 2);
  let out = '';
  await cli.run(['describe', '--json'], { runner: () => {}, print: (s) => { out += s; } });
  const p = JSON.parse(out).params.find((x) => x.key === 'terminal.background.opacity.inactive');
  assert.equal(p.modified, false, 'values.yaml must stay sparse');
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

test('describe emits bindings and slowest effectiveLiveness', async () => {
  await cli.run(['set', 'terminal.background.opacity.inactive', '0.6'], { runner: () => {} });
  let out = '';
  await cli.run(['describe', '--json'], { runner: () => {}, print: (s) => { out += s; } });
  const d = JSON.parse(out);
  const p = d.params.find((x) => x.key === 'terminal.background.opacity.inactive');
  assert.equal(p.modified, true);
  assert.equal(p.value, 0.6);
  assert.equal(p.effectiveLiveness, 'reload'); // slowest of live+reload
  const unbound = d.params.find((x) => x.bindings.length === 0);
  assert.equal(unbound.effectiveLiveness, null); // glass params are unbound in this fixture
});

test('describe emits only the public counter-free JSON shape', async () => {
  let out = '';
  assert.equal(await cli.run(['describe', '--json'], { print: (s) => { out += s; } }), 0);
  const described = JSON.parse(out);
  assert.deepEqual(Object.keys(described), ['params']);
  const p = described.params.find((item) => item.key === 'terminal.background.opacity.inactive');
  assert.deepEqual(Object.keys(p), [
    'key', 'type', 'range', 'default', 'value', 'modified', 'ui', 'description',
    'bindings', 'effectiveLiveness',
  ]);
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

  fs.writeFileSync(valuesPath(), 'terminal.blur: false\n');
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
  assert.match(stderr, /fastsink: Error: fastsink down/);
  assert.match(stderr, /slowsink: Error: slowsink down/);
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
  assert.match(failedApply.stderr, /slowsink: Error: down/);
  let out = '';
  const code = await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } });
  assert.equal(code, 1);
  assert.match(out, /slowsink: failed/);
  assert.match(out, /down/, 'the sink error text must survive to the report');
  // fastsink applied cleanly and gensink was not selected: exactly one problem
  assert.doesNotMatch(out, /fastsink/);
  assert.doesNotMatch(out, /gensink/);
});

test('doctor: a sink whose snapshot drifted is stale', async () => {
  await cli.run(['apply'], { runner: () => {} });   // every sink current at the defaults
  // A pulled values.yaml changes a canonical value with no fan-out behind it —
  // the only way to reach the stale branch, since a failed apply is reported as
  // failed and never gets as far as comparing snapshots.
  fs.writeFileSync(valuesPath(), 'terminal.blur: false\n');   // default is true
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
  assert.match(out, /gone\.away/);
  assert.match(out, /unset/, 'doctor must name the way out');
});

test('orphan keys: unset digs out, every other verb fails loudly', async () => {
  fs.writeFileSync(valuesPath(), 'gone.away: 1\n');

  // resolution throws on the orphan, so these cannot work — and must not pretend to
  for (const argv of [
    ['list'],
    ['describe', '--json'],
    ['apply'],
    ['set', 'terminal.blur', 'false'],
  ]) {
    const failure = await runCaptured(argv, { runner: () => {}, print: () => {} });
    assert.notEqual(failure.code, 0);
    assert.match(failure.stderr, /unknown param gone\.away in values/);
  }

  // the one escape hatch
  assert.equal(await cli.run(['unset', 'gone.away'], { runner: () => {} }), 0);
  assert.equal(fs.readFileSync(valuesPath(), 'utf8').includes('gone.away'), false);
  assert.equal(await cli.run(['list'], { runner: () => {}, print: () => {} }), 0);

  // but unset does NOT invent keys: an undefined key absent from values.yaml is still an error
  const absent = await runCaptured(['unset', 'never.existed'], { runner: () => {} });
  assert.notEqual(absent.code, 0);
  assert.match(absent.stderr, /unknown param never\.existed/);
});

test('orphans block mutation; orphan unsets remove exactly one per invocation', async () => {
  await cli.run(['apply'], { runner: () => {} });
  const resolvedBefore = fs.readFileSync(resolvedPath(), 'utf8');
  fs.writeFileSync(valuesPath(), 'first.orphan: 1\nsecond.orphan: 2\n');

  const blocked = await runCaptured(['set', 'terminal.blur', 'false'], { runner: () => {} });
  assert.notEqual(blocked.code, 0);
  assert.match(blocked.stderr, /unknown param first\.orphan in values/);
  assert.deepEqual(fs.readFileSync(valuesPath(), 'utf8'), 'first.orphan: 1\nsecond.orphan: 2\n');
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), resolvedBefore);

  const firstUnset = await runCaptured(['unset', 'first.orphan'], { runner: () => {} });
  assert.notEqual(firstUnset.code, 0);
  assert.match(firstUnset.stderr, /unknown param second\.orphan in values/);
  assert.deepEqual(fs.readFileSync(valuesPath(), 'utf8'), 'second.orphan: 2\n');
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), resolvedBefore);

  assert.equal(await cli.run(['unset', 'second.orphan'], { runner: () => {} }), 0);
  assert.deepEqual(fs.readFileSync(valuesPath(), 'utf8'), '{}\n');
});

test('every public verb enforces its required and stray arguments', async () => {
  const invalid = [
    ['unset'], ['unset', 'terminal.blur', 'extra'],
    ['get'], ['get', 'terminal.blur', 'extra'],
    ['list', 'extra'],
    ['describe'], ['describe', '--json', 'extra'], ['describe', '--yaml'],
    ['doctor', 'extra'],
  ];
  for (const argv of invalid) {
    const failure = await runCaptured(argv, { print: () => {} });
    assert.notEqual(failure.code, 0,
      `${argv.join(' ')} unexpectedly succeeded`);
    assert.match(failure.stderr, /usage: prism/);
  }
});
