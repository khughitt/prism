import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

const seed = JSON.parse(fs.readFileSync(new URL('./fixtures/niri-glass-seed.json', import.meta.url), 'utf8'));
const MAPPED = { layoutGaps: 'compositor.gaps', paneApps: 'terminal.apps' };

test('every glass config key has a def, and defaults match the live QML defaults', () => {
  const defs = loadDefs(defsDir());
  for (const [jsonKey, value] of Object.entries(seed)) {
    if (jsonKey in MAPPED) continue;
    const def = defs.get(`glass.${jsonKey}`);
    assert.ok(def, `missing def glass.${jsonKey}`);
    assert.deepEqual(def.default, value, `default for glass.${jsonKey} drifted from the QML`);
  }
});

test('the schema is closed: no glass def exists outside the fixture', () => {
  const defs = loadDefs(defsDir());
  const fixtureKeys = new Set(Object.keys(seed).map((k) => MAPPED[k] ?? `glass.${k}`));
  for (const key of defs.keys()) {
    if (!key.startsWith('glass.')) continue;
    assert.ok(fixtureKeys.has(key), `def ${key} has no JsonAdapter property behind it`);
  }
});

test('the omitted keys are the two that moved, and nothing else', () => {
  assert.deepEqual(Object.keys(seed).filter((k) => k in MAPPED).sort(),
    ['layoutGaps', 'paneApps']);
});
