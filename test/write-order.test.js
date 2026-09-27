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
const { contextPath, readActive, readContextText, writeActive, writeContext, wallpaperId, readLook, writeLook, readRuntime, writeRuntime, lookPath } = await import('../src/contexts.js');
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
    if (stop === 0) throw new Error(`injected failure after write 0`);
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

// Every look owns both ids; their distinct values catch cross-look attribution.
function pairStore({ profile = 'Aurora', hasWallpaper = true } = {}) {
  const [w1, w2] = ['one.jpg', 'two.jpg'].map((name) => {
    const file = wallpaperFile(name);
    return { id: wallpaperId(file), path: file };
  });
  for (const [look, roughness, ior, noise] of [
    [null, 0.1, 1.2, 0.12], ['Aurora', 0.3, 1.4, 0.22], ['Dusk', 0.5, 1.6, 0.32],
  ]) {
    writeLook(look, { values: { 'glass.roughness': roughness, 'glass.ior': ior }, wallpapers: {
      [w1.id]: { source: w1.path, values: { 'glass.roughness': roughness + 0.1, 'glass.noise': noise } },
      [w2.id]: { source: w2.path, values: { 'glass.roughness': roughness + 0.15 } },
    } });
  }
  const active = { ...(profile === null ? {} : { profile }), ...(hasWallpaper ? { wallpaper: w1 } : {}) };
  const scratch = { 'glass.roughness': 0.73, 'terminal.background.opacity.inactive': 0.51 };
  writeRuntime({ active, scratch });
  return { w1, w2, active, scratch };
}

const lookNames = [null, 'Aurora', 'Dusk', 'Renamed'];
const looks = () => Object.fromEntries(lookNames.map((name) => [name, readLook(name)]));
const select = (name) => name === null ? ['context', 'deactivate', 'profile'] : ['context', 'activate', 'profile', name];
const fold = (documents, { active, scratch }) => {
  Object.assign(documents[active.profile ?? null].wallpapers[active.wallpaper.id].values, scratch);
};

const cases = [
  ...[['Aurora', 'Dusk'], ['Aurora', 'Aurora'], ['Aurora', null], [null, 'Aurora'], [null, null]].map(([from, to]) => ({
    name: `select ${from ?? 'Default'} to ${to ?? 'Default'} with wallpaper`,
    seed: { profile: from }, argv: () => select(to), fold: true,
    next: ({ active }) => ({ ...active, ...(to === null ? { profile: undefined } : { profile: to }) }),
    writes: () => [lookPath(from), activePath(), resolvedPath()],
  })),
  ...[['Aurora', 'Dusk'], ['Aurora', 'Aurora'], ['Aurora', null], [null, 'Aurora'], [null, null]].map(([from, to]) => ({
    name: `select ${from ?? 'Default'} to ${to ?? 'Default'} without wallpaper`,
    seed: { profile: from, hasWallpaper: false }, argv: () => select(to),
    next: () => to === null ? {} : { profile: to },
    writes: () => [activePath(), resolvedPath()],
  })),
  ...[
    ['wallpaper hook rotation', ({ w2 }) => ['context', 'wallpaper', w2.path]],
    ['explicit wallpaper rotation', ({ w2 }) => ['context', 'activate', 'wallpaper', w2.id]],
  ].map(([name, argv]) => ({
    // w2's pair owns roughness; w1's noise and the pending opacity are carried.
    name: `${name} carries pending edits and writes no pair`, argv,
    scratch: { 'glass.noise': 0.22, 'terminal.background.opacity.inactive': 0.51 },
    next: ({ active, w2 }) => ({ ...active, wallpaper: w2 }),
    writes: () => [activePath(), resolvedPath()],
  })),
  {
    name: 'wallpaper deactivation carries the leaving pair and keeps the screen',
    argv: () => ['context', 'deactivate', 'wallpaper'], keepsScreen: true,
    scratch: { 'glass.roughness': 0.73, 'glass.noise': 0.22, 'terminal.background.opacity.inactive': 0.51 },
    next: ({ active }) => ({ profile: active.profile }),
    writes: () => [activePath(), resolvedPath()], completedRefusal: /no active wallpaper/,
  },
  {
    // w1's pair owns roughness and noise; only the pending opacity survives.
    name: 'first wallpaper activation lets the incoming pair win its keys', seed: { hasWallpaper: false },
    argv: ({ w1 }) => ['context', 'wallpaper', w1.path],
    scratch: { 'terminal.background.opacity.inactive': 0.51 },
    next: ({ active, w1 }) => ({ ...active, wallpaper: w1 }),
    writes: () => [activePath(), resolvedPath()],
  },
  {
    name: 'Keep for wallpaper', argv: ({ w1 }) => ['commit', 'wallpaper', w1.id], fold: true,
    writes: () => [lookPath('Aurora'), activePath()], completedRefusal: /nothing to commit/,
  },
  ...[null, 'Aurora'].map((profile) => ({
    name: `Keep in ${profile ?? 'Default'}`, seed: { profile },
    argv: () => ['commit', profile === null ? 'base' : 'profile'],
    edit: (documents, { w1, scratch }) => {
      Object.assign(documents[profile].values, scratch);
      for (const key of Object.keys(scratch)) delete documents[profile].wallpapers[w1.id].values[key];
    },
    writes: () => [lookPath(profile), activePath()], completedRefusal: /nothing to commit/,
  })),
  {
    name: 'Save As replaces destination current pair and preserves its other pair',
    argv: () => ['commit', 'profile', 'Dusk'],
    edit: (documents, { w1 }, params) => {
      documents.Dusk.values = { ...params };
      delete documents.Dusk.wallpapers[w1.id];
    },
    next: ({ active }) => ({ ...active, profile: 'Dusk' }),
    writes: () => [lookPath('Dusk'), activePath()], completedRefusal: /nothing to commit/,
  },
  {
    name: 'clear active pair keeps slots and scratch', argv: ({ w1 }) => ['context', 'clear', 'wallpaper', w1.id],
    edit: (documents, { w1 }) => { delete documents.Aurora.wallpapers[w1.id]; }, keepScratch: true,
    visible: () => lookPath('Aurora'), writes: () => [lookPath('Aurora'), resolvedPath()],
    completedRefusal: /wallpaper .*: untuned/,
  },
  {
    name: 'delete active pair preserves other looks', argv: ({ w1 }) => ['context', 'delete', 'wallpaper', w1.id],
    edit: (documents, { w1 }) => { delete documents.Aurora.wallpapers[w1.id]; }, keepScratch: true,
    next: ({ active }) => ({ profile: active.profile }),
    writes: () => [activePath(), lookPath('Aurora'), resolvedPath()], completedRefusal: /wallpaper .*: no such context/,
  },
  {
    name: 'delete active profile loads Default pair and preserves scratch', argv: () => ['context', 'delete', 'profile', 'Aurora'],
    edit: (documents) => { documents.Aurora = null; }, keepScratch: true,
    next: ({ w1 }) => ({ wallpaper: w1 }),
    writes: () => [activePath(), lookPath('Aurora'), resolvedPath()], completedRefusal: /profile Aurora: no such context/,
  },
  {
    name: 'rename active profile carries every pair and scratch', argv: () => ['context', 'rename', 'profile', 'Aurora', 'Renamed'],
    edit: (documents) => { documents.Renamed = documents.Aurora; documents.Aurora = null; }, keepScratch: true,
    next: ({ active }) => ({ ...active, profile: 'Renamed' }),
    writes: () => [lookPath('Renamed'), activePath(), lookPath('Aurora')], completedRefusal: /profile Aurora: no such context/,
  },
];

for (const scenario of cases) {
  test(`${scenario.name}: every write prefix has exact ownership and retry converges`, async () => {
    const seed = pairStore(scenario.seed);
    const argv = scenario.argv(seed);
    const before = { params: loadStore(defs).params, looks: looks(), runtime: readRuntime() };
    const expectedLooks = structuredClone(before.looks);
    if (scenario.fold) fold(expectedLooks, seed);
    scenario.edit?.(expectedLooks, seed, before.params);
    // JSON round-trip omits the absent profile slot in Default selections.
    const expectedRuntime = { active: JSON.parse(JSON.stringify(scenario.next?.(seed) ?? seed.active)),
      scratch: scenario.scratch ?? (scenario.keepScratch ? seed.scratch : {}) };
    const clean = await runAfterWrite(argv);
    assert.equal(clean.code, 0, clean.stderr);
    assert.deepEqual(clean.writes, scenario.writes(seed), 'exact durable order');
    assert.deepEqual(looks(), expectedLooks, 'clean result has the specified pair maps');
    assert.deepEqual(readRuntime(), expectedRuntime);
    const final = { params: loadStore(defs).params, files: files() };
    if (argv[0] === 'commit' || argv[1] === 'rename' || scenario.keepsScreen
        || (scenario.fold && isDeepStrictEqual(expectedRuntime.active, seed.active))) {
      assert.deepEqual(final.params, before.params, 'operation preserves the screen');
    } else {
      assert.notDeepEqual(final.params, before.params, 'fixture must expose the visible switch');
    }
    const visible = scenario.visible?.() ?? activePath();
    const visibleAt = clean.writes.indexOf(visible);

    for (let n = 0; n <= clean.writes.length; n += 1) {
      reset();
      const retryArgv = scenario.argv(pairStore(scenario.seed));
      const interrupted = await runAfterWrite(retryArgv, n);
      assert.equal(interrupted.code, 1, `prefix ${n}: did not interrupt`);
      assert.match(interrupted.stderr, /injected failure after write/);
      const written = clean.writes.slice(0, n);
      for (const look of lookNames) {
        assert.deepEqual(readLook(look), written.includes(lookPath(look)) ? expectedLooks[look] : before.looks[look],
          `prefix ${n}: wrong ${look ?? 'Default'} document`);
      }
      assert.deepEqual(readRuntime(), written.includes(activePath()) ? expectedRuntime : before.runtime);
      assert.deepEqual(loadStore(defs).params, n > visibleAt ? final.params : before.params,
        `prefix ${n}: wrong resolved appearance`);
      const alreadyFinal = isDeepStrictEqual(files(), final.files);
      const retry = await runAfterWrite(retryArgv);
      if (retry.code !== 0) {
        assert.ok(alreadyFinal && scenario.completedRefusal, `prefix ${n}: premature refusal: ${retry.stderr}`);
        assert.match(retry.stderr, scenario.completedRefusal);
      }
      assert.deepEqual(files(), final.files, `prefix ${n}: retry must converge`);
      assert.deepEqual(loadStore(defs).params, final.params);
      assert.equal(await cli.run(['apply'], { runner: () => {} }), 0);
      assert.deepEqual(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params, final.params);
    }
  });
}

test('Default round-trip preserves each departing pair through every return prefix', async () => {
  for (let stop = 0; stop <= 3; stop += 1) {
    reset();
    const seed = pairStore();
    assert.equal((await runAfterWrite(select(null))).code, 0);
    const nextScratch = { 'glass.roughness': 0.87, 'terminal.background.opacity.inactive': 0.63 };
    writeRuntime({ active: { wallpaper: seed.w1 }, scratch: nextScratch });
    const before = loadStore(defs).params;
    const expected = looks();
    Object.assign(expected.null.wallpapers[seed.w1.id].values, nextScratch);
    const interrupted = await runAfterWrite(select('Aurora'), stop);
    assert.equal(interrupted.code, 1);
    assert.deepEqual(readLook('Aurora').wallpapers[seed.w1.id].values,
      { 'glass.roughness': 0.73, 'glass.noise': 0.22, 'terminal.background.opacity.inactive': 0.51 });
    if (stop < 2) assert.deepEqual(loadStore(defs).params, before);
    else assert.equal(loadStore(defs).params['glass.roughness'], 0.73);
    assert.equal((await runAfterWrite(select('Aurora'))).code, 0);
    assert.deepEqual(looks(), expected);
    assert.deepEqual(readRuntime(), { active: seed.active, scratch: {} });
    assert.equal(loadStore(defs).params['glass.roughness'], 0.73);
    assert.equal(loadStore(defs).params['terminal.background.opacity.inactive'], 0.51);
  }
});

test('same-wallpaper hook writes nothing and preserves every pair and pending key', async () => {
  const { w1 } = pairStore();
  const before = files();
  const result = await runAfterWrite(['context', 'wallpaper', w1.path]);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(files(), before);
});

for (const destination of [null, 'Dusk']) {
  for (const broken of ['missing', 'malformed', 'invalid-pair']) {
    test(`recover ${broken} look to ${destination ?? 'Default'}: retry before runtime, apply after`, async () => {
      const setup = () => {
        const seed = pairStore();
        if (broken === 'missing') fs.unlinkSync(lookPath('Aurora'));
        if (broken === 'malformed') fs.writeFileSync(lookPath('Aurora'), '[: broken');
        if (broken === 'invalid-pair') {
          const look = readLook('Aurora');
          look.wallpapers[seed.w1.id].values['glass.roughness'] = 99;
          writeLook('Aurora', look);
        }
        return seed;
      };
      for (const n of [0, 1, 2]) {
        reset();
        const seed = setup();
        const before = files();
        assert.throws(() => loadStore(defs));
        const result = await runAfterWrite(select(destination), n);
        assert.equal(result.code, 1);
        assert.match(result.stderr, /injected failure/);
        assert.deepEqual(result.writes, [activePath(), resolvedPath()].slice(0, n));
        if (n === 0) {
          assert.deepEqual(files(), before);
          assert.throws(() => loadStore(defs));
          assert.equal((await runAfterWrite(select(destination))).code, 0);
        }
        assert.deepEqual(readRuntime(), { active: { ...(destination === null ? {} : { profile: destination }), wallpaper: seed.w1 }, scratch: seed.scratch });
        const expected = { ...Object.fromEntries([...defs].map(([key, def]) => [key, def.default])),
          ...readLook(null).values, ...(destination === null ? {} : readLook(destination).values),
          ...readLook(destination).wallpapers[seed.w1.id].values, ...seed.scratch };
        assert.deepEqual(loadStore(defs).params, expected);
        for (const [file, content] of Object.entries(before)) {
          if (file !== 'state/active.json') assert.equal(files()[file], content, `${file} changed during recovery`);
        }
        // Recovery is already complete. Apply repairs only the bus; reselect is a new action.
        const recovered = files();
        assert.equal(await cli.run(['apply'], { runner: () => {} }), 0);
        assert.deepEqual(files(), recovered);
        assert.deepEqual(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params, expected);
      }
    });
  }
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
