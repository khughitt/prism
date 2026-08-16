import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatValue, groupParams, quantizeValue, stepPrecision, titleParam,
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
    'glass.transmission',
    'glass.attenuationColor',
  ]);
  const renderedKeys = groups.flatMap((group) => group.params.map((param) => param.key));
  const title = titleParam(defs);
  assert.equal(title.key, 'glass.enabled');
  assert.equal(title.ui.control, 'toggle');
  assert.equal(renderedKeys.length, 32);
  assert.equal(new Set(renderedKeys).size, 32);
  const allRenderedKeys = [title.key].concat(renderedKeys);
  assert.equal(allRenderedKeys.length, 33);
  assert.equal(new Set(allRenderedKeys).size, 33);
  assert.deepEqual(allRenderedKeys.slice().sort(), visible.map((def) => def.key).sort());
});

test('quantizes panel writes to step precision', () => {
  assert.equal(stepPrecision(0.000001), 6);
  assert.equal(quantizeValue(20.000000000000004, 0.1), 20);
  assert.equal(quantizeValue(2.2199999999999998, 0.01), 2.22);
});

test('formats values without binary noise or trailing zeros', () => {
  assert.equal(formatValue(0.000100, 0.000001), '0.0001');
  assert.equal(formatValue(0.0040, 0.0001), '0.004');
  assert.equal(formatValue(0.0600, 0.01), '0.06');
});
