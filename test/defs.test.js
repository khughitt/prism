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

test('slider presentation metadata is validated', () => {
  const valid = dirWith(`
- {key: a.depth, type: float, range: [0.1, 200], default: 20, ui: {group: A, control: slider, label: Depth, order: 1, step: 0.1, display: normalized, scale: logarithmic}, description: d}
- {key: a.tint, type: color, default: '#ffffff', ui: {group: A, control: color, label: Tint, order: 2}, description: d}
`);
  assert.doesNotThrow(() => loadDefs(valid));

  const badDisplay = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, display: mystery}, description: d}\n');
  assert.throws(() => loadDefs(badDisplay), /ui\.display/);

  const nullDisplay = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, display: null}, description: d}\n');
  assert.throws(() => loadDefs(nullDisplay), /ui\.display/);

  const nullScale = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, scale: null}, description: d}\n');
  assert.throws(() => loadDefs(nullScale), /ui\.scale/);

  const badToggle = dirWith('- {key: a.b, type: bool, default: true, ui: {group: A, control: toggle, label: B, order: 1, display: raw}, description: d}\n');
  assert.throws(() => loadDefs(badToggle), /slider-only/);

  const badUnit = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, display: normalized, unit: px}, description: d}\n');
  assert.throws(() => loadDefs(badUnit), /unit.*raw/);
});

test('numeric slider grids fail early', () => {
  const noStep = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1}, description: d}\n');
  assert.throws(() => loadDefs(noStep), /finite positive ui\.step/);

  const fractionalIntRange = dirWith('- {key: a.b, type: int, range: [0.5, 10.5], default: 1, ui: {group: A, control: slider, label: B, order: 1, step: 1}, description: d}\n');
  assert.throws(() => loadDefs(fractionalIntRange), /integer range endpoints/);

  const fractionalIntStep = dirWith('- {key: a.b, type: int, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.5}, description: d}\n');
  assert.throws(() => loadDefs(fractionalIntStep), /integer ui\.step/);

  const shortLastStep = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.3}, description: d}\n');
  assert.throws(() => loadDefs(shortLastStep), /range span.*ui\.step/);

  const zeroLog = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, scale: logarithmic}, description: d}\n');
  assert.throws(() => loadDefs(zeroLog), /logarithmic.*positive/);

  const percentLog = dirWith('- {key: a.b, type: float, range: [1, 2], default: 1, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, display: percent, scale: logarithmic}, description: d}\n');
  assert.throws(() => loadDefs(percentLog), /percent.*linear/);
});
