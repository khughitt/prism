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

test('shipped defs load and default the opacity pair to a fully transparent terminal', () => {
  const defs = loadDefs(defsDir());
  assert.equal(defs.get('terminal.background.opacity.active').default, 0);
  assert.equal(defs.get('terminal.background.opacity.inactive').default, 0);
  assert.equal(defs.get('terminal.apps').ui.control, 'none');
  assert.equal(defs.get('compositor.gaps').type, 'int');
});

test('whole-window opacity is gone and the debug backdrop is CLI-only', () => {
  const defs = loadDefs(defsDir());
  assert.equal(defs.has('terminal.window.opacity.active'), false);
  assert.equal(defs.has('terminal.window.opacity.inactive'), false);
  assert.equal(defs.get('debug.backdrop').ui.control, 'none');
});

test('ui.state and ui.row come together, on sliders only', () => {
  const base = (ui) => `- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: g, control: slider, step: 0.1, label: B, order: 1, ${ui}}, description: d}\n`;
  assert.throws(() => loadDefs(dirWith(base('state: focused'))), /ui.state requires ui.row/);
  assert.throws(() => loadDefs(dirWith(base('row: Blur'))), /ui.row requires ui.state/);
  assert.throws(() => loadDefs(dirWith(base('state: active, row: Blur'))), /ui.state must be one of focused\|unfocused/);
  assert.throws(() => loadDefs(dirWith(
    `- {key: a.b, type: bool, default: false, ui: {group: g, control: toggle, label: B, order: 1, state: focused, row: Blur}, description: d}\n`,
  )), /ui.state and ui.row are slider-only/);
  const defs = loadDefs(dirWith(base('state: unfocused, row: Blur')));
  assert.equal(defs.get('a.b').ui.state, 'unfocused');
  assert.equal(defs.get('a.b').ui.row, 'Blur');
});

test('ui.header marks at most one toggle per group', () => {
  const toggle = (key, ui) => `- {key: ${key}, type: bool, default: false, ui: {group: g, control: toggle, label: B, order: ${key.length}, ${ui}}, description: d}\n`;
  assert.throws(() => loadDefs(dirWith(toggle('a.b', 'header: false'))), /ui.header must be true/);
  assert.throws(() => loadDefs(dirWith(
    `- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: g, control: slider, step: 0.1, label: B, order: 1, header: true}, description: d}\n`,
  )), /ui.header is toggle-only/);
  assert.throws(() => loadDefs(dirWith(toggle('a.b', 'header: true') + toggle('a.cd', 'header: true'))), /two header toggles/);
  assert.equal(loadDefs(dirWith(toggle('a.b', 'header: true'))).get('a.b').ui.header, true);
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
  assert.doesNotThrow(() => loadDefs(percentLog), 'a curved slider only changes the track; the label may still read percent');
});

test('power scale needs an exponent above one and may start at zero', () => {
  const power = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.01, display: percent, scale: power, exponent: 2}, description: d}\n');
  const defs = loadDefs(power);
  assert.equal(defs.get('a.b').ui.scale, 'power');
  assert.equal(defs.get('a.b').ui.exponent, 2);

  const noExponent = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, scale: power}, description: d}\n');
  assert.throws(() => loadDefs(noExponent), /power.*exponent/);

  const flatExponent = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, scale: power, exponent: 1}, description: d}\n');
  assert.throws(() => loadDefs(flatExponent), /exponent.*greater than 1/);

  const strayExponent = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, exponent: 2}, description: d}\n');
  assert.throws(() => loadDefs(strayExponent), /exponent.*power/);

  const nonSlider = dirWith('- {key: a.b, type: bool, default: true, ui: {group: A, control: toggle, label: B, order: 1, exponent: 2}, description: d}\n');
  assert.throws(() => loadDefs(nonSlider), /slider-only/);
});
