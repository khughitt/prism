import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

const niriRoot = process.argv[2];
if (!niriRoot) throw new Error('usage: npm run test:niri-glass-contract -- PATH');

const sources = ['GlassMaterial.qml', 'PreviewSurface.qml']
  .map((name) => fs.readFileSync(path.join(path.resolve(niriRoot), name), 'utf8'))
  .join('\n');
// This recognizes direct config.foo reads; update the scanner if QML access
// style changes.
const qmlKeys = [...sources.matchAll(/\bconfig\.([a-z][a-zA-Z0-9]*)\b/g)]
  .map((match) => `glass.${match[1]}`);
const expected = [...new Set(qmlKeys)].sort();
const actual = [...loadDefs(defsDir()).values()]
  .filter((def) => def.ui.affectsPreview === true)
  .map((def) => def.key)
  .sort();

assert.deepEqual(actual, expected);
console.log(`preview contract: ok (${actual.length} params)`);
