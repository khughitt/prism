import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDefs } from '../src/defs.js';
import { loadRack, validateRack } from '../src/rack.js';
import { defsDir } from '../src/paths.js';

// A small group with one matrix row, one shared select, one header toggle,
// and one bypass toggle, so every validation rule has something to bite.
const DEFS = `
- {key: t.on, type: bool, default: true, neutral: true, ui: {group: Title, control: toggle, label: On, order: 0}, description: d}
- {key: r.split, type: bool, default: true, neutral: true, ui: {group: R, control: toggle, label: Split, order: 1, header: true}, description: d}
- {key: r.blur, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Blur, order: 2, state: focused, row: Blur}, description: d}
- {key: r.inactive.blur, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused blur, order: 3, state: unfocused, row: Blur}, description: d}
- {key: r.depth, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Depth, order: 4, state: focused, row: Depth}, description: d}
- {key: r.inactive.depth, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused depth, order: 5, state: unfocused, row: Depth}, description: d}
- {key: r.kind, type: enum, values: [a, b], default: a, neutral: a, ui: {group: R, control: select, label: Kind, order: 6}, description: d}
- {key: r.bypass.one, type: bool, default: false, neutral: false, ui: {group: R, control: toggle, label: Bypass one, order: 7}, description: d}
- {key: r.bypass.two, type: bool, default: false, neutral: false, ui: {group: R, control: toggle, label: Bypass two, order: 8}, description: d}
- {key: r.amount, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Amount, order: 9}, description: d}
- {key: g.gap, type: int, range: [0, 9], default: 1, neutral: 1, ui: {group: G, control: slider, step: 1, label: Gap, order: 10}, description: d}
`;

function defsFrom(yamlText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-rack-'));
  fs.writeFileSync(path.join(dir, 'a.yaml'), yamlText);
  return loadDefs(dir);
}

const defs = defsFrom(DEFS);

// Covers every row and key in group R except the header toggle.
const complete = { group: 'R', devices: [
  { device: 'one', label: 'One', category: 'optic', mix: 'Blur', rows: [], shared: ['r.kind'], bypass: 'r.bypass.one' },
  { device: 'two', label: 'Two', category: 'post', mix: 'Depth', rows: [], shared: ['r.amount'], bypass: 'r.bypass.two', requires: 'one' },
] };

test('a complete rack validates and comes back verbatim', () => {
  assert.deepEqual(validateRack(complete, defs), complete);
});

test('the shipped rack loads against the shipped defs in shader order', () => {
  const rack = loadRack(defsDir(), loadDefs(defsDir()));
  assert.equal(rack.group, 'Focus');
  assert.deepEqual(rack.devices.map((d) => d.device), [
    'backdrop', 'distortion', 'refraction', 'fringing', 'directionalBlur', 'tint', 'iridescence', 'aurora', 'saturation', 'noise',
  ]);
  assert.deepEqual(rack.devices.filter((d) => d.requires).map((d) => [d.device, d.requires]),
    [['fringing', 'refraction'], ['directionalBlur', 'refraction']]);
  assert.deepEqual(rack.devices.find((d) => d.device === 'tint').shared, ['glass.tintSource', 'glass.tintAccentMix']);
  assert.deepEqual(rack.devices.find((d) => d.device === 'noise').shared, ['glass.noiseType']);
});

test('loadDefs still loads with the rack directory beside the def files', () => {
  const shipped = loadDefs(defsDir());
  assert.ok(shipped.has('glass.bypass.noise'));
  assert.ok(fs.existsSync(path.join(defsDir(), 'rack', 'devices.yaml')));
});

test('a row with two parameters of one state is rejected before a device can claim it', () => {
  const doubled = defsFrom(DEFS + `- {key: r.blur2, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Blur again, order: 11, state: focused, row: Blur}, description: d}\n`);
  assert.throws(() => validateRack(complete, doubled), /row Blur in group R has two focused parameters/);
});

const rackWith = (edit) => {
  const rack = structuredClone(complete);
  edit(rack);
  return rack;
};

test('the rack file shape is checked before its contents', () => {
  assert.throws(() => validateRack({ devices: complete.devices }, defs), /group must be a non-empty string/);
  assert.throws(() => validateRack({ group: 'R', devices: [] }, defs), /devices must be a non-empty list/);
});

test('device ids are camelCase and unique, categories fixed, labels present', () => {
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].device = 'One'; }), defs), /device One: bad id/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[1].device = 'one'; }), defs), /device one: duplicate id/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].category = 'light'; }), defs), /category must be one of source\|geometry\|optic\|post/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].label = ' '; }), defs), /device one: label required/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].colour = 'red'; }), defs), /device one: unknown field colour/);
});

test('rows and keys must exist in the group and belong to exactly one device', () => {
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].mix = 'Gap'; }), defs), /device one: no matrix row Gap in group R/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].rows = ['Depth']; }), defs), /device two: row Depth already belongs to one/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].shared = ['r.kind', 'r.kind']; }), defs), /device one: r.kind already belongs to one/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].shared = ['r.blur']; }), defs), /device one: no shared parameter r.blur in group R/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].shared = ['g.gap']; }), defs), /device one: no shared parameter g.gap in group R/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[1].shared = []; }), defs), /r.amount in group R belongs to no device/);
  // Rows are checked before keys, so dropping device two reports its row first.
  assert.throws(() => validateRack(rackWith((r) => { r.devices.pop(); }), defs), /row Depth in group R belongs to no device/);
});

test('bypass must be a bool toggle without state, and requires an earlier device', () => {
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].bypass = 'r.amount'; r.devices[1].shared = ['r.bypass.one']; }), defs), /device one: bypass r.amount must be a bool toggle/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].requires = 'two'; }), defs), /device one: requires must name an earlier device/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[1].requires = 'two'; }), defs), /device two: requires must name an earlier device/);
});

test('a card keeps its head: ui.when may hide a shared key but never the mix row', () => {
  const gate = ', when: {param: r.kind, in: [a], otherwise: hidden}';
  const hiddenShared = defsFrom(DEFS.replace('label: Amount, order: 9}', `label: Amount, order: 9${gate}}`));
  assert.doesNotThrow(() => validateRack(complete, hiddenShared));
  const hiddenMix = defsFrom(DEFS
    .replace('order: 2, state: focused, row: Blur}', `order: 2, state: focused, row: Blur${gate}}`)
    .replace('order: 3, state: unfocused, row: Blur}', `order: 3, state: unfocused, row: Blur${gate}}`));
  assert.throws(() => validateRack(complete, hiddenMix),
    /device one: mix row Blur cannot be hidden by ui\.when; a card has no head without it/);
});
