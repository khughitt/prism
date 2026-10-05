import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defsDir } from '../src/paths.js';

// Where the renderer checkout is: the environment first, then the tasks
// registry. Neither resolving skips the comparison and says so.
function rendererRoot() {
  if (process.env.NIRI_MATERIAL_DIR) return process.env.NIRI_MATERIAL_DIR;
  const run = spawnSync('tasks', ['projects'], { encoding: 'utf8' });
  if (run.status !== 0) return null;
  const { projects } = JSON.parse(run.stdout);
  const entry = projects.find((p) => p.prefix === 'material' && p.reachable);
  return entry ? entry.root : null;
}

test('the vendored schema is byte-identical to the renderer checkout', (t) => {
  const root = rendererRoot();
  if (root === null) {
    t.skip('no niri-material checkout: set NIRI_MATERIAL_DIR or register the material project');
    return;
  }
  const theirs = path.join(root, 'resources', 'materials', 'pipeline.json');
  const ours = path.join(defsDir(), 'rack', 'pipeline.json');
  assert.equal(
    fs.readFileSync(ours, 'utf8'),
    fs.readFileSync(theirs, 'utf8'),
    `defs/rack/pipeline.json differs from ${theirs}; copy the newer one over the other`,
  );
});
