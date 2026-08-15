import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeJsonAtomic, readJson } from '../src/store.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prism-test-'));

test('writeJsonAtomic writes parseable JSON and leaves no temp files', () => {
  const dir = tmp();
  const file = path.join(dir, 'sub', 'x.json');
  writeJsonAtomic(file, { a: 1 });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { a: 1 });
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['x.json']);
});

test('readJson returns fallback for a missing file', () => {
  assert.deepEqual(readJson(path.join(tmp(), 'nope.json'), {}), {});
});

test('paths honor PRISM_* env overrides', async () => {
  process.env.PRISM_CONFIG_DIR = '/tmp/pc';
  process.env.PRISM_STATE_DIR = '/tmp/ps';
  const p = await import('../src/paths.js');
  assert.equal(p.valuesPath(), '/tmp/pc/values.yaml');
  assert.equal(p.resolvedPath(), '/tmp/ps/resolved.json');
});

test('shipped paths decode spaces and non-ASCII filesystem names', async () => {
  delete process.env.PRISM_INTEGRATIONS_DIR;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism path-é-'));
  const sourceDir = path.join(root, 'src');
  fs.mkdirSync(sourceDir);
  const copy = path.join(sourceDir, 'paths.mjs');
  fs.copyFileSync(new URL('../src/paths.js', import.meta.url), copy);

  const p = await import(pathToFileURL(copy));

  assert.equal(p.defsDir(), `${path.join(root, 'defs')}${path.sep}`);
  assert.equal(p.integrationsDir(), `${path.join(root, 'integrations')}${path.sep}`);
});
