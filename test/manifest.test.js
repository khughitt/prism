import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadManifests } from '../src/manifest.js';
import { nodeMap } from '../src/nodes.js';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

const defs = new Map([
  ['a.x', { key: 'a.x' }],
  ['a.on', { key: 'a.on', type: 'bool' }],
]);

function integ(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-integ-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

function loadBinding(fields) {
  const root = integ({
    'alpha/manifest.yaml': `sink: alpha\nbinds:\n  - param: a.x\n${fields}\n`,
  });
  return loadManifests(root, defs)[0].binds[0];
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
  for (const generated of ['', '.', '..', '/tmp/out.json', '../out.json', 'nested/out.json']) {
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

test('drag release is the only accepted live binding override', () => {
  assert.equal(loadBinding('    liveness: live\n    drag: release').drag, 'release');
  assert.throws(() => loadBinding('    liveness: live\n    drag: sample'), /bad drag/);
  assert.throws(() => loadBinding('    liveness: reload\n    drag: release'),
    /drag: release requires liveness: live/);
});

function loadRequires(body) {
  const root = integ({
    'alpha/manifest.yaml': `sink: alpha\nbinds:\n  - {param: a.x, liveness: live}\nrequires:\n${body}`,
    'alpha/probe-present': '#!/bin/sh\nexit 0\n',
    'alpha/probe-inert': 'not executable\n',
  });
  fs.chmodSync(path.join(root, 'alpha', 'probe-present'), 0o755);
  fs.chmodSync(path.join(root, 'alpha', 'probe-inert'), 0o644);
  return () => loadManifests(root, defs);
}

test('absent requires defaults to empty', () => {
  const root = integ({ 'alpha/manifest.yaml': 'sink: alpha\nbinds:\n  - {param: a.x, liveness: live}\n' });
  assert.deepEqual(loadManifests(root, defs)[0].requires, []);
});

test('a command requirement is parsed with its fix and optional when', () => {
  const load = loadRequires('  - {command: qs, when: a.on, fix: install quickshell}\n');
  assert.deepEqual(load()[0].requires, [{ command: 'qs', when: 'a.on', fix: 'install quickshell' }]);
});

test('a probe requirement names an executable beside apply', () => {
  const load = loadRequires('  - {probe: present, fix: install it}\n');
  assert.deepEqual(load()[0].requires, [{ probe: 'present', fix: 'install it' }]);
});

test('a requirement needs exactly one of command and probe', () => {
  assert.throws(loadRequires('  - {fix: do something}\n'), /exactly one of command or probe/);
  assert.throws(loadRequires('  - {command: qs, probe: present, fix: x}\n'), /exactly one of command or probe/);
});

test('a requirement needs a fix', () => {
  assert.throws(loadRequires('  - {command: qs}\n'), /needs a fix/);
  assert.throws(loadRequires('  - {command: qs, fix: "  "}\n'), /needs a fix/);
});

test('a probe that is not an executable file beside apply is a manifest error', () => {
  assert.throws(loadRequires('  - {probe: absent, fix: x}\n'), /probe absent is missing/);
  assert.throws(loadRequires('  - {probe: inert, fix: x}\n'), /probe inert is not executable/);
});

// X_OK is satisfied by a directory, which cannot be spawned, and a name with a
// separator would reach out of the sink's directory entirely.
test('a probe directory and a probe name with a separator are manifest errors', () => {
  const root = integ({
    'alpha/manifest.yaml': 'sink: alpha\nbinds:\n  - {param: a.x, liveness: live}\nrequires:\n  - {probe: dir, fix: x}\n',
  });
  fs.mkdirSync(path.join(root, 'alpha', 'probe-dir'));
  assert.throws(() => loadManifests(root, defs), /probe dir is not a file/);

  assert.throws(loadRequires('  - {probe: ../escape, fix: x}\n'), /must be a bare name/);
  assert.throws(loadRequires('  - {probe: nested/thing, fix: x}\n'), /must be a bare name/);
});

// A when that names nothing, or names a param prism cannot read as a switch,
// would silently never fire. Both are manifest errors.
test('when must name a defined bool param', () => {
  assert.throws(loadRequires('  - {command: qs, when: a.nope, fix: x}\n'), /undefined param a\.nope/);
  assert.throws(loadRequires('  - {command: qs, when: a.x, fix: x}\n'), /a\.x must be type bool/);
});

test('a bind may carry a native node, and it must be a non-empty string', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-manifest-node-'));
  fs.mkdirSync(path.join(dir, 'niri'));
  fs.writeFileSync(path.join(dir, 'niri', 'manifest.yaml'),
    'sink: niri\nbinds:\n  - {param: glass.roughness, node: roughness, liveness: reload}\n');
  const [m] = loadManifests(dir, loadDefs(defsDir()));
  assert.equal(m.binds[0].node, 'roughness');
  assert.deepEqual([...nodeMap([m])], [['glass.roughness', 'roughness']]);

  fs.writeFileSync(path.join(dir, 'niri', 'manifest.yaml'),
    'sink: niri\nbinds:\n  - {param: glass.roughness, node: "", liveness: reload}\n');
  assert.throws(() => loadManifests(dir, loadDefs(defsDir())), /manifest\.yaml: bad node "" for glass\.roughness/);
});
