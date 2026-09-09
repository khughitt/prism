import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diagnose, onPath } from '../src/sink.js';

// What execFileSync hands back: the child's output as Buffers. Printing the
// error object renders these as Buffer(2383) [Uint8Array] [69, 114, ...] and
// buries the one part an operator can act on.
test('diagnose returns the child stderr a Buffer is hiding', () => {
  const error = new Error('Command failed: niri validate');
  error.stderr = Buffer.from('error: material "terminal-glass": bad value\n');
  error.stdout = Buffer.from('');

  assert.equal(diagnose(error), 'error: material "terminal-glass": bad value');
});

// niri rejects a config with a multi-line miette report. The body carries the
// property name and its position, so collapsing it would discard the answer.
test('diagnose preserves a multi-line diagnostic intact', () => {
  const report = [
    'Error:   × unexpected node `material`',
    '   ╭─[prism.kdl:2:1]',
    ' 2 │ material "terminal-glass" {',
    '   ╰────',
  ].join('\n');
  const error = new Error('Command failed');
  error.stderr = Buffer.from(`${report}\n`);

  assert.equal(diagnose(error), report);
});

test('diagnose falls back to stdout when stderr is empty', () => {
  const error = new Error('Command failed');
  error.stderr = Buffer.from('   \n');
  error.stdout = Buffer.from('qs: no running instances\n');

  assert.equal(diagnose(error), 'qs: no running instances');
});

test('diagnose names the command a failed spawn could not find', () => {
  const error = new Error('spawnSync qs ENOENT');
  error.code = 'ENOENT';
  error.syscall = 'spawnSync qs';
  error.path = 'qs';

  assert.equal(diagnose(error), 'qs is not installed');
});

// A missing file is not a missing command: only a spawn ENOENT means the
// command itself was not found.
test('diagnose leaves a filesystem ENOENT as its own message', () => {
  const error = new Error("ENOENT: no such file or directory, open '/nope'");
  error.code = 'ENOENT';
  error.syscall = 'open';
  error.path = '/nope';

  assert.equal(diagnose(error), "ENOENT: no such file or directory, open '/nope'");
});

test('diagnose falls back to the message, then to the error itself', () => {
  assert.equal(diagnose(new Error('plain failure')), 'plain failure');
  assert.equal(diagnose('not an error at all'), 'not an error at all');
});

test('onPath finds an executable and ignores a non-executable of the same name', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-path-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'runnable'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'inert'), 'not executable\n', { mode: 0o644 });

  const restore = process.env.PATH;
  process.env.PATH = dir;
  t.after(() => { process.env.PATH = restore; });

  assert.equal(onPath('runnable'), true);
  assert.equal(onPath('inert'), false);
  assert.equal(onPath('absent'), false);
});
