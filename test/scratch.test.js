import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
const { readScratch, writeScratch } = await import('../src/scratch.js');
const { scratchPath } = await import('../src/paths.js');

beforeEach(() => {
  fs.rmSync(process.env.PRISM_STATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(process.env.PRISM_STATE_DIR, { recursive: true });
});

test('a missing scratch file is an empty layer', () => {
  assert.deepEqual(readScratch(), {});
});

test('scratch round-trips as flat YAML in the state directory', () => {
  writeScratch({ 'glass.ior': 1.4, 'glass.noise': 0 });
  assert.equal(scratchPath(), path.join(process.env.PRISM_STATE_DIR, 'scratch.yaml'));
  assert.equal(fs.readFileSync(scratchPath(), 'utf8'), 'glass.ior: 1.4\nglass.noise: 0\n');
  assert.deepEqual(readScratch(), { 'glass.ior': 1.4, 'glass.noise': 0 });
});

test('writing an empty scratch removes the file, so a clean store leaves nothing behind', () => {
  writeScratch({ 'glass.ior': 1.4 });
  writeScratch({});
  assert.equal(fs.existsSync(scratchPath()), false);
  assert.deepEqual(readScratch(), {});
});

test('a scratch file that is not a flat object fails loudly', () => {
  fs.writeFileSync(scratchPath(), '- 1\n- 2\n');
  assert.throws(() => readScratch(), /scratch must be a flat object/);
});
