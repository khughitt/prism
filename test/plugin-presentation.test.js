import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalFromSlider, formatValue, groupParams, oppositeSide, sliderFrom,
  sliderStep, sliderTo, snapValue, stepCanonicalValue, stepPrecision,
  titleParam, toSliderValue,
} from '../integrations/noctalia-plugin/presentation.mjs';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

test('groups visible params in presentation order with Quick first', () => {
  const params = [
    { key: 'title.enabled', ui: { control: 'toggle', group: 'Title', order: 0 } },
    { key: 'b.two', ui: { control: 'toggle', group: 'Beta', order: 20 } },
    { key: 'q.one', ui: { control: 'slider', group: 'Quick', order: 50 } },
    { key: 'a.one', ui: { control: 'toggle', group: 'Alpha', order: 10 } },
    { key: 'hidden.one', ui: { control: 'none', group: 'CLI' } },
    { key: 'b.one', ui: { control: 'toggle', group: 'Beta', order: 15 } },
  ];
  assert.equal(titleParam(params).key, 'title.enabled');
  assert.equal(groupParams(params).flatMap((group) => group.params)
    .some((param) => param.ui.group === 'Title'), false);
  assert.deepEqual(groupParams(params).map((group) => ({
    name: group.name,
    keys: group.params.map((param) => param.key),
  })), [
    { name: 'Quick', keys: ['q.one'] },
    { name: 'Alpha', keys: ['a.one'] },
    { name: 'Beta', keys: ['b.one', 'b.two'] },
  ]);
});

test('shipped presentation has the exact Quick and advanced structure', () => {
  const defs = [...loadDefs(defsDir()).values()];
  const visible = defs.filter((def) => def.ui.control !== 'none');
  const groups = groupParams(defs);
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
  const title = titleParam(defs);
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

const slider = (range, step, ui = {}) => ({
  range,
  ui: { control: 'slider', step, ...ui },
});

test('snaps to a range-minimum-relative canonical grid', () => {
  assert.equal(stepPrecision(0.000001), 6);
  assert.equal(snapValue(100.04, [0.1, 200], 0.1), 100);
  assert.equal(snapValue(100.06, [0.1, 200], 0.1), 100.1);
  assert.equal(snapValue(-1, [0.1, 200], 0.1), 0.1);
  assert.equal(snapValue(201, [0.1, 200], 0.1), 200);
  assert.equal(snapValue(0.05, [0.05, 1.05], 0.1), 0.05);
  assert.equal(snapValue(0.15, [0.05, 1.05], 0.1), 0.15);
  assert.equal(snapValue(1.05, [0.05, 1.05], 0.1), 1.05);
});

test('maps raw, percent, normalized, and logarithmic sliders', () => {
  const raw = slider([0, 2], 0.05, { unit: '×' });
  const percent = slider([0, 1], 0.01, { display: 'percent' });
  const coarsePercent = slider([0, 0.98], 0.07, { display: 'percent' });
  const offsetPercent = slider([0.005, 1.005], 0.01, { display: 'percent' });
  const depth = slider([0.1, 200], 0.1, { display: 'normalized' });
  const tint = slider([1, 10000], 1, { display: 'normalized', scale: 'logarithmic' });

  assert.deepEqual([sliderFrom(raw), sliderTo(raw), sliderStep(raw)], [0, 2, 0.05]);
  assert.deepEqual([sliderFrom(percent), sliderTo(percent), sliderStep(percent)], [0, 100, 1]);
  assert.equal(sliderStep(coarsePercent), 7);
  assert.deepEqual(
    [sliderFrom(offsetPercent), sliderTo(offsetPercent), sliderStep(offsetPercent)],
    [0.5, 100.5, 1]);
  assert.deepEqual([sliderFrom(depth), sliderTo(depth), sliderStep(depth)], [0, 1, 0]);
  assert.deepEqual([sliderFrom(tint), sliderTo(tint), sliderStep(tint)], [0, 1, 0]);
  assert.equal(toSliderValue(1, tint), 0);
  assert.equal(toSliderValue(10000, tint), 1);
  assert.equal(canonicalFromSlider(0.5, tint), 100);

  const midpoint = canonicalFromSlider(0.5, depth);
  assert.ok(Math.abs(midpoint - 100.05) <= depth.ui.step / 2 + 1e-9);
  assert.ok(Math.abs(toSliderValue(midpoint, depth) - 0.5)
    <= depth.ui.step / (depth.range[1] - depth.range[0]));
});

test('keyboard and wheel direction advances one canonical step', () => {
  const tint = slider([1, 10000], 1, { display: 'normalized', scale: 'logarithmic' });
  assert.equal(stepCanonicalValue(1, 1, tint), 2);
  assert.equal(stepCanonicalValue(2, -1, tint), 1);
  assert.equal(stepCanonicalValue(1, -1, tint), 1);
  assert.equal(stepCanonicalValue(10000, 1, tint), 10000);
});

test('formats presentation without changing canonical values', () => {
  assert.equal(formatValue(0.08, slider([0, 1], 0.01, { display: 'percent' })), '8%');
  assert.equal(formatValue(0.14, slider([0, 0.98], 0.07, { display: 'percent' })), '14%');
  assert.equal(formatValue(0.015, slider([0.005, 1.005], 0.01, { display: 'percent' })), '1.5%');
  assert.equal(formatValue(6, slider([-128, 128], 1, { unit: 'px' })), '6px');
  assert.equal(formatValue(0.5, slider([0, 2], 0.02, { unit: '×' })), '0.5×');
  assert.equal(formatValue(20, slider([0.1, 200], 0.1, { display: 'normalized' })), '0.1');
  assert.equal(formatValue(20.2, slider([0.1, 200], 0.1, { display: 'normalized' })), '0.101');
  assert.equal(formatValue(0.0001, slider([0.000001, 1], 0.000001)), '0.0001');
});

test('preview opens opposite the panel', () => {
  assert.equal(oppositeSide(300, 1000), 'right');
  assert.equal(oppositeSide(1700, 1000), 'left');
});
