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

test('the ring sweep replaces the ring drift rate', () => {
  const defs = loadDefs(defsDir());
  const sweep = defs.get('glass.ring.sweepMs');
  assert.deepEqual([sweep.type, sweep.range, sweep.default, sweep.neutral], ['int', [0, 10000], 1500, 1500]);
  assert.equal(sweep.replaces, 'glass.ring.driftHz');
  assert.deepEqual([sweep.ui.group, sweep.ui.order, sweep.ui.unit], ['Ring', 530, 'ms']);
  assert.equal(defs.has('glass.ring.driftHz'), false);
});

test('replaces must name a key', () => {
  const dir = dirWith('- {key: a.b, type: int, range: [0, 1], default: 0, neutral: 0, replaces: 7, ui: {group: g, control: slider, step: 1, label: B, order: 1}, description: d}\n');
  assert.throws(() => loadDefs(dir), /replaces must name a key/);
  const self = dirWith('- {key: a.b, type: int, range: [0, 1], default: 0, neutral: 0, replaces: a.b, ui: {group: g, control: slider, step: 1, label: B, order: 1}, description: d}\n');
  assert.throws(() => loadDefs(self), /cannot replace itself/);
});

test('a def cannot replace a key that is still defined, and a key is replaced at most once', () => {
  const live = dirWith(
    '- {key: a.old, type: int, range: [0, 1], default: 0, neutral: 0, ui: {group: g, control: slider, step: 1, label: O, order: 1}, description: d}\n'
    + '- {key: a.new, type: int, range: [0, 1], default: 0, neutral: 0, replaces: a.old, ui: {group: g, control: slider, step: 1, label: N, order: 2}, description: d}\n');
  assert.throws(() => loadDefs(live), /a\.new replaces a\.old, which is still defined/);
  const twice = dirWith(
    '- {key: a.one, type: int, range: [0, 1], default: 0, neutral: 0, replaces: a.old, ui: {group: g, control: slider, step: 1, label: O, order: 1}, description: d}\n'
    + '- {key: a.two, type: int, range: [0, 1], default: 0, neutral: 0, replaces: a.old, ui: {group: g, control: slider, step: 1, label: N, order: 2}, description: d}\n');
  assert.throws(() => loadDefs(twice), /a\.old is replaced by both a\.one and a\.two/);
});

test('glass slider ranges and curves follow the sweep evidence', () => {
  // niri-material docs/materials/2026-09-06-glass-parameter-sweep-evidence.md, Part 2.
  const defs = loadDefs(defsDir());
  for (const key of ['glass.roughness', 'glass.inactive.roughness']) {
    assert.deepEqual(defs.get(key).range, [0, 1]);
    assert.equal(defs.get(key).ui.scale, 'power');
    assert.equal(defs.get(key).ui.exponent, 2);
    assert.equal(defs.get(key).ui.display, 'percent');
  }
  assert.deepEqual(defs.get('glass.thickness').range, [0, 100]);
  assert.equal(defs.get('glass.thickness').ui.scale, 'power');
  assert.equal(defs.get('glass.thickness').ui.exponent, 2);
  assert.deepEqual(defs.get('glass.ior').range, [1, 2]);
  assert.equal(defs.get('glass.ior').ui.scale, undefined);
  assert.deepEqual(defs.get('glass.noise').range, [0, 1]);
  assert.deepEqual(defs.get('glass.saturation').range, [0, 3]);
});

test('whole-window opacity is gone and the debug backdrop is CLI-only', () => {
  const defs = loadDefs(defsDir());
  assert.equal(defs.has('terminal.window.opacity.active'), false);
  assert.equal(defs.has('terminal.window.opacity.inactive'), false);
  assert.equal(defs.get('debug.backdrop').ui.control, 'none');
});

test('ui.state and ui.row come together, on the controls a matrix cell can draw', () => {
  const base = (ui) => `- {key: a.b, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: g, control: slider, step: 0.1, label: B, order: 1, ${ui}}, description: d}\n`;
  assert.throws(() => loadDefs(dirWith(base('state: focused'))), /ui.state requires ui.row/);
  assert.throws(() => loadDefs(dirWith(base('row: Blur'))), /ui.row requires ui.state/);
  assert.throws(() => loadDefs(dirWith(base('state: active, row: Blur'))), /ui.state must be one of focused\|unfocused/);
  const defs = loadDefs(dirWith(base('state: unfocused, row: Blur')));
  assert.equal(defs.get('a.b').ui.state, 'unfocused');
  assert.equal(defs.get('a.b').ui.row, 'Blur');
});

// The panel draws a matrix cell from any control it can render on its own, so a
// focus row is not limited to sliders. A select is excluded deliberately: an
// enum shared by both states reads as one row, which is what noise type is.
test('a matrix row may pair toggles and colors, but never a select', () => {
  const def = (type, control, extra) =>
    `- {key: a.b, type: ${type}, ${extra}neutral: ${type === 'color' ? "'#ffffff'" : type === 'bool' ? 'false' : 'x'}, ui: {group: g, control: ${control}, label: B, order: 1, state: focused, row: Blur}, description: d}\n`;

  for (const [type, control, extra] of [['bool', 'toggle', 'default: false, '], ['color', 'color', "default: '#ffffff', "]]) {
    const defs = loadDefs(dirWith(def(type, control, extra)));
    assert.equal(defs.get('a.b').ui.state, 'focused', control);
    assert.equal(defs.get('a.b').ui.row, 'Blur', control);
  }

  assert.throws(() => loadDefs(dirWith(def('enum', 'select', "values: [x, y], default: x, "))),
    /ui.state and ui.row are not supported on control select/);
});

test('ui.header marks at most one toggle per group', () => {
  const toggle = (key, ui) => `- {key: ${key}, type: bool, default: false, neutral: false, ui: {group: g, control: toggle, label: B, order: ${key.length}, ${ui}}, description: d}\n`;
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
  const dir = dirWith(`- {key: a.b, type: bool, default: true, neutral: true, ui: {group: g, control: toggle, label: B, order: 1}, description: d}\n`);
  fs.writeFileSync(path.join(dir, 'b.yaml'),
    `- {key: a.b, type: bool, default: false, neutral: false, ui: {group: g, control: toggle, label: B, order: 2}, description: d}\n`);
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
  const dir = dirWith('- {key: a.one, type: bool, default: true, neutral: true, ui: {group: A, control: toggle, label: One, order: 10}, description: d}\n');
  fs.writeFileSync(path.join(dir, 'b.yaml'),
    '- {key: a.two, type: bool, default: false, neutral: false, ui: {group: B, control: toggle, label: Two, order: 10}, description: d}\n');
  assert.throws(() => loadDefs(dir), /duplicate ui\.order 10/);
});

test('hidden definitions do not require presentation metadata', () => {
  const dir = dirWith('- {key: a.one, type: list, items: string, default: [], ui: {group: A, control: none}, description: d}\n');
  assert.doesNotThrow(() => loadDefs(dir));
});

test('slider presentation metadata is validated', () => {
  const valid = dirWith(`
- {key: a.depth, type: float, range: [0.1, 200], default: 20, neutral: 20, ui: {group: A, control: slider, label: Depth, order: 1, step: 0.1, display: normalized, scale: logarithmic}, description: d}
- {key: a.tint, type: color, default: '#ffffff', neutral: '#ffffff', ui: {group: A, control: color, label: Tint, order: 2}, description: d}
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

  const percentLog = dirWith('- {key: a.b, type: float, range: [1, 2], default: 1, neutral: 1, ui: {group: A, control: slider, label: B, order: 1, step: 0.1, display: percent, scale: logarithmic}, description: d}\n');
  assert.doesNotThrow(() => loadDefs(percentLog), 'a curved slider only changes the track; the label may still read percent');
});

test('power scale needs an exponent above one and may start at zero', () => {
  const power = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: A, control: slider, label: B, order: 1, step: 0.01, display: percent, scale: power, exponent: 2}, description: d}\n');
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

const VISIBLE = 'ui: {group: G, control: slider, step: 1, label: L, order: 1}';

test('a visible def declares exactly one of neutral and neutralize', () => {
  const neither = `- {key: a.one, type: int, range: [0, 4], default: 0, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(neither)), /a\.one.*neutral/);
  const both = `- {key: a.one, type: int, range: [0, 4], default: 0, neutral: 0, neutralize: false, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(both)), /a\.one.*neutral/);
  const one = `- {key: a.one, type: int, range: [0, 4], default: 0, neutral: 2, description: d, ${VISIBLE}}`;
  assert.equal(loadDefs(dirWith(one)).get('a.one').neutral, 2);
});

test('neutralize is false or absent, never true', () => {
  const yes = `- {key: a.one, type: int, range: [0, 4], default: 0, neutralize: true, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(yes)), /neutralize must be false/);
  const no = `- {key: a.one, type: int, range: [0, 4], default: 0, neutralize: false, description: d, ${VISIBLE}}`;
  assert.equal(loadDefs(dirWith(no)).get('a.one').neutralize, false);
});

test('a neutral is validated like any other value at load', () => {
  const high = `- {key: a.one, type: int, range: [0, 4], default: 0, neutral: 9, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(high)), /a\.one/);
  const wrongType = `- {key: a.one, type: int, range: [0, 4], default: 0, neutral: hello, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(wrongType)), /a\.one/);
  const badEnum = '- {key: a.two, type: enum, values: [x, y], default: x, neutral: z, description: d, '
    + 'ui: {group: G, control: select, label: L, order: 2}}';
  assert.throws(() => loadDefs(dirWith(badEnum)), /a\.two/);
});

test('a control:none def declares no neutral', () => {
  const invisible = '- {key: a.hidden, type: bool, default: false, neutral: false, description: d, ui: {group: G, control: none}}';
  assert.throws(() => loadDefs(dirWith(invisible)), /a\.hidden/);
  const clean = '- {key: a.hidden, type: bool, default: false, description: d, ui: {group: G, control: none}}';
  assert.equal(loadDefs(dirWith(clean)).get('a.hidden').neutral, undefined);
});

test('both halves of a matrix row declare the same neutral', () => {
  const row = (state, order, neutral) => `- {key: a.${state}, type: int, range: [0, 4], default: 0, neutral: ${neutral}, `
    + `description: d, ui: {group: G, control: slider, step: 1, label: L${order}, order: ${order}, state: ${state}, row: R}}`;
  const disagree = [row('focused', 1, 2), row('unfocused', 2, 3)].join('\n');
  assert.throws(() => loadDefs(dirWith(disagree)), /G.*R.*a\.focused.*a\.unfocused/);
  const agree = [row('focused', 1, 2), row('unfocused', 2, 2)].join('\n');
  assert.equal(loadDefs(dirWith(agree)).get('a.unfocused').neutral, 2);
});

test('two groups may reuse one row label', () => {
  const half = (group, state, order) => `- {key: ${group.toLowerCase()}.${state}, type: int, range: [0, 4], `
    + `default: 0, neutral: 1, description: d, ui: {group: ${group}, control: slider, step: 1, `
    + `label: L${order}, order: ${order}, state: ${state}, row: Blur}}`;
  const text = [half('One', 'focused', 1), half('One', 'unfocused', 2),
    half('Two', 'focused', 3), half('Two', 'unfocused', 4)].join('\n');
  assert.equal(loadDefs(dirWith(text)).size, 4);
});

test('a matrix half may not be exempt', () => {
  const half = (state, order) => `- {key: a.${state}, type: int, range: [0, 4], default: 0, neutralize: false, `
    + `description: d, ui: {group: G, control: slider, step: 1, label: L${order}, order: ${order}, `
    + `state: ${state}, row: R}}`;
  assert.throws(() => loadDefs(dirWith([half('focused', 1), half('unfocused', 2)].join('\n'))),
    /a\.focused.*must declare a neutral/);
});
