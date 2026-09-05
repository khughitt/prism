# Prism context layers: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Prism store gains per-kind context layers (wallpaper, profile) resolved over the base values, a `context` CLI to manage them, `set`/`unset` that write into the active context, and a panel reset that removes the override in the write target.

**Architecture:** A new `src/contexts.js` owns the on-disk layout (context files under the config dir, `active.json` in the state dir). `src/resolve.js` learns to merge an ordered list of layers and to report which layer each value came from. `src/layers.js` turns the active slots into that list and computes the write target and per-key fallback. Every CLI verb reads through `loadStore`, so shell reads, the panel, and the applied appearance agree. `src/context-cli.js` holds the new subcommand; slot changes diff the effective values before and after and fan out only what changed. The Noctalia panel keys its reset on `layer == target` and resets to `fallback`.

**Tech Stack:** Node.js 20 ESM (`node --test`), `yaml`, Luau panel with a plain-Lua test.

**Spec:** `docs/specs/2026-09-05-prism-context-layers-design.md`

**Tasks:** `prism-6fd864` (piece), `prism-2f0b4b` (goal)

## Global Constraints

- Resolution order is exactly defaults, base, wallpaper, state, profile. Kinds accepted by every verb are `profile` and `wallpaper`; `state` is reserved and rejected with `kind state is reserved`.
- Context files live at `<config dir>/contexts/<kind>/<name>.yaml`; the active slots at `<state dir>/active.json`. Config and state dirs come from `src/paths.js` (`PRISM_CONFIG_DIR`, `PRISM_STATE_DIR` in tests).
- A wallpaper id is the first 8 hex characters of the SHA-256 of the wallpaper path. `_source` is allowed only in wallpaper files and is required there.
- Names match `^[A-Za-z0-9._-]+$`.
- `set` without `--base` writes to the topmost active layer; `set` stores a default-valued key in a context but keeps dropping it from base. `unset` of a key the target does not hold fails with `<key>: not set in <target>`.
- `save` writes every effective parameter and never fans out. Slot changes fan out the diff; when the previous state cannot resolve they fan out every bound key; an empty diff runs no sink.
- `describe --json` top level is exactly `active`, `target`, `params`; per param the key order is `key, type, range, default, value, layer, fallback, ui, description, bindings, effectiveLiveness, effectiveDrag`. `modified` is gone.
- Work happens in `.worktrees/store-contexts` on branch `feat/prism-6fd864`; `npm test` is the suite (`just test` records timing). `tasks check` must pass before every commit. Never edit `tasks/*.md` by hand.
- Each `### Task N` heading has a child task under `prism-6fd864`. Its first step is `tasks start <child>`; its commit step runs `tasks done <child>` and stages `tasks/` alongside the code. Task 8 closes `prism-6fd864` after its own child.
- Commit messages are conventional commits. No attribution trailer of any kind.

| Task | Child |
| --- | --- |
| 1 | `prism-46b96a` |
| 2 | `prism-bfecea` |
| 3 | `prism-df8b75` |
| 4 | `prism-9a083e` |
| 5 | `prism-cdd7cc` |
| 6 | `prism-47e47d` |
| 7 | `prism-92b32b` |
| 8 | `prism-1f3afe` |

---

### Task 1: Context storage

**Files:**
- Modify: `src/paths.js` (add two path helpers)
- Create: `src/contexts.js`
- Test: `test/contexts.test.js`

**Interfaces:**
- Consumes: `configDir()`, `stateDir()` from `src/paths.js`; `readJson`, `writeJsonAtomic` from `src/store.js`.
- Produces: `LAYER_ORDER`, `VERB_KINDS`, `assertKind(kind)`, `assertName(name)`, `wallpaperId(path)`, `contextPath(kind, name)`, `readActive()`, `writeActive(active)`, `readContext(kind, name)` returning `{ source, values }` or `null`, `writeContext(kind, name, { source, values })`, `deleteContext(kind, name)`, `listContexts()` returning `{ profile: string[], wallpaper: string[] }`. The active object shape is `{ wallpaper?: { id, path }, profile?: string }`.

- [ ] **Step 1: `tasks start prism-46b96a`**

- [ ] **Step 2: Write the failing tests**

Create `test/contexts.test.js`:

```js
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));

const contexts = await import('../src/contexts.js');
const { activePath, contextsDir } = await import('../src/paths.js');

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
});

test('kinds: profile and wallpaper are accepted, state is reserved, anything else is unknown', () => {
  contexts.assertKind('profile');
  contexts.assertKind('wallpaper');
  assert.throws(() => contexts.assertKind('state'), /kind state is reserved/);
  assert.throws(() => contexts.assertKind('theme'), /unknown kind theme/);
  assert.deepEqual(contexts.LAYER_ORDER, ['wallpaper', 'state', 'profile']);
  assert.deepEqual(contexts.VERB_KINDS, ['profile', 'wallpaper']);
});

test('names are filesystem-safe', () => {
  for (const ok of ['dusk', 'dusk-2', 'a.b_c', '3f9a1c2e']) contexts.assertName(ok);
  for (const bad of ['', 'a b', '../x', 'x/y', 'ü']) {
    assert.throws(() => contexts.assertName(bad), /invalid context name/);
  }
});

test('wallpaperId is 8 hex chars, stable, and refuses an empty path', () => {
  const id = contexts.wallpaperId('/walls/a.jpg');
  assert.match(id, /^[0-9a-f]{8}$/);
  assert.equal(contexts.wallpaperId('/walls/a.jpg'), id);
  assert.notEqual(contexts.wallpaperId('/walls/b.jpg'), id);
  assert.throws(() => contexts.wallpaperId(''), /wallpaper path must not be empty/);
  assert.throws(() => contexts.wallpaperId('   '), /wallpaper path must not be empty/);
});

test('context files round-trip; wallpaper files carry _source', () => {
  assert.equal(contexts.readContext('profile', 'dusk'), null);
  contexts.writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  assert.deepEqual(contexts.readContext('profile', 'dusk'), { source: null, values: { 'glass.ior': 1.3 } });
  assert.equal(contexts.contextPath('profile', 'dusk'), path.join(contextsDir(), 'profile', 'dusk.yaml'));

  contexts.writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: { 'glass.ior': 1.1 } });
  const text = fs.readFileSync(contexts.contextPath('wallpaper', 'abc12345'), 'utf8');
  assert.match(text, /^_source: \/walls\/a\.jpg\n/);
  assert.deepEqual(contexts.readContext('wallpaper', 'abc12345'),
    { source: '/walls/a.jpg', values: { 'glass.ior': 1.1 } });
});

test('malformed context files fail loudly', () => {
  fs.mkdirSync(path.join(contextsDir(), 'profile'), { recursive: true });
  fs.mkdirSync(path.join(contextsDir(), 'wallpaper'), { recursive: true });
  fs.writeFileSync(contexts.contextPath('profile', 'list'), '- 1\n- 2\n');
  assert.throws(() => contexts.readContext('profile', 'list'), /profile list: context must be a flat object/);
  fs.writeFileSync(contexts.contextPath('profile', 'src'), '_source: /x\n');
  assert.throws(() => contexts.readContext('profile', 'src'), /profile src: _source is only allowed in wallpaper contexts/);
  fs.writeFileSync(contexts.contextPath('wallpaper', 'nosrc'), 'glass.ior: 1\n');
  assert.throws(() => contexts.readContext('wallpaper', 'nosrc'), /wallpaper nosrc: missing _source/);
});

test('deleteContext removes the file and refuses a missing one', () => {
  contexts.writeContext('profile', 'dusk', { source: null, values: {} });
  contexts.deleteContext('profile', 'dusk');
  assert.equal(fs.existsSync(contexts.contextPath('profile', 'dusk')), false);
  assert.throws(() => contexts.deleteContext('profile', 'dusk'), /profile dusk: no such context/);
});

test('listContexts lists every kind sorted, empty when nothing exists', () => {
  assert.deepEqual(contexts.listContexts(), { profile: [], wallpaper: [] });
  contexts.writeContext('profile', 'zed', { source: null, values: {} });
  contexts.writeContext('profile', 'alpha', { source: null, values: {} });
  contexts.writeContext('wallpaper', 'abc12345', { source: '/w', values: {} });
  assert.deepEqual(contexts.listContexts(), { profile: ['alpha', 'zed'], wallpaper: ['abc12345'] });
});

test('active slots round-trip and reject the reserved kind and bad shapes', () => {
  assert.deepEqual(contexts.readActive(), {});
  contexts.writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  assert.deepEqual(JSON.parse(fs.readFileSync(activePath(), 'utf8')),
    { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  assert.deepEqual(contexts.readActive(), { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });

  fs.writeFileSync(activePath(), JSON.stringify({ state: 'dark' }));
  assert.throws(() => contexts.readActive(), /kind state is reserved/);
  fs.writeFileSync(activePath(), JSON.stringify({ wallpaper: 'abc12345' }));
  assert.throws(() => contexts.readActive(), /active wallpaper must carry id and path/);
  fs.writeFileSync(activePath(), JSON.stringify({ profile: 7 }));
  assert.throws(() => contexts.readActive(), /invalid context name/);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/contexts.test.js`
Expected: FAIL, `Cannot find module '../src/contexts.js'`.

- [ ] **Step 4: Add the path helpers**

In `src/paths.js`, after `export const lockPath = ...`, add:

```js
export const activePath = () => path.join(stateDir(), 'active.json');
export const contextsDir = () => path.join(configDir(), 'contexts');
```

- [ ] **Step 5: Write `src/contexts.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { activePath, contextsDir } from './paths.js';
import { readJson, writeJsonAtomic } from './store.js';

// Resolution order of the context kinds, lowest first. Base sits below all of them.
export const LAYER_ORDER = ['wallpaper', 'state', 'profile'];
// Kinds a verb may name. `state` is reserved until its activation sources are designed.
export const VERB_KINDS = ['profile', 'wallpaper'];

const NAME_RE = /^[A-Za-z0-9._-]+$/;

export function assertKind(kind) {
  if (kind === 'state') throw new Error('kind state is reserved');
  if (!VERB_KINDS.includes(kind)) throw new Error(`unknown kind ${kind}`);
}

export function assertName(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    throw new Error(`invalid context name ${JSON.stringify(name)}`);
  }
}

export function wallpaperId(wallpaper) {
  if (typeof wallpaper !== 'string' || wallpaper.trim() === '') {
    throw new Error('wallpaper path must not be empty');
  }
  return createHash('sha256').update(wallpaper).digest('hex').slice(0, 8);
}

export function contextPath(kind, name) {
  return path.join(contextsDir(), kind, `${name}.yaml`);
}

export function readActive() {
  const active = readJson(activePath(), {});
  if (typeof active !== 'object' || active === null || Array.isArray(active)) {
    throw new Error('active.json must be an object');
  }
  for (const kind of Object.keys(active)) assertKind(kind);
  if (active.wallpaper !== undefined) {
    const entry = active.wallpaper;
    if (typeof entry !== 'object' || entry === null
        || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
      throw new Error('active wallpaper must carry id and path');
    }
    assertName(entry.id);
  }
  if (active.profile !== undefined) assertName(active.profile);
  return active;
}

export function writeActive(active) {
  writeJsonAtomic(activePath(), active);
}

// null when the file is missing; a malformed file is an error.
export function readContext(kind, name) {
  let text;
  try {
    text = fs.readFileSync(contextPath(kind, name), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const doc = parse(text) ?? {};
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new Error(`${kind} ${name}: context must be a flat object`);
  }
  const { _source: source, ...values } = doc;
  if (kind !== 'wallpaper' && source !== undefined) {
    throw new Error(`${kind} ${name}: _source is only allowed in wallpaper contexts`);
  }
  if (kind === 'wallpaper' && typeof source !== 'string') {
    throw new Error(`wallpaper ${name}: missing _source`);
  }
  return { source: source ?? null, values };
}

export function writeContext(kind, name, { source, values }) {
  const file = contextPath(kind, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const doc = kind === 'wallpaper' ? { _source: source, ...values } : values;
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, stringify(doc));
  fs.renameSync(tmp, file);
}

export function deleteContext(kind, name) {
  try {
    fs.unlinkSync(contextPath(kind, name));
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`${kind} ${name}: no such context`);
    throw err;
  }
}

export function listContexts() {
  const out = {};
  for (const kind of VERB_KINDS) {
    let files = [];
    try {
      files = fs.readdirSync(path.join(contextsDir(), kind));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    out[kind] = files.filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5)).sort();
  }
  return out;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test test/contexts.test.js`
Expected: PASS, 8 tests. Then `npm test` to confirm nothing else moved.

- [ ] **Step 7: Commit**

```bash
tasks done prism-46b96a "contexts.js: file layout, names, wallpaper ids, active slots"
git add src/paths.js src/contexts.js test/contexts.test.js tasks/
git commit -m "feat(store): add context file storage and active slots"
```

---

### Task 2: Layered resolution

**Files:**
- Modify: `src/resolve.js`
- Create: `src/layers.js`
- Test: `test/resolve.test.js`, `test/layers.test.js`

**Interfaces:**
- Consumes: Task 1's `LAYER_ORDER`, `readActive`, `readContext`; `readValues` from `src/values.js`.
- Produces: `resolveLayered(defs, base, layers)` returning `{ params, layerOf }` where `layers` is `[{ kind, name, values }]` in resolution order and `layerOf[key]` is `'default' | 'base' | kind`, and which validates the selected value even when it is the default; `resolveParams(defs, values)` unchanged in meaning; `writeResolved(params)` now takes resolved params, not `(defs, values)`. From `src/layers.js`: `activeName(active, kind)`, `loadLayers(active)`, `writeTarget(layers)` returning `{ kind, name }` with `kind === 'base'` when nothing is active, `loadStore(defs)` returning `{ base, active, layers, target, params, layerOf, fallback }`, and `activeJson(active)` returning `{ wallpaper: {id,path}|null, profile: string|null }`.

- [ ] **Step 1: `tasks start prism-bfecea`**

- [ ] **Step 2: Extend `test/resolve.test.js`**

Replace the second test and append two more:

```js
test('writeResolved persists exactly what it is given, and carries no counter', async () => {
  writeResolved({ 'a.x': 0.5, 'a.y': true });
  const second = writeResolved({ 'a.x': 0.9, 'a.y': true });
  assert.deepEqual(second, { params: { 'a.x': 0.9, 'a.y': true } });
  assert.deepEqual(Object.keys(second), ['params'], 'no generation/sequence field');
  const { resolvedPath } = await import('../src/paths.js');
  assert.deepEqual(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')), second);
});

test('resolveLayered merges defaults, base, then each layer in order, and names the source', () => {
  const layers = [
    { kind: 'wallpaper', name: 'w', values: { 'a.x': 0.7 } },
    { kind: 'profile', name: 'p', values: { 'a.y': false } },
  ];
  const { params, layerOf } = resolveLayered(defs, { 'a.x': 0.2 }, layers);
  assert.deepEqual(params, { 'a.x': 0.7, 'a.y': false });
  assert.deepEqual(layerOf, { 'a.x': 'wallpaper', 'a.y': 'profile' });

  const base = resolveLayered(defs, { 'a.x': 0.2 }, []);
  assert.deepEqual(base.layerOf, { 'a.x': 'base', 'a.y': 'default' });
  assert.deepEqual(resolveLayered(defs, {}, []).params, resolveParams(defs, {}));
});

test('resolveLayered validates the selected default, so a bad def cannot reach the bus', () => {
  const badDefs = new Map([['b.x', { key: 'b.x', type: 'float', range: [0, 1], default: 4,
    ui: { group: 'g', control: 'slider' }, description: 'd' }]]);
  assert.throws(() => resolveLayered(badDefs, {}, []), /b\.x: 4 outside range/);
});

test('resolveLayered validates every layer, not only the effective value', () => {
  const shadowed = [
    { kind: 'wallpaper', name: 'w', values: { 'a.x': 7 } },
    { kind: 'profile', name: 'p', values: { 'a.x': 0.4 } },
  ];
  assert.throws(() => resolveLayered(defs, {}, shadowed), /a\.x: 7 outside range/);
  assert.throws(() => resolveLayered(defs, {}, [{ kind: 'profile', name: 'p', values: { 'a.z': 1 } }]),
    /unknown param a\.z in profile p/);
});
```

Update the import line to `const { resolveParams, resolveLayered, writeResolved } = await import('../src/resolve.js');`.

- [ ] **Step 3: Write `test/layers.test.js`**

```js
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));

const { writeActive, writeContext } = await import('../src/contexts.js');
const { writeValues } = await import('../src/values.js');
const layers = await import('../src/layers.js');

const defs = new Map([
  ['a.x', { key: 'a.x', type: 'float', range: [0, 1], default: 0.5,
    ui: { group: 'g', control: 'slider' }, description: 'd' }],
  ['a.y', { key: 'a.y', type: 'bool', default: true,
    ui: { group: 'g', control: 'toggle' }, description: 'd' }],
]);

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
});

test('activeName reads the id of a wallpaper entry and the name of a profile entry', () => {
  const active = { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' };
  assert.equal(layers.activeName(active, 'wallpaper'), 'abc12345');
  assert.equal(layers.activeName(active, 'profile'), 'dusk');
  assert.equal(layers.activeName({}, 'profile'), null);
});

test('loadLayers: an untuned wallpaper is an empty layer, a missing profile is an error', () => {
  assert.deepEqual(layers.loadLayers({ wallpaper: { id: 'abc12345', path: '/w' } }),
    [{ kind: 'wallpaper', name: 'abc12345', values: {} }]);
  assert.throws(() => layers.loadLayers({ profile: 'gone' }), /profile gone: active context is missing/);

  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'a.x': 0.7 } });
  writeContext('profile', 'dusk', { source: null, values: { 'a.y': false } });
  assert.deepEqual(layers.loadLayers({ profile: 'dusk', wallpaper: { id: 'abc12345', path: '/w' } }), [
    { kind: 'wallpaper', name: 'abc12345', values: { 'a.x': 0.7 } },
    { kind: 'profile', name: 'dusk', values: { 'a.y': false } },
  ]);
});

test('writeTarget is the topmost layer, or base', () => {
  assert.deepEqual(layers.writeTarget([]), { kind: 'base', name: null });
  assert.deepEqual(layers.writeTarget([
    { kind: 'wallpaper', name: 'w', values: {} },
    { kind: 'profile', name: 'p', values: {} },
  ]), { kind: 'profile', name: 'p' });
});

test('loadStore derives params, layerOf, target, and fallback from disk', () => {
  writeValues({ 'a.x': 0.2 });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'a.x': 0.7, 'a.y': true } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' } });

  const store = layers.loadStore(defs);
  assert.deepEqual(store.params, { 'a.x': 0.7, 'a.y': true });
  assert.deepEqual(store.layerOf, { 'a.x': 'wallpaper', 'a.y': 'wallpaper' });
  assert.deepEqual(store.target, { kind: 'wallpaper', name: 'abc12345' });
  // fallback is what unset would leave: the layer below, even when the override equals the default
  assert.deepEqual(store.fallback, { 'a.x': 0.2, 'a.y': true });
  assert.deepEqual(layers.activeJson(store.active),
    { wallpaper: { id: 'abc12345', path: '/w' }, profile: null });
});

test('loadStore with nothing active: target is base and fallback is the default for base overrides', () => {
  writeValues({ 'a.x': 0.2 });
  const store = layers.loadStore(defs);
  assert.deepEqual(store.target, { kind: 'base', name: null });
  assert.deepEqual(store.params, { 'a.x': 0.2, 'a.y': true });
  assert.deepEqual(store.fallback, { 'a.x': 0.5, 'a.y': true }, 'unset from base reveals the default');
  assert.deepEqual(layers.activeJson(store.active), { wallpaper: null, profile: null });
});
```

- [ ] **Step 4: Run both files to verify they fail**

Run: `node --test test/resolve.test.js test/layers.test.js`
Expected: FAIL (`resolveLayered` is not exported; `../src/layers.js` missing).

- [ ] **Step 5: Rewrite `src/resolve.js`**

```js
import { validateValue } from './values.js';
import { writeJsonAtomic } from './store.js';
import { resolvedPath } from './paths.js';

function checkLayer(defs, values, where) {
  for (const key of Object.keys(values)) {
    const def = defs.get(key);
    if (!def) throw new Error(`unknown param ${key} in ${where}`);
    validateValue(def, values[key]);
  }
}

// layers: [{ kind, name, values }] lowest first. Every layer is validated in
// full, so a bad value shadowed by a higher layer still fails the resolve.
export function resolveLayered(defs, base, layers) {
  checkLayer(defs, base, 'values');
  for (const layer of layers) checkLayer(defs, layer.values, `${layer.kind} ${layer.name}`);
  const params = {};
  const layerOf = {};
  for (const [key, def] of defs) {
    let value = def.default;
    let source = 'default';
    if (key in base) { value = base[key]; source = 'base'; }
    for (const layer of layers) {
      if (key in layer.values) { value = layer.values[key]; source = layer.kind; }
    }
    validateValue(def, value); // the default is the one value no layer check has seen
    params[key] = value;
    layerOf[key] = source;
  }
  return { params, layerOf };
}

export function resolveParams(defs, values) {
  return resolveLayered(defs, values, []).params;
}

export function writeResolved(params) {
  const resolved = { params };
  writeJsonAtomic(resolvedPath(), resolved);
  return resolved;
}
```

Note the base error text stays `unknown param <key> in values`; `test/cli.test.js` matches it.

- [ ] **Step 6: Write `src/layers.js`**

```js
import { readValues } from './values.js';
import { LAYER_ORDER, readActive, readContext } from './contexts.js';
import { resolveLayered } from './resolve.js';

export function activeName(active, kind) {
  const entry = active[kind];
  if (entry === undefined) return null;
  return kind === 'wallpaper' ? entry.id : entry;
}

export function activeJson(active) {
  return { wallpaper: active.wallpaper ?? null, profile: active.profile ?? null };
}

// The active slots as layers in resolution order. A wallpaper without a file
// is the untuned wallpaper: an empty layer. A profile without a file is broken.
export function loadLayers(active) {
  const layers = [];
  for (const kind of LAYER_ORDER) {
    const name = activeName(active, kind);
    if (name === null) continue;
    const context = readContext(kind, name);
    if (context === null && kind !== 'wallpaper') {
      throw new Error(`${kind} ${name}: active context is missing`);
    }
    layers.push({ kind, name, values: context === null ? {} : context.values });
  }
  return layers;
}

export function writeTarget(layers) {
  const top = layers[layers.length - 1];
  return top ? { kind: top.kind, name: top.name } : { kind: 'base', name: null };
}

export function loadStore(defs) {
  const base = readValues();
  const active = readActive();
  const layers = loadLayers(active);
  const { params, layerOf } = resolveLayered(defs, base, layers);
  const target = writeTarget(layers);
  // What unset would leave: the layer below the target. Below base sit the defaults.
  const below = target.kind === 'base'
    ? resolveLayered(defs, {}, []).params
    : resolveLayered(defs, base, layers.slice(0, -1)).params;
  const fallback = {};
  for (const key of Object.keys(params)) {
    fallback[key] = layerOf[key] === target.kind ? below[key] : params[key];
  }
  return { base, active, layers, target, params, layerOf, fallback };
}
```

- [ ] **Step 7: Run the two files, then the suite**

Run: `node --test test/resolve.test.js test/layers.test.js`
Expected: PASS. Then `npm test`: `test/cli.test.js` now FAILS because `set`, `unset`, and `apply` still call `writeResolved(defs, values)`. That is expected and is fixed in Tasks 3 and 4. Do not commit a red suite: make the three call sites compile now with the minimum change, `writeResolved(resolveParams(defs, values))` in each, so the suite is green again, and leave the layered behaviour to the next tasks.

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
tasks done prism-bfecea "resolveLayered, writeResolved(params), layers.js store view"
git add src/resolve.js src/layers.js src/cli.js test/resolve.test.js test/layers.test.js tasks/
git commit -m "feat(store): resolve context layers over the base values"
```

---

### Task 3: Reading verbs through the layered store

**Files:**
- Modify: `src/cli.js` (`get`, `list`, `describe`, `apply`, `doctor`, usage string)
- Test: `test/cli.test.js`

**Interfaces:**
- Consumes: `loadStore`, `activeJson` from `src/layers.js`; `listContexts`, `readContext`, `readActive`, `contextPath` from `src/contexts.js`.
- Produces: `snapshot(defs)`, which is `loadStore` under the store lock, so a reader never sees a slot and a file from two different writes; the `describe` JSON shape from Global Constraints; `doctor` lines `doctor: <kind> <name>: <error>` (file shape and invalid values alike), `doctor: orphan value <key> in <kind> <name>: no definition — edit <file>`, and `doctor: profile <name>: active context is missing — run 'prism context deactivate profile'`.

- [ ] **Step 1: `tasks start prism-df8b75`**

- [ ] **Step 2: Update the existing describe tests and add layered-read tests**

In `test/cli.test.js`:

1. In `'set back to the default deletes the override but still fans out'`, replace the last assertion with `assert.equal(p.layer, 'default', 'values.yaml must stay sparse');`.
2. In `'describe emits bindings and slowest effectiveLiveness'`, replace `assert.equal(p.modified, true);` with `assert.equal(p.layer, 'base');`.
3. Replace `'describe emits only the public counter-free JSON shape'`:

```js
test('describe emits only the public counter-free JSON shape', async () => {
  let out = '';
  assert.equal(await cli.run(['describe', '--json'], { print: (s) => { out += s; } }), 0);
  const described = JSON.parse(out);
  assert.deepEqual(Object.keys(described), ['active', 'target', 'params']);
  assert.deepEqual(described.active, { wallpaper: null, profile: null });
  assert.equal(described.target, 'base');
  const p = described.params.find((item) => item.key === 'terminal.background.opacity.inactive');
  assert.deepEqual(Object.keys(p), [
    'key', 'type', 'range', 'default', 'value', 'layer', 'fallback', 'ui', 'description',
    'bindings', 'effectiveLiveness', 'effectiveDrag',
  ]);
  assert.equal(p.layer, 'default');
  assert.equal(p.fallback, p.value);
});
```

4. Add, after it, the layered-read tests. They need the store imports at the top of the file: `const { writeActive, writeContext } = await import('../src/contexts.js');`

```js
test('get, list, and describe read through the active layers', async () => {
  fs.writeFileSync(valuesPath(), 'glass.paneLip: 8\nglass.ior: 1.24\n');
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ior': 1.3 } });
  writeContext('profile', 'dusk', { source: null, values: { 'glass.paneLip': 6 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });

  let out = '';
  assert.equal(await cli.run(['get', 'glass.ior'], { print: (s) => { out += s; } }), 0);
  assert.equal(out, '1.3\n');
  out = '';
  assert.equal(await cli.run(['list'], { print: (s) => { out += s; } }), 0);
  assert.match(out, /^glass\.paneLip = 6$/m);
  assert.match(out, /^glass\.ior = 1\.3$/m);

  out = '';
  await cli.run(['describe', '--json'], { print: (s) => { out += s; } });
  const d = JSON.parse(out);
  assert.deepEqual(d.active, { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  assert.equal(d.target, 'profile');
  const lip = d.params.find((x) => x.key === 'glass.paneLip');
  assert.deepEqual([lip.value, lip.layer, lip.fallback], [6, 'profile', 8]);
  const ior = d.params.find((x) => x.key === 'glass.ior');
  assert.deepEqual([ior.value, ior.layer, ior.fallback], [1.3, 'wallpaper', 1.3]);
});

test('a missing active profile fails every reading verb, describe included', async () => {
  writeActive({ profile: 'gone' });
  for (const argv of [['get', 'glass.ior'], ['list'], ['describe', '--json'], ['apply']]) {
    const failure = await runCaptured(argv, { runner: () => {}, print: () => {} });
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
    assert.match(failure.stderr, /profile gone: active context is missing/);
  }
});

test('apply resolves through the layers', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.paneLip': 11 } });
  writeActive({ profile: 'dusk' });
  assert.equal(await cli.run(['apply'], { runner: () => {} }), 0);
  const resolved = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8'));
  assert.equal(resolved.params['glass.paneLip'], 11);
});

test('doctor reports a missing active profile, a broken context file, and context orphans', async () => {
  await cli.run(['apply'], { runner: () => {} });
  let out = '';
  writeActive({ profile: 'gone' });
  assert.equal(await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } }), 1);
  assert.match(out, /doctor: profile gone: active context is missing — run 'prism context deactivate profile'/);

  writeActive({});
  fs.mkdirSync(path.dirname(contextPath('profile', 'bad')), { recursive: true });
  fs.writeFileSync(contextPath('profile', 'bad'), '- not\n- flat\n');
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'gone.away': 1 } });
  // an inactive context with a known key holding an invalid value must not pass diagnosis
  writeContext('profile', 'hot', { source: null, values: { 'glass.ior': 99 } });
  out = '';
  assert.equal(await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } }), 1);
  assert.match(out, /doctor: profile bad: context must be a flat object/);
  assert.match(out, /doctor: orphan value gone\.away in wallpaper abc12345: no definition — edit /);
  assert.match(out, /doctor: profile hot: glass\.ior: 99 outside range/);
});

test('reading verbs take the store lock, so they wait for an in-flight write', async () => {
  const { withLock } = await import('../src/lock.js');
  let release;
  const held = withLock(lockPath(), () => new Promise((resolve) => { release = resolve; }));
  await new Promise((r) => setTimeout(r, 20)); // let the holder acquire
  let finished = false;
  const reader = cli.run(['describe', '--json'], { print: () => {} }).then(() => { finished = true; });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(finished, false, 'describe must not read past the lock');
  release();
  await held;
  await reader;
  assert.equal(finished, true);
});
```

Add `contextPath` to the contexts import. In `'every public verb enforces its required and stray arguments'` nothing changes yet.

- [ ] **Step 3: Run the file to verify the new tests fail**

Run: `node --test test/cli.test.js`
Expected: the four new tests and the two edited describe tests FAIL; everything else PASSES.

- [ ] **Step 4: Route the reading verbs through `loadStore`**

In `src/cli.js`:

Imports: add `import { loadStore, activeJson } from './layers.js';` and `import { listContexts, readContext, readActive, contextPath, VERB_KINDS } from './contexts.js';`. Drop `resolveParams` from the resolve import if nothing else uses it after Task 4 (keep it until then).

Add near `load()`:

```js
// Every read of the store happens under the store lock: a slot and the file it
// names must come from the same write.
const snapshot = (defs) => withLock(lockPath(), async () => loadStore(defs));
```

`get`:

```js
      case 'get': {
        if (rest.length !== 1) throw new Error('usage: prism get <key>');
        const [key] = rest;
        const { defs } = load();
        if (!defs.has(key)) throw new Error(`unknown param ${key}`);
        print(`${JSON.stringify((await snapshot(defs)).params[key])}\n`);
        return 0;
      }
```

`list`:

```js
      case 'list': {
        if (rest.length !== 0) throw new Error('usage: prism list');
        const { defs } = load();
        const { params } = await snapshot(defs);
        for (const key of Object.keys(params)) {
          print(`${key} = ${JSON.stringify(params[key])}\n`);
        }
        return 0;
      }
```

`describe`: replace `const values = readValues(); const params = resolveParams(defs, values);` with `const store = await snapshot(defs);`, replace `value: params[key], modified: Object.hasOwn(values, key),` with `value: store.params[key], layer: store.layerOf[key], fallback: store.fallback[key],`, and print `JSON.stringify({ active: activeJson(store.active), target: store.target.kind, params: described }, null, 2)`.

`apply`: inside the lock, `resolved = writeResolved(loadStore(defs).params);`.

`doctor`: the whole diagnosis of files reads under one lock. Wrap everything from `const values = readValues();` through the resolve in `await withLock(lockPath(), async () => { ... })`, collecting the `print` lines and `problems` count inside it (the sink-status loop that follows reads only `sink-status.json` and stays outside). After the base-orphan loop and before `if (orphans.length > 0) return 1;`, add:

```js
        let contextProblems = 0;
        const active = readActive();
        if (active.profile !== undefined && readContext('profile', active.profile) === null) {
          print(`doctor: profile ${active.profile}: active context is missing — run 'prism context deactivate profile'\n`);
          contextProblems++;
        }
        const all = listContexts();
        for (const kind of VERB_KINDS) {
          for (const name of all[kind]) {
            let context;
            try {
              context = readContext(kind, name);
            } catch (error) {
              print(`doctor: ${error.message}\n`);
              contextProblems++;
              continue;
            }
            for (const [key, value] of Object.entries(context.values)) {
              const def = defs.get(key);
              if (!def) {
                print(`doctor: orphan value ${key} in ${kind} ${name}: no definition — edit ${contextPath(kind, name)}\n`);
                contextProblems++;
                continue;
              }
              try {
                validateValue(def, value);   // inactive contexts are never resolved, so check them here
              } catch (error) {
                print(`doctor: ${kind} ${name}: ${error.message}\n`);
                contextProblems++;
              }
            }
          }
        }
        if (orphans.length > 0 || contextProblems > 0) return 1;
        const { params } = loadStore(defs);
```

and delete the old `const params = resolveParams(defs, values);` line that followed. Note the `readContext` errors already read `profile bad: context must be a flat object`, and `validateValue` errors read `glass.ior: 99 outside range [1, 3]`, so the two `doctor: ...` prefixes produce the asserted lines. Shape the lock callback to return `{ params, blocked }` where `blocked` is true when orphans or context problems were printed; after the lock, `if (blocked) return 1;` and continue into the sink-status loop with `params`. `withLock` releases the lock in its `finally`, so a throw inside the callback (a malformed `active.json`) still surfaces through the verb's normal error path.

Usage string in the `default:` branch: `usage: prism set|unset|get|list|describe|apply|doctor|context`.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS. `test/plugin-client.test.js` still passes because the panel is untouched until Task 7 (it reads the panel source, not `describe`).

- [ ] **Step 6: Commit**

```bash
tasks done prism-df8b75 "get, list, describe, apply, doctor read through loadStore; describe carries active, target, layer, fallback"
git add src/cli.js test/cli.test.js tasks/
git commit -m "feat(cli): read every verb through the context layers"
```

---

### Task 4: Set and unset with a write target

**Files:**
- Modify: `src/cli.js` (`set`, `unset`)
- Test: `test/cli.test.js`

**Interfaces:**
- Consumes: `loadStore`, `loadLayers`, `writeTarget` from `src/layers.js`; `readActive`, `writeContext` from `src/contexts.js`.
- Produces: `prism set [--base] <key> <value>`, `prism unset [--base] <key>`; error `<key>: not set in base` / `<key>: not set in <kind> <name>`; the first `set` into an untuned wallpaper creates its file with `_source`.

- [ ] **Step 1: `tasks start prism-9a083e`**

- [ ] **Step 2: Write the failing tests**

Append to `test/cli.test.js` (`readContext` joins the contexts import):

```js
test('set writes into the topmost active context and creates an untuned wallpaper file with _source', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeActive({ wallpaper: { id: 'abc12345', path: '/walls/a.jpg' } });
  const calls = [];
  assert.equal(await cli.run(['set', 'glass.ior', '1.3'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readContext('wallpaper', 'abc12345'), { source: '/walls/a.jpg', values: { 'glass.ior': 1.3 } });
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), 'glass.ior: 1.24\n', 'base untouched');
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.3);

  // a default-valued key is kept in a context, because the layer below differs
  assert.equal(await cli.run(['set', 'glass.ior', '1.5'], { runner: () => {} }), 0);
  assert.equal(readContext('wallpaper', 'abc12345').values['glass.ior'], 1.5);
});

test('set --base writes through to values.yaml under an active context', async () => {
  writeContext('profile', 'dusk', { source: null, values: {} });
  writeActive({ profile: 'dusk' });
  assert.equal(await cli.run(['set', '--base', 'glass.ior', '1.1'], { runner: () => {} }), 0);
  assert.match(fs.readFileSync(valuesPath(), 'utf8'), /glass\.ior: 1\.1/);
  assert.deepEqual(readContext('profile', 'dusk').values, {});
});

test('unset removes the override from the write target and refuses a key it does not hold', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.5 } });
  writeActive({ profile: 'dusk' });

  const calls = [];
  assert.equal(await cli.run(['unset', 'glass.ior'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readContext('profile', 'dusk').values, {});
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.24, 'base shows through');
  assert.match(fs.readFileSync(valuesPath(), 'utf8'), /glass\.ior: 1\.24/, 'base untouched');

  const absent = await runCaptured(['unset', 'glass.ior'], { runner: () => {} });
  assert.notEqual(absent.code, 0);
  assert.match(absent.stderr, /glass\.ior: not set in profile dusk/);

  assert.equal(await cli.run(['unset', '--base', 'glass.ior'], { runner: () => {} }), 0);
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), '{}\n');
  const absentBase = await runCaptured(['unset', 'glass.ior'], { runner: () => {} });
  assert.match(absentBase.stderr, /glass\.ior: not set in profile dusk/);
  const absentBaseFlag = await runCaptured(['unset', '--base', 'glass.ior'], { runner: () => {} });
  assert.match(absentBaseFlag.stderr, /glass\.ior: not set in base/);
});

test('unset digs an orphan out of the active context the way it does for base', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'gone.away': 1 } });
  writeActive({ profile: 'dusk' });
  const blocked = await runCaptured(['set', 'glass.paneLip', '10'], { runner: () => {} });
  assert.match(blocked.stderr, /unknown param gone\.away in profile dusk/);
  assert.equal(await cli.run(['unset', 'gone.away'], { runner: () => {} }), 0);
  assert.deepEqual(readContext('profile', 'dusk').values, {});
});
```

Also add to the invalid-arguments list in `'every public verb enforces its required and stray arguments'`: `['set', '--base'], ['set', '--base', 'glass.ior'], ['unset', '--base']`.

- [ ] **Step 3: Run the file to verify the new tests fail**

Run: `node --test test/cli.test.js`
Expected: the four new tests FAIL.

- [ ] **Step 4: Rewrite `set` and `unset`**

Add near `load()` in `src/cli.js`:

```js
function splitBaseFlag(rest) {
  const toBase = rest[0] === '--base';
  return { toBase, args: toBase ? rest.slice(1) : rest };
}

function contextSource(active, target) {
  return target.kind === 'wallpaper' ? active.wallpaper.path : null;
}
```

Imports: `loadLayers`, `writeTarget` from `./layers.js`; `readActive`, `writeContext` from `./contexts.js`; `resolveLayered` from `./resolve.js` (replacing `resolveParams`).

```js
      case 'set': {
        const { toBase, args } = splitBaseFlag(rest);
        if (args.length !== 2) throw new Error('usage: prism set [--base] <key> <value>');
        const [key, text] = args;
        const { defs, manifests } = load();
        const def = defs.get(key);
        if (!def) throw new Error(`unknown param ${key}`);
        const value = parseCliValue(def, text);
        validateValue(def, value);

        let resolved;
        await withLock(lockPath(), async () => {
          const store = loadStore(defs);
          const target = toBase ? { kind: 'base', name: null } : store.target;
          if (target.kind === 'base') {
            const values = { ...store.base };
            if (isDeepStrictEqual(value, def.default)) delete values[key];
            else values[key] = value;
            writeValues(values);
          } else {
            const layer = store.layers[store.layers.length - 1];
            writeContext(target.kind, target.name, {
              source: contextSource(store.active, target),
              values: { ...layer.values, [key]: value },
            });
          }
          resolved = writeResolved(loadStore(defs).params);
        });

        return report(await fanOut({ manifests, resolved, changedKeys: [key], runner: opts.runner }), eprint);
      }

      case 'unset': {
        const { toBase, args } = splitBaseFlag(rest);
        if (args.length !== 1) throw new Error('usage: prism unset [--base] <key>');
        const [key] = args;
        const { defs, manifests } = load();
        let resolved;

        await withLock(lockPath(), async () => {
          const active = readActive();
          const layers = loadLayers(active);
          const target = toBase ? { kind: 'base', name: null } : writeTarget(layers);
          const base = readValues();
          const held = target.kind === 'base' ? base : layers[layers.length - 1].values;
          const where = target.kind === 'base' ? 'base' : `${target.kind} ${target.name}`;
          const orphan = !defs.has(key) && Object.hasOwn(held, key);
          if (!defs.has(key) && !orphan) throw new Error(`unknown param ${key}`);
          if (!Object.hasOwn(held, key)) throw new Error(`${key}: not set in ${where}`);
          if (!orphan) resolveLayered(defs, base, layers);
          const values = { ...held };
          delete values[key];
          if (target.kind === 'base') writeValues(values);
          else writeContext(target.kind, target.name, { source: contextSource(active, target), values });
          resolved = writeResolved(loadStore(defs).params);
        });

        return report(await fanOut({ manifests, resolved, changedKeys: [key], runner: opts.runner }), eprint);
      }
```

Why `resolveLayered` before the write for a non-orphan: this preserves the existing contract that a store with an orphan blocks every mutation except the orphan's own `unset` (`'orphans block mutation; orphan unsets remove exactly one per invocation'` asserts values.yaml is written and `resolved.json` is not, which the trailing `loadStore` throwing still gives).

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS, including the older orphan tests untouched.

- [ ] **Step 6: Commit**

```bash
tasks done prism-9a083e "set and unset target the topmost active context; --base writes through; first wallpaper write carries _source"
git add src/cli.js test/cli.test.js tasks/
git commit -m "feat(cli): write set and unset into the active context"
```

---

### Task 5: Context list, show, and save

**Files:**
- Create: `src/context-cli.js`
- Modify: `src/cli.js` (dispatch `context`)
- Test: `test/context-cli.test.js`

**Interfaces:**
- Consumes: Task 1 storage, `loadStore`, `activeName` from `src/layers.js`, `withLock`, `lockPath`.
- Produces: `runContext(args, { defs, manifests, print, runner })` returning a fan-out result `{ applied, failed }` or `null` when nothing reached the bus. `cli.js` maps `null` to exit 0. Verbs `list`, `show`, `save` in this task; `activate`, `deactivate`, `delete`, `wallpaper` in Task 6.

- [ ] **Step 1: `tasks start prism-cdd7cc`**

- [ ] **Step 2: Write the failing tests**

Create `test/context-cli.test.js` with the same fixture prelude as `test/cli.test.js` (temp config, state, and integrations dirs with `fastsink` and `slowsink` bound to `terminal.background.opacity.inactive`; copy the block verbatim, drop `gensink`), then:

```js
const cli = await import('../src/cli.js');
const { resolvedPath, valuesPath } = await import('../src/paths.js');
const { readActive, readContext, writeActive, writeContext } = await import('../src/contexts.js');

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(valuesPath(), '{}\n');
});

async function runCaptured(argv, opts = {}) {
  let stdout = '';
  let stderr = '';
  const code = await cli.run(argv, {
    runner: () => {}, ...opts,
    print: (text) => { stdout += text; }, eprint: (text) => { stderr += text; },
  });
  return { code, stdout, stderr };
}

test('context list shows every context by kind, marks the active ones, and shows the untuned active wallpaper', async () => {
  writeContext('profile', 'dusk', { source: null, values: {} });
  writeContext('profile', 'dawn', { source: null, values: {} });
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });
  writeActive({ profile: 'dusk', wallpaper: { id: 'ffff0000', path: '/walls/z.jpg' } });
  const { code, stdout } = await runCaptured(['context', 'list']);
  assert.equal(code, 0);
  assert.equal(stdout, [
    '  profile dawn',
    '* profile dusk',
    '  wallpaper abc12345  /walls/a.jpg',
    '* wallpaper ffff0000  /walls/z.jpg (untuned)',
    '',
  ].join('\n'));
});

test('context show prints the file contents, _source first for a wallpaper', async () => {
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: { 'glass.ior': 1.3 } });
  const shown = await runCaptured(['context', 'show', 'wallpaper', 'abc12345']);
  assert.equal(shown.stdout, '_source: /walls/a.jpg\nglass.ior: 1.3\n');
  const missing = await runCaptured(['context', 'show', 'profile', 'nope']);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /profile nope: no such context/);
});

test('context save snapshots every effective parameter and touches neither resolved.json nor sinks', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ior': 1.5 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' } });
  await cli.run(['apply'], { runner: () => {} });
  const before = fs.readFileSync(resolvedPath(), 'utf8');

  const calls = [];
  assert.equal(await cli.run(['context', 'save', 'profile', 'dusk'], { runner: (m) => calls.push(m.sink) }), 0);
  assert.deepEqual(calls, []);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before);
  const saved = readContext('profile', 'dusk');
  assert.equal(saved.source, null);
  assert.equal(saved.values['glass.ior'], 1.5, 'the default-valued override is kept');
  assert.deepEqual(saved.values, JSON.parse(before).params, 'every effective parameter is written');
  assert.deepEqual(readActive(), { wallpaper: { id: 'abc12345', path: '/w' } }, 'save does not activate');
});

test('context save wallpaper requires the file and preserves its _source', async () => {
  const missing = await runCaptured(['context', 'save', 'wallpaper', 'abc12345']);
  assert.match(missing.stderr, /wallpaper abc12345: no such context/);
  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });
  assert.equal(await cli.run(['context', 'save', 'wallpaper', 'abc12345'], { runner: () => {} }), 0);
  assert.equal(readContext('wallpaper', 'abc12345').source, '/walls/a.jpg');
});

test('context verbs reject the reserved kind, unknown kinds, bad names, and stray arguments', async () => {
  for (const argv of [
    ['context'], ['context', 'bogus'],
    ['context', 'list', 'extra'],
    ['context', 'show'], ['context', 'show', 'profile'], ['context', 'show', 'profile', 'a', 'b'],
    ['context', 'save', 'state', 'dark'], ['context', 'save', 'theme', 'x'], ['context', 'save', 'profile', 'a b'],
  ]) {
    const failure = await runCaptured(argv);
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
  }
  assert.match((await runCaptured(['context', 'save', 'state', 'dark'])).stderr, /kind state is reserved/);
  assert.match((await runCaptured(['context', 'save', 'theme', 'x'])).stderr, /unknown kind theme/);
  assert.match((await runCaptured(['context', 'save', 'profile', 'a b'])).stderr, /invalid context name/);
  assert.match((await runCaptured(['context'])).stderr, /usage: prism context/);
});
```

- [ ] **Step 3: Run the file to verify it fails**

Run: `node --test test/context-cli.test.js`
Expected: FAIL, `context` falls into the usage branch (exit 2) for every call.

- [ ] **Step 4: Write `src/context-cli.js`**

```js
import { stringify } from 'yaml';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  VERB_KINDS, assertKind, assertName, listContexts, readActive, readContext, writeContext,
} from './contexts.js';
import { activeName, loadStore } from './layers.js';

function usage(text) {
  return new Error(`usage: prism context ${text}`);
}

function requireContext(kind, name) {
  const context = readContext(kind, name);
  if (context === null) throw new Error(`${kind} ${name}: no such context`);
  return context;
}

function kindAndName(rest, verb) {
  if (rest.length !== 2) throw usage(`${verb} <kind> <name>`);
  const [kind, name] = rest;
  assertKind(kind);
  assertName(name);
  return { kind, name };
}

// Returns a fan-out result, or null when nothing reached the bus.
export async function runContext(args, { defs, manifests, print, runner }) {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'list': {
      if (rest.length !== 0) throw usage('list');
      const { active, all, sources } = await withLock(lockPath(), async () => {
        const listed = listContexts();
        return {
          active: readActive(),
          all: listed,
          sources: Object.fromEntries(listed.wallpaper.map((name) => [name, readContext('wallpaper', name).source])),
        };
      });
      for (const kind of VERB_KINDS) {
        const current = activeName(active, kind);
        for (const name of all[kind]) {
          const marker = name === current ? '*' : ' ';
          const source = kind === 'wallpaper' ? `  ${sources[name]}` : '';
          print(`${marker} ${kind} ${name}${source}\n`);
        }
      }
      if (active.wallpaper && !all.wallpaper.includes(active.wallpaper.id)) {
        print(`* wallpaper ${active.wallpaper.id}  ${active.wallpaper.path} (untuned)\n`);
      }
      return null;
    }

    case 'show': {
      const { kind, name } = kindAndName(rest, 'show');
      const context = await withLock(lockPath(), async () => requireContext(kind, name));
      const doc = kind === 'wallpaper' ? { _source: context.source, ...context.values } : context.values;
      print(stringify(doc));
      return null;
    }

    case 'save': {
      const { kind, name } = kindAndName(rest, 'save');
      await withLock(lockPath(), async () => {
        const source = kind === 'wallpaper' ? requireContext(kind, name).source : null;
        const { params } = loadStore(defs);
        writeContext(kind, name, { source, values: params });
      });
      return null;
    }

    default:
      throw usage('list|show|save|activate|deactivate|delete|wallpaper');
  }
}
```

`manifests` and `runner` are unused until Task 6; keep them in the signature so Task 6 only adds cases.

In `src/cli.js`, add `import { runContext } from './context-cli.js';` and a case before `default:`:

```js
      case 'context': {
        const { defs, manifests } = load();
        const outcome = await runContext(rest, { defs, manifests, print, runner: opts.runner });
        return outcome === null ? 0 : report(outcome, eprint);
      }
```

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
tasks done prism-cdd7cc "context list, show, save"
git add src/context-cli.js src/cli.js test/context-cli.test.js tasks/
git commit -m "feat(cli): add context list, show, and save"
```

---

### Task 6: Slot-changing verbs and fan-out

**Files:**
- Modify: `src/context-cli.js`
- Test: `test/context-cli.test.js`

**Interfaces:**
- Consumes: `resolveLayered`, `writeResolved` from `src/resolve.js`; `loadLayers`, `loadStore` from `src/layers.js`; `deleteContext`, `wallpaperId`, `writeActive`, `readValues`; `fanOut` from `src/fanout.js`.
- Produces: `activate <kind> <name>`, `deactivate <kind>`, `delete <kind> <name>`, `wallpaper <path>`; the shared `changeSlots(ctx, mutate, commit)` that validates the result first, commits file changes second, diffs, recovers, and fans out.

- [ ] **Step 1: `tasks start prism-47e47d`**

- [ ] **Step 2: Write the failing tests**

Append to `test/context-cli.test.js`:

```js
test('activate profile fans out only the keys whose effective value changed', async () => {
  fs.writeFileSync(valuesPath(), 'terminal.background.opacity.inactive: 0.6\n');
  await cli.run(['apply'], { runner: () => {} });
  writeContext('profile', 'dusk', { source: null,
    values: { 'terminal.background.opacity.inactive': 0.4, 'glass.ior': 1.24 } });

  const calls = [];
  assert.equal(await cli.run(['context', 'activate', 'profile', 'dusk'],
    { runner: (m, f, keys) => calls.push([m.sink, keys]) }), 0);
  assert.deepEqual(readActive(), { profile: 'dusk' });
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['terminal.background.opacity.inactive'], 0.4);
  // both fixture sinks bind the opacity key; glass.ior changed too but no fixture sink binds it
  assert.deepEqual(calls.map(([s]) => s).sort(), ['fastsink', 'slowsink']);
  for (const [, keys] of calls) {
    assert.deepEqual(keys.sort(), ['glass.ior', 'terminal.background.opacity.inactive']);
  }
});

test('activate profile requires the file; activate wallpaper copies _source into the slot', async () => {
  const missing = await runCaptured(['context', 'activate', 'profile', 'nope']);
  assert.match(missing.stderr, /profile nope: no such context/);
  assert.deepEqual(readActive(), {});

  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: {} });
  assert.equal(await cli.run(['context', 'activate', 'wallpaper', 'abc12345'], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { wallpaper: { id: 'abc12345', path: '/walls/a.jpg' } });
});

test('an empty diff runs no sink and a repeated wallpaper is a no-op', async () => {
  await cli.run(['apply'], { runner: () => {} });
  const before = fs.readFileSync(resolvedPath(), 'utf8');
  const calls = [];
  assert.equal(await cli.run(['context', 'wallpaper', '/walls/untuned.jpg'], { runner: (m) => calls.push(m.sink) }), 0);
  assert.deepEqual(calls, []);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before);
  const { wallpaperId } = await import('../src/contexts.js');
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId('/walls/untuned.jpg'), path: '/walls/untuned.jpg' } });

  const again = await runCaptured(['context', 'wallpaper', '/walls/untuned.jpg']);
  assert.equal(again.code, 0);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before);
  assert.match((await runCaptured(['context', 'wallpaper', ''])).stderr, /wallpaper path must not be empty/);
});

test('deactivate and delete clear the slot and restore the layer below', async () => {
  fs.writeFileSync(valuesPath(), 'terminal.background.opacity.inactive: 0.6\n');
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'terminal.background.opacity.inactive': 0.5 } });
  writeContext('profile', 'dusk', { source: null, values: { 'terminal.background.opacity.inactive': 0.4 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  await cli.run(['apply'], { runner: () => {} });

  let calls = [];
  assert.equal(await cli.run(['context', 'deactivate', 'profile'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readActive(), { wallpaper: { id: 'abc12345', path: '/w' } });
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['terminal.background.opacity.inactive'], 0.5);
  assert.deepEqual(calls, [['terminal.background.opacity.inactive'], ['terminal.background.opacity.inactive']]);

  calls = [];
  assert.equal(await cli.run(['context', 'delete', 'wallpaper', 'abc12345'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readActive(), {});
  assert.equal(readContext('wallpaper', 'abc12345'), null);
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['terminal.background.opacity.inactive'], 0.6);
  assert.equal(calls.length, 2);

  // deleting an inactive context never touches the bus
  const before = fs.readFileSync(resolvedPath(), 'utf8');
  calls = [];
  assert.equal(await cli.run(['context', 'delete', 'profile', 'dusk'], { runner: (m) => calls.push(m.sink) }), 0);
  assert.deepEqual(calls, []);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before);
  assert.match((await runCaptured(['context', 'delete', 'profile', 'dusk'])).stderr, /profile dusk: no such context/);
});

test('a broken previous state does not block recovery: the result is applied with a full fan-out', async () => {
  fs.writeFileSync(valuesPath(), 'terminal.background.opacity.inactive: 0.6\n');
  await cli.run(['apply'], { runner: () => {} });
  writeActive({ profile: 'vanished' });
  assert.notEqual((await runCaptured(['list'])).code, 0, 'precondition: the store is broken');

  const calls = [];
  assert.equal(await cli.run(['context', 'deactivate', 'profile'], { runner: (m, f, keys) => calls.push([m.sink, keys]) }), 0);
  assert.deepEqual(readActive(), {});
  assert.deepEqual(calls.map(([s]) => s).sort(), ['fastsink', 'slowsink']);
  for (const [, keys] of calls) assert.deepEqual(keys, ['terminal.background.opacity.inactive']);
  assert.equal((await runCaptured(['list'])).code, 0);

  // switching straight to a valid profile works too
  writeActive({ profile: 'vanished' });
  writeContext('profile', 'dusk', { source: null, values: {} });
  assert.equal(await cli.run(['context', 'activate', 'profile', 'dusk'], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), { profile: 'dusk' });
});

test('a result that cannot resolve is refused and leaves the slots unchanged', async () => {
  writeContext('profile', 'bad', { source: null, values: { 'glass.ior': 99 } });
  const failure = await runCaptured(['context', 'activate', 'profile', 'bad']);
  assert.notEqual(failure.code, 0);
  assert.match(failure.stderr, /glass\.ior: 99 outside range/);
  assert.deepEqual(readActive(), {});
});

test('an unchanged slot is still validated: re-activating a broken context fails loudly', async () => {
  writeContext('profile', 'bad', { source: null, values: { 'glass.ior': 99 } });
  writeActive({ profile: 'bad' });
  const again = await runCaptured(['context', 'activate', 'profile', 'bad']);
  assert.notEqual(again.code, 0);
  assert.match(again.stderr, /glass\.ior: 99 outside range/);

  writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: { 'glass.ior': 99 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/walls/a.jpg' } });
  const repeat = await runCaptured(['context', 'wallpaper', '/walls/a.jpg']);
  assert.notEqual(repeat.code, 0);
  assert.match(repeat.stderr, /glass\.ior: 99 outside range/);
});

test('a refused delete keeps both the file and the slots', async () => {
  // the profile sits above a broken wallpaper; removing the profile exposes the
  // broken layer, so the delete must be refused without touching anything
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ior': 99 } });
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.2 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  const failure = await runCaptured(['context', 'delete', 'profile', 'dusk']);
  assert.notEqual(failure.code, 0);
  assert.match(failure.stderr, /glass\.ior: 99 outside range/);
  assert.notEqual(readContext('profile', 'dusk'), null, 'file preserved');
  assert.deepEqual(readActive(), { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' }, 'slots preserved');
});
```

- [ ] **Step 3: Run the file to verify the new tests fail**

Run: `node --test test/context-cli.test.js`
Expected: the eight new tests FAIL with the `usage: prism context` error.

- [ ] **Step 4: Add `changeSlots` and the four verbs**

In `src/context-cli.js`, add imports:

```js
import { isDeepStrictEqual } from 'node:util';
import { deleteContext, wallpaperId, writeActive } from './contexts.js';   // merge into the existing contexts import
import { loadLayers } from './layers.js';                                   // merge into the existing layers import
import { readValues } from './values.js';
import { resolveLayered, writeResolved } from './resolve.js';
import { fanOut } from './fanout.js';
```

Add the helper above `runContext`:

```js
// Apply a slot change. `mutate(active)` is pure and returns the next slots;
// `commit()` performs any file change (a delete) and runs only after the
// resulting state has resolved, so a refused change leaves every file and
// slot as it was. The resulting state is always validated, even when the
// slots do not change, so re-activating a broken context fails loudly. The
// previous state is allowed not to resolve, in which case every bound key
// fans out (the apply contract): that is how a broken active context is
// recovered from.
async function changeSlots({ defs, manifests, runner }, mutate, commit = () => {}) {
  let outcome = null;
  await withLock(lockPath(), async () => {
    const active = readActive();
    let previous = null;
    try {
      previous = loadStore(defs).params;
    } catch {
      previous = null;
    }
    const next = mutate(active);
    const { params } = resolveLayered(defs, readValues(), loadLayers(next));
    commit();
    if (isDeepStrictEqual(next, active)) return;
    writeActive(next);
    const resolved = writeResolved(params);
    const changedKeys = previous === null
      ? [...new Set(manifests.flatMap((manifest) => manifest.binds.map((bind) => bind.param)))]
      : Object.keys(params).filter((key) => !isDeepStrictEqual(params[key], previous[key]));
    outcome = { resolved, changedKeys };
  });
  if (outcome === null || outcome.changedKeys.length === 0) return null;
  return fanOut({ manifests, resolved: outcome.resolved, changedKeys: outcome.changedKeys, runner });
}
```

Add the cases before `default:`:

```js
    case 'activate': {
      const { kind, name } = kindAndName(rest, 'activate');
      return changeSlots({ defs, manifests, runner }, (active) => {
        const context = requireContext(kind, name);
        return kind === 'wallpaper'
          ? { ...active, wallpaper: { id: name, path: context.source } }
          : { ...active, profile: name };
      });
    }

    case 'deactivate': {
      if (rest.length !== 1) throw usage('deactivate <kind>');
      const [kind] = rest;
      assertKind(kind);
      return changeSlots({ defs, manifests, runner }, (active) => {
        const next = { ...active };
        delete next[kind];
        return next;
      });
    }

    case 'delete': {
      const { kind, name } = kindAndName(rest, 'delete');
      requireContext(kind, name);   // a missing file fails before any state is touched
      return changeSlots({ defs, manifests, runner }, (active) => {
        const next = { ...active };
        if (activeName(active, kind) === name) delete next[kind];
        return next;
      }, () => deleteContext(kind, name));
    }

    case 'wallpaper': {
      if (rest.length !== 1) throw usage('wallpaper <path>');
      const [wallpaper] = rest;
      const id = wallpaperId(wallpaper);
      return changeSlots({ defs, manifests, runner }, (active) => ({ ...active, wallpaper: { id, path: wallpaper } }));
    }
```

`readActive` inside `changeSlots` throws on a malformed `active.json`; that is a hand-edit failure and stays loud. The "previous cannot resolve" recovery covers a missing or invalid context file, which is what `loadStore` throws on. Deleting an inactive context while the active state is broken is refused too, because the resulting state is the same broken state; recover with `deactivate` first.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
tasks done prism-47e47d "activate, deactivate, delete, wallpaper with diff fan-out and broken-state recovery"
git add src/context-cli.js test/context-cli.test.js tasks/
git commit -m "feat(cli): activate and deactivate contexts with a diff fan-out"
```

---

### Task 7: Panel reset semantics

**Files:**
- Modify: `integrations/noctalia-plugin/panel.luau` (`visibleParamError`, `validateModel`, `described`, `updateParam`, `unsetParam`, `resetGroup`, `resetButton`, `appendSection`)
- Modify: `integrations/noctalia-plugin/presentation.luau` (`modifiedCount` becomes `overriddenCount`)
- Modify: `integrations/noctalia-plugin/plugin_test.lua`, `test/plugin-client.test.js`, `test/plugin-panel-lifecycle.test.js`

**Interfaces:**
- Consumes: the `describe` JSON from Task 3 (`target`, per-param `layer`, `fallback`).
- Produces: `Presentation.overriddenCount(params)`; a per-param runtime field `overridden` derived at model acceptance.

- [ ] **Step 1: `tasks start prism-92b32b`**

- [ ] **Step 2: Update the Lua test**

In `integrations/noctalia-plugin/plugin_test.lua`:

1. Line 65 becomes `equal(Presentation.overriddenCount({ { overridden = true }, { overridden = false }, { overridden = true } }), 2)`.
2. In the `model` fixture, add `target = "base",` as the first field of the outer table, and on every param replace `modified = <bool>` with `layer = "<layer>", fallback = <value>`: `glass.roughness` gets `layer = "base", fallback = 0.1` (deliberately not its default of 0.08, so the test proves the panel reads `fallback`); every other param gets `layer = "default"` and a `fallback` equal to its `value`.
3. Replace the `noctalia.runAsync` stub so it records commands and only captures the describe callback:

```lua
local commands = {}
noctalia = {
  runAsync = function(cmd, callback)
    commands[#commands + 1] = cmd
    if cmd:find("describe", 1, true) then described = callback end
    return true
  end,
  json = { decode = function() return model end },
}
```

4. After the `equal(#collect(rendered, "toggle"), 2, ...)` line, add the reset assertions:

```lua
-- Reset means "remove the override in the write target": visible only where
-- layer == target, and it optimistically shows the fallback value.
local visibleResets = {}
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Remove override" and button.props.visible then
    visibleResets[#visibleResets + 1] = button
  end
end
equal(#visibleResets, 1, "exactly the base-overridden roughness row offers a reset")
local sectionResets = 0
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Reset section (1)" and button.props.visible then sectionResets = sectionResets + 1 end
end
equal(sectionResets, 1, "the Focus section counts its one override")
visibleResets[1].props.onClick()
equal(model.params[4].value, 0.1, "reset shows the fallback, not the default, before describe reconciles")
equal(model.params[4].overridden, false)
assert(commands[#commands]:find("unset", 1, true) and commands[#commands]:find("glass.roughness", 1, true),
  "reset enqueues prism unset for the row")
```

`model.params[4]` is `glass.roughness` in the fixture order.

- [ ] **Step 3: Update the Node-side plugin tests**

`test/plugin-client.test.js`:
- field list: `['key', 'value', 'default', 'layer', 'fallback', 'control', 'group']`;
- `Presentation\.modifiedCount\(sectionParams\)` becomes `Presentation\.overriddenCount\(sectionParams\)`;
- `resetGroup` regex becomes `/local function resetGroup[\s\S]*if param\.overridden then[\s\S]*unsetParam\(param\)/`;
- `tooltip = "Reset to default"` becomes `tooltip = "Remove override"`.

`test/plugin-panel-lifecycle.test.js`: in the fixture model add `target = "base",` before `params = {` and on both params replace `modified = false` with `layer = "default", fallback = <its value>` (`true` and `100`).

- [ ] **Step 4: Run the plugin tests to verify they fail**

Run: `npm run test:plugin-lua && node --test test/plugin-client.test.js test/plugin-panel-lifecycle.test.js`
Expected: FAIL (`overriddenCount` is nil; source regexes do not match; the model validator rejects the fixture for a missing `modified`).

- [ ] **Step 5: Change the panel**

`presentation.luau`: rename `M.modifiedCount` to `M.overriddenCount` and count `param.overridden`.

`panel.luau`:

In `visibleParamError`, replace the `modified` check with:

```lua
  if type(param.layer) ~= "string" then return param.key .. " has no layer" end
  if param.fallback == nil then return param.key .. " has no fallback" end
```

In `validateModel`, after the params-array checks and before the loop:

```lua
  if type(model.target) ~= "string" then return "prism describe returned no write target" end
```

Add above `described`:

```lua
local function markOverrides(model)
  for _, param in ipairs(model.params) do
    param.overridden = param.ui.control ~= "none" and param.layer == model.target
  end
end
```

In `described`, change `state.model = model` to `markOverrides(model); state.model = model` (keep it inside the same `elseif not message then` branch).

Replace `updateParam`, `unsetParam`, and `resetGroup`:

```lua
local function updateParam(param, value)
  param.value = value
  param.overridden = true
end

local function unsetParam(param)
  param.value = param.fallback
  param.overridden = false
  enqueue({verb = "unset", key = param.key})
  render()
end

local function resetGroup(params)
  for _, param in ipairs(params) do
    if param.overridden then unsetParam(param) end
  end
end
```

In `resetButton`: `tooltip = "Remove override"`, `visible = param.overridden`.

In `appendSection`: `local overriddenCount = Presentation.overriddenCount(sectionParams)` and use it in the tooltip and `visible` of the section reset (keep the `"Reset section"` text).

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: PASS, including the Lua check.

- [ ] **Step 7: Commit**

```bash
tasks done prism-92b32b "panel reset keys on layer == target and resets to fallback"
git add integrations/noctalia-plugin test/plugin-client.test.js test/plugin-panel-lifecycle.test.js tasks/
git commit -m "feat(noctalia): reset removes the override in the write target"
```

---

### Task 8: Documentation and closure

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md` (end of Section 2), `docs/notes/noctalia-plugin-contract.md`, `docs/specs/2026-09-05-prism-context-layers-design.md` (status line)

- [ ] **Step 1: `tasks start prism-1f3afe`**

- [ ] **Step 2: README**

After the opening paragraph, add:

```markdown
## Configuration layout

```
~/.config/prism/values.yaml                  # base values, dotfiles-tracked per host
~/.config/prism/contexts/profile/<name>.yaml # named profiles, full snapshots
~/.config/prism/contexts/wallpaper/<id>.yaml # per-wallpaper overrides, `_source` names the wallpaper
~/.local/state/prism/active.json             # which contexts are active (runtime state)
~/.local/state/prism/resolved.json           # the bus: every parameter's effective value
```

Values resolve as defaults, then base, then the active wallpaper context, then
the active profile. `prism set` writes into the topmost active context;
`prism set --base` writes the base file. `prism context` manages contexts:
`list`, `show`, `save`, `activate`, `deactivate`, `delete`, and `wallpaper
<path>`, the last being what a Noctalia `wallpaper_changed` hook calls. Design:
`docs/specs/2026-09-05-prism-context-layers-design.md`.
```

- [ ] **Step 3: Visual-bus design**

At the end of Section 2 (before `## Section 3`), add:

```markdown
### Context layers (2026-09-05)

Resolution is no longer only default then override. Named profile and
per-wallpaper contexts layer over `values.yaml`, one active per kind, and
`set` writes into the topmost active one. `resolved.json` is unchanged.
See `../../specs/2026-09-05-prism-context-layers-design.md`.
```

- [ ] **Step 4: Plugin contract note**

Replace the sentence `Each section shows a reset that clears every modified parameter it contains.` with `Each section shows a reset that removes every override its parameters hold in the write target.` Replace `and a per-parameter reset.` with `and a per-parameter reset that removes the override in the write target and shows the fallback value until describe reconciles.` Add a short paragraph after the "Declarative presentation" bullets:

```markdown
`prism describe --json` carries `active` (the active context per kind),
`target` (the write-target layer), and per parameter `layer` (where the value
comes from) and `fallback` (what `unset` would leave). A parameter is
overridden when `layer == target`; the reset is visible exactly then.
```

- [ ] **Step 5: Spec status**

In `docs/specs/2026-09-05-prism-context-layers-design.md` set the status line to `**Status:** implemented on \`feat/prism-6fd864\` at <commit of Task 7>, suite passing` (fill the short hash from `git log --oneline -1` before this commit).

- [ ] **Step 6: Verify and close**

Run: `just gate`
Expected: `tasks check` ok and the suite passing.

```bash
tasks done prism-1f3afe "README, visual-bus pointer, plugin contract note, spec status"
tasks done prism-6fd864 "context layers: storage, layered resolution, context CLI, set/unset targeting, panel reset; spec docs/specs/2026-09-05-prism-context-layers-design.md"
git add README.md docs tasks/
git commit -m "docs: record the context layers in the README, bus design, and plugin contract"
```

Then merge `feat/prism-6fd864` into `main` per the finishing-a-development-branch skill; the live hook wiring is `dot-88dc34` and the panel profile controls are `prism-ea6344`, both unblocked by this merge.
