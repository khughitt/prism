import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDefs } from '../src/defs.js';
import { loadRack } from '../src/rack.js';
import { loadDry } from '../src/dry.js';
import { loadManifests } from '../src/manifest.js';
import { nodeMap } from '../src/nodes.js';
import { renderInteractions } from '../src/interactions.js';
import { defsDir, integrationsDir } from '../src/paths.js';

const DOC = fileURLToPath(new URL('../docs/notes/pipeline-interactions.md', import.meta.url));
const BEGIN = '<!-- interactions:begin -->';
const END = '<!-- interactions:end -->';

test('the structural block of the interaction document is generated', () => {
  const defs = loadDefs(defsDir());
  const rack = loadRack(defsDir(), defs, { dry: loadDry(integrationsDir()), nodes: nodeMap(loadManifests(integrationsDir(), defs)) });
  const expected = `\n${renderInteractions(rack)}\n`;
  const doc = fs.readFileSync(DOC, 'utf8');
  const a = doc.indexOf(BEGIN) + BEGIN.length;
  const b = doc.indexOf(END);
  assert.ok(a > BEGIN.length - 1 && b > a, 'the document carries both markers');
  if (process.env.PRISM_DOCS_UPDATE) {
    fs.writeFileSync(DOC, doc.slice(0, a) + expected + doc.slice(b));
    return;
  }
  assert.equal(doc.slice(a, b), expected, 'docs/notes/pipeline-interactions.md is stale; rerun with PRISM_DOCS_UPDATE=1');
});

test('the table has one row per structural cell and keeps the decision', () => {
  const defs = loadDefs(defsDir());
  const rack = loadRack(defsDir(), defs, { dry: loadDry(integrationsDir()), nodes: nodeMap(loadManifests(integrationsDir(), defs)) });
  const table = renderInteractions(rack);
  const rows = table.trim().split('\n').slice(2);
  assert.equal(rows.length, 3);
  assert.match(rows[0], /^\| Backdrop \| Refraction \| attenuates \| schema \| .*\| expose \|$/);
  assert.match(rows[1], /^\| Fringing \| Refraction \| requires \| dry \| .*\| expose \|$/);
  assert.match(rows[2], /^\| Directional blur \| Refraction \| requires \| dry \| .*\| expose \|$/);
});

test('the source column is the interaction\'s own source, not a match on its text', () => {
  const rack = { devices: [
    { device: 'a', label: 'A', interactions: [] },
    { device: 'b', label: 'B', interactions: [
      { kind: 'requires', device: 'a', why: 'a feeds b [expose]', source: 'schema' },
      { kind: 'requires', device: 'a', why: 'a feeds b [expose]', source: 'dry' },
    ] },
  ] };
  assert.deepEqual(renderInteractions(rack).split('\n').slice(2), [
    '| B | A | requires | schema | a feeds b | expose |',
    '| B | A | requires | dry | a feeds b | expose |',
  ]);
  const bare = (source) => ({ devices: [{ device: 'a', label: 'A', interactions: [] },
    { device: 'b', label: 'B', interactions: [{ kind: 'requires', device: 'a', why: 'a feeds b', source }] }] });
  assert.throws(() => renderInteractions(bare('schema')), /interaction on b: schema edge has no \[decision\] suffix: a feeds b/);
  assert.match(renderInteractions(bare('dry')), /\| B \| A \| requires \| dry \| a feeds b \| expose \|/);
  assert.throws(() => renderInteractions(bare('guess')), /interaction on b: unknown source guess/);
});
