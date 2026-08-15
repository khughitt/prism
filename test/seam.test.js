import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN = /niri|kitty|ghostty|noctalia/i;
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

test('src/ and bin/ never name a specific compositor, terminal, or shell', () => {
  for (const file of [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'bin'))]) {
    const hit = fs.readFileSync(file, 'utf8').match(FORBIDDEN);
    assert.equal(hit, null, `${file} contains forbidden name "${hit?.[0]}"`);
  }
});
