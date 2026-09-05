import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
const { resolveParams, resolveLayered, writeResolved } = await import('../src/resolve.js');

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

test('writeResolved persists exactly what it is given, and carries no counter', async () => {
  writeResolved({ 'a.x': 0.5, 'a.y': true });
  const second = writeResolved({ 'a.x': 0.9, 'a.y': true });
  assert.deepEqual(second, { params: { 'a.x': 0.9, 'a.y': true } });
  assert.deepEqual(Object.keys(second), ['params'], 'no generation/sequence field');
  const { resolvedPath } = await import('../src/paths.js');
  assert.deepEqual(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')), second);
});

test('resolveLayered merges defaults, base, then each layer in order, and names the source', () => {
  const layers = [
    { kind: 'wallpaper', name: 'w', values: { 'a.x': 0.7 } },
    { kind: 'profile', name: 'p', values: { 'a.y': false } },
  ];
  const { params, layerOf } = resolveLayered(defs, { 'a.x': 0.2 }, layers);
  assert.deepEqual(params, { 'a.x': 0.7, 'a.y': false });
  assert.deepEqual(layerOf, { 'a.x': 'wallpaper', 'a.y': 'profile' });

  const base = resolveLayered(defs, { 'a.x': 0.2 }, []);
  assert.deepEqual(base.layerOf, { 'a.x': 'base', 'a.y': 'default' });
  assert.deepEqual(resolveLayered(defs, {}, []).params, resolveParams(defs, {}));
});

test('resolveLayered validates the selected default, so a bad def cannot reach the bus', () => {
  const badDefs = new Map([['b.x', { key: 'b.x', type: 'float', range: [0, 1], default: 4,
    ui: { group: 'g', control: 'slider' }, description: 'd' }]]);
  assert.throws(() => resolveLayered(badDefs, {}, []), /b\.x: 4 outside range/);
});

test('resolveLayered validates every layer, not only the effective value', () => {
  const shadowed = [
    { kind: 'wallpaper', name: 'w', values: { 'a.x': 7 } },
    { kind: 'profile', name: 'p', values: { 'a.x': 0.4 } },
  ];
  assert.throws(() => resolveLayered(defs, {}, shadowed), /a\.x: 7 outside range/);
  assert.throws(() => resolveLayered(defs, {}, [{ kind: 'profile', name: 'p', values: { 'a.z': 1 } }]),
    /unknown param a\.z in profile p/);
});

test('resolveLayered names the offending layer in a range error, for both base and a context', () => {
  assert.throws(() => resolveLayered(defs, { 'a.x': 7 }, []),
    /values: a\.x: 7 outside range/);
  assert.throws(
    () => resolveLayered(defs, {}, [{ kind: 'profile', name: 'bad', values: { 'a.x': 7 } }]),
    /profile bad: a\.x: 7 outside range/,
  );
});
