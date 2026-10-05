# Pipeline Schema (prism side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor the renderer's pipeline schema, validate the rack against it, derive `requires` from the schema and the sink's dry file, and let the panel color and hint from resolved schema data.

**Architecture:** `src/pipeline.js` loads and shape-checks the vendored `defs/rack/pipeline.json`. `src/rack.js` gains the schema, the dry file, and the manifest's native-node map as inputs, validates `stage`, order, ownership, and derives `requires` and `interactions` onto each device. `describe --json` carries the resolved fields, and the Noctalia panel reads `family` for color and `interactions` for the attenuates hint. A contract test compares the vendored copy with the niri-material checkout when one is reachable.

**Tech Stack:** Node 26 ES modules, `node:test`, the `yaml` package, Luau panel with the `lua` test runner, `just test-fast` as the only test front door.

**Spec:** `docs/specs/2026-10-04-pipeline-schema-design.md` (Sections 3, 4, 6). The renderer side is the niri-material plan `docs/plans/2026-10-05-pipeline-schema.md` there; its Task 3 produces `resources/materials/pipeline.json`, which Task 1 below vendors. Start Task 1 only after that file exists.

## Global Constraints

- Never call a test runner directly: `just test-fast` is the front door; there is no `test-one` recipe in this project.
- Fail on load, name the device, stage, or parameter, never guess (spec Section 6).
- The bus stays flat; no new keys are added by this plan.
- `defs/rack/pipeline.json` is a byte copy of niri-material's `resources/materials/pipeline.json`; never hand-edit it.
- The sink's output is unchanged: the niri golden tests must pass with the same expected KDL.
- `tasks start <step id>` before each task, `tasks done <step id>` in the task's commit; `tasks check` before every commit.
- Commit messages are conventional commits, no attribution trailers.

## Review Focus

1. A vendored schema with `version: 2` must fail `loadRack` with a message naming the version, not be parsed on a best-effort basis (Task 1 test `rejects an unknown version`).
2. A prism key bound with a `node` that no stage owns (a typo such as `node: roughnes`) must fail the manifest test, not silently exempt the key from ownership (Task 3 test `every manifest node is owned by a stage`).
3. A device whose `mix` row binds to a node owned by a different stage (Depth placed on Tint) must fail with the device and the owning stage named (Task 4 test `a device key owned by another stage`).
4. Two devices that would both derive `requires` on each other through the dry file must fail rather than loop (Task 4 test `requires derivation refuses two sources`).
5. The panel must not crash on a device without `interactions` (an older `describe`): the hint reads an absent list as empty, and the light still renders (Task 4 Lua test `a device without interactions renders`).

---

### Task 1: Vendored schema loader and contract test

**Files:**
- Create: `defs/rack/pipeline.json` (copied from niri-material `resources/materials/pipeline.json`)
- Create: `src/pipeline.js`
- Test: `test/pipeline.test.js`
- Test: `test/pipeline-contract.test.js`

**Interfaces:**
- Consumes: niri-material's generated file (its plan, Task 3).
- Produces: `loadPipeline(dir) -> { version, sites, stages, interactions, siteIndex: Map<siteId, number>, stageById: Map<stageId, stage>, stageIndex: Map<stageId, number> }`; `validatePipeline(schema) -> schema` (same return); constants `CARRIERS`, `LAWS`, `COVERAGES`, `COSTS`, `SCOPES`, `PROGRAMS`, `KINDS`, `BLUR_FIELDS`.

- [ ] **Step 1: Copy the generated file**

```bash
cp "${NIRI_MATERIAL_DIR:-$HOME/d/niri-material}/resources/materials/pipeline.json" defs/rack/pipeline.json
```

- [ ] **Step 2: Write the failing shape tests**

`test/pipeline.test.js`:

```js
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
  badScope.stages[0].scope = 'global';
  assert.throws(() => validatePipeline(badScope), /stage blur: scope must be one of output\|material\|window/);

  const orphan = shipped();
  orphan.stages[0].site = 'nowhere';
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
```

`test/pipeline-contract.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defsDir } from '../src/paths.js';

// Where the renderer checkout is: the environment first, then the tasks
// registry. Neither resolving skips the comparison and says so.
function rendererRoot() {
  if (process.env.NIRI_MATERIAL_DIR) return process.env.NIRI_MATERIAL_DIR;
  const run = spawnSync('tasks', ['projects'], { encoding: 'utf8' });
  if (run.status !== 0) return null;
  const { projects } = JSON.parse(run.stdout);
  const entry = projects.find((p) => p.prefix === 'material' && p.reachable);
  return entry ? entry.root : null;
}

test('the vendored schema is byte-identical to the renderer checkout', (t) => {
  const root = rendererRoot();
  if (root === null) {
    t.skip('no niri-material checkout: set NIRI_MATERIAL_DIR or register the material project');
    return;
  }
  const theirs = path.join(root, 'resources', 'materials', 'pipeline.json');
  const ours = path.join(defsDir(), 'rack', 'pipeline.json');
  assert.equal(
    fs.readFileSync(ours, 'utf8'),
    fs.readFileSync(theirs, 'utf8'),
    `defs/rack/pipeline.json differs from ${theirs}; copy the newer one over the other`,
  );
});
```

- [ ] **Step 3: Run the suite to see the new tests fail**

Run: `just test-fast`
Expected: FAIL in `test/pipeline.test.js` with `Cannot find module '../src/pipeline.js'`; the contract test either passes (file just copied) or skips.

- [ ] **Step 4: Write the loader**

`src/pipeline.js`:

```js
import fs from 'node:fs';
import path from 'node:path';

// The renderer's pipeline schema, vendored as a byte copy of niri-material's
// resources/materials/pipeline.json. This module checks the copy's version
// and shape at load; freshness against the checkout is the contract test's
// job (docs/specs/2026-10-04-pipeline-schema-design.md, Section 3).
export const VERSION = 1;
export const CARRIERS = ['texture', 'normal', 'linear', 'light', 'encoded'];
export const LAWS = ['sequence', 'sum', 'product', 'coupled'];
export const COVERAGES = ['backdrop', 'glass', 'window'];
export const COSTS = ['cached', 'fragment'];
export const SCOPES = ['output', 'material', 'window'];
export const PROGRAMS = ['material', 'effect', 'postprocess'];
export const KINDS = ['requires', 'attenuates', 'shadows'];
export const BLUR_FIELDS = ['blur passes', 'blur offset', 'blur noise', 'blur saturation'];

const fail = (msg) => { throw new Error(`invalid pipeline schema: ${msg}`); };
const oneOf = (where, field, value, allowed) => {
  if (!allowed.includes(value)) fail(`${where}: ${field} must be one of ${allowed.join('|')}`);
};
const strings = (where, field, value) => {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) fail(`${where}: ${field} must be a list of strings`);
};
const nonEmptyList = (field, value) => {
  if (!Array.isArray(value) || value.length === 0) fail(`${field} must be a non-empty list`);
};

export function loadPipeline(dir) {
  const file = path.join(dir, 'rack', 'pipeline.json');
  return validatePipeline(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function validatePipeline(schema) {
  if (schema?.version !== VERSION) {
    fail(`pipeline schema version ${schema?.version} is not supported; this prism reads version ${VERSION}`);
  }
  nonEmptyList('sites', schema.sites);
  nonEmptyList('stages', schema.stages);
  if (!Array.isArray(schema.interactions)) fail('interactions must be a list');

  const siteIndex = new Map();
  schema.sites.forEach((site, i) => {
    const where = `site ${site?.id ?? '?'}`;
    if (typeof site?.id !== 'string' || site.id === '') fail(`${where}: id required`);
    if (siteIndex.has(site.id)) fail(`${where}: duplicate id`);
    oneOf(where, 'carrier', site.carrier, CARRIERS);
    oneOf(where, 'law', site.law, LAWS);
    if (typeof site.orderable !== 'boolean') fail(`${where}: orderable must be a boolean`);
    oneOf(where, 'coverage', site.coverage, COVERAGES);
    oneOf(where, 'cost', site.cost, COSTS);
    siteIndex.set(site.id, i);
  });

  const stageById = new Map();
  const stageIndex = new Map();
  let lastSite = -1;
  schema.stages.forEach((stage, i) => {
    const where = `stage ${stage?.id ?? '?'}`;
    if (typeof stage?.id !== 'string' || stage.id === '') fail(`${where}: id required`);
    if (stageById.has(stage.id)) fail(`${where}: duplicate id`);
    if (!siteIndex.has(stage.site)) fail(`${where}: unknown site ${stage.site}`);
    const site = siteIndex.get(stage.site);
    if (site < lastSite) fail(`${where}: out of site order`);
    lastSite = site;
    oneOf(where, 'scope', stage.scope, SCOPES);
    strings(where, 'owns', stage.owns);
    strings(where, 'reads', stage.reads);
    strings(where, 'responses', stage.responses);
    if (typeof stage.animated !== 'boolean') fail(`${where}: animated must be a boolean`);
    if (stage.optic !== undefined) {
      if (typeof stage.optic?.name !== 'string' || typeof stage.optic?.hook !== 'string') fail(`${where}: optic needs name and hook`);
      oneOf(where, 'optic.program', stage.optic.program, PROGRAMS);
    }
    if (stage.selector !== undefined) {
      if (typeof stage.selector?.param !== 'string' || typeof stage.selector?.variant !== 'string') fail(`${where}: selector needs param and variant`);
    }
    stageById.set(stage.id, stage);
    stageIndex.set(stage.id, i);
  });

  for (const edge of schema.interactions) {
    const where = `interaction ${edge?.kind} ${edge?.from} -> ${edge?.on}`;
    oneOf(where, 'kind', edge?.kind, KINDS);
    for (const end of [edge.from, edge.on]) {
      if (!stageById.has(end)) fail(`${where}: unknown stage ${end}`);
    }
    if (edge.from === edge.on) fail(`${where}: source and target must differ`);
    if (typeof edge.why !== 'string' || edge.why === '') fail(`${where}: why required`);
  }

  return { ...schema, siteIndex, stageById, stageIndex };
}
```

- [ ] **Step 5: Run the suite to see them pass**

Run: `just test-fast`
Expected: PASS, including `test/pipeline.test.js` (4 tests) and the contract test (pass or skip with its reason).

- [ ] **Step 6: Commit**

```bash
tasks done <step id> "vendored pipeline.json, src/pipeline.js shape check, contract test against the renderer checkout"
git add defs/rack/pipeline.json src/pipeline.js test/pipeline.test.js test/pipeline-contract.test.js tasks/
git commit -m "feat(rack): vendor the renderer's pipeline schema with a shape check and a contract test (prism-eef38f)"
```

---

### Task 2: The dry table moves to `integrations/niri/dry.yaml`

**Files:**
- Create: `integrations/niri/dry.yaml`
- Modify: `integrations/niri/render.js:97-114` (replace the `DRY` literal with a loader)
- Test: `test/niri-render.test.js:565-568`

**Interfaces:**
- Produces: `loadDry() -> Record<bypassKey, Record<field, value>>` exported from `integrations/niri/render.js`; `DRY` stays exported and equals `loadDry()`'s result, so existing imports keep working.

- [ ] **Step 1: Write the failing test**

Append to `test/niri-render.test.js` after the cross-check test at line 568:

```js
test('the dry table is the yaml file, verbatim', () => {
  const file = parse(fs.readFileSync(path.join(integrationsDir(), 'niri', 'dry.yaml'), 'utf8'));
  assert.deepEqual(DRY, file);
  assert.deepEqual(loadDry(), file);
  assert.deepEqual(DRY['glass.bypass.refraction'], { ior: 1, chromaticAberration: 0, anisotropicBlur: 0 });
});
```

Update the imports at the top of the file:

```js
import { renderNiriFragment, DRY, loadDry, sourceColors } from '../integrations/niri/render.js';
import { defsDir, integrationsDir, stateDir } from '../src/paths.js';
```

- [ ] **Step 2: Run the suite to see it fail**

Run: `just test-fast`
Expected: FAIL with `loadDry` not exported (SyntaxError on import) in `test/niri-render.test.js`.

- [ ] **Step 3: Write the yaml and the loader**

`integrations/niri/dry.yaml`:

```yaml
# What "off" means for each rack device, keyed by its bypass parameter. The
# rack (defs/rack/devices.yaml) says where a device sits in the chain; this
# file says what the material does without it, which is sink knowledge. The
# rack loader also reads it: a device whose mix is written by another
# device's entry requires that device (Fringing and Directional blur under
# Refraction, whose entry zeroes both so "bypass Refraction" means no
# refraction at all).
glass.bypass.backdrop: {roughness: 0, backdropBlur: false}
glass.bypass.distortion: {distortion: 0}
glass.bypass.refraction: {ior: 1, chromaticAberration: 0, anisotropicBlur: 0}
glass.bypass.fringing: {chromaticAberration: 0}
glass.bypass.iridescence: {iridescence: 0}
glass.bypass.directionalBlur: {anisotropicBlur: 0}
glass.bypass.tint: {attenuationColor: "#ffffff"}
glass.bypass.aurora: {aurora: 0}
glass.bypass.saturation: {saturation: 1}
glass.bypass.noise: {noise: 0}
```

In `integrations/niri/render.js`, replace lines 97 to 114 (the comment and the `DRY` literal) with:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// What "off" means for each rack device lives in dry.yaml beside this file;
// the rack loader reads the same file to derive which device requires which.
export function loadDry() {
  const file = fileURLToPath(new URL('./dry.yaml', import.meta.url));
  const dry = parse(fs.readFileSync(file, 'utf8'));
  for (const [key, fields] of Object.entries(dry)) {
    if (!key.startsWith('glass.bypass.')) throw new Error(`dry.yaml: ${key} is not a bypass key`);
    if (typeof fields !== 'object' || fields === null || Object.keys(fields).length === 0) {
      throw new Error(`dry.yaml: ${key} must map to at least one field`);
    }
  }
  return dry;
}

export const DRY = loadDry();
```

Move the three `import` lines to the top of `render.js` with the existing imports (ES modules hoist imports, but keep them together for the reader). Delete any now-duplicate import of `fs`, `path`, or `parse` that `render.js` already had.

- [ ] **Step 4: Run the suite to see it pass**

Run: `just test-fast`
Expected: PASS; the niri golden tests are unchanged.

- [ ] **Step 5: Commit**

```bash
tasks done <step id> "DRY moved to integrations/niri/dry.yaml; render.js loads it; table pinned verbatim"
git add integrations/niri/dry.yaml integrations/niri/render.js test/niri-render.test.js tasks/
git commit -m "refactor(niri): move the dry table to dry.yaml so the rack loader can read it (prism-eef38f)"
```

---

### Task 3: Native node per bound parameter in the sink manifest

**Files:**
- Modify: `integrations/niri/manifest.yaml` (every `glass.*` bind that writes a material parameter)
- Modify: `src/manifest.js:20-29` (validate `node`)
- Create: `src/nodes.js`
- Test: `test/manifest.test.js`
- Test: `test/niri-render.test.js`

**Interfaces:**
- Produces: `nodeMap(manifests) -> Map<prismKey, node>` in `src/nodes.js`, built from every manifest bind that carries `node`; `loadManifests` accepts an optional string `node` on a bind.

- [ ] **Step 1: Write the failing tests**

Append to `test/manifest.test.js` (it already has a helper that writes a temporary manifest; reuse the file's existing fixture function, which the file names near its top; if it is `writeManifest(dir, yaml)`, call it as below):

```js
import { nodeMap } from '../src/nodes.js';

test('a bind may carry a native node, and it must be a non-empty string', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-manifest-node-'));
  fs.mkdirSync(path.join(dir, 'niri'));
  fs.writeFileSync(path.join(dir, 'niri', 'manifest.yaml'),
    'sink: niri\nbinds:\n  - {param: glass.roughness, node: roughness, liveness: reload}\n');
  const [m] = loadManifests(dir, loadDefs(defsDir()));
  assert.equal(m.binds[0].node, 'roughness');
  assert.deepEqual([...nodeMap([m])], [['glass.roughness', 'roughness']]);

  fs.writeFileSync(path.join(dir, 'niri', 'manifest.yaml'),
    'sink: niri\nbinds:\n  - {param: glass.roughness, node: "", liveness: reload}\n');
  assert.throws(() => loadManifests(dir, loadDefs(defsDir())), /manifest\.yaml: bad node "" for glass\.roughness/);
});
```

Append to `test/niri-render.test.js`:

```js
import { loadManifests } from '../src/manifest.js';
import { nodeMap } from '../src/nodes.js';
import { loadPipeline } from '../src/pipeline.js';

test('every manifest node is owned by a stage', () => {
  const schema = loadPipeline(defsDir());
  const owned = new Set(schema.stages.flatMap((st) => st.owns));
  const nodes = nodeMap(loadManifests(integrationsDir(), loadDefs(defsDir())));
  for (const [key, node] of nodes) {
    assert.ok(owned.has(node), `${key} binds node ${node}, which no stage owns`);
  }
  // Every material parameter the sink writes carries its node.
  for (const key of [
    'glass.ior', 'glass.thickness', 'glass.roughness', 'glass.backdropBlur', 'glass.noise', 'glass.noiseType',
    'glass.saturation', 'glass.attenuationColor', 'glass.attenuationDistance', 'glass.chromaticAberration',
    'glass.anisotropicBlur', 'glass.distortion', 'glass.distortionScale', 'glass.iridescence', 'glass.aurora',
    'glass.auroraDriftHz', 'glass.auroraColorA', 'glass.auroraColorB', 'glass.paneLip', 'glass.paneShiftX',
    'glass.paneShiftY', 'glass.jellyFlex', 'glass.jellyRipple', 'glass.lightIor',
    'glass.inactive.ior', 'glass.inactive.thickness', 'glass.inactive.roughness', 'glass.inactive.noise',
  ]) {
    assert.ok(nodes.has(key), `${key} has no node in the niri manifest`);
  }
  assert.equal(nodes.get('glass.noiseType'), 'noise type=');
  assert.equal(nodes.get('glass.distortionScale'), 'distortion scale=');
  assert.equal(nodes.get('glass.auroraColorA'), 'aurora color');
  assert.equal(nodes.get('glass.paneLip'), 'bevel');
  assert.equal(nodes.has('glass.tintSource'), false);
  assert.equal(nodes.has('glass.bypass.noise'), false);
  assert.equal(nodes.has('glass.ring.gap'), false, 'ring keys write response fields, not parameters');
});
```

- [ ] **Step 2: Run the suite to see them fail**

Run: `just test-fast`
Expected: FAIL with `Cannot find module '../src/nodes.js'`.

- [ ] **Step 3: Validate `node` in the manifest loader and add the map**

In `src/manifest.js`, inside the `for (const b of m.binds)` loop after the `drag` checks, add:

```js
      if (b.node !== undefined && (typeof b.node !== 'string' || b.node.trim() === '')) {
        throw new Error(`${file}: bad node ${JSON.stringify(b.node)} for ${b.param}`);
      }
```

`src/nodes.js`:

```js
// The prism-key-to-native-node map the niri sink declares in its manifest:
// which `ParamSpec.node` (the renderer's spelling, "noise type=") a key
// writes. Keys with no native node (bypass toggles, tint source, ring keys
// that write response fields) are absent. The rack loader uses it to check
// that a device's keys are owned by the device's stage.
export function nodeMap(manifests) {
  const nodes = new Map();
  for (const manifest of manifests) {
    for (const bind of manifest.binds) {
      if (bind.node === undefined) continue;
      const prior = nodes.get(bind.param);
      if (prior !== undefined && prior !== bind.node) {
        throw new Error(`${bind.param} binds two nodes: ${prior} and ${bind.node}`);
      }
      nodes.set(bind.param, bind.node);
    }
  }
  return nodes;
}
```

- [ ] **Step 4: Add `node:` to every material bind in `integrations/niri/manifest.yaml`**

Rewrite each listed bind with its node (the `inactive.` twin takes the same node). The complete map:

| Prism key (and `glass.inactive.` twin where one exists) | `node` |
| --- | --- |
| `glass.paneLip` | `bevel` |
| `glass.paneShiftX` / `glass.paneShiftY` | `offset-x` / `offset-y` |
| `glass.ior` | `ior` |
| `glass.lightIor` | `light-ior` |
| `glass.thickness` | `thickness` |
| `glass.attenuationColor` | `attenuation-color` |
| `glass.attenuationDistance` | `attenuation-distance` |
| `glass.chromaticAberration` | `chromatic-aberration` |
| `glass.distortion` | `distortion` |
| `glass.distortionScale` | `distortion scale=` |
| `glass.anisotropicBlur` | `anisotropic-blur` |
| `glass.roughness` | `roughness` |
| `glass.backdropBlur` | `backdrop-blur` |
| `glass.jellyFlex` | `jelly-flex` |
| `glass.jellyRipple` | `jelly-ripple` |
| `glass.noise` | `noise` |
| `glass.noiseType` | `noise type=` |
| `glass.saturation` | `saturation` |
| `glass.iridescence` | `iridescence` |
| `glass.aurora` | `aurora` |
| `glass.auroraDriftHz` | `aurora drift-hz` |
| `glass.auroraColorA` / `glass.auroraColorB` | `aurora color` |

For example the roughness line becomes `- {param: glass.roughness, node: roughness, liveness: reload}` and the noise-type line `- {param: glass.noiseType, node: "noise type=", liveness: reload}`. `compositor.gaps`, `terminal.apps`, `glass.enabled`, `glass.focusSplit`, `glass.tintSource`, `glass.tintAccentMix`, every `glass.bypass.*`, and every `glass.ring.*` bind stay as they are.

- [ ] **Step 5: Run the suite to see them pass**

Run: `just test-fast`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
tasks done <step id> "manifest binds carry node; nodeMap(); every node checked against the schema's owned set"
git add integrations/niri/manifest.yaml src/manifest.js src/nodes.js test/manifest.test.js test/niri-render.test.js tasks/
git commit -m "feat(niri): declare the native node each bound parameter writes (prism-eef38f)"
```

---

### Task 4: The rack validates against the schema, derives `requires`, and the panel follows

One task, not two: `describe` stops emitting `category` and the panel stops reading it, and the plugin contract test feeds real `describe` output through the panel, so the producer and the consumer change in one commit.

**Files:**
- Modify: `defs/rack/devices.yaml`
- Modify: `src/rack.js`
- Modify: `src/cli.js:239-245` (pass dry and nodes to `loadRack`)
- Modify: `integrations/noctalia-plugin/presentation.luau:314-316, 372-392`
- Modify: `integrations/noctalia-plugin/panel.luau:674-685, 708-735`
- Modify: `integrations/noctalia-plugin/plugin_test.lua` (fixtures and the category assertions)
- Modify: `test/plugin-panel-lifecycle.test.js:25`
- Modify: `README.md:66-70`
- Test: `test/rack.test.js`
- Test: `test/cli.test.js:175-189`

**Interfaces:**
- Consumes: `loadPipeline` (Task 1), `loadDry` (Task 2), `nodeMap` (Task 3).
- Produces: `loadRack(dir, defs, { dry, nodes }) -> rack`; `validateRack(rack, defs, schema, dry, nodes) -> rack`; `FAMILIES`, `familyOf(siteId)`. Each returned device carries `stage`, `site`, `scope`, `family`, `interactions: [{kind, device, why}]`, and `requires` when derived. `rack.shared` is the list of stage ids from the file. On the panel side: `Presentation.familyColors` (five entries) and cards with `family` and `attenuatedBy` (a list of `{card, why}` for `attenuates` entries whose named device is bypassed).

- [ ] **Step 1: Rewrite `defs/rack/devices.yaml`**

```yaml
# The rack: the Focus group as an ordered list of devices, each naming the
# pipeline stage it controls (defs/rack/pipeline.json, vendored from
# niri-material). Order, families, and `requires` are derived from the schema
# and the niri sink's dry file (integrations/niri/dry.yaml); the file carries
# only presentation. `shared` names stages prism exposes outside the rack.
# `mix` and `rows` name matrix rows by their ui.row label; `shared` on a device
# names keys with no state; `bypass` names the device's bool toggle. Every
# visible parameter in the group other than its header toggle must belong to
# exactly one device.
group: Focus
shared: [slab, ripple, ring]
devices:
  - device: backdrop
    label: Backdrop
    stage: prefilter
    mix: Blur
    rows: [Frosted backdrop]
    shared: []
    bypass: glass.bypass.backdrop
  - device: distortion
    label: Distortion
    stage: distortion
    mix: Distortion
    rows: [Distortion detail]
    shared: []
    bypass: glass.bypass.distortion
  - device: refraction
    label: Refraction
    stage: refraction
    mix: Refraction
    rows: [Depth]
    shared: []
    bypass: glass.bypass.refraction
  - device: fringing
    label: Fringing
    stage: fringing
    mix: Fringing
    rows: []
    shared: []
    bypass: glass.bypass.fringing
  - device: directionalBlur
    label: Directional blur
    stage: directional-blur
    mix: Directional blur
    rows: []
    shared: []
    bypass: glass.bypass.directionalBlur
  - device: saturation
    label: Saturation
    stage: saturation
    mix: Saturation
    rows: []
    shared: []
    bypass: glass.bypass.saturation
  - device: noise
    label: Noise
    stage: noise
    mix: Noise
    rows: []
    shared: [glass.noiseType]
    bypass: glass.bypass.noise
  - device: tint
    label: Tint
    stage: tint
    mix: Tint
    rows: [Tint distance]
    shared: [glass.tintSource, glass.tintAccentMix]
    bypass: glass.bypass.tint
  - device: aurora
    label: Aurora
    stage: aurora
    mix: Aurora
    rows: [Drift rate, Color A, Color B]
    shared: []
    bypass: glass.bypass.aurora
  - device: iridescence
    label: Iridescence
    stage: iridescence
    mix: Iridescence
    rows: []
    shared: []
    bypass: glass.bypass.iridescence
```

- [ ] **Step 2: Rewrite the rack tests**

Replace `test/rack.test.js` wholesale:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDefs } from '../src/defs.js';
import { loadRack, validateRack, familyOf } from '../src/rack.js';
import { loadPipeline, validatePipeline } from '../src/pipeline.js';
import { loadDry } from '../integrations/niri/render.js';
import { loadManifests } from '../src/manifest.js';
import { nodeMap } from '../src/nodes.js';
import { defsDir, integrationsDir } from '../src/paths.js';

// A small group with two matrix rows, one shared select, one header toggle,
// and two bypass toggles, so every validation rule has something to bite.
const DEFS = `
- {key: t.on, type: bool, default: true, neutral: true, ui: {group: Title, control: toggle, label: On, order: 0}, description: d}
- {key: r.split, type: bool, default: true, neutral: true, ui: {group: R, control: toggle, label: Split, order: 1, header: true}, description: d}
- {key: r.blur, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Blur, order: 2, state: focused, row: Blur}, description: d}
- {key: r.inactive.blur, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused blur, order: 3, state: unfocused, row: Blur}, description: d}
- {key: r.depth, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Depth, order: 4, state: focused, row: Depth}, description: d}
- {key: r.inactive.depth, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused depth, order: 5, state: unfocused, row: Depth}, description: d}
- {key: r.kind, type: enum, values: [a, b], default: a, neutral: a, ui: {group: R, control: select, label: Kind, order: 6}, description: d}
- {key: r.bypass.one, type: bool, default: false, neutral: false, ui: {group: R, control: toggle, label: Bypass one, order: 7}, description: d}
- {key: r.bypass.two, type: bool, default: false, neutral: false, ui: {group: R, control: toggle, label: Bypass two, order: 8}, description: d}
- {key: r.amount, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Amount, order: 9}, description: d}
- {key: r.gain, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Gain, order: 10, state: focused, row: Gain}, description: d}
- {key: r.inactive.gain, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused gain, order: 11, state: unfocused, row: Gain}, description: d}
- {key: r.bypass.three, type: bool, default: false, neutral: false, ui: {group: R, control: toggle, label: Bypass three, order: 12}, description: d}
- {key: g.gap, type: int, range: [0, 9], default: 1, neutral: 1, ui: {group: G, control: slider, step: 1, label: Gap, order: 13}, description: d}
`;

function defsFrom(yamlText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-rack-'));
  fs.writeFileSync(path.join(dir, 'a.yaml'), yamlText);
  return loadDefs(dir);
}

const defs = defsFrom(DEFS);

// A two-site schema on real site ids (familyOf knows only those): `one`,
// `two`, and `three` are devices at behind, a sequence site; `four` owns gap
// at within and is a shared stage (g.gap is in group G, so no device can
// carry it).
const SCHEMA = () => validatePipeline({
  version: 1,
  sites: [
    { id: 'behind', carrier: 'linear', law: 'sequence', orderable: false, coverage: 'glass', cost: 'fragment' },
    { id: 'within', carrier: 'light', law: 'sum', orderable: false, coverage: 'glass', cost: 'fragment' },
  ],
  stages: [
    { id: 'one', site: 'behind', scope: 'material', owns: ['blur', 'kind'], reads: ['blur', 'kind'], responses: [], animated: false },
    { id: 'two', site: 'behind', scope: 'material', owns: ['depth', 'amount'], reads: ['depth', 'amount', 'blur'], responses: [], animated: false },
    { id: 'three', site: 'behind', scope: 'material', owns: ['gain'], reads: ['gain'], responses: [], animated: false },
    { id: 'four', site: 'within', scope: 'output', owns: ['gap'], reads: ['gap'], responses: [], animated: false },
  ],
  interactions: [
    { kind: 'attenuates', from: 'one', on: 'two', why: 'blur scales depth [expose]' },
  ],
});
const NODES = new Map([
  ['r.blur', 'blur'], ['r.inactive.blur', 'blur'], ['r.depth', 'depth'], ['r.inactive.depth', 'depth'],
  ['r.kind', 'kind'], ['r.amount', 'amount'], ['r.gain', 'gain'], ['r.inactive.gain', 'gain'], ['g.gap', 'gap'],
]);
// Device one's dry entry zeroes depth, which device two's mix writes: two requires one.
const DRY = { 'r.bypass.one': { blur: 0, depth: 0 }, 'r.bypass.two': { depth: 0 }, 'r.bypass.three': { gain: 0 } };

const complete = () => ({ group: 'R', shared: ['four'], devices: [
  { device: 'one', label: 'One', stage: 'one', mix: 'Blur', rows: [], shared: ['r.kind'], bypass: 'r.bypass.one' },
  { device: 'two', label: 'Two', stage: 'two', mix: 'Depth', rows: [], shared: ['r.amount'], bypass: 'r.bypass.two' },
  { device: 'three', label: 'Three', stage: 'three', mix: 'Gain', rows: [], shared: [], bypass: 'r.bypass.three' },
] });

test('a complete rack validates and comes back resolved', () => {
  const rack = validateRack(complete(), defs, SCHEMA(), DRY, NODES);
  assert.deepEqual(rack.shared, ['four']);
  const [one, two, three] = rack.devices;
  assert.deepEqual([one.site, one.scope, one.family], ['behind', 'material', 'transmission']);
  assert.equal(Object.hasOwn(one, 'requires'), false);
  assert.deepEqual(one.interactions, []);
  assert.equal(two.requires, 'one');
  assert.deepEqual(two.interactions, [
    { kind: 'attenuates', device: 'one', why: 'blur scales depth [expose]' },
    { kind: 'requires', device: 'one', why: 'the r.bypass.one dry entry writes depth' },
  ]);
  assert.equal(Object.hasOwn(three, 'requires'), false, 'a device is not required by its own dry entry');
  assert.deepEqual(three.interactions, []);
});

test('the shipped rack loads against the shipped defs, schema, and dry file', () => {
  const shippedDefs = loadDefs(defsDir());
  const rack = loadRack(defsDir(), shippedDefs, {
    dry: loadDry(), nodes: nodeMap(loadManifests(integrationsDir(), shippedDefs)),
  });
  assert.equal(rack.group, 'Focus');
  assert.deepEqual(rack.shared, ['slab', 'ripple', 'ring']);
  assert.deepEqual(rack.devices.map((d) => d.device), [
    'backdrop', 'distortion', 'refraction', 'fringing', 'directionalBlur', 'saturation', 'noise', 'tint', 'aurora', 'iridescence',
  ]);
  assert.deepEqual(rack.devices.filter((d) => d.requires).map((d) => [d.device, d.requires]),
    [['fringing', 'refraction'], ['directionalBlur', 'refraction']]);
  const backdrop = rack.devices[0];
  assert.deepEqual([backdrop.stage, backdrop.site, backdrop.scope, backdrop.family], ['prefilter', 'source', 'material', 'source']);
  assert.deepEqual(backdrop.interactions.map((i) => [i.kind, i.device]), [['attenuates', 'refraction']]);
  assert.deepEqual(rack.devices.map((d) => d.family), [
    'source', 'geometry', 'transmission', 'transmission', 'transmission', 'transmission', 'transmission',
    'transmission', 'light', 'light',
  ]);
  assert.deepEqual(rack.devices.find((d) => d.device === 'tint').shared, ['glass.tintSource', 'glass.tintAccentMix']);
  assert.equal(rack.devices.some((d) => 'category' in d), false);
});

test('families follow the site', () => {
  assert.equal(familyOf('source'), 'source');
  assert.equal(familyOf('normal'), 'geometry');
  for (const s of ['taps', 'behind', 'attenuation']) assert.equal(familyOf(s), 'transmission');
  for (const s of ['within', 'specular', 'emissive']) assert.equal(familyOf(s), 'light');
  assert.equal(familyOf('post'), 'post');
  assert.throws(() => familyOf('encode'), /site encode has no family; no device may sit there/);
});

test('loadDefs still loads with the rack directory beside the def files', () => {
  const shipped = loadDefs(defsDir());
  assert.ok(shipped.has('glass.bypass.noise'));
  assert.ok(fs.existsSync(path.join(defsDir(), 'rack', 'devices.yaml')));
  assert.ok(fs.existsSync(path.join(defsDir(), 'rack', 'pipeline.json')));
});

test('a row with two parameters of one state is rejected before a device can claim it', () => {
  const doubled = defsFrom(DEFS + `- {key: r.blur2, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Blur again, order: 11, state: focused, row: Blur}, description: d}\n`);
  assert.throws(() => validateRack(complete(), doubled, SCHEMA(), DRY, NODES), /row Blur in group R has two focused parameters/);
});

const rackWith = (edit) => { const rack = complete(); edit(rack); return rack; };
const check = (rack, schema = SCHEMA(), dry = DRY, nodes = NODES) => validateRack(rack, defs, schema, dry, nodes);

test('the rack file shape is checked before its contents', () => {
  assert.throws(() => check({ shared: [], devices: complete().devices }), /group must be a non-empty string/);
  assert.throws(() => check({ group: 'R', shared: [], devices: [] }), /devices must be a non-empty list/);
  assert.throws(() => check({ group: 'R', devices: complete().devices }), /shared must be a list of stage ids/);
  assert.throws(() => check(rackWith((r) => { r.shared = ['nowhere']; })), /shared names unknown stage nowhere/);
});

test('device ids are camelCase and unique, labels present, no stray fields', () => {
  assert.throws(() => check(rackWith((r) => { r.devices[0].device = 'One'; })), /device One: bad id/);
  assert.throws(() => check(rackWith((r) => { r.devices[1].device = 'one'; })), /device one: duplicate id/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].label = ' '; })), /device one: label required/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].colour = 'red'; })), /device one: unknown field colour/);
});

test('category and requires are derived, so authoring them is an error', () => {
  assert.throws(() => check(rackWith((r) => { r.devices[0].category = 'optic'; })), /device one: category is derived from the stage's site; remove it/);
  assert.throws(() => check(rackWith((r) => { r.devices[1].requires = 'one'; })), /device two: requires is derived from the schema and the dry file; remove it/);
});

test('stage must exist, be unique, and keep schema order', () => {
  assert.throws(() => check(rackWith((r) => { delete r.devices[0].stage; })), /device one: stage required/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].stage = 'ghost'; })), /device one: unknown stage ghost/);
  assert.throws(() => check(rackWith((r) => { r.devices[1].stage = 'one'; })), /device two: stage one already belongs to one/);
  assert.throws(() => check(rackWith((r) => { r.devices.reverse(); })), /device two: out of stage order; stage two precedes stage three in the schema/);
});

test('a device key owned by another stage', () => {
  // Depth's node is owned by stage two; swapping the mixes puts r.depth on
  // device one, and ownership fires while device one is still being read.
  const swapped = rackWith((r) => { r.devices[0].mix = 'Depth'; r.devices[1].mix = 'Blur'; });
  assert.throws(() => check(swapped), /device one: r.depth writes depth, which stage two owns, not stage one/);
});

test('a stage with bound parameters needs a device or a place in shared', () => {
  assert.throws(() => check(rackWith((r) => { r.shared = []; })), /stage four owns gap, written by g.gap, but has no device and is not in shared/);
  // A stage whose parameters prism never binds needs neither.
  const unbound = new Map(NODES);
  unbound.delete('g.gap');
  assert.doesNotThrow(() => check(rackWith((r) => { r.shared = []; }), SCHEMA(), DRY, unbound));
});

test('requires derivation refuses two sources', () => {
  // The schema says three requires two; the dry file says one's entry writes
  // gain, three's mix. Two different devices from two sources is an error.
  const twoSources = SCHEMA();
  twoSources.interactions.push({ kind: 'requires', from: 'three', on: 'two', why: 'x [expose]' });
  const dry = { ...DRY, 'r.bypass.one': { blur: 0, depth: 0, gain: 0 } };
  assert.throws(() => check(complete(), twoSources, dry, NODES),
    /device three: requires would name one \(dry\) and two \(schema\); one source only until a consumer needs more/);
  // The same device from both sources is one requires.
  const agree = SCHEMA();
  agree.interactions.push({ kind: 'requires', from: 'two', on: 'one', why: 'x [expose]' });
  assert.equal(check(complete(), agree, DRY, NODES).devices[1].requires, 'one');
});

test('rows and keys must exist in the group and belong to exactly one device', () => {
  assert.throws(() => check(rackWith((r) => { r.devices[0].mix = 'Gap'; })), /device one: no matrix row Gap in group R/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].shared = ['r.kind', 'r.kind']; })), /device one: r.kind already belongs to one/);
  // A row claimed twice: device three takes Blur before device one's turn never comes, so
  // the duplicate is reported on the later device.
  assert.throws(() => check(rackWith((r) => { r.devices[2].rows = ['Blur']; })), /device three: row Blur already belongs to one/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].shared = ['r.blur']; })), /device one: no shared parameter r.blur in group R/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].shared = ['g.gap']; })), /device one: no shared parameter g.gap in group R/);
  assert.throws(() => check(rackWith((r) => { r.devices[1].shared = []; })), /r.amount in group R belongs to no device/);
  assert.throws(() => check(rackWith((r) => { r.devices.pop(); })), /row Gain in group R belongs to no device/);
});

test('bypass must be a bool toggle without state', () => {
  assert.throws(() => check(rackWith((r) => { r.devices[0].bypass = 'r.amount'; r.devices[1].shared = ['r.bypass.one']; })), /device one: bypass r.amount must be a bool toggle/);
});

test('a card keeps its head: ui.when may hide a shared key but never the mix row', () => {
  const gate = ', when: {param: r.kind, in: [a], otherwise: hidden}';
  const hiddenShared = defsFrom(DEFS.replace('label: Amount, order: 9}', `label: Amount, order: 9${gate}}`));
  assert.doesNotThrow(() => validateRack(complete(), hiddenShared, SCHEMA(), DRY, NODES));
  const hiddenMix = defsFrom(DEFS
    .replace('order: 2, state: focused, row: Blur}', `order: 2, state: focused, row: Blur${gate}}`)
    .replace('order: 3, state: unfocused, row: Blur}', `order: 3, state: unfocused, row: Blur${gate}}`));
  assert.throws(() => validateRack(complete(), hiddenMix, SCHEMA(), DRY, NODES),
    /device one: mix row Blur cannot be hidden by ui\.when; a card has no head without it/);
});
```

Update `test/cli.test.js` lines 175 to 189:

```js
test('describe carries the resolved rack', async () => {
  let out = '';
  await cli.run(['describe', '--json'], { runner: () => {}, print: (s) => { out += s; } });
  const { rack } = JSON.parse(out);
  assert.equal(rack.group, 'Focus');
  assert.deepEqual(rack.shared, ['slab', 'ripple', 'ring']);
  assert.deepEqual(rack.devices.map((d) => d.device), [
    'backdrop', 'distortion', 'refraction', 'fringing', 'directionalBlur', 'saturation', 'noise', 'tint', 'aurora', 'iridescence',
  ]);
  assert.deepEqual(rack.devices[3], {
    device: 'fringing', label: 'Fringing', stage: 'fringing', mix: 'Fringing',
    rows: [], shared: [], bypass: 'glass.bypass.fringing',
    site: 'taps', scope: 'material', family: 'transmission', requires: 'refraction',
    interactions: [{ kind: 'requires', device: 'refraction', why: 'the glass.bypass.refraction dry entry writes chromatic-aberration' }],
  });
  assert.equal(Object.hasOwn(rack.devices[0], 'requires'), false);
  assert.deepEqual(rack.devices[0].interactions, [{
    kind: 'attenuates', device: 'refraction',
    why: rack.devices[0].interactions[0].why,
  }]);
  assert.match(rack.devices[0].interactions[0].why, /roughness/);
});
```

- [ ] **Step 3: Run the suite to see the new tests fail**

Run: `just test-fast`
Expected: FAIL in `test/rack.test.js` (`familyOf` not exported; `validateRack` rejects `stage` as an unknown field) and in `test/cli.test.js`. The Lua suite does not run yet because `npm test` stops at the first failing Node file.

- [ ] **Step 4: Rewrite `src/rack.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { loadPipeline } from './pipeline.js';

// The rack names which pipeline stage each device controls and how it is
// presented; the schema (defs/rack/pipeline.json) decides order, site, scope,
// and family, and the sink's dry file decides which device requires which.
// It lives one directory below the defs so loadDefs, which reads every .yaml
// directly inside defs/ as a list of params, never sees it.
const FIELDS = ['device', 'label', 'stage', 'mix', 'rows', 'shared', 'bypass'];
const DERIVED = {
  category: "category is derived from the stage's site; remove it",
  requires: 'requires is derived from the schema and the dry file; remove it',
};

export const FAMILIES = {
  source: 'source',
  normal: 'geometry',
  taps: 'transmission', behind: 'transmission', attenuation: 'transmission',
  within: 'light', specular: 'light', emissive: 'light',
  post: 'post',
};

export function familyOf(site) {
  const family = FAMILIES[site];
  if (family === undefined) throw new Error(`site ${site} has no family; no device may sit there`);
  return family;
}

// `dry` is the niri sink's dry table (integrations/niri/dry.yaml), `nodes`
// the prism-key-to-native-node map from the manifests (src/nodes.js).
export function loadRack(dir, defs, { dry, nodes }) {
  const file = path.join(dir, 'rack', 'devices.yaml');
  return validateRack(parse(fs.readFileSync(file, 'utf8')), defs, loadPipeline(dir), dry, nodes);
}

export function validateRack(rack, defs, schema, dry, nodes) {
  const fail = (msg) => { throw new Error(`invalid rack: ${msg}`); };
  if (typeof rack?.group !== 'string' || rack.group.trim() === '') fail('group must be a non-empty string');
  if (!Array.isArray(rack.devices) || rack.devices.length === 0) fail('devices must be a non-empty list');
  if (!Array.isArray(rack.shared) || rack.shared.some((s) => typeof s !== 'string')) fail('shared must be a list of stage ids');
  for (const stage of rack.shared) {
    if (!schema.stageById.has(stage)) fail(`shared names unknown stage ${stage}`);
  }
  const group = rack.group;

  // What the group holds: matrix rows by label, stateless visible keys, and
  // the header toggle, which belongs to the section rather than a device.
  const rows = new Map();
  const singles = new Set();
  for (const def of defs.values()) {
    if (def.ui.group !== group || def.ui.control === 'none') continue;
    if (def.ui.state !== undefined) {
      const row = rows.get(def.ui.row) ?? {};
      if (row[def.ui.state]) fail(`row ${def.ui.row} in group ${group} has two ${def.ui.state} parameters`);
      row[def.ui.state] = def.key;
      rows.set(def.ui.row, row);
    } else if (def.ui.header !== true) {
      singles.add(def.key);
    }
  }
  for (const [label, row] of rows) {
    if (!row.focused || !row.unfocused) fail(`row ${label} in group ${group} lacks a ${row.focused ? 'unfocused' : 'focused'} parameter`);
  }

  // Which stage owns each native node, for the ownership rule.
  const ownerOf = new Map();
  for (const stage of schema.stages) {
    for (const node of stage.owns) ownerOf.set(node, stage.id);
  }

  const ids = new Set();
  const rowOwner = new Map();
  const keyOwner = new Map();
  const stageOwner = new Map();
  let lastStage = -1;
  const devices = [];
  for (const device of rack.devices) {
    const id = device?.device;
    const where = `device ${id ?? '?'}`;
    if (typeof id !== 'string' || !/^[a-z][a-zA-Z0-9]*$/.test(id)) fail(`${where}: bad id`);
    if (ids.has(id)) fail(`${where}: duplicate id`);
    for (const field of Object.keys(device)) {
      if (field in DERIVED) fail(`${where}: ${DERIVED[field]}`);
      if (!FIELDS.includes(field)) fail(`${where}: unknown field ${field}`);
    }
    if (typeof device.label !== 'string' || device.label.trim() === '') fail(`${where}: label required`);
    if (device.stage === undefined) fail(`${where}: stage required`);
    const stage = schema.stageById.get(device.stage);
    if (stage === undefined) fail(`${where}: unknown stage ${device.stage}`);
    if (stageOwner.has(stage.id)) fail(`${where}: stage ${stage.id} already belongs to ${stageOwner.get(stage.id)}`);
    const index = schema.stageIndex.get(stage.id);
    if (index < lastStage) {
      const previous = schema.stages[lastStage].id;
      fail(`${where}: out of stage order; stage ${stage.id} precedes stage ${previous} in the schema`);
    }
    lastStage = index;
    stageOwner.set(stage.id, id);
    if (!Array.isArray(device.rows) || !Array.isArray(device.shared)) fail(`${where}: rows and shared must be lists`);
    const keys = [];
    for (const label of [device.mix, ...device.rows]) {
      if (typeof label !== 'string' || !rows.has(label)) fail(`${where}: no matrix row ${label} in group ${group}`);
      if (rowOwner.has(label)) fail(`${where}: row ${label} already belongs to ${rowOwner.get(label)}`);
      rowOwner.set(label, id);
      keys.push(rows.get(label).focused, rows.get(label).unfocused);
    }
    if (defs.get(rows.get(device.mix).focused).ui.when?.otherwise === 'hidden') {
      fail(`${where}: mix row ${device.mix} cannot be hidden by ui.when; a card has no head without it`);
    }
    for (const key of [...device.shared, device.bypass]) {
      if (typeof key !== 'string' || !singles.has(key)) fail(`${where}: no shared parameter ${key} in group ${group}`);
      if (keyOwner.has(key)) fail(`${where}: ${key} already belongs to ${keyOwner.get(key)}`);
      keyOwner.set(key, id);
    }
    keys.push(...device.shared);
    const bypass = defs.get(device.bypass);
    if (bypass.type !== 'bool' || bypass.ui.control !== 'toggle') fail(`${where}: bypass ${device.bypass} must be a bool toggle`);
    // Ownership: every key with a native node sits at this device's stage.
    for (const key of keys) {
      const node = nodes.get(key);
      if (node === undefined) continue;
      const owner = ownerOf.get(node);
      if (owner !== stage.id) fail(`${where}: ${key} writes ${node}, which stage ${owner} owns, not stage ${stage.id}`);
    }
    ids.add(id);
    devices.push({ ...device, site: stage.site, scope: stage.scope, family: familyOf(stage.site), keys });
  }
  for (const label of rows.keys()) {
    if (!rowOwner.has(label)) fail(`row ${label} in group ${group} belongs to no device`);
  }
  for (const key of singles) {
    if (!keyOwner.has(key)) fail(`${key} in group ${group} belongs to no device`);
  }

  // Every stage prism writes to is a device or a declared shared stage.
  const written = new Map();
  for (const [key, node] of nodes) {
    const owner = ownerOf.get(node);
    if (owner !== undefined && !written.has(owner)) written.set(owner, { key, node });
  }
  for (const [stageId, { key, node }] of written) {
    if (!stageOwner.has(stageId) && !rack.shared.includes(stageId)) {
      fail(`stage ${stageId} owns ${node}, written by ${key}, but has no device and is not in shared`);
    }
  }

  // Derived requires and resolved interactions.
  const deviceOfStage = new Map(devices.map((d) => [d.stage, d.device]));
  const deviceOfBypass = new Map(devices.map((d) => [d.bypass, d.device]));
  const nodesOfDevice = new Map(devices.map((d) => [d.device, new Set(d.keys.map((k) => nodes.get(k)).filter((n) => n !== undefined))]));
  for (const device of devices) {
    const interactions = [];
    const requiresFrom = [];
    // A requires edge lands on the dependent (its `from`) naming what it needs;
    // an attenuates or shadows edge lands on the affected stage (its `on`)
    // naming what acts on it. Both read as "this card, because of that one".
    for (const edge of schema.interactions) {
      const [here, there] = edge.kind === 'requires' ? [edge.from, edge.on] : [edge.on, edge.from];
      if (here !== device.stage) continue;
      const other = deviceOfStage.get(there);
      if (other === undefined) continue;
      interactions.push({ kind: edge.kind, device: other, why: edge.why });
      if (edge.kind === 'requires') requiresFrom.push({ device: other, source: 'schema' });
    }
    for (const [bypassKey, fields] of Object.entries(dry)) {
      const other = deviceOfBypass.get(bypassKey);
      if (other === undefined || other === device.device) continue;
      const mine = nodesOfDevice.get(device.device);
      const written = Object.keys(fields).map((f) => fieldNode(f, ownerOf)).filter((n) => mine.has(n));
      if (written.length === 0) continue;
      interactions.push({ kind: 'requires', device: other, why: `the ${bypassKey} dry entry writes ${written.join(', ')}` });
      requiresFrom.push({ device: other, source: 'dry' });
    }
    const distinct = [...new Set(requiresFrom.map((r) => r.device))];
    if (distinct.length > 1) {
      const named = [...requiresFrom].sort((a, b) => a.source.localeCompare(b.source)).map((r) => `${r.device} (${r.source})`).join(' and ');
      fail(`device ${device.device}: requires would name ${named}; one source only until a consumer needs more`);
    }
    delete device.keys;
    device.interactions = interactions;
    if (distinct.length === 1) device.requires = distinct[0];
  }
  return { group, shared: rack.shared, devices };
}

// The dry file spells fields as render.js does (camelCase); the schema
// spells nodes as the renderer does (kebab-case). A field whose node is not
// owned by any stage is an error, not a silent miss: the `=` nodes
// (`noise type=`) have no dry entry today and would need a table here.
function fieldNode(field, ownerOf) {
  const node = field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  if (!ownerOf.has(node)) throw new Error(`invalid rack: dry field ${field} maps to ${node}, which no stage owns`);
  return node;
}
```

The derived `interactions` on a device are ordered as the tests expect: schema edges first, in schema order, then dry couplings in dry-file order. The two-source message sorts by source name (`dry` before `schema`).

- [ ] **Step 5: Wire `describe`**

In `src/cli.js`, the `describe` case (line 239 onward) becomes:

```js
      case 'describe': {
        const { defs, manifests } = load();
        const store = await snapshot(defs);
        const rack = loadRack(defsDir(), defs, { dry: loadDry(), nodes: nodeMap(manifests) });
```

Add the imports at the top of `src/cli.js`:

```js
import { loadDry } from '../integrations/niri/render.js';
import { nodeMap } from './nodes.js';
```

`describeText` already prints `rack.devices.map((device) => device.device)`; it needs no change.

- [ ] **Step 6: Update the Lua tests and the lifecycle fixture**

In `integrations/noctalia-plugin/plugin_test.lua`:

Lines 94 and 95 (the small golden rack) become:

```lua
  { device = "one", label = "One", family = "transmission", mix = "Blur", rows = {}, shared = { "r.kind" }, bypass = "r.bypass.one", interactions = {} },
  { device = "two", label = "Two", family = "post", mix = "Depth", rows = {}, shared = {}, bypass = "r.bypass.two", requires = "one",
    interactions = { { kind = "attenuates", device = "one", why = "blur scales depth" }, { kind = "requires", device = "one", why = "dry" } } },
```

Line 103 becomes `equal(rack.cards[1].family, "transmission")`.

Lines 117 to 120 become:

```lua
equal(Presentation.familyColors.transmission, "#4fd1c5")
equal(Presentation.familyColors.post, "#f6ad55")
equal(Presentation.familyColors.source, "#5b9cf6")
equal(Presentation.familyColors.geometry, "#c78bfa")
equal(Presentation.familyColors.light, "#f6e05e")
do
  local seen = {}
  for family, color in pairs(Presentation.familyColors) do
    assert(seen[color] == nil, "family colors are distinct: " .. family .. " repeats " .. color)
    seen[color] = family
  end
end
```

After line 128 (`equal(bypassed.cards[2].silenced, true)`) add:

```lua
equal(#bypassed.cards[2].attenuatedBy, 1, "a bypassed source lights its attenuates entry on the target")
equal(bypassed.cards[2].attenuatedBy[1].card.device, "one")
equal(bypassed.cards[2].attenuatedBy[1].why, "blur scales depth")
equal(#rack.cards[2].attenuatedBy, 0, "no hint while the source is active")
```

Line 140 becomes:

```lua
    devices[i] = { device = d.device, label = d.label, family = d.family, mix = d.mix, rows = {}, shared = {}, bypass = d.bypass, requires = d.requires, interactions = d.interactions }
```

Line 157 becomes:

```lua
rackFails(function(m) m.rack.devices[1].family = "glow" end, "device one has unknown family glow")
```

Add, beside the other `rackFails` cases, the Review Focus case:

```lua
-- An older describe without interactions still renders: the list reads as empty.
do
  local devices = {}
  for i, d in ipairs(rackModel.rack.devices) do
    devices[i] = { device = d.device, label = d.label, family = d.family, mix = d.mix, rows = {}, shared = {}, bypass = d.bypass, requires = d.requires }
    for j, sh in ipairs(d.shared) do devices[i].shared[j] = sh end
  end
  local older = Presentation.rack({ params = rackParams, rack = { group = "Rack", devices = devices } })
  equal(#older.cards[1].attenuatedBy, 0, "a device without interactions renders")
end
```

`rackModel` and `rackParams` are the golden model and its params the file defines above `rackFails`.

Lines 310 to 312 (the rendered-tree fixture) become:

```lua
  { device = "backdrop", label = "Backdrop", family = "source", mix = "Blur", rows = {}, shared = {}, bypass = "glass.bypass.backdrop",
    interactions = { { kind = "attenuates", device = "saturation", why = "the prefilter level scales with ior" } } },
  { device = "saturation", label = "Saturation", family = "transmission", mix = "Saturation", rows = {}, shared = {}, bypass = "glass.bypass.saturation", requires = "backdrop", interactions = {} },
  { device = "noise", label = "Noise", family = "transmission", mix = "Noise", rows = {}, shared = { "glass.noiseType" }, bypass = "glass.bypass.noise", interactions = {} },
```

Line 615 becomes `equal(silencedLight.props.color, "#4fd1c5", "a silenced light keeps its family color, hollow")`.

After line 585 (the wallpaper hint assertion) add, using the same `hintLabels` table rebuilt from the rendered tree in which `glass.bypass.saturation` is `true` (the fixture at line 304 already sets it):

```lua
assert(hintLabels["Blur is flattened while Saturation is bypassed"], "the attenuates hint names the bypassed source")
```

Line 977 becomes:

```lua
      { device = "backdrop", label = "Backdrop", family = "source", mix = "Blur", rows = {}, shared = {}, bypass = "glass.bypass.backdrop", interactions = {} },
```

In `test/plugin-panel-lifecycle.test.js` line 25 becomes:

```js
      {device = "noise", label = "Noise", family = "transmission", mix = "Noise", rows = {}, shared = {}, bypass = "glass.bypass.noise", interactions = {}},
```

- [ ] **Step 7: Update `presentation.luau`**

Replace lines 314 to 316:

```lua
-- One color per site family (docs/specs/2026-10-04-pipeline-schema-design.md,
-- Section 3). Noctalia gives a plugin no theme palette, so these are
-- constants; a card's fill is the same color at hex alpha 1f. Light is the
-- yellow: distinct from post's orange at the light's 12 px size.
M.familyColors = { source = "#5b9cf6", geometry = "#c78bfa", transmission = "#4fd1c5", light = "#f6e05e", post = "#f6ad55" }
```

In `M.rack`, lines 374 to 377 become:

```lua
    if M.familyColors[device.family] == nil then
      error("device " .. id .. " has unknown family " .. tostring(device.family))
    end
    local card = { device = id, label = device.label, family = device.family, rows = {}, shared = {}, interactions = device.interactions or {} }
```

Replace the loop that sets `bypassed` and `silenced` (lines 398 to 401) with two passes, since `attenuatedBy` reads another card's `bypassed`:

```lua
  for _, card in ipairs(cards) do
    card.bypassed = card.bypass.value == true
    card.silenced = card.requires ~= nil and card.requires.bypass.value == true
  end
  for _, card in ipairs(cards) do
    card.attenuatedBy = {}
    for _, interaction in ipairs(card.interactions) do
      if interaction.kind == "attenuates" then
        local source = byId[interaction.device]
          or error("device " .. card.device .. " names unknown device " .. tostring(interaction.device))
        if source.bypassed then
          card.attenuatedBy[#card.attenuatedBy + 1] = { card = source, why = interaction.why }
        end
      end
    end
  end
```

`byId` is the table the device loop above already fills.

- [ ] **Step 8: Update `panel.luau`**

Line 676 becomes:

```lua
  local color = card.bypassed and "on_surface_variant" or Presentation.familyColors[card.family]
```

Line 732 becomes:

```lua
    fill = Presentation.familyColors[card.family] .. "1f",
```

In `deviceCard`, after the `hint` row (line 720), add the attenuates hint:

```lua
  for _, entry in ipairs(card.attenuatedBy) do
    children[#children + 1] = ui.row({gap = 8, align = "center", justify = "end"}, {
      ui.label({
        text = card.mix.focused.ui.row .. " is flattened while " .. entry.card.label .. " is bypassed",
        fontSize = 11, color = "on_surface_variant",
      }),
    })
  end
```

`ui.label` takes no tooltip at any plugin API, so the mechanism (`entry.why`) is not shown; the sentence carries the fact and the interaction document (Task 5) carries the mechanism.

- [ ] **Step 9: Update the README sentence**

`README.md` line 69, `colored by category that bypasses the stage when clicked`, becomes `colored by its stage's site family (source, geometry, transmission, light, post) that bypasses the stage when clicked`.

- [ ] **Step 10: Run the suite to see it pass**

Run: `just test-fast`
Expected: PASS, Node and Lua, including `integrations/noctalia-plugin/contract.test.mjs`, which feeds real `describe` output through the panel. Nothing is committed between the rack change and the panel change: `category` leaves `describe` and the panel stops reading it in one commit.

- [ ] **Step 11: Commit**

```bash
tasks done <step id> "rack validates stage, order, ownership, and shared stages; requires and interactions derived; describe carries site, scope, family, requires, interactions; panel colors by family and hints attenuated devices"
git add defs/rack/devices.yaml src/rack.js src/cli.js test/rack.test.js test/cli.test.js integrations/noctalia-plugin/presentation.luau integrations/noctalia-plugin/panel.luau integrations/noctalia-plugin/plugin_test.lua test/plugin-panel-lifecycle.test.js README.md tasks/
git commit -m "feat(rack): validate devices against the pipeline schema, derive requires, and color the panel by family (prism-eef38f)"
```

---

### Task 5: The interaction matrix document

**Files:**
- Create: `docs/notes/pipeline-interactions.md`
- Create: `src/interactions.js`
- Test: `test/pipeline-interactions.test.js`

**Interfaces:**
- Consumes: `loadRack` (Task 4) for the devices with their resolved `interactions`.
- Produces: `renderInteractions(rack, schema) -> string` (a Markdown table); the document keeps a hand-written block outside the markers.

- [ ] **Step 1: Write the failing test**

`test/pipeline-interactions.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDefs } from '../src/defs.js';
import { loadRack } from '../src/rack.js';
import { loadPipeline } from '../src/pipeline.js';
import { loadDry } from '../integrations/niri/render.js';
import { loadManifests } from '../src/manifest.js';
import { nodeMap } from '../src/nodes.js';
import { renderInteractions } from '../src/interactions.js';
import { defsDir, integrationsDir } from '../src/paths.js';

const DOC = fileURLToPath(new URL('../docs/notes/pipeline-interactions.md', import.meta.url));
const BEGIN = '<!-- interactions:begin -->';
const END = '<!-- interactions:end -->';

test('the structural block of the interaction document is generated', () => {
  const defs = loadDefs(defsDir());
  const rack = loadRack(defsDir(), defs, { dry: loadDry(), nodes: nodeMap(loadManifests(integrationsDir(), defs)) });
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
  const rack = loadRack(defsDir(), defs, { dry: loadDry(), nodes: nodeMap(loadManifests(integrationsDir(), defs)) });
  const table = renderInteractions(rack, loadPipeline(defsDir()));
  const rows = table.trim().split('\n').slice(2);
  assert.equal(rows.length, 3);
  assert.match(rows[0], /^\| Backdrop \| Refraction \| attenuates \| schema \| .*\| expose \|$/);
  assert.match(rows[1], /^\| Fringing \| Refraction \| requires \| dry \| .*\| expose \|$/);
  assert.match(rows[2], /^\| Directional blur \| Refraction \| requires \| dry \| .*\| expose \|$/);
});
```

- [ ] **Step 2: Run the suite to see it fail**

Run: `just test-fast`
Expected: FAIL with `Cannot find module '../src/interactions.js'`.

- [ ] **Step 3: Write the renderer and the document**

`src/interactions.js`:

```js
// The structural cells of the interaction matrix (spec Section 4), one row
// per resolved interaction on a device, as a Markdown table. The decision is
// the bracketed suffix of a schema edge's `why`; a dry coupling is always
// `expose`, since the hollow light already shows it.
export function renderInteractions(rack, schema) {
  const label = new Map(rack.devices.map((d) => [d.device, d.label]));
  const rows = ['| Device | Depends on | Kind | Source | Mechanism | Decision |', '| --- | --- | --- | --- | --- | --- |'];
  for (const device of rack.devices) {
    for (const entry of device.interactions) {
      const fromSchema = schema.interactions.some((e) => e.why === entry.why && e.kind === entry.kind);
      const match = /^(.*?)\s*\[(expose|alternative|drop)\]$/.exec(entry.why);
      if (fromSchema && !match) throw new Error(`interaction on ${device.device}: schema edge has no [decision] suffix: ${entry.why}`);
      const mechanism = match ? match[1] : entry.why;
      const decision = match ? match[2] : 'expose';
      rows.push(`| ${label.get(device.device)} | ${label.get(entry.device)} | ${entry.kind} | ${fromSchema ? 'schema' : 'dry'} | ${mechanism} | ${decision} |`);
    }
  }
  return rows.join('\n');
}
```

`docs/notes/pipeline-interactions.md`:

```markdown
# Pipeline interactions

The interaction matrix of `docs/specs/2026-10-04-pipeline-schema-design.md`
Section 4, for today's pipeline. The structural block between the markers
is generated from `defs/rack/pipeline.json` and `integrations/niri/dry.yaml`
by `test/pipeline-interactions.test.js`; regenerate it with
`PRISM_DOCS_UPDATE=1 just test-fast`. The blocks outside the markers are
written by hand.

## Structural cells

<!-- interactions:begin -->
<!-- interactions:end -->

## Conditional dependencies

Not edges: each holds only under a condition, so it is described here and
never encoded.

| Device | Depends on | Condition | Mechanism |
| --- | --- | --- | --- |
| Directional blur | Refraction | chromatic aberration is 0 | at ior 1 the depth-jittered taps sample one point, so there is nothing to smear; with aberration above zero the green and blue taps keep raised indices and still smear |

## Perceptual cells

None recorded. Capture evidence under niri-material's `docs/materials/`
lands here with the document that measured it.
```

- [ ] **Step 4: Generate the block, then run the suite**

Run: `PRISM_DOCS_UPDATE=1 just test-fast` then `just test-fast`
Expected: the first run writes the block; the second passes with the document fresh.

- [ ] **Step 5: Commit**

```bash
tasks done <step id> "docs/notes/pipeline-interactions.md with a generated structural block, hand-written conditional and perceptual blocks"
git add src/interactions.js test/pipeline-interactions.test.js docs/notes/pipeline-interactions.md tasks/
git commit -m "docs(notes): generate the interaction matrix from the schema and the dry file (prism-eef38f)"
```

---

## Closing the task

After Task 5, in the task worktree: `just gate` (check plus the full suite), then `tasks done prism-eef38f "<what landed>"` in a final commit that also marks the spec's status line `implemented`. Then the finishing-a-development-branch skill: a personal-profile checkout merges locally. Before removing the worktree, run `tt-report`, and confirm the Noctalia plugin symlink (`~/.config/noctalia/plugins/prism`) does not resolve into it.
