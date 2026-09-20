import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-mig-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-mig-state-'));

const { loadDefs } = await import('../src/defs.js');
const { defsDir, valuesPath } = await import('../src/paths.js');
const { readValues, writeValues } = await import('../src/values.js');
const { writeContext, readContext, contextPath } = await import('../src/contexts.js');
const { replacements, convertValue, migrateValues, planMigration, backupDir, writeBackup, writeMigrated } =
  await import('../src/migrate.js');

const defs = loadDefs(defsDir());
const sweep = defs.get('glass.ring.sweepMs');

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
});

test('the shipped definitions declare exactly one replacement', () => {
  const map = replacements(defs);
  assert.deepEqual([...map.keys()], ['glass.ring.driftHz']);
  assert.equal(map.get('glass.ring.driftHz').key, 'glass.ring.sweepMs');
});

test('zero carries over; any other value takes the new default', () => {
  assert.equal(convertValue(0, sweep), 0);
  assert.equal(convertValue(25, sweep), 1500);
  assert.equal(convertValue(1, sweep), 1500);
  assert.equal(convertValue(0, { ...sweep, range: [1, 10] }), 1500);
});

test('migrateValues rewrites one flat store and reports each change', () => {
  const converted = migrateValues({ 'glass.ior': 1.3, 'glass.ring.driftHz': 25 }, defs);
  assert.deepEqual(converted.values, { 'glass.ior': 1.3, 'glass.ring.sweepMs': 1500 });
  assert.deepEqual(converted.changes,
    [{ from: 'glass.ring.driftHz', to: 'glass.ring.sweepMs', old: 25, value: 1500, kept: false }]);

  const zero = migrateValues({ 'glass.ring.driftHz': 0 }, defs);
  assert.deepEqual(zero.values, { 'glass.ring.sweepMs': 0 });

  const collision = migrateValues({ 'glass.ring.driftHz': 12, 'glass.ring.sweepMs': 800 }, defs);
  assert.deepEqual(collision.values, { 'glass.ring.sweepMs': 800 });
  assert.deepEqual(collision.changes,
    [{ from: 'glass.ring.driftHz', to: 'glass.ring.sweepMs', old: 12, value: 800, kept: true }]);

  const untouched = { 'glass.ior': 1.3 };
  const same = migrateValues(untouched, defs);
  assert.deepEqual(same, { values: { 'glass.ior': 1.3 }, changes: [] });
  assert.notEqual(same.values, untouched, 'a copy, never the input');
});

test('planMigration covers base and every context, active or not, and skips clean files', () => {
  writeValues({ 'glass.ring.driftHz': 25 });
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.driftHz': 0 } });
  writeContext('profile', 'plain', { source: null, values: { 'glass.ior': 1.4 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.driftHz': 12, 'glass.ring.sweepMs': 800 } });

  const plan = planMigration(defs);
  assert.deepEqual(plan.map((file) => file.where), ['base', 'profile dusk', 'wallpaper abc12345']);
  assert.deepEqual(plan.map((file) => file.path),
    [valuesPath(), contextPath('profile', 'dusk'), contextPath('wallpaper', 'abc12345')]);
  assert.equal(plan[2].source, '/w');
  assert.deepEqual(plan[2].values, { 'glass.ring.sweepMs': 800 });
});

test('planMigration aborts on a context that does not parse', () => {
  writeValues({ 'glass.ring.driftHz': 25 });
  fs.mkdirSync(path.dirname(contextPath('profile', 'bad')), { recursive: true });
  fs.writeFileSync(contextPath('profile', 'bad'), '- not\n- flat\n');
  assert.throws(() => planMigration(defs), /profile bad: context must be a flat object/);
});

test('backupDir is a compact UTC timestamp under the state dir', () => {
  assert.equal(backupDir(new Date('2026-09-19T22:41:07.123Z')),
    path.join(process.env.PRISM_STATE_DIR, 'migrations', '20260919T224107Z'));
});

test('writeBackup copies every planned file byte for byte at its config-relative path and nothing else', () => {
  fs.writeFileSync(valuesPath(), 'glass.ring.driftHz: 25   # hand-written spacing survives in the backup\nglass.ior: 1.3\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.driftHz': 0 } });
  writeContext('profile', 'plain', { source: null, values: { 'glass.ior': 1.4 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.driftHz': 12, 'glass.ring.sweepMs': 800 } });
  const originals = {
    base: fs.readFileSync(valuesPath()),
    dusk: fs.readFileSync(contextPath('profile', 'dusk')),
    wall: fs.readFileSync(contextPath('wallpaper', 'abc12345')),
  };

  const now = new Date('2026-09-19T22:41:07Z');
  const backup = writeBackup(planMigration(defs), now);
  assert.equal(backup, backupDir(now));
  assert.deepEqual(fs.readFileSync(path.join(backup, 'values.yaml')), originals.base);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'contexts', 'profile', 'dusk.yaml')), originals.dusk);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'contexts', 'wallpaper', 'abc12345.yaml')), originals.wall);
  assert.equal(fs.existsSync(path.join(backup, 'contexts', 'profile', 'plain.yaml')), false);
  assert.deepEqual(fs.readFileSync(valuesPath()), originals.base);
});

test('writeBackup refuses a directory that already exists and copies nothing into it', () => {
  writeValues({ 'glass.ring.driftHz': 25 });
  const now = new Date('2026-09-19T22:41:07Z');
  fs.mkdirSync(backupDir(now), { recursive: true });
  assert.throws(() => writeBackup(planMigration(defs), now), /backup .*20260919T224107Z already exists/);
  assert.deepEqual(fs.readdirSync(backupDir(now)), []);
});

test('writeBackup refuses a config-relative path that would escape its directory', () => {
  const now = new Date('2026-09-19T22:41:07Z');
  const outside = path.join(process.env.PRISM_STATE_DIR, 'scratch.yaml');
  fs.writeFileSync(outside, 'glass.ring.driftHz: 0\n');
  assert.throws(() => writeBackup([{ kind: 'base', path: outside }], now), /backup source outside config directory/);
  assert.deepEqual(fs.readdirSync(backupDir(now)), []);
});

test('writeMigrated rewrites one file through the store writers, and a migrated store plans nothing', () => {
  writeValues({ 'glass.ring.driftHz': 25, 'glass.ior': 1.3 });
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.driftHz': 0 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.driftHz': 12, 'glass.ring.sweepMs': 800 } });

  const plan = planMigration(defs);
  writeMigrated(plan[0]);
  assert.deepEqual(readValues(), { 'glass.ring.sweepMs': 1500, 'glass.ior': 1.3 });
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ring.driftHz': 0 }, 'one file at a time');
  writeMigrated(plan[1]);
  writeMigrated(plan[2]);
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ring.sweepMs': 0 });
  assert.deepEqual(readContext('wallpaper', 'abc12345'), { source: '/w', values: { 'glass.ring.sweepMs': 800 } });

  assert.deepEqual(planMigration(defs), [], 'a second pass has nothing to do');
});
