import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCliValue, validateValue } from '../src/values.js';

const def = (over) => ({ key: 'k.k', type: 'float', range: [0, 1], default: 0.5,
  ui: { group: 'g', control: 'slider' }, description: 'd', ...over });

test('parseCliValue by declared type', () => {
  assert.equal(parseCliValue(def(), '0.65'), 0.65);
  assert.equal(parseCliValue(def({ type: 'int', range: [0, 9] }), '3'), 3);
  assert.equal(parseCliValue(def({ type: 'bool' }), 'true'), true);
  assert.equal(parseCliValue(def({ type: 'color' }), '#aabbcc'), '#aabbcc');
  assert.equal(parseCliValue(def({ type: 'enum', values: ['a', 'b'] }), 'b'), 'b');
  assert.deepEqual(parseCliValue(def({ type: 'list' }), '["x","y"]'), ['x', 'y']);
  assert.equal(parseCliValue(def({ type: 'string' }), 'as is'), 'as is');
});

test('parseCliValue rejects garbage loudly', () => {
  assert.throws(() => parseCliValue(def(), 'abc'), /k\.k/);
  assert.throws(() => parseCliValue(def({ type: 'int', range: [0, 9] }), '1.5'));
  assert.throws(() => parseCliValue(def({ type: 'bool' }), 'yes'));
  assert.throws(() => parseCliValue(def({ type: 'color' }), 'red'));
  assert.throws(() => parseCliValue(def({ type: 'enum', values: ['a'] }), 'z'));
  assert.throws(() => parseCliValue(def({ type: 'list' }), '{"a":1}'));
});

test('validateValue enforces range, type, and list element type', () => {
  assert.throws(() => validateValue(def(), 1.5), /k\.k/);
  assert.throws(() => validateValue(def({ type: 'bool' }), 'true'));
  assert.throws(() => validateValue(def({ type: 'list' }), [1, 'x']), /elements/);
  validateValue(def({ type: 'list' }), ['kitty']);
  validateValue(def(), 0.65);
});

test('readValues/writeValues round-trip via PRISM_CONFIG_DIR', async () => {
  process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
  const { readValues, writeValues } = await import('../src/values.js');
  assert.deepEqual(readValues(), {});
  writeValues({ 'a.b': 1 });
  assert.deepEqual(readValues(), { 'a.b': 1 });
});

test('readValues and writeValues reject scalar and array documents', async () => {
  process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
  const { readValues, writeValues } = await import('../src/values.js');
  const file = path.join(process.env.PRISM_CONFIG_DIR, 'values.yaml');
  fs.writeFileSync(file, 'scalar\n');
  assert.throws(() => readValues(), /object/);
  fs.writeFileSync(file, '- item\n');
  assert.throws(() => readValues(), /object/);
  assert.throws(() => writeValues('scalar'), /object/);
  assert.throws(() => writeValues(['item']), /object/);
});
