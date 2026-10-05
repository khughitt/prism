import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDry } from '../src/dry.js';
import { DRY } from '../integrations/niri/render.js';
import { integrationsDir } from '../src/paths.js';

function sinks(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-dry-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

test('the shipped dry tables are the niri sink table, each entry naming its sink', () => {
  const merged = loadDry(integrationsDir());
  assert.deepEqual(Object.keys(merged).sort(), Object.keys(DRY).sort());
  for (const [key, fields] of Object.entries(DRY)) assert.deepEqual(merged[key], { sink: 'niri', fields });
});

test('dry tables merge across sinks and a bypass key belongs to one sink', () => {
  const merged = loadDry(sinks({
    'a/dry.yaml': 'glass.bypass.one: {x: 0}\n',
    'b/dry.yaml': 'glass.bypass.two: {y: 1}\n',
    'c/manifest.yaml': 'sink: c\nbinds: []\n',
  }));
  assert.deepEqual(merged, { 'glass.bypass.one': { sink: 'a', fields: { x: 0 } }, 'glass.bypass.two': { sink: 'b', fields: { y: 1 } } });
  assert.throws(() => loadDry(sinks({
    'a/dry.yaml': 'glass.bypass.one: {x: 0}\n',
    'b/dry.yaml': 'glass.bypass.one: {x: 0}\n',
  })), /b\/dry\.yaml: glass\.bypass\.one is already declared by a\/dry\.yaml/);
});

test('a dry entry is a bypass key with at least one field', () => {
  assert.throws(() => loadDry(sinks({ 'a/dry.yaml': 'glass.ior: {x: 0}\n' })), /a\/dry\.yaml: glass\.ior is not a bypass key/);
  assert.throws(() => loadDry(sinks({ 'a/dry.yaml': 'glass.bypass.one: {}\n' })), /a\/dry\.yaml: glass\.bypass\.one must map to at least one field/);
});

test('an empty or non-map dry file is refused by name', () => {
  assert.throws(() => loadDry(sinks({ 'a/dry.yaml': '' })), /a\/dry\.yaml: dry table must be a map of bypass keys/);
  assert.throws(() => loadDry(sinks({ 'a/dry.yaml': '# nothing yet\n' })), /a\/dry\.yaml: dry table must be a map of bypass keys/);
  assert.throws(() => loadDry(sinks({ 'a/dry.yaml': '- glass.bypass.one\n' })), /a\/dry\.yaml: dry table must be a map of bypass keys/);
});

test('a missing integrations directory has no dry tables, as it has no manifests', () => {
  assert.deepEqual(loadDry(path.join(sinks({}), 'nowhere')), {});
});
