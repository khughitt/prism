import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readEffective } from '../src/effective.js';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

const defs = loadDefs(defsDir());

const dirWith = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-effective-'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
};
const entry = (value) => ({ value, from: 'the Noctalia palette' });

test('no report directory is no reports', () => {
  assert.deepEqual(readEffective(defs, path.join(os.tmpdir(), 'prism-effective-absent', 'x')), new Map());
});

test('reports from every sink join by key, ignoring temp files', () => {
  const dir = dirWith({
    'niri.json': JSON.stringify({ 'glass.ring.color': entry('#a1b2c3') }),
    'other.json': JSON.stringify({ 'glass.attenuationColor': entry('#000000') }),
    'niri.json.123.tmp': '{ half written',
  });
  assert.deepEqual(readEffective(defs, dir), new Map([
    ['glass.ring.color', entry('#a1b2c3')],
    ['glass.attenuationColor', entry('#000000')],
  ]));
});

test('a malformed report fails naming its file', () => {
  for (const [text, pattern] of [
    ['{ broken', /niri\.json: not valid JSON/],
    ['[]', /niri\.json: expected an object of reported values/],
    [JSON.stringify({ 'glass.ring.color': { value: 7, from: 'x' } }), /niri\.json: glass\.ring\.color needs a string value and from/],
    [JSON.stringify({ 'glass.ring.color': { value: '#000000' } }), /niri\.json: glass\.ring\.color needs a string value and from/],
    [JSON.stringify({ 'glass.ring.color': entry('garbage') }), /niri\.json: glass\.ring\.color: not a #rrggbb\[aa\] color/],
    [JSON.stringify({ 'glass.ring.color': entry('#zzzzzz') }), /niri\.json: glass\.ring\.color: not a #rrggbb\[aa\] color/],
    [JSON.stringify({ 'other.color': entry('#000000') }), /niri\.json: reports other\.color, which no def declares/],
  ]) {
    assert.throws(() => readEffective(defs, dirWith({ 'niri.json': text })), pattern);
  }
});

test('two sinks reporting one key is an error naming both', () => {
  const dir = dirWith({
    'a.json': JSON.stringify({ 'glass.ring.color': entry('#000000') }),
    'b.json': JSON.stringify({ 'glass.ring.color': entry('#ffffff') }),
  });
  assert.throws(() => readEffective(defs, dir), /glass\.ring\.color is reported by both a\.json and b\.json/);
});

test('an unreadable report fails naming its file, not as invalid JSON', () => {
  const dir = dirWith({});
  fs.mkdirSync(path.join(dir, 'niri.json'));
  assert.throws(
    () => readEffective(defs, dir),
    (error) => /niri\.json/.test(error.message) && !/not valid JSON/.test(error.message),
  );
});
