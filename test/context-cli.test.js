import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
process.env.PRISM_INTEGRATIONS_DIR = integ;

const cli = await import('../src/cli.js');
const { resolvedPath, valuesPath } = await import('../src/paths.js');
const { readActive, readContext, writeActive, writeContext } = await import('../src/contexts.js');

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(valuesPath(), '{}\n');
});

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
});

test('context show prints the file contents, _source first for a wallpaper', async () => {
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: { 'glass.ior': 1.3 } });
  const shown = await runCaptured(['context', 'show', 'wallpaper', 'abc12345']);
  assert.equal(shown.stdout, '_source: /walls/a.jpg\nglass.ior: 1.3\n');
  const missing = await runCaptured(['context', 'show', 'profile', 'nope']);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /profile nope: no such context/);
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

test('context save wallpaper requires the file and preserves its _source', async () => {
  const missing = await runCaptured(['context', 'save', 'wallpaper', 'abc12345']);
  assert.match(missing.stderr, /wallpaper abc12345: no such context/);
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });
  assert.equal(await cli.run(['context', 'save', 'wallpaper', 'abc12345'], { runner: () => {} }), 0);
  assert.equal(readContext('wallpaper', 'abc12345').source, '/walls/a.jpg');
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
