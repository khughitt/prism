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
  'glass.jellyFlex': { range: [0, 0.02], default: 0.004 },
  'glass.jellyRipple': { range: [0, 0.5], default: 0.06 },
  'glass.paneLip': { range: [0, 64], default: 6 },
  'glass.paneShiftX': { range: [-64, 64], default: 6 },
  'glass.paneShiftY': { range: [-64, 64], default: 6 },
  'glass.enabled': { default: true },
};

const REMOVED = [
  'glass.gridOverlay', 'glass.calibrate', 'glass.probeExposure',
  'glass.roughness', 'glass.samples', 'glass.springDampingRatio',
  'glass.springStiffness', 'glass.springEpsilon',
  'terminal.blur', 'terminal.saturation.active', 'terminal.saturation.inactive',
  'terminal.noise.active', 'terminal.noise.inactive',
];

// Native units, not the legacy normalized presentation of the retired shader.
const NATIVE_UNITS = [
  'glass.thickness', 'glass.attenuationDistance', 'glass.chromaticAberration',
  'glass.distortion', 'glass.distortionScale',
];

const NATIVE_BEVEL_MAX = 128;

test('the glass surface is exactly the parameters native niri consumes', () => {
  const defs = loadDefs(defsDir());
  const glass = [...defs.keys()].filter((key) => key.startsWith('glass.'));

  assert.deepEqual(glass.slice().sort(), Object.keys(NATIVE).sort());
});

test('every glass definition matches the native range and default', () => {
  const defs = loadDefs(defsDir());

  for (const [key, native] of Object.entries(NATIVE)) {
    const def = defs.get(key);
    assert.ok(def, `missing def ${key}`);
    assert.deepEqual(def.default, native.default, `${key} default`);
    if (native.range) assert.deepEqual(def.range, native.range, `${key} range`);
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
  assert.equal(defs.get('glass.paneLip').ui.unit, 'px');
});

test('the motion controls keep their normalized presentation', () => {
  const defs = loadDefs(defsDir());

  assert.equal(defs.get('glass.jellyFlex').ui.display, 'normalized');
  assert.equal(defs.get('glass.jellyRipple').ui.display, 'normalized');
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
