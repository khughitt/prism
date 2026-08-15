import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadManifests } from '../src/manifest.js';

const defs = new Map([['a.x', { key: 'a.x' }]]);

function integ(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-integ-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

test('loads manifests and skips manifest-less dirs', () => {
  const root = integ({
    'alpha/manifest.yaml': 'sink: alpha\nbinds:\n  - {param: a.x, liveness: live}\n',
    'plugin-only/readme.md': 'no manifest here\n',
  });
  const ms = loadManifests(root, defs);
  assert.equal(ms.length, 1);
  assert.equal(ms[0].sink, 'alpha');
  assert.equal(ms[0].dir, path.join(root, 'alpha'));
  assert.deepEqual(ms[0].binds, [{ param: 'a.x', liveness: 'live' }]);
  assert.deepEqual(ms[0].generates, [], 'absent generates defaults to empty');
});

test('generates is parsed when present and rejected when malformed', () => {
  const ok = integ({ 'alpha/manifest.yaml':
    'sink: alpha\nbinds:\n  - {param: a.x, liveness: live}\ngenerates: [out.json]\n' });
  assert.deepEqual(loadManifests(ok, defs)[0].generates, ['out.json']);
  const bad = integ({ 'alpha/manifest.yaml':
    'sink: alpha\nbinds:\n  - {param: a.x, liveness: live}\ngenerates: out.json\n' });
  assert.throws(() => loadManifests(bad, defs), /generates/);
});

test('generates accepts basenames only', () => {
  for (const generated of ['', '/tmp/out.json', '../out.json', 'nested/out.json']) {
    const root = integ({ 'alpha/manifest.yaml':
      `sink: alpha\nbinds:\n  - {param: a.x, liveness: live}\ngenerates: [${JSON.stringify(generated)}]\n` });
    assert.throws(() => loadManifests(root, defs), /generates.*file names/, JSON.stringify(generated));
  }
});

test('binding an undefined param is a hard error', () => {
  const root = integ({ 'alpha/manifest.yaml': 'sink: alpha\nbinds:\n  - {param: no.such, liveness: live}\n' });
  assert.throws(() => loadManifests(root, defs), /no\.such/);
});

test('unknown liveness is a hard error', () => {
  const root = integ({ 'alpha/manifest.yaml': 'sink: alpha\nbinds:\n  - {param: a.x, liveness: sometimes}\n' });
  assert.throws(() => loadManifests(root, defs), /liveness/);
});
