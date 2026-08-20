import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

test('shipped presentation has the exact Quick and advanced structure', () => {
  const defs = [...loadDefs(defsDir()).values()];
  const visible = defs.filter((def) => def.ui.control !== 'none');
  const ordered = visible.slice().sort((a, b) => a.ui.order - b.ui.order);
  const groups = [
    { name: 'Quick', params: ordered.filter((def) => def.ui.group === 'Quick') },
    ...['Opacity & Focus', 'Glass Shape', 'Glass Optics', 'Motion', 'Diagnostics']
      .map((name) => ({ name, params: ordered.filter((def) => def.ui.group === name) })),
  ];
  assert.deepEqual(groups.map((group) => group.name), [
    'Quick', 'Opacity & Focus', 'Glass Shape', 'Glass Optics', 'Motion', 'Diagnostics',
  ]);
  assert.deepEqual(groups[0].params.map((param) => param.key), [
    'terminal.background.opacity.active',
    'terminal.background.opacity.inactive',
    'compositor.gaps',
    'glass.roughness',
    'glass.attenuationColor',
  ]);
  const renderedKeys = groups.flatMap((group) => group.params.map((param) => param.key));
  const title = defs.find((def) => def.ui.group === 'Title');
  assert.equal(title.key, 'glass.enabled');
  assert.equal(title.ui.control, 'toggle');
  assert.equal(renderedKeys.length, 31);
  assert.equal(new Set(renderedKeys).size, 31);
  const allRenderedKeys = [title.key].concat(renderedKeys);
  assert.equal(allRenderedKeys.length, 32);
  assert.equal(new Set(allRenderedKeys).size, 32);
  assert.deepEqual(allRenderedKeys.slice().sort(), visible.map((def) => def.key).sort());
});

test('shipped defs declare exact value and preview presentation', () => {
  const defs = loadDefs(defsDir());
  assert.equal(defs.has('glass.transmission'), false);
  assert.equal(defs.get('terminal.background.opacity.active').ui.display, 'percent');
  assert.equal(defs.get('compositor.gaps').ui.unit, 'px');
  assert.deepEqual(
    [...defs.values()].filter((def) => def.ui.affectsPreview === true)
      .map((def) => def.key).sort(),
    [
      'glass.anisotropicBlur', 'glass.attenuationColor',
      'glass.attenuationDistance', 'glass.chromaticAberration',
      'glass.distortion', 'glass.distortionScale', 'glass.ior',
      'glass.probeExposure', 'glass.roughness', 'glass.samples',
      'glass.thickness',
    ],
  );
});
