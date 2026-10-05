import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDefs } from '../src/defs.js';
import { loadRack } from '../src/rack.js';
import { loadPipeline } from '../src/pipeline.js';
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
  const expected = `\n${renderInteractions(rack, loadPipeline(defsDir()))}\n`;
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
  const table = renderInteractions(rack, loadPipeline(defsDir()));
  const rows = table.trim().split('\n').slice(2);
  assert.equal(rows.length, 3);
  assert.match(rows[0], /^\| Backdrop \| Refraction \| attenuates \| schema \| .*\| expose \|$/);
  assert.match(rows[1], /^\| Fringing \| Refraction \| requires \| dry \| .*\| expose \|$/);
  assert.match(rows[2], /^\| Directional blur \| Refraction \| requires \| dry \| .*\| expose \|$/);
});
