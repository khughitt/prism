import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDefs } from '../src/defs.js';
import { planReset, visibleGroups } from '../src/reset.js';

const YAML = `
- {key: a.lip, type: int, range: [0, 64], default: 6, neutral: 0, description: d,
   ui: {group: Glass, control: slider, step: 1, label: Lip, order: 1}}
- {key: a.split, type: bool, default: true, neutralize: false, description: d,
   ui: {group: Focus, control: toggle, label: Split, order: 2, header: true}}
- {key: a.blur, type: float, range: [0, 1], default: 0.08, neutral: 0, description: d,
   ui: {group: Focus, control: slider, step: 0.01, label: Blur, order: 3, state: focused, row: Blur}}
- {key: a.blur.off, type: float, range: [0, 1], default: 0.5, neutral: 0, description: d,
   ui: {group: Focus, control: slider, step: 0.01, label: Unfocused blur, order: 4, state: unfocused, row: Blur}}
- {key: a.opacity, type: float, range: [0, 1], default: 0, neutral: 0, description: d,
   ui: {group: Terminal, control: slider, step: 0.01, label: Opacity, order: 5}}
- {key: a.hidden, type: bool, default: false, description: d, ui: {group: Hidden, control: none}}
`;

function defs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-reset-'));
  fs.writeFileSync(path.join(dir, 'a.yaml'), YAML);
  return loadDefs(dir);
}

const plan = (over) => planReset({
  defs: defs(), mode: 'neutral', group: null, held: {}, effective: {},
  beneath: {}, ...over,
});

test('visibleGroups skips a group with no visible parameter', () => {
  assert.deepEqual([...visibleGroups(defs())].sort(), ['Focus', 'Glass', 'Terminal']);
});

test('revert removes every scoped key scratch holds', () => {
  const held = { 'a.lip': 9, 'a.blur': 0.4 };
  const out = plan({ mode: 'revert', held, effective: { 'a.lip': 30, 'a.blur': 0.4 } });
  assert.deepEqual(out.values, {});
  assert.deepEqual(out.changedKeys.sort(), ['a.blur', 'a.lip']);
  assert.deepEqual(held, { 'a.lip': 9, 'a.blur': 0.4 }, 'held is not mutated');
});

test('revert honours the group scope', () => {
  const out = plan({ mode: 'revert', group: 'Glass', held: { 'a.lip': 9, 'a.blur': 0.4 } });
  assert.deepEqual(out.values, { 'a.blur': 0.4 });
  assert.deepEqual(out.changedKeys, ['a.lip']);
});

test('neutral writes each eligible key and skips the exempt one', () => {
  const effective = { 'a.lip': 6, 'a.split': true, 'a.blur': 0.08, 'a.blur.off': 0.5, 'a.opacity': 0.3 };
  const out = plan({ effective });
  assert.deepEqual(out.values, { 'a.lip': 0, 'a.blur': 0, 'a.blur.off': 0, 'a.opacity': 0 });
  assert.equal('a.split' in out.values, false);
});

test('neutral skips a key already at its neutral', () => {
  const effective = { 'a.lip': 0, 'a.blur': 0.08, 'a.blur.off': 0.5 };
  const out = plan({ effective });
  assert.equal('a.lip' in out.values, false);
});

test('symmetric mirrors focused onto unfocused and leaves singles alone', () => {
  const effective = { 'a.lip': 6, 'a.blur': 0.08, 'a.blur.off': 0.5 };
  const out = plan({ mode: 'symmetric', effective });
  assert.deepEqual(out.values, { 'a.blur.off': 0.08 });
});

test('symmetric skips a pair already equal', () => {
  const effective = { 'a.blur': 0.08, 'a.blur.off': 0.08 };
  const out = plan({ mode: 'symmetric', effective });
  assert.deepEqual(out.changedKeys, []);
});

test('a rejected copy leaves no partial batch behind', () => {
  const twoRows = `${YAML}
- {key: a.tint, type: float, range: [0, 1], default: 0, neutral: 0, description: d,
   ui: {group: Focus, control: slider, step: 0.01, label: Tint, order: 6, state: focused, row: Tint}}
- {key: a.tint.off, type: float, range: [0, 0.2], default: 0.1, neutral: 0, description: d,
   ui: {group: Focus, control: slider, step: 0.01, label: Unfocused tint, order: 7, state: unfocused, row: Tint}}
`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-reset-'));
  fs.writeFileSync(path.join(dir, 'a.yaml'), twoRows);
  const held = { 'a.lip': 9 };
  assert.throws(() => planReset({
    defs: loadDefs(dir), mode: 'symmetric', group: 'Focus', held,
    effective: { 'a.blur': 0.9, 'a.blur.off': 0.1, 'a.tint': 0.9, 'a.tint.off': 0.1 },
    beneath: {},
  }), /a\.tint\.off/);
  assert.deepEqual(held, { 'a.lip': 9 });
});

test('a selected key can still be no change at all', () => {
  const out = planReset({
    defs: defs(), mode: 'neutral', group: 'Terminal', held: {},
    effective: { 'a.opacity': 0.5 }, beneath: { 'a.opacity': 0 },
  });
  assert.deepEqual(out.values, {});
  assert.deepEqual(out.changedKeys, []);
});

test('a write away from the def default is stored at base', () => {
  const out = planReset({
    defs: defs(), mode: 'neutral', group: 'Glass', held: {},
    effective: { 'a.lip': 6 }, beneath: { 'a.lip': 6 },
  });
  assert.deepEqual(out.values, { 'a.lip': 0 });
  assert.deepEqual(out.changedKeys, ['a.lip']);
});

test('a neutral value the fold beneath already supplies is removed from scratch, not stored', () => {
  const held = { 'a.lip': 9 };
  const out = plan({ group: 'Glass', held, effective: { 'a.lip': 9 }, beneath: { 'a.lip': 0 } });
  assert.deepEqual(out.values, {}, 'beneath is already neutral, so the edit goes');
  assert.deepEqual(out.changedKeys, ['a.lip']);
});
