import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));

const { writeActive, writeContext } = await import('../src/contexts.js');
const { writeValues } = await import('../src/values.js');
const { writeScratch } = await import('../src/scratch.js');
const layers = await import('../src/layers.js');

const defs = new Map([
  ['a.x', { key: 'a.x', type: 'float', range: [0, 1], default: 0.5,
    ui: { group: 'g', control: 'slider' }, description: 'd' }],
  ['a.y', { key: 'a.y', type: 'bool', default: true,
    ui: { group: 'g', control: 'toggle' }, description: 'd' }],
]);

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
});

test('activeName reads the id of a wallpaper entry and the name of a profile entry', () => {
  const active = { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' };
  assert.equal(layers.activeName(active, 'wallpaper'), 'abc12345');
  assert.equal(layers.activeName(active, 'profile'), 'dusk');
  assert.equal(layers.activeName({}, 'profile'), null);
});

test('loadLayers: an untuned wallpaper is an empty layer, a missing profile is an error', () => {
  assert.deepEqual(layers.loadLayers({ wallpaper: { id: 'abc12345', path: '/w' } }),
    [{ kind: 'wallpaper', name: 'abc12345', values: {} }]);
  assert.throws(() => layers.loadLayers({ profile: 'gone' }), /profile gone: active context is missing/);

  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'a.x': 0.7 } });
  writeContext('profile', 'dusk', { source: null, values: { 'a.y': false } });
  assert.deepEqual(layers.loadLayers({ profile: 'dusk', wallpaper: { id: 'abc12345', path: '/w' } }), [
    { kind: 'wallpaper', name: 'abc12345', values: { 'a.x': 0.7 } },
    { kind: 'profile', name: 'dusk', values: { 'a.y': false } },
  ]);
});

test('writeTarget is the topmost explicit layer: a loaded profile, a pinned wallpaper, else base', () => {
  assert.deepEqual(layers.writeTarget({}), { kind: 'base', name: null });
  // an automatic layer is an overlay: unpinned, it never captures edits
  assert.deepEqual(layers.writeTarget({ wallpaper: { id: 'w', path: '/w' } }), { kind: 'base', name: null });
  assert.deepEqual(layers.writeTarget({ wallpaper: { id: 'w', path: '/w', pinned: false } }), { kind: 'base', name: null });
  assert.deepEqual(layers.writeTarget({ wallpaper: { id: 'w', path: '/w', pinned: true } }), { kind: 'wallpaper', name: 'w' });
  assert.deepEqual(layers.writeTarget({ wallpaper: { id: 'w', path: '/w', pinned: true }, profile: 'p' }), { kind: 'profile', name: 'p' });
  assert.deepEqual(layers.writeTarget({ profile: 'p' }), { kind: 'profile', name: 'p' });
});

test('loadStore derives params, layerOf, target, and fallback from disk', () => {
  writeValues({ 'a.x': 0.2 });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'a.x': 0.7, 'a.y': true } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w', pinned: true } });

  const store = layers.loadStore(defs);
  assert.deepEqual(store.params, { 'a.x': 0.7, 'a.y': true });
  assert.deepEqual(store.layerOf, { 'a.x': 'wallpaper', 'a.y': 'wallpaper' });
  assert.deepEqual(store.target, { kind: 'wallpaper', name: 'abc12345' });
  // fallback is what unset would leave: the layer below, even when the override equals the default
  assert.deepEqual(store.fallback, { 'a.x': 0.2, 'a.y': true });
  assert.deepEqual(layers.activeJson(store.active),
    { wallpaper: { id: 'abc12345', path: '/w', pinned: true }, profile: null });
});

test('loadStore under an unpinned wallpaper: the overlay shows, the target is base, and fallback follows base', () => {
  writeValues({ 'a.x': 0.2 });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'a.x': 0.7 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' } });

  const store = layers.loadStore(defs);
  assert.deepEqual(store.params, { 'a.x': 0.7, 'a.y': true });
  assert.deepEqual(store.layerOf, { 'a.x': 'wallpaper', 'a.y': 'default' });
  assert.deepEqual(store.target, { kind: 'base', name: null });
  // a.x is shadowed by the wallpaper: unset from base would not change what shows
  assert.deepEqual(store.fallback, { 'a.x': 0.7, 'a.y': true });
  assert.deepEqual(layers.activeJson(store.active),
    { wallpaper: { id: 'abc12345', path: '/w', pinned: false }, profile: null });
});

test('loadStore with a profile over a pinned wallpaper targets the profile; fallback is the wallpaper value', () => {
  writeValues({ 'a.x': 0.2 });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'a.x': 0.7 } });
  writeContext('profile', 'dusk', { source: null, values: { 'a.x': 0.9 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w', pinned: true }, profile: 'dusk' });
  const store = layers.loadStore(defs);
  assert.deepEqual(store.target, { kind: 'profile', name: 'dusk' });
  assert.deepEqual(store.fallback, { 'a.x': 0.7, 'a.y': true });
});

test('loadStore with nothing active: target is base and fallback is the default for base overrides', () => {
  writeValues({ 'a.x': 0.2 });
  const store = layers.loadStore(defs);
  assert.deepEqual(store.target, { kind: 'base', name: null });
  assert.deepEqual(store.params, { 'a.x': 0.2, 'a.y': true });
  assert.deepEqual(store.fallback, { 'a.x': 0.5, 'a.y': true }, 'unset from base reveals the default');
  assert.deepEqual(layers.activeJson(store.active), { wallpaper: null, profile: null });
});

test('loadStore reads scratch as the topmost layer and reports beneath and held', () => {
  writeValues({ 'a.x': 0.2 });
  writeContext('profile', 'dusk', { source: null, values: { 'a.x': 0.9, 'a.y': true } });
  writeActive({ profile: 'dusk' });
  writeScratch({ 'a.y': false });

  const store = layers.loadStore(defs);
  assert.deepEqual(store.params, { 'a.x': 0.9, 'a.y': false });
  assert.deepEqual(store.layerOf, { 'a.x': 'profile', 'a.y': 'scratch' });
  assert.deepEqual(store.beneath, { 'a.x': 0.9, 'a.y': true }, 'the fold without scratch');
  assert.deepEqual(store.held, { 'a.x': ['base', 'profile'], 'a.y': ['profile', 'scratch'] });
  assert.deepEqual(store.scratch, { 'a.y': false });
  assert.deepEqual(store.layers.map((layer) => layer.kind), ['profile'], 'context layers only');
});

test('loadStore with nothing active: held is empty for a default and names base for an override', () => {
  writeValues({ 'a.x': 0.2 });
  const store = layers.loadStore(defs);
  assert.deepEqual(store.held, { 'a.x': ['base'], 'a.y': [] });
  assert.deepEqual(store.beneath, store.params);
});

test('loadStore validates scratch like every other layer', () => {
  writeScratch({ 'a.x': 7 });
  assert.throws(() => layers.loadStore(defs), /scratch null: a\.x: 7 outside range/);
});

test('withScratch appends scratch as the last layer', () => {
  assert.deepEqual(layers.withScratch([{ kind: 'profile', name: 'p', values: {} }], { 'a.x': 0.1 }), [
    { kind: 'profile', name: 'p', values: {} },
    { kind: 'scratch', name: null, values: { 'a.x': 0.1 } },
  ]);
});
