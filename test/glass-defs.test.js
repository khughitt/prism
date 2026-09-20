import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

// The native grammar this sink targets, transcribed from the accepted niri
// package's docs/materials/material-config.md. Prism may narrow a range but
// must never offer a value the compositor rejects.
const NATIVE = {
  'glass.iridescence': { range: [0, 1], default: 0 },
  'glass.aurora': { range: [0, 1], default: 0 },
  'glass.auroraDriftHz': { range: [0, 30], default: 4 },
  'glass.auroraColorA': { default: "#3dffb0" },
  'glass.auroraColorB': { default: "#7a5cff" },
  'glass.inactive.iridescence': { range: [0, 1], default: 0 },
  'glass.inactive.aurora': { range: [0, 1], default: 0 },
  'glass.inactive.auroraDriftHz': { range: [0, 30], default: 4 },
  'glass.inactive.auroraColorA': { default: "#3dffb0" },
  'glass.inactive.auroraColorB': { default: "#7a5cff" },
  'glass.bypass.iridescence': { default: false },
  'glass.bypass.aurora': { default: false },
  'glass.ior': { range: [1, 3], default: 1.5 },
  'glass.inactive.ior': { range: [1, 3], default: 1.5 },
  'glass.thickness': { range: [0, 200], default: 20 },
  'glass.inactive.thickness': { range: [0, 200], default: 20 },
  'glass.attenuationColor': { default: '#dfe8ff' },
  'glass.inactive.attenuationColor': { default: '#dfe8ff' },
  'glass.attenuationDistance': { range: [1, 65535], default: 60 },
  'glass.chromaticAberration': { range: [0, 1], default: 0 },
  'glass.distortion': { range: [0, 1], default: 0 },
  'glass.distortionScale': { range: [0.01, 2], default: 0.5 },
  'glass.inactive.distortionScale': { range: [0.01, 2], default: 0.5 },
  'glass.anisotropicBlur': { range: [0, 1], default: 0 },
  'glass.roughness': { range: [0, 1], default: 0.08 },
  'glass.backdropBlur': { default: false },
  'glass.inactive.backdropBlur': { default: false },
  'glass.bypass.backdrop': { default: false },
  'glass.bypass.distortion': { default: false },
  'glass.bypass.refraction': { default: false },
  'glass.bypass.fringing': { default: false },
  'glass.bypass.directionalBlur': { default: false },
  'glass.bypass.tint': { default: false },
  'glass.bypass.saturation': { default: false },
  'glass.bypass.noise': { default: false },
  'glass.jellyFlex': { range: [0, 0.02], default: 0.004 },
  'glass.jellyRipple': { range: [0, 0.5], default: 0.06 },
  'glass.ring.focus': { default: true },
  'glass.ring.color': { default: '#ccccff' },
  'glass.ring.sweepMs': { range: [0, 10000], default: 1500 },
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
  'glass.inactive.distortion', 'glass.inactive.thickness',
  'glass.inactive.distortionScale',
];

const NATIVE_BEVEL_MAX = 128;

test('the glass surface is exactly the parameters native niri consumes', () => {
  const defs = loadDefs(defsDir());
  const glass = [...defs.keys()].filter((key) => key.startsWith('glass.'));

  assert.deepEqual(glass.slice().sort(),
    [...Object.keys(NATIVE), 'glass.noiseType', 'glass.ring.colorSource'].sort());
});

test('noise type is a shared Focus select with an explicit Prism default', () => {
  const defs = loadDefs(defsDir());
  const def = defs.get('glass.noiseType');
  assert.equal(def.type, 'enum');
  assert.deepEqual(def.values, ['white', 'fine']);
  assert.equal(def.default, 'fine');
  assert.deepEqual(def.ui, { group: 'Focus', control: 'select', label: 'Noise type', order: 325 });
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
  assert.equal(defs.get('glass.inactive.thickness').ui.unit, 'px');
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
  ['Iridescence', 'glass.iridescence', 'glass.inactive.iridescence'],
  ['Aurora', 'glass.aurora', 'glass.inactive.aurora'],
  ['Drift rate', 'glass.auroraDriftHz', 'glass.inactive.auroraDriftHz'],
  ['Color A', 'glass.auroraColorA', 'glass.inactive.auroraColorA'],
  ['Color B', 'glass.auroraColorB', 'glass.inactive.auroraColorB'],
  ['Frosted backdrop', 'glass.backdropBlur', 'glass.inactive.backdropBlur'],
  ['Blur', 'glass.roughness', 'glass.inactive.roughness'],
  ['Tint', 'glass.attenuationColor', 'glass.inactive.attenuationColor'],
  ['Tint distance', 'glass.attenuationDistance', 'glass.inactive.attenuationDistance'],
  ['Refraction', 'glass.ior', 'glass.inactive.ior'],
  ['Depth', 'glass.thickness', 'glass.inactive.thickness'],
  ['Fringing', 'glass.chromaticAberration', 'glass.inactive.chromaticAberration'],
  ['Distortion', 'glass.distortion', 'glass.inactive.distortion'],
  ['Distortion detail', 'glass.distortionScale', 'glass.inactive.distortionScale'],
  ['Directional blur', 'glass.anisotropicBlur', 'glass.inactive.anisotropicBlur'],
  ['Noise', 'glass.noise', 'glass.inactive.noise'],
  ['Saturation', 'glass.saturation', 'glass.inactive.saturation'],
];

// The terminal opacity pair is a kitty sink parameter, not a glass stage, and
// its only panel effect was to reintroduce the terminal-versus-glass seam, so
// it is CLI-only: no control, and no neutral, since resets scope to visible
// parameters.
const TERMINAL_PAIR = ['terminal.background.opacity.active', 'terminal.background.opacity.inactive'];

test('the terminal opacity pair is hidden from the panel', () => {
  const defs = loadDefs(defsDir());
  for (const key of TERMINAL_PAIR) {
    const def = defs.get(key);
    assert.equal(def.ui.control, 'none', key);
    assert.equal(Object.hasOwn(def, 'neutral'), false, `${key} stays out of resets`);
    assert.equal(def.type, 'float', key);
    assert.equal(def.default, 0, key);
  }
});

// One bypass per rack device, shared by both focus states: the niri sink
// writes the device's dry value while the key is true and the mix keeps its
// number (docs/specs/2026-09-08-device-chain-rack-design.md).
const BYPASS = [
  ['glass.bypass.iridescence', 'Bypass iridescence', 435],
  ['glass.bypass.aurora', 'Bypass aurora', 455],
  ['glass.bypass.backdrop', 'Bypass backdrop', 400],
  ['glass.bypass.distortion', 'Bypass distortion', 410],
  ['glass.bypass.refraction', 'Bypass refraction', 420],
  ['glass.bypass.fringing', 'Bypass fringing', 430],
  ['glass.bypass.directionalBlur', 'Bypass directional blur', 440],
  ['glass.bypass.tint', 'Bypass tint', 450],
  ['glass.bypass.saturation', 'Bypass saturation', 460],
  ['glass.bypass.noise', 'Bypass noise', 470],
];

// The optics split by this change default to their focused value, so widening
// the matrix adds capability without altering the shipped appearance.
const NEWLY_SPLIT = [
  'glass.backdropBlur', 'glass.attenuationColor', 'glass.ior',
  'glass.thickness', 'glass.distortionScale',
];

// The optics that ship already receded. Every other pair starts level, so the
// README may not claim that the whole matrix defaults to its focused value.
const RECEDED = [
  'glass.roughness', 'glass.attenuationDistance', 'glass.chromaticAberration',
  'glass.distortion', 'glass.noise', 'glass.saturation',
];

function assertPair(defs, group, [row, focusedKey, unfocusedKey]) {
  const focused = defs.get(focusedKey);
  const unfocused = defs.get(unfocusedKey);
  assert.equal(focused.ui.group, group, focusedKey);
  assert.equal(unfocused.ui.group, group, unfocusedKey);
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

test('the focus matrix pairs every focused optic with an unfocused twin', () => {
  const defs = loadDefs(defsDir());

  for (const pair of MATRIX) assertPair(defs, 'Focus', pair);
  const split = defs.get('glass.focusSplit');
  assert.equal(split.ui.group, 'Focus');
  assert.equal(split.ui.control, 'toggle');
  assert.equal(split.ui.header, true);
  assert.equal(split.ui.state, undefined);
  assert.equal(defs.get('glass.backdropBlur').ui.header, undefined);
  const stateful = [...defs.values()].filter((def) => def.ui.state !== undefined).map((def) => def.key);
  assert.deepEqual(stateful.sort(), MATRIX.flatMap(([, a, b]) => [a, b]).sort());
});

test('every rack device has one shared bool bypass toggle in the Focus group', () => {
  const defs = loadDefs(defsDir());

  for (const [key, label, order] of BYPASS) {
    const def = defs.get(key);
    assert.ok(def, key);
    assert.equal(def.type, 'bool', key);
    assert.equal(def.default, false, key);
    assert.equal(def.ui.group, 'Focus', key);
    assert.equal(def.ui.control, 'toggle', key);
    assert.equal(def.ui.label, label, key);
    assert.equal(def.ui.order, order, key);
    assert.equal(def.ui.state, undefined, key);
    assert.equal(def.ui.header, undefined, key);
    assert.equal(defs.has(key.replace('glass.bypass.', 'glass.inactive.bypass.')), false,
      `${key} gained a per-state twin; bypass is shared`);
  }
  assert.match(defs.get('glass.bypass.refraction').description, /fringing/i);
  assert.match(defs.get('glass.bypass.refraction').description, /directional blur/i);
  assert.match(defs.get('glass.bypass.refraction').description, /blur flattens/i);
  assert.match(defs.get('glass.bypass.noise').description, /both materials/i);
});

test('the newly split optics default to their focused value', () => {
  const defs = loadDefs(defsDir());

  for (const key of NEWLY_SPLIT) {
    const twin = key.replace('glass.', 'glass.inactive.');
    assert.deepEqual(defs.get(twin).default, defs.get(key).default, twin);
  }
});

test('exactly the receding optics ship with a divergent unfocused default', () => {
  const defs = loadDefs(defsDir());
  const level = MATRIX
    .filter(([, focused, unfocused]) => defs.get(focused).default === defs.get(unfocused).default)
    .map(([, focused]) => focused);

  for (const key of RECEDED) {
    const twin = key.replace('glass.', 'glass.inactive.');
    assert.notEqual(defs.get(twin).default, defs.get(key).default, twin);
  }
  assert.deepEqual(
    MATRIX.map(([, focused]) => focused).filter((key) => !RECEDED.includes(key)).sort(),
    level.sort(),
  );
});

test('an unfocused default is fixed, never inherited from its focused twin', () => {
  const defs = loadDefs(defsDir());

  // Tuning glass.X does not move glass.inactive.X: the store resolves defaults,
  // then base, then contexts, with no link between a pair. The README documents
  // this, so pin the shape the documentation describes.
  for (const [, focused, unfocused] of MATRIX) {
    assert.equal(Object.hasOwn(defs.get(unfocused), 'inherits'), false, unfocused);
    assert.notEqual(defs.get(unfocused).default, undefined, unfocused);
    assert.notEqual(defs.get(focused).default, undefined, focused);
  }
});

test('geometry and pane motion stay shared across focus states', () => {
  const defs = loadDefs(defsDir());

  for (const key of [
    'glass.paneLip', 'glass.paneShiftX', 'glass.paneShiftY',
    'glass.jellyFlex', 'glass.jellyRipple', 'glass.noiseType',
  ]) {
    assert.equal(defs.has(key.replace('glass.', 'glass.inactive.')), false,
      `${key} gained a per-state twin; the swap is a hard cut, so a divergent slab jumps`);
  }
});

test('everything outside the matrix is shared glass', () => {
  const defs = loadDefs(defsDir());
  const shared = [...defs.values()]
    .filter((def) => def.ui.control !== 'none' && def.ui.group !== 'Focus' && def.ui.group !== 'Title')
    .map((def) => def.key);

  assert.deepEqual(shared.sort(), [
    'compositor.gaps', 'glass.paneLip', 'glass.paneShiftX',
    'glass.paneShiftY', 'glass.jellyFlex', 'glass.jellyRipple',
    'glass.ring.focus', 'glass.ring.colorSource', 'glass.ring.color', 'glass.ring.sweepMs',
  ].sort());
  const groups = Object.fromEntries(shared.map((key) => [key, defs.get(key).ui.group]));
  assert.deepEqual(groups, {
    'compositor.gaps': 'Glass',
    'glass.paneLip': 'Glass',
    'glass.paneShiftX': 'Glass',
    'glass.paneShiftY': 'Glass',
    'glass.jellyFlex': 'Glass',
    'glass.jellyRipple': 'Glass',
    'glass.ring.focus': 'Ring',
    'glass.ring.colorSource': 'Ring',
    'glass.ring.color': 'Ring',
    'glass.ring.sweepMs': 'Ring',
  });
});

const NEUTRAL = {
  'glass.iridescence': 0,
  'glass.aurora': 0,
  'glass.auroraDriftHz': 4,
  'glass.auroraColorA': "#3dffb0",
  'glass.auroraColorB': "#7a5cff",
  'glass.inactive.iridescence': 0,
  'glass.inactive.aurora': 0,
  'glass.inactive.auroraDriftHz': 4,
  'glass.inactive.auroraColorA': "#3dffb0",
  'glass.inactive.auroraColorB': "#7a5cff",
  'glass.bypass.iridescence': false, 'glass.bypass.aurora': false,
  'glass.enabled': true, 'compositor.gaps': 24,
  'glass.paneLip': 8, 'glass.paneShiftX': 0, 'glass.paneShiftY': 0,
  'glass.jellyFlex': 0, 'glass.jellyRipple': 0,
  'glass.backdropBlur': false, 'glass.inactive.backdropBlur': false,
  'glass.roughness': 0, 'glass.inactive.roughness': 0,
  'glass.attenuationColor': '#ffffff', 'glass.inactive.attenuationColor': '#ffffff',
  'glass.attenuationDistance': 60, 'glass.inactive.attenuationDistance': 60,
  'glass.ior': 1, 'glass.inactive.ior': 1,
  'glass.thickness': 20, 'glass.inactive.thickness': 20,
  'glass.chromaticAberration': 0, 'glass.inactive.chromaticAberration': 0,
  'glass.distortion': 0, 'glass.inactive.distortion': 0,
  'glass.distortionScale': 0.5, 'glass.inactive.distortionScale': 0.5,
  'glass.anisotropicBlur': 0, 'glass.inactive.anisotropicBlur': 0,
  'glass.noise': 0, 'glass.inactive.noise': 0, 'glass.noiseType': 'fine',
  'glass.saturation': 1, 'glass.inactive.saturation': 1,
  'glass.bypass.backdrop': false, 'glass.bypass.distortion': false,
  'glass.bypass.refraction': false, 'glass.bypass.fringing': false,
  'glass.bypass.directionalBlur': false, 'glass.bypass.tint': false,
  'glass.bypass.saturation': false, 'glass.bypass.noise': false,
  'glass.ring.focus': true, 'glass.ring.colorSource': 'noctalia',
  'glass.ring.color': '#ccccff', 'glass.ring.sweepMs': 1500,
};

test('every visible parameter neutralizes to its curated value', () => {
  const defs = loadDefs(defsDir());
  for (const [key, neutral] of Object.entries(NEUTRAL)) assert.deepEqual(defs.get(key).neutral, neutral, key);
  assert.deepEqual([...defs.values()].filter((d) => d.neutralize === false).map((d) => d.key), ['glass.focusSplit']);
  const visible = [...defs.values()].filter((d) => d.ui.control !== 'none' && d.neutralize !== false);
  assert.deepEqual(visible.map((d) => d.key).sort(), Object.keys(NEUTRAL).sort());
});

test('neutral saturation and refraction are identities, not zeroes', () => {
  const defs = loadDefs(defsDir());
  assert.equal(defs.get('glass.saturation').neutral, 1);
  assert.equal(defs.get('glass.ior').neutral, 1);
  assert.equal(defs.get('glass.ior').range[0], 1);
});

test('drift controls use whole Hz so every offered rate parses in niri', () => {
  const defs = loadDefs(defsDir());
  for (const key of ['glass.auroraDriftHz', 'glass.inactive.auroraDriftHz']) {
    const def = defs.get(key);
    assert.equal(def.type, 'int');
    assert.deepEqual(def.range, [0, 30]);
    assert.equal(def.ui.step, 1);
    assert.equal(def.ui.unit, 'Hz');
  }
});
