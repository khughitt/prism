import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

// The native grammar this sink targets, transcribed from the accepted niri
// package's docs/materials/material-config.md. Prism may narrow a range but
// must never offer a value the compositor rejects.
const NATIVE = {
  'glass.ior': { range: [1, 3], default: 1.5 },
  'glass.thickness': { range: [0, 200], default: 20 },
  'glass.attenuationColor': { default: '#dfe8ff' },
  'glass.attenuationDistance': { range: [1, 65535], default: 60 },
  'glass.chromaticAberration': { range: [0, 1], default: 0 },
  'glass.distortion': { range: [0, 1], default: 0 },
  'glass.distortionScale': { range: [0.01, 2], default: 0.5 },
  'glass.anisotropicBlur': { range: [0, 1], default: 0 },
  'glass.roughness': { range: [0, 1], default: 0.08 },
  'glass.backdropBlur': { default: false },
  'glass.jellyFlex': { range: [0, 0.02], default: 0.004 },
  'glass.jellyRipple': { range: [0, 0.5], default: 0.06 },
  'glass.paneLip': { range: [0, 64], default: 6 },
  'glass.paneShiftX': { range: [-64, 64], default: 6 },
  'glass.paneShiftY': { range: [-64, 64], default: 6 },
  'glass.enabled': { default: true },
  'glass.focusSplit': { default: true },
  'glass.inactive.roughness': { range: [0, 1], default: 0.5 },
  'glass.inactive.attenuationDistance': { range: [1, 65535], default: 70 },
  'glass.inactive.chromaticAberration': { range: [0, 1], default: 0.08 },
  'glass.inactive.distortion': { range: [0, 1], default: 0.1 },
  'glass.inactive.anisotropicBlur': { range: [0, 1], default: 0 },
  'glass.noise': { range: [0, 1], default: 0 },
  'glass.inactive.noise': { range: [0, 1], default: 0.02 },
  'glass.saturation': { range: [0, 3], default: 1 },
  'glass.inactive.saturation': { range: [0, 3], default: 0.85 },
};

const REMOVED = [
  'glass.gridOverlay', 'glass.calibrate', 'glass.probeExposure',
  'glass.samples', 'glass.springDampingRatio',
  'glass.springStiffness', 'glass.springEpsilon',
  'terminal.blur', 'terminal.saturation.active', 'terminal.saturation.inactive',
  'terminal.window.opacity.active', 'terminal.window.opacity.inactive',
  'terminal.noise.active', 'terminal.noise.inactive',
];

// Native units, not the legacy normalized presentation of the retired shader.
const NATIVE_UNITS = [
  'glass.thickness', 'glass.attenuationDistance', 'glass.chromaticAberration',
  'glass.distortion', 'glass.distortionScale',
  'glass.inactive.attenuationDistance', 'glass.inactive.chromaticAberration',
  'glass.inactive.distortion',
];

const NATIVE_BEVEL_MAX = 128;

test('the glass surface is exactly the parameters native niri consumes', () => {
  const defs = loadDefs(defsDir());
  const glass = [...defs.keys()].filter((key) => key.startsWith('glass.'));

  assert.deepEqual(glass.slice().sort(), [...Object.keys(NATIVE), 'glass.noiseType'].sort());
});

test('noise type is a shared Focus select with an explicit Prism default', () => {
  const defs = loadDefs(defsDir());
  const def = defs.get('glass.noiseType');
  assert.equal(def.type, 'enum');
  assert.deepEqual(def.values, ['white', 'fine', 'lightness']);
  assert.equal(def.default, 'fine');
  assert.deepEqual(def.ui, { group: 'Focus', control: 'select', label: 'Noise type', order: 275 });
  assert.ok(defs.get('glass.inactive.noise').ui.order < def.ui.order);
  assert.ok(def.ui.order < defs.get('glass.saturation').ui.order);
});

test('every glass definition matches the native range and default', () => {
  const defs = loadDefs(defsDir());

  for (const [key, native] of Object.entries(NATIVE)) {
    const def = defs.get(key);
    assert.ok(def, `missing def ${key}`);
    assert.deepEqual(def.default, native.default, `${key} default`);
    if (native.range) {
      assert.ok(def.range[0] >= native.range[0] && def.range[1] <= native.range[1],
        `${key} range [${def.range}] leaves the native [${native.range}]`);
    }
  }
});

test('the derived bevel cannot leave the native range at any supported value', () => {
  const defs = loadDefs(defsDir());
  const lip = defs.get('glass.paneLip').range;
  const x = defs.get('glass.paneShiftX').range;
  const y = defs.get('glass.paneShiftY').range;
  const widest = Math.max(...[...x, ...y].map(Math.abs));

  // bevel = paneLip + max(abs(offsets)); niri rejects bevel > 128 and any
  // offset wider than the bevel. The second rule holds for every combination
  // exactly while the lip cannot go negative, so that is what we pin.
  assert.ok(lip[0] >= 0,
    'a negative pane lip could derive a bevel narrower than its own offset');
  assert.ok(lip[1] + widest <= NATIVE_BEVEL_MAX,
    `derived bevel may reach ${lip[1] + widest}, above the native maximum`);
});

test('parameters with no native consumer are gone, with no hidden alias', () => {
  const defs = loadDefs(defsDir());

  for (const key of REMOVED) {
    assert.equal(defs.has(key), false, `${key} still has a definition`);
  }
});

test('no definition carries preview metadata', () => {
  const defs = loadDefs(defsDir());

  for (const def of defs.values()) {
    assert.equal(Object.hasOwn(def.ui, 'affectsPreview'), false,
      `${def.key} still declares ui.affectsPreview`);
  }
});

test('native values are presented in native units', () => {
  const defs = loadDefs(defsDir());

  for (const key of NATIVE_UNITS) {
    const def = defs.get(key);
    assert.notEqual(def.ui.display, 'normalized',
      `${key} still presents a normalized value`);
    assert.doesNotMatch(def.description, /[Nn]ormalized/,
      `${key} still describes a normalized value`);
  }
  assert.equal(defs.get('glass.thickness').ui.unit, 'px');
  assert.equal(defs.get('glass.attenuationDistance').ui.unit, 'px');
  assert.equal(defs.get('glass.inactive.attenuationDistance').ui.unit, 'px');
  assert.equal(defs.get('glass.paneLip').ui.unit, 'px');
});

test('the motion controls keep their normalized presentation', () => {
  const defs = loadDefs(defsDir());

  assert.equal(defs.get('glass.jellyFlex').ui.display, 'normalized');
  assert.equal(defs.get('glass.jellyRipple').ui.display, 'normalized');
});

test('roughness is the focused blur of the focus matrix', () => {
  const def = loadDefs(defsDir()).get('glass.roughness');

  assert.equal(def.ui.group, 'Focus');
  assert.equal(def.ui.state, 'focused');
  assert.equal(def.ui.row, 'Blur');
  assert.equal(def.ui.display, 'percent');
});

test('backdrop blur no longer claims to supply noise or saturation', () => {
  const description = loadDefs(defsDir()).get('glass.backdropBlur').description;

  assert.match(description, /global blur block/);
  assert.doesNotMatch(description, /saturation/);
  assert.doesNotMatch(description, /noise/);
});

test('noise and saturation are focus-matrix optics, not blur inheritance', () => {
  const defs = loadDefs(defsDir());
  for (const key of ['glass.noise', 'glass.inactive.noise']) {
    assert.equal(defs.get(key).ui.display, 'percent', key);
  }
  for (const key of ['glass.saturation', 'glass.inactive.saturation']) {
    assert.notEqual(defs.get(key).ui.display, 'percent', key);
    assert.doesNotMatch(defs.get(key).description, /blur block/, key);
  }
});

test('terminals are matched by the exact live app ids', () => {
  const defs = loadDefs(defsDir());
  const apps = defs.get('terminal.apps');

  assert.deepEqual(apps.default, ['kitty', 'com.mitchellh.ghostty']);
  assert.equal(apps.type, 'list');
  assert.equal(apps.ui.control, 'none');
});

test('visible numeric defaults lie on their slider grids', () => {
  const defs = loadDefs(defsDir());
  for (const def of defs.values()) {
    if (def.ui.control === 'none' || (def.type !== 'float' && def.type !== 'int')) continue;
    const n = (def.default - def.range[0]) / def.ui.step;
    assert.ok(Math.abs(n - Math.round(n)) <= 1e-9, `${def.key} default is off-grid`);
  }
});

const MATRIX = [
  ['Terminal opacity', 'terminal.background.opacity.active', 'terminal.background.opacity.inactive'],
  ['Blur', 'glass.roughness', 'glass.inactive.roughness'],
  ['Tint distance', 'glass.attenuationDistance', 'glass.inactive.attenuationDistance'],
  ['Fringing', 'glass.chromaticAberration', 'glass.inactive.chromaticAberration'],
  ['Distortion', 'glass.distortion', 'glass.inactive.distortion'],
  ['Directional blur', 'glass.anisotropicBlur', 'glass.inactive.anisotropicBlur'],
  ['Noise', 'glass.noise', 'glass.inactive.noise'],
  ['Saturation', 'glass.saturation', 'glass.inactive.saturation'],
];

test('the focus matrix pairs every focused optic with an unfocused twin', () => {
  const defs = loadDefs(defsDir());

  for (const [row, focusedKey, unfocusedKey] of MATRIX) {
    const focused = defs.get(focusedKey);
    const unfocused = defs.get(unfocusedKey);
    assert.equal(focused.ui.group, 'Focus', focusedKey);
    assert.equal(unfocused.ui.group, 'Focus', unfocusedKey);
    assert.equal(focused.ui.state, 'focused', focusedKey);
    assert.equal(unfocused.ui.state, 'unfocused', unfocusedKey);
    assert.equal(focused.ui.row, row);
    assert.equal(unfocused.ui.row, row);
    assert.equal(unfocused.ui.order, focused.ui.order + 1, row);
    assert.deepEqual(unfocused.range, focused.range, row);
    assert.equal(unfocused.ui.step, focused.ui.step, row);
    assert.equal(unfocused.ui.display, focused.ui.display, row);
    assert.equal(unfocused.ui.scale, focused.ui.scale, row);
    assert.equal(unfocused.ui.unit, focused.ui.unit, row);
  }
  const split = defs.get('glass.focusSplit');
  assert.equal(split.ui.group, 'Focus');
  assert.equal(split.ui.control, 'toggle');
  assert.equal(split.ui.header, true);
  assert.equal(split.ui.state, undefined);
  assert.equal(defs.get('glass.backdropBlur').ui.header, undefined);
  const stateful = [...defs.values()].filter((def) => def.ui.state !== undefined).map((def) => def.key);
  assert.deepEqual(stateful.sort(), MATRIX.flatMap(([, a, b]) => [a, b]).sort());
});

test('everything outside the matrix is shared glass', () => {
  const defs = loadDefs(defsDir());
  const shared = [...defs.values()]
    .filter((def) => def.ui.control !== 'none' && def.ui.group !== 'Focus' && def.ui.group !== 'Title')
    .map((def) => def.key);

  assert.deepEqual(shared.sort(), [
    'compositor.gaps', 'glass.attenuationColor', 'glass.ior', 'glass.thickness',
    'glass.distortionScale', 'glass.backdropBlur', 'glass.paneLip', 'glass.paneShiftX',
    'glass.paneShiftY', 'glass.jellyFlex', 'glass.jellyRipple',
  ].sort());
  for (const key of shared) assert.equal(defs.get(key).ui.group, 'Glass', key);
});
