import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';
import { contextPath, writeActive } from '../src/contexts.js';
import { loadStore } from '../src/layers.js';
import { writeValues } from '../src/values.js';
import { renderNiriFragment } from '../integrations/niri/render.js';

test('starter profiles load as complete snapshots and render both native preset optics', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-starter-profiles-'));
  const previous = [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR];
  process.env.PRISM_CONFIG_DIR = path.join(root, 'config');
  process.env.PRISM_STATE_DIR = path.join(root, 'state');
  t.after(() => {
    for (const [i, key] of ['PRISM_CONFIG_DIR', 'PRISM_STATE_DIR'].entries()) {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  const defs = loadDefs(defsDir());
  writeValues({ 'glass.bypass.aurora': true, 'glass.bypass.iridescence': true,
    'glass.roughness': 0.9, 'glass.inactive.ior': 1.9 });
  for (const name of ['Aurora', 'Rainbow']) {
    fs.mkdirSync(path.dirname(contextPath('profile', name)), { recursive: true });
    fs.copyFileSync(new URL(`../resources/profiles/${name}.yaml`, import.meta.url),
      contextPath('profile', name));
  }
  for (const name of ['Aurora', 'Rainbow']) {
    writeActive({ profile: name });
    const { params, layerOf, profiles } = loadStore(defs);
    assert.deepEqual(profiles, ['Aurora', 'Rainbow']);
    assert.ok(Object.values(layerOf).every((source) => source === 'profile'), 'full snapshot');
    assert.equal(params['glass.enabled'], true);
    assert.equal(params['glass.tintSource'], 'manual');
    assert.equal(params['glass.tintAccentMix'], 0.1);
    assert.equal(params['glass.focusSplit'], true);
    for (const prefix of ['glass.', 'glass.inactive.']) {
      assert.equal(params[`${prefix}ior`], name === 'Rainbow' ? 1.7 : 1.5);
      assert.equal(params[`${prefix}chromaticAberration`], name === 'Rainbow' ? 0.5 : 0);
      assert.equal(params[`${prefix}iridescence`], name === 'Rainbow' ? 0.8 : 0);
      assert.equal(params[`${prefix}aurora`], name === 'Aurora' ? 0.5 : 0);
      assert.equal(params[`${prefix}auroraDriftHz`], 4);
      assert.equal(params[`${prefix}auroraColorA`], '#3dffb0');
      assert.equal(params[`${prefix}auroraColorB`], '#7a5cff');
      assert.equal(params[`${prefix}attenuationColor`], name === 'Aurora' ? '#cfe0ff' : '#dfe8ff');
      assert.equal(params[`${prefix}roughness`], 0);
      assert.equal(params[`${prefix}noise`], 0);
      assert.equal(params[`${prefix}saturation`], 1);
    }
    assert.equal(params['glass.bypass.aurora'], false);
    assert.equal(params['glass.bypass.iridescence'], false);
    const kdl = renderNiriFragment({ params });
    assert.equal(kdl.match(/^material /gm).length, 2);
    assert.equal(kdl.match(new RegExp(`attenuation-color "${name === 'Aurora' ? '#cfe0ff' : '#dfe8ff'}"`, 'g')).length, 2);
    assert.equal(kdl.match(new RegExp(`iridescence ${name === 'Rainbow' ? '0.8' : '0'}\\n`, 'g')).length, 2);
    assert.equal(kdl.match(new RegExp(`aurora ${name === 'Aurora' ? '0.5' : '0'} \\{`, 'g')).length, 2);
  }
});
