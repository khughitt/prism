import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
process.env.PRISM_INTEGRATIONS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-integ-'));

const cli = await import('../src/cli.js');
const { activePath, defsDir, resolvedPath, valuesPath } = await import('../src/paths.js');
const { contextPath, readActive, readContextText, writeActive, writeContext, wallpaperId } = await import('../src/contexts.js');
const { writeScratch } = await import('../src/scratch.js');
const { loadDefs } = await import('../src/defs.js');
const { loadStore } = await import('../src/layers.js');
const defs = loadDefs(defsDir());

function reset() {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(valuesPath(), '{}\n');
}

beforeEach(reset);

function wallpaperFile(name) {
  const dir = path.join(process.env.PRISM_CONFIG_DIR, 'walls');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, '');
  return file;
}

function wallpaper(name, values = {}) {
  const file = wallpaperFile(name);
  const id = wallpaperId(file);
  writeContext('wallpaper', id, { source: file, values });
  return { id, path: file };
}

function files() {
  const out = {};
  for (const [root, dir] of [['config', process.env.PRISM_CONFIG_DIR], ['state', process.env.PRISM_STATE_DIR]]) {
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const file = path.join(current, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (!['resolved.json', 'store.lock'].includes(entry.name) && !entry.name.endsWith('.tmp')) {
          out[`${root}/${path.relative(dir, file)}`] = fs.readFileSync(file, 'utf8');
        }
      }
    };
    walk(dir);
  }
  return out;
}

// The real rename/unlink completes, then the process dies before the next write.
async function runAfterWrite(argv, stop = Infinity) {
  const real = { renameSync: fs.renameSync, linkSync: fs.linkSync, rmSync: fs.rmSync, unlinkSync: fs.unlinkSync };
  const writes = [];
  const trip = (name, target) => (...args) => {
    const result = real[name](...args);
    writes.push(target(...args));
    if (writes.length === stop) throw new Error(`injected failure after write ${stop}`);
    return result;
  };
  fs.renameSync = trip('renameSync', (from, to) => to);
  fs.linkSync = trip('linkSync', (from, to) => to);
  fs.rmSync = trip('rmSync', (file) => file);
  fs.unlinkSync = trip('unlinkSync', (file) => file);
  let stderr = '';
  let code;
  try {
    code = await cli.run(argv, { runner: () => {}, eprint: (message) => { stderr += message; } });
  } finally {
    Object.assign(fs, real);
  }
  return { code, stderr, writes };
}

const cases = [
  {
    name: 'hook folds a departing wallpaper',
    setup: () => {
      const old = wallpaper('old.jpg', { 'glass.paneLip': 9 });
      writeActive({ wallpaper: old });
      writeScratch({ 'glass.ior': 1.7 });
      return ['context', 'wallpaper', wallpaperFile('new.jpg')];
    },
    visible: () => activePath(),
  },
  {
    name: 'first wallpaper keeps scratch and activates its delta',
    setup: () => {
      const next = wallpaper('new.jpg', { 'glass.paneLip': 9 });
      writeScratch({ 'glass.ior': 1.7 });
      return ['context', 'wallpaper', next.path];
    },
    visible: () => activePath(),
  },
  {
    name: 'explicit wallpaper activation folds the departing wallpaper',
    setup: () => {
      const old = wallpaper('old.jpg', { 'glass.paneLip': 9 });
      const next = wallpaper('new.jpg', { 'glass.ior': 1.35 });
      writeActive({ wallpaper: old });
      writeScratch({ 'glass.ior': 1.7 });
      return ['context', 'activate', 'wallpaper', next.id];
    },
    visible: () => activePath(),
  },
  {
    name: 'wallpaper deactivation folds the departing wallpaper',
    setup: () => {
      writeActive({ wallpaper: wallpaper('old.jpg', { 'glass.paneLip': 9 }) });
      writeScratch({ 'glass.ior': 1.7 });
      return ['context', 'deactivate', 'wallpaper'];
    },
    visible: () => activePath(),
    completedRefusal: /no active wallpaper/,
  },
  {
    name: 'commit base',
    setup: () => {
      writeActive({ wallpaper: wallpaper('old.jpg', { 'glass.ior': 1.35, 'glass.noise': 0.2 }) });
      writeScratch({ 'glass.ior': 1.7 });
      return ['commit', 'base'];
    },
    completedRefusal: /nothing to commit/,
  },
  {
    name: 'commit profile',
    setup: () => {
      writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
      writeActive({ profile: 'dusk', wallpaper: wallpaper('old.jpg', { 'glass.ior': 1.35, 'glass.noise': 0.2 }) });
      writeScratch({ 'glass.ior': 1.7 });
      return ['commit', 'profile'];
    },
    completedRefusal: /nothing to commit/,
  },
  {
    name: 'save-as profile',
    setup: () => {
      writeContext('profile', 'dusk', { source: null, values: { 'glass.roughness': 0.5 } });
      writeActive({ profile: 'dusk', wallpaper: wallpaper('old.jpg', { 'glass.roughness': 0.1 }) });
      writeScratch({ 'glass.roughness': 0.2 });
      return ['commit', 'profile', 'noon'];
    },
    completedRefusal: /nothing to commit/,
  },
  {
    name: 'commit wallpaper',
    setup: () => {
      writeActive({ wallpaper: wallpaper('old.jpg', { 'glass.noise': 0.2 }) });
      writeScratch({ 'glass.ior': 1.7 });
      return ['commit', 'wallpaper', wallpaperId(path.join(process.env.PRISM_CONFIG_DIR, 'walls', 'old.jpg'))];
    },
    completedRefusal: /nothing to commit/,
  },
  {
    name: 'clear active wallpaper',
    setup: () => {
      const old = wallpaper('old.jpg', { 'glass.paneLip': 9 });
      writeActive({ wallpaper: old });
      writeScratch({ 'glass.ior': 1.7 });
      return ['context', 'clear', 'wallpaper', old.id];
    },
    visible: () => contextPath('wallpaper', wallpaperId(path.join(process.env.PRISM_CONFIG_DIR, 'walls', 'old.jpg'))),
    completedRefusal: /wallpaper .*: untuned/,
  },
  {
    name: 'delete active wallpaper',
    setup: () => {
      const old = wallpaper('old.jpg', { 'glass.paneLip': 9 });
      writeActive({ wallpaper: old });
      return ['context', 'delete', 'wallpaper', old.id];
    },
    visible: () => activePath(),
    completedRefusal: /wallpaper .*: no such context/,
  },
  {
    name: 'delete active profile',
    setup: () => {
      writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
      writeActive({ profile: 'dusk' });
      return ['context', 'delete', 'profile', 'dusk'];
    },
    visible: () => activePath(),
    completedRefusal: /profile dusk: no such context/,
  },
  {
    name: 'rename active profile',
    setup: () => {
      writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
      writeActive({ profile: 'dusk' });
      return ['context', 'rename', 'profile', 'dusk', 'noon'];
    },
    visible: () => activePath(),
    unchangedScreen: true,
    completedRefusal: /profile dusk: no such context/,
  },
];

for (const { name, setup, visible, unchangedScreen, completedRefusal } of cases) {
  test(`${name}: every write prefix is valid and retry converges`, async () => {
    const argv = setup();
    const before = loadStore(defs).params;
    const clean = await runAfterWrite(argv);
    assert.equal(clean.code, 0, `${name}: clean run failed: ${clean.stderr}`);
    assert.ok(clean.writes.length > 0, `${name}: no store writes were exercised`);
    const final = { params: loadStore(defs).params, files: files() };
    const visibleAt = visible && clean.writes.indexOf(visible());
    if (visible) {
      if (!unchangedScreen) {
        assert.notDeepEqual(before, final.params, `${name}: fixture does not show the visible step`);
      }
      assert.ok(visibleAt >= 0, `${name}: visible write was not exercised`);
      assert.equal(clean.writes.lastIndexOf(visible()), visibleAt, `${name}: visible write repeated`);
    }

    for (let n = 1; n <= clean.writes.length; n += 1) {
      reset();
      const retryArgv = setup();
      const interrupted = await runAfterWrite(retryArgv, n);
      assert.equal(interrupted.code, 1, `${name}: write ${n} did not interrupt`);
      assert.match(interrupted.stderr, /injected failure after write/);
      const prefix = loadStore(defs).params; // A broken active context throws here.
      assert.deepEqual(prefix, visible && n > visibleAt ? final.params : before,
        `${name}: write ${n} exposed the wrong screen`);

      const alreadyFinal = isDeepStrictEqual(files(), final.files);
      const retry = await runAfterWrite(retryArgv);
      if (retry.code !== 0) {
        assert.ok(alreadyFinal && completedRefusal, `${name}: write ${n} retry failed before completion: ${retry.stderr}`);
        assert.match(retry.stderr, completedRefusal);
      }
      assert.deepEqual(loadStore(defs).params, final.params, `${name}: write ${n} retry changed the screen`);
      assert.deepEqual(files(), final.files, `${name}: write ${n} retry did not finish the store`);
      const applied = await cli.run(['apply'], { runner: () => {} });
      assert.equal(applied, 0, `${name}: apply failed after write ${n}`);
      assert.deepEqual(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params, final.params,
        `${name}: apply did not recover the bus`);
    }
  });
}

test('active profile rename refuses a distinct destination without changing the store', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeContext('profile', 'noon', { source: null, values: { 'glass.ior': 1.24 } });
  writeActive({ profile: 'dusk' });
  const before = files();
  const result = await runAfterWrite(['context', 'rename', 'profile', 'dusk', 'noon']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /profile noon already exists/);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(files(), before);

  const sameName = await runAfterWrite(['context', 'rename', 'profile', 'dusk', 'dusk']);
  assert.equal(sameName.code, 1);
  assert.match(sameName.stderr, /profile dusk already exists/);
  assert.deepEqual(sameName.writes, []);
  assert.deepEqual(files(), before);
});

test('active profile rename refuses a destination symlink to its source', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ profile: 'dusk' });
  const source = contextPath('profile', 'dusk');
  const destination = contextPath('profile', 'noon');
  fs.symlinkSync(source, destination);
  const sourceText = readContextText('profile', 'dusk');

  const result = await runAfterWrite(['context', 'rename', 'profile', 'dusk', 'noon']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /profile noon already exists/);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(readActive(), { profile: 'dusk' });
  assert.equal(readContextText('profile', 'dusk'), sourceText);
  assert.equal(fs.readlinkSync(destination), source);
  assert.equal(readContextText('profile', 'noon'), sourceText);
});
