import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
const { readScratch, writeScratch } = await import('../src/scratch.js');
const { scratchPath, activePath } = await import('../src/paths.js');

beforeEach(() => {
  fs.rmSync(process.env.PRISM_STATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(process.env.PRISM_STATE_DIR, { recursive: true });
});

test('a missing scratch file is an empty layer', () => {
  assert.deepEqual(readScratch(), {});
});

test('scratch round-trips inside active.json and clearing retains active slots', async () => {
  const { writeActive, readActive } = await import('../src/contexts.js');
  writeActive({ profile: 'Aurora' });
  writeScratch({ 'glass.ior': 1.4, 'glass.noise': 0 });
  assert.deepEqual(JSON.parse(fs.readFileSync(activePath(), 'utf8'))._scratch, { 'glass.ior': 1.4, 'glass.noise': 0 });
  assert.deepEqual(readScratch(), { 'glass.ior': 1.4, 'glass.noise': 0 });
  writeScratch({});
  assert.deepEqual(readScratch(), {});
  assert.deepEqual(readActive(), { profile: 'Aurora' });
  assert.equal(fs.existsSync(scratchPath()), false);
  assert.equal(fs.existsSync(activePath()), true);
});

test('malformed runtime scratch is refused without writing', () => {
  for (const scratch of [[], null, 4]) {
    const text = JSON.stringify({ _scratch: scratch });
    fs.writeFileSync(activePath(), text);
    assert.throws(() => readScratch(), /_scratch must be a mapping/);
    assert.equal(fs.readFileSync(activePath(), 'utf8'), text);
  }
});
