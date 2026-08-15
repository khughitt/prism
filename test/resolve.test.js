import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
const { resolveParams, writeResolved } = await import('../src/resolve.js');

const defs = new Map([
  ['a.x', { key: 'a.x', type: 'float', range: [0, 1], default: 0.5,
    ui: { group: 'g', control: 'slider' }, description: 'd' }],
  ['a.y', { key: 'a.y', type: 'bool', default: true,
    ui: { group: 'g', control: 'toggle' }, description: 'd' }],
]);

test('resolveParams merges default with override and validates', () => {
  assert.deepEqual(resolveParams(defs, {}), { 'a.x': 0.5, 'a.y': true });
  assert.deepEqual(resolveParams(defs, { 'a.x': 0.9 }), { 'a.x': 0.9, 'a.y': true });
  assert.throws(() => resolveParams(defs, { 'a.z': 1 }), /unknown param a\.z/);
  assert.throws(() => resolveParams(defs, { 'a.x': 7 }), /outside range/);
});

test('writeResolved persists exactly what it returns, and carries no counter', async () => {
  writeResolved(defs, {});
  const second = writeResolved(defs, { 'a.x': 0.9 });
  assert.deepEqual(second, { params: { 'a.x': 0.9, 'a.y': true } });
  assert.deepEqual(Object.keys(second), ['params'], 'no generation/sequence field');
  const { resolvedPath } = await import('../src/paths.js');
  assert.deepEqual(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')), second);
});
