import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pairs-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pairs-state-'));

const { lookPath, readLook, writeLook, readPair, listPairs } = await import('../src/contexts.js');
const { valuesPath } = await import('../src/paths.js');

beforeEach(() => {
  fs.rmSync(process.env.PRISM_CONFIG_DIR, { recursive: true, force: true });
  fs.mkdirSync(process.env.PRISM_CONFIG_DIR, { recursive: true });
});

test('Default and named Default keep independent pair values', () => {
  assert.equal(lookPath(null), valuesPath());
  assert.deepEqual(readLook(null), { values: {}, wallpapers: {} });
  assert.equal(readLook('Default'), null);
  writeLook(null, { values: {}, wallpapers: {
    w1: { source: '/w', values: { 'glass.roughness': 0.1 } },
  } });
  writeLook('Default', { values: { 'glass.roughness': 0.4 }, wallpapers: {
    w1: { source: '/w', values: { 'glass.roughness': 0.2 } },
  } });
  assert.deepEqual(readPair(null, 'w1'), { source: '/w', values: { 'glass.roughness': 0.1 } });
  assert.deepEqual(readPair('Default', 'w1'), { source: '/w', values: { 'glass.roughness': 0.2 } });
  assert.equal(readPair('Default', 'missing'), null);
  assert.throws(() => readPair('Missing', 'w1'), /Missing.*no such look/);
  assert.deepEqual(listPairs(), [
    { look: null, id: 'w1', source: '/w', values: { 'glass.roughness': 0.1 } },
    { look: 'Default', id: 'w1', source: '/w', values: { 'glass.roughness': 0.2 } },
  ]);
});

test('flat profile YAML and explicitly supplied pairs survive round trips', () => {
  fs.mkdirSync(path.dirname(lookPath('Aurora')), { recursive: true });
  fs.writeFileSync(lookPath('Aurora'), 'glass.roughness: 0.4\n');
  assert.deepEqual(readLook('Aurora'), { values: { 'glass.roughness': 0.4 }, wallpapers: {} });
  writeLook('Aurora', { values: { 'glass.roughness': 0.4 }, wallpapers: {
    w1: { source: '/w', values: { 'glass.roughness': 0.4, 'glass.ior': 1.3 } },
    w2: { source: '/other', values: {} },
  } });
  assert.deepEqual(readLook('Aurora'), { values: { 'glass.roughness': 0.4 }, wallpapers: {
    w1: { source: '/w', values: { 'glass.roughness': 0.4, 'glass.ior': 1.3 } },
    w2: { source: '/other', values: {} },
  } });
  const text = fs.readFileSync(lookPath('Aurora'), 'utf8');
  assert.match(text, /_wallpapers:/);
  assert.match(text, /_source: \/w/);
  writeLook('Empty', { values: {}, wallpapers: {} });
  assert.doesNotMatch(fs.readFileSync(lookPath('Empty'), 'utf8'), /_wallpapers/);
});

test('an inherited object name is not mistaken for a saved pair', () => {
  assert.equal(readPair(null, 'constructor'), null);
  writeLook(null, { values: {}, wallpapers: Object.fromEntries([
    ['constructor', { source: '/w', values: { 'glass.ior': 1.2 } }],
  ]) });
  assert.deepEqual(readPair(null, 'constructor'), { source: '/w', values: { 'glass.ior': 1.2 } });
});

test('malformed look metadata fails without changing file bytes', () => {
  const cases = [
    ['', /look must be a mapping/],
    ['null\n', /look must be a mapping/],
    ['- x\n', /mapping|object/],
    ['_wallpapers: []\n', /_wallpapers.*mapping/],
    ['_wallpapers:\n  w1:\n    glass.ior: 1.2\n', /_source/],
    ['_wallpapers:\n  w1: []\n', /w1.*mapping/],
    ['_wallpapers:\n  bad name:\n    _source: \/w\n', /invalid context name/],
    ['_wallpapers:\n  w1:\n    _source: 1\n', /_source/],
    ['_wallpapers:\n  w1:\n    _source: \/w\n    _extra: x\n', /_extra/],
    ['_source: \/w\n', /_source/],
  ];
  for (const [raw, reason] of cases) {
    fs.writeFileSync(valuesPath(), raw);
    assert.throws(() => readLook(null), reason, raw);
    assert.equal(fs.readFileSync(valuesPath(), 'utf8'), raw);
  }
});

test('invalid writeLook input does not make directories or overwrite a valid look', () => {
  const bad = [
    { values: {}, wallpapers: [] },
    { values: {}, wallpapers: { w1: { values: {} } } },
    { values: {}, wallpapers: { w1: { source: '/w', values: [] } } },
    { values: { _source: '/w' }, wallpapers: {} },
  ];
  for (const document of bad) {
    assert.throws(() => writeLook('Missing', document));
    assert.equal(fs.existsSync(path.dirname(lookPath('Missing'))), false);
  }
  writeLook('Valid', { values: { 'glass.ior': 1.1 }, wallpapers: {} });
  const original = fs.readFileSync(lookPath('Valid'));
  assert.throws(() => writeLook('Valid', bad[1]));
  assert.deepEqual(fs.readFileSync(lookPath('Valid')), original);
  assert.throws(() => lookPath('../escape'), /invalid context name/);
});
