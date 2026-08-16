import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

function dirWith(yamlText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-defs-'));
  fs.writeFileSync(path.join(dir, 'a.yaml'), yamlText);
  return dir;
}

test('shipped defs load and include the opacity pair', () => {
  const defs = loadDefs(defsDir());
  assert.equal(defs.get('terminal.background.opacity.active').default, 0.95);
  assert.equal(defs.get('terminal.background.opacity.inactive').default, 0.65);
  assert.equal(defs.get('terminal.apps').ui.control, 'none');
  assert.equal(defs.get('compositor.gaps').type, 'int');
});

test('enum without values is rejected', () => {
  const dir = dirWith(`- {key: a.b, type: enum, default: x, ui: {group: g, control: select, label: B, order: 1}, description: d}\n`);
  assert.throws(() => loadDefs(dir), /enum requires values/);
});

test('list without control none is rejected', () => {
  const dir = dirWith(`- {key: a.b, type: list, items: string, default: [], ui: {group: g, control: slider, label: B, order: 1}, description: d}\n`);
  assert.throws(() => loadDefs(dir), /must declare control: none/);
});

test('list without an item type is rejected', () => {
  const dir = dirWith(`- {key: a.b, type: list, default: [], ui: {group: g, control: none}, description: d}\n`);
  assert.throws(() => loadDefs(dir), /items: string/);
});

test('numeric def without range is rejected', () => {
  const dir = dirWith(`- {key: a.b, type: float, default: 1, ui: {group: g, control: slider, label: B, order: 1}, description: d}\n`);
  assert.throws(() => loadDefs(dir), /requires range/);
});

test('duplicate keys across files are rejected', () => {
  const dir = dirWith(`- {key: a.b, type: bool, default: true, ui: {group: g, control: toggle, label: B, order: 1}, description: d}\n`);
  fs.writeFileSync(path.join(dir, 'b.yaml'),
    `- {key: a.b, type: bool, default: false, ui: {group: g, control: toggle, label: B, order: 2}, description: d}\n`);
  assert.throws(() => loadDefs(dir), /duplicate/);
});

test('visible definition requires a label', () => {
  const dir = dirWith('- {key: a.one, type: bool, default: true, ui: {group: A, control: toggle, order: 10}, description: d}\n');
  assert.throws(() => loadDefs(dir), /ui\.label required/);
});

test('visible definition requires an integer order', () => {
  const dir = dirWith('- {key: a.one, type: bool, default: true, ui: {group: A, control: toggle, label: One, order: 1.5}, description: d}\n');
  assert.throws(() => loadDefs(dir), /ui\.order must be an integer/);
});

test('visible orders are unique across files', () => {
  const dir = dirWith('- {key: a.one, type: bool, default: true, ui: {group: A, control: toggle, label: One, order: 10}, description: d}\n');
  fs.writeFileSync(path.join(dir, 'b.yaml'),
    '- {key: a.two, type: bool, default: false, ui: {group: B, control: toggle, label: Two, order: 10}, description: d}\n');
  assert.throws(() => loadDefs(dir), /duplicate ui\.order 10/);
});

test('hidden definitions do not require presentation metadata', () => {
  const dir = dirWith('- {key: a.one, type: list, items: string, default: [], ui: {group: A, control: none}, description: d}\n');
  assert.doesNotThrow(() => loadDefs(dir));
});
