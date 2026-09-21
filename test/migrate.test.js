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
const beamSpeed = defs.get('glass.ring.beamSpeed');

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
});

test('the shipped definitions declare exactly one replacement', () => {
  const map = replacements(defs);
  assert.deepEqual([...map.keys()], ['glass.ring.sweepMs']);
  assert.equal(map.get('glass.ring.sweepMs').key, 'glass.ring.beamSpeed');
});

test('zero carries over; any other value takes the new default', () => {
  assert.equal(convertValue(0, beamSpeed), 0);
  assert.equal(convertValue(9000, beamSpeed), 300);
  assert.equal(convertValue(1, beamSpeed), 300);
  // a replacing def whose range excludes zero cannot keep it
  assert.equal(convertValue(0, { ...beamSpeed, range: [1, 10] }), 300);
});

test('migrateValues rewrites one flat store and reports each change', () => {
  const converted = migrateValues({ 'glass.ior': 1.3, 'glass.ring.sweepMs': 9000 }, defs);
  assert.deepEqual(converted.values, { 'glass.ior': 1.3, 'glass.ring.beamSpeed': 300 });
  assert.deepEqual(converted.changes,
    [{ from: 'glass.ring.sweepMs', to: 'glass.ring.beamSpeed', old: 9000, value: 300, kept: false }]);

  const zero = migrateValues({ 'glass.ring.sweepMs': 0 }, defs);
  assert.deepEqual(zero.values, { 'glass.ring.beamSpeed': 0 });

  const collision = migrateValues({ 'glass.ring.sweepMs': 1200, 'glass.ring.beamSpeed': 450 }, defs);
  assert.deepEqual(collision.values, { 'glass.ring.beamSpeed': 450 });
  assert.deepEqual(collision.changes,
    [{ from: 'glass.ring.sweepMs', to: 'glass.ring.beamSpeed', old: 1200, value: 450, kept: true }]);

  const untouched = { 'glass.ior': 1.3 };
  const same = migrateValues(untouched, defs);
  assert.deepEqual(same, { values: { 'glass.ior': 1.3 }, changes: [] });
  assert.notEqual(same.values, untouched, 'a copy, never the input');
});

test('planMigration covers base and every context, active or not, and skips clean files', () => {
  writeValues({ 'glass.ring.sweepMs': 9000 });
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.sweepMs': 0 } });
  writeContext('profile', 'plain', { source: null, values: { 'glass.ior': 1.4 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.sweepMs': 1200, 'glass.ring.beamSpeed': 450 } });

  const plan = planMigration(defs);
  assert.deepEqual(plan.map((file) => file.where), ['base', 'profile dusk']);
  assert.deepEqual(plan.map((file) => file.path),
    [valuesPath(), contextPath('profile', 'dusk')]);
  assert.equal(plan[0].document.wallpapers.abc12345.source, '/w');
  assert.deepEqual(plan[0].document.wallpapers.abc12345.values, { 'glass.ring.beamSpeed': 450 });
});

test('planMigration aborts on a context that does not parse', () => {
  writeValues({ 'glass.ring.sweepMs': 9000 });
  fs.mkdirSync(path.dirname(contextPath('profile', 'bad')), { recursive: true });
  fs.writeFileSync(contextPath('profile', 'bad'), '- not\n- flat\n');
  assert.throws(() => planMigration(defs), /look must be a mapping/);
});

test('backupDir is a compact UTC timestamp under the state dir', () => {
  assert.equal(backupDir(new Date('2026-09-19T22:41:07.123Z')),
    path.join(process.env.PRISM_STATE_DIR, 'migrations', '20260919T224107Z'));
});

test('writeBackup copies every planned file byte for byte at its config-relative path and nothing else', () => {
  fs.writeFileSync(valuesPath(), 'glass.ring.sweepMs: 25   # hand-written spacing survives in the backup\nglass.ior: 1.3\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.sweepMs': 0 } });
  writeContext('profile', 'plain', { source: null, values: { 'glass.ior': 1.4 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.sweepMs': 1200, 'glass.ring.beamSpeed': 450 } });
  const originals = {
    base: fs.readFileSync(valuesPath()),
    dusk: fs.readFileSync(contextPath('profile', 'dusk')),
  };

  const now = new Date('2026-09-19T22:41:07Z');
  const backup = writeBackup(planMigration(defs), now);
  assert.equal(backup, backupDir(now));
  assert.deepEqual(fs.readFileSync(path.join(backup, 'values.yaml')), originals.base);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'contexts', 'profile', 'dusk.yaml')), originals.dusk);
  assert.equal(fs.existsSync(path.join(backup, 'contexts', 'profile', 'plain.yaml')), false);
  assert.deepEqual(fs.readFileSync(valuesPath()), originals.base);
});

test('writeBackup refuses a directory that already exists and copies nothing into it', () => {
  writeValues({ 'glass.ring.sweepMs': 9000 });
  const now = new Date('2026-09-19T22:41:07Z');
  fs.mkdirSync(backupDir(now), { recursive: true });
  assert.throws(() => writeBackup(planMigration(defs), now), /backup .*20260919T224107Z already exists/);
  assert.deepEqual(fs.readdirSync(backupDir(now)), []);
});

test('writeBackup refuses a config-relative path that would escape its directory', () => {
  const now = new Date('2026-09-19T22:41:07Z');
  const outside = path.join(process.env.PRISM_STATE_DIR, 'outside.yaml');
  fs.writeFileSync(outside, 'glass.ring.sweepMs: 0\n');
  assert.throws(() => writeBackup([{ kind: 'base', path: outside }], now), /backup source outside config directory/);
  assert.deepEqual(fs.readdirSync(backupDir(now)), []);
});

test('writeMigrated rewrites one file through the store writers, and a migrated store plans nothing', () => {
  writeValues({ 'glass.ring.sweepMs': 9000, 'glass.ior': 1.3 });
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.sweepMs': 0 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.sweepMs': 1200, 'glass.ring.beamSpeed': 450 } });

  const plan = planMigration(defs);
  writeMigrated(plan[0]);
  assert.deepEqual(readValues(), { 'glass.ring.beamSpeed': 300, 'glass.ior': 1.3 });
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ring.sweepMs': 0 }, 'one file at a time');
  writeMigrated(plan[1]);
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ring.beamSpeed': 0 });
  assert.deepEqual(readContext('wallpaper', 'abc12345'), { source: '/w', values: { 'glass.ring.beamSpeed': 450 } });

  assert.deepEqual(planMigration(defs), [], 'a second pass has nothing to do');
});
