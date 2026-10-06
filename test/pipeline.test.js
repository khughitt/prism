import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPipeline, validatePipeline } from '../src/pipeline.js';
import { defsDir } from '../src/paths.js';

const shipped = () => JSON.parse(fs.readFileSync(path.join(defsDir(), 'rack', 'pipeline.json'), 'utf8'));

test('the shipped schema loads with indexes', () => {
  const schema = loadPipeline(defsDir());
  assert.equal(schema.version, 1);
  assert.deepEqual(schema.sites.map((s) => s.id), [
    'source', 'normal', 'taps', 'behind', 'attenuation', 'within', 'specular', 'emissive', 'encode', 'post', 'background-effect',
  ]);
  assert.equal(schema.siteIndex.get('behind'), 3);
  assert.equal(schema.stageById.get('noise').site, 'behind');
  assert.ok(schema.stageIndex.get('saturation') < schema.stageIndex.get('noise'));
  assert.ok(schema.stageIndex.get('noise') < schema.stageIndex.get('tint'));
});

test('rejects an unknown version', () => {
  const s = shipped();
  s.version = 2;
  assert.throws(() => validatePipeline(s), /pipeline schema version 2 is not supported; this prism reads version 1/);
});

test('rejects a malformed shape and names the field', () => {
  const missing = shipped();
  delete missing.sites[0].law;
  assert.throws(() => validatePipeline(missing), /site source: law must be one of sequence\|sum\|product\|coupled/);

  const badScope = shipped();
  badScope.stages.find((st) => st.id === 'blur').scope = 'global';
  assert.throws(() => validatePipeline(badScope), /stage blur: scope must be one of output\|material\|window/);

  const orphan = shipped();
  orphan.stages.find((st) => st.id === 'blur').site = 'nowhere';
  assert.throws(() => validatePipeline(orphan), /stage blur: unknown site nowhere/);

  const badOptic = shipped();
  badOptic.stages.find((st) => st.id === 'noise').optic = { name: 'noise', hook: 'behind' };
  assert.throws(() => validatePipeline(badOptic), /stage noise: optic\.program must be one of material\|effect\|postprocess/);

  const badEdge = shipped();
  badEdge.interactions.push({ kind: 'requires', from: 'noise', on: 'ghost', why: 'x' });
  assert.throws(() => validatePipeline(badEdge), /interaction requires noise -> ghost: unknown stage ghost/);

  const notObject = shipped();
  notObject.stages = {};
  assert.throws(() => validatePipeline(notObject), /stages must be a non-empty list/);
});

test('owns is a partition and reads covers owns', () => {
  const schema = loadPipeline(defsDir());
  const owned = schema.stages.flatMap((st) => st.owns);
  assert.equal(new Set(owned).size, owned.length, 'a parameter is owned once');
  for (const st of schema.stages) {
    for (const p of st.owns) assert.ok(st.reads.includes(p), `${st.id} reads what it owns (${p})`);
  }
});
