import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderGlassConfig } from '../integrations/niri-glass/render.js';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';
import { resolveParams } from '../src/resolve.js';

const seed = JSON.parse(fs.readFileSync(new URL('./fixtures/niri-glass-seed.json', import.meta.url), 'utf8'));

test('pure defaults reproduce the live QML defaults, key for key', () => {
  const defs = loadDefs(defsDir());
  const resolved = { params: resolveParams(defs, {}) };
  const rendered = renderGlassConfig(resolved);
  assert.deepEqual(Object.keys(rendered).sort(), Object.keys(seed).sort());
  for (const key of Object.keys(seed)) {
    if (key === 'layoutGaps' || key === 'paneApps') continue;
    assert.deepEqual(rendered[key], seed[key], `key ${key}`);
  }
});

test('the rendered file is valid JSON — the thing the old hand-edited one was not', () => {
  const defs = loadDefs(defsDir());
  const rendered = renderGlassConfig({ params: resolveParams(defs, {}) });
  assert.deepEqual(JSON.parse(JSON.stringify(rendered, null, 2)), rendered);
});

test('mapped params flow through', () => {
  const defs = loadDefs(defsDir());
  const params = resolveParams(defs, { 'compositor.gaps': 10, 'terminal.apps': ['foot'] });
  const rendered = renderGlassConfig({ params });
  assert.equal(rendered.layoutGaps, 10);
  assert.deepEqual(rendered.paneApps, ['foot']);
});

test('glass enablement renders true by default and follows resolution', () => {
  const defs = loadDefs(defsDir());
  assert.equal(renderGlassConfig({ params: resolveParams(defs, {}) }).enabled, true);
  assert.equal(renderGlassConfig({ params: resolveParams(defs, { 'glass.enabled': false }) }).enabled, false);
});
