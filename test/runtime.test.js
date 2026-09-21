import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-runtime-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-runtime-'));

const { readRuntime, writeRuntime } = await import('../src/contexts.js');
const { activePath } = await import('../src/paths.js');

beforeEach(() => {
  fs.rmSync(process.env.PRISM_STATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(process.env.PRISM_STATE_DIR, { recursive: true });
});

test('runtime atomically carries selection and scratch without leaking metadata', () => {
  assert.deepEqual(readRuntime(), { active: {}, scratch: {} });
  const state = { active: { profile: 'Aurora', wallpaper: { id: 'w1', path: '/w' } },
    scratch: { 'glass.roughness': 0.3 } };
  writeRuntime(state);
  assert.deepEqual(readRuntime(), state);
  assert.deepEqual(JSON.parse(fs.readFileSync(activePath(), 'utf8')),
    { profile: 'Aurora', wallpaper: { id: 'w1', path: '/w' }, _scratch: { 'glass.roughness': 0.3 } });
  writeRuntime({ active: { profile: 'Dark' }, scratch: {} });
  assert.deepEqual(readRuntime(), { active: { profile: 'Dark' }, scratch: {} });
  assert.deepEqual(JSON.parse(fs.readFileSync(activePath(), 'utf8')), { profile: 'Dark' });
});

test('malformed runtime reads fail without rewriting bytes', () => {
  const cases = [
    ['[]', /object/],
    ['{"_scratch":[]}', /_scratch.*mapping/],
    ['{"_scratch":null}', /_scratch.*mapping/],
    ['{"other":1}', /unknown.*other/],
    ['{"profile":"bad name"}', /invalid context name/],
    ['{"wallpaper":{"id":"w1","path":"/w","extra":1}}', /unknown field extra/],
    ['{"wallpaper":{"id":"w1","path":"/w","pinned":false}}', /pinned/],
    ['{"wallpaper":{"id":"w1","path":42}}', /id and path/],
  ];
  for (const [raw, reason] of cases) {
    fs.writeFileSync(activePath(), raw);
    assert.throws(() => readRuntime(), reason, raw);
    assert.equal(fs.readFileSync(activePath(), 'utf8'), raw);
  }
});

test('invalid runtime writes preserve previous bytes, including nested metadata injection', () => {
  writeRuntime({ active: { profile: 'Valid' }, scratch: { 'glass.ior': 1.2 } });
  const original = fs.readFileSync(activePath());
  const cases = [
    { active: { _scratch: { x: 1 } }, scratch: {} },
    { active: { wallpaper: { id: 'w1', path: '/w', pinned: false } }, scratch: {} },
    { active: { profile: 'bad name' }, scratch: {} },
    { active: {}, scratch: [] },
    { active: {}, scratch: null },
    { active: null, scratch: {} },
    { active: {}, scratch: { _scratch: { x: 1 } } },
  ];
  for (const state of cases) {
    assert.throws(() => writeRuntime(state));
    assert.deepEqual(fs.readFileSync(activePath()), original);
  }
});

test('active input is rejected before filesystem access', () => {
  fs.rmSync(process.env.PRISM_STATE_DIR, { recursive: true, force: true });
  assert.throws(() => writeRuntime({ active: { _scratch: { x: 1 } }, scratch: {} }), /unknown active field _scratch/);
  assert.equal(fs.existsSync(process.env.PRISM_STATE_DIR), false);
});
