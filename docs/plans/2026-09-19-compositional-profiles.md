# Compositional Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every edit lands in a scratch layer above the look and the context deltas; commits are typed, revert is one verb, the wallpaper hook folds scratch into the wallpaper that leaves, and the panel shows edits, commits, and the wallpaper's nudges from the store's `held` field.

**Architecture:** The store gains one runtime file, `scratch.yaml`, and the resolution order becomes `default, base, profile, wallpaper, state, scratch`. `set`, `unset`, and `reset` write scratch; a new `prism commit` verb folds it into base, the loaded profile, a new profile, or the wallpaper's delta, and every multi-file verb validates its whole next state first and writes in the order the spec fixes. The Noctalia panel drops its shadow machinery, derives every count from `held`, gains an edits row and a clear-wallpaper header, and re-reads describe every two seconds on the host's second tick.

**Tech Stack:** Node 20 ESM, `node --test`, `yaml`; Luau panel for Noctalia plugin API 22 tested with plain Lua 5.4 (`plugin_test.lua`, driven by `npm run test:plugin-lua`).

**Spec:** `docs/specs/2026-09-19-compositional-profiles-design.md`. Section numbers below refer to it.

## Global Constraints

- Every verb that touches `values.yaml`, a context file, `scratch.yaml`, or `active.json` runs under the store lock (`withLock(lockPath(), …)`) and writes through the temp-and-rename helpers.
- A multi-file verb computes and validates its whole next state before its first write, then writes in the Section 8 order: every prefix is a valid store with unchanged effective values, up to the one visible step.
- A commit never changes an effective value and never writes `resolved.json`.
- Errors are one line, name the key or context, and leave no partial write. Message texts are copied verbatim from the spec: `nothing to commit`, `<key>: not edited`, `wallpaper <id> is not on screen`, `wallpaper <id>: untuned`, `profile <name> is loaded; commit profile, or deactivate it first`, `prism: dropped the retired pinned field from active.json`.
- Panel buttons keep the reset idiom: always in the tree, `opacity` carries state, tooltip explains, the click handler guards. Noctalia glyph names used here are verified in `assets/fonts/tabler.json`: `restore`, `equal`, `baseline`, `bookmark`, `photo-check`, `photo`, `photo-filled`, `eraser`, `device-floppy`, `pencil`, `trash`, `check`, `x`.
- No AI attribution in commit messages. Conventional commits, scoped as the log already does (`feat(store)`, `feat(context)`, `feat(cli)`, `feat(panel)`, `test(…)`, `docs(…)`).
- Run `just test` (the full suite) before every commit; a task's commit lands only on a green suite.
- Paths in this plan are relative to the repository root inside the task worktree `.worktrees/prism-aec90f/`.
- Shipped defaults the fixtures lean on (read from `defs/`): `glass.ior` 1.5, `glass.paneLip` 6, `glass.roughness` 0.08, `glass.noise` 0, `compositor.gaps` 24, `terminal.background.opacity.inactive` 0. `set` normalizes a value the fold beneath already shows into no edit, so a fixture's edit uses a value no layer beneath supplies: `glass.ior` 1.7 for an edit, 1.24 for base, 1.3 for a profile, 1.35 or 1.4 for a delta. A fixture that expects the default names it as such.

## Commit boundaries

The contract test (`integrations/noctalia-plugin/contract.test.mjs`) hands real `describe` output to the panel's validator, so the store's shape and the panel's model contract cannot change in separate green commits. The tasks therefore group into five commits, each of which passes `just test`:

| commit | tasks | message |
|---|---|---|
| 1 | 1, 2 | `feat(store): add the scratch layer, repair the retired pinned field, lock the requirements read` (Task 1 commits its half; Task 2 amends nothing and commits its own) |
| 2 | 3, 4, 5, 6, 7, 9, 10 | `feat: move every edit into the scratch layer with typed commits` |
| 3 | 8 | `test(store): prove every multi-file verb survives an interruption after any write` |
| 4 | 11 | `feat(panel): re-read the store every two seconds while open` |
| 5 | 12 | `docs: describe the scratch layer, commits, and the panel's edits row` |

Inside commit 2, each task ends by running the tests it touched and says so; only Task 10 runs the full suite and commits. A task in that group is still reviewed on its own diff (`git diff` against the commit-1 tip), which is what makes it a task.

## File structure

| file | responsibility after this plan |
|---|---|
| `src/paths.js` | adds `scratchPath()` |
| `src/scratch.js` (new) | read and write `scratch.yaml`; an empty scratch is no file |
| `src/contexts.js` | `LAYER_ORDER = ['profile','wallpaper','state']`, `DELTA_KINDS`, the one-time `pinned` repair in `readActive` |
| `src/layers.js` | `RESOLUTION_ORDER` with `scratch`, `withScratch`, `loadStore` returning `scratch`, `beneath`, `held`; no write target |
| `src/resolve.js` | exports `checkLayer` |
| `src/reset.js` | modes `revert`, `symmetric`, `neutral`; normalizes against `beneath` |
| `src/commit.js` (new) | `prism commit base | profile [<name>] | wallpaper <id>` |
| `src/context-cli.js` | no `save`/`pin`/`unpin`; `clear wallpaper <id>`; fold branches in `changeSlots` |
| `src/cli.js` | `set`/`unset`/`reset` write scratch; `describe` emits `held`; `commit` dispatch; `requirements` locked |
| `integrations/noctalia-plugin/queue.luau` | verbs `commit` and `clear`; no `pin`/`save` |
| `integrations/noctalia-plugin/presentation.luau` | `holds`, `editedCount`, `wallpaperHeader` from `held`, `profileSection` with `Default`; no shadow helpers |
| `integrations/noctalia-plugin/panel.luau` | validator on `held`, edits row, wallpaper header with clear, provenance marker, commit flows, second-tick refresh |
| tests | `test/scratch.test.js` (new), `test/commit.test.js` (new), edits to `layers`, `contexts`, `cli`, `context-cli`, `reset`, `plugin-client`, `plugin-panel-lifecycle` tests, `plugin_test.lua`, `contract.test.mjs` |
| docs | README, `docs/notes/noctalia-plugin-contract.md`, status lines on the two superseded specs, closing paragraph on the brief |

---

### Task 1: Scratch file, and the store reads it

Additive only: the layer order, the write target, and every existing export stay, so the suite stays green. Task 3 performs the switch.

**Files:**
- Modify: `src/paths.js`
- Create: `src/scratch.js`
- Modify: `src/contexts.js:11` (add `DELTA_KINDS`)
- Modify: `src/layers.js` (`loadStore`, new `withScratch`)
- Modify: `src/resolve.js:6` (export `checkLayer`)
- Test: `test/scratch.test.js` (new), `test/layers.test.js` (append)

**Interfaces:**
- Produces: `readScratch(): object`, `writeScratch(values)`, `scratchPath()`, `DELTA_KINDS = ['wallpaper','state']`, `withScratch(layers, scratch)`, `checkLayer(defs, values, where)`; `loadStore(defs)` gains `scratch`, `beneath`, and `held` beside its existing fields.

- [ ] **Step 1: Write the failing scratch test**

Create `test/scratch.test.js`:

```js
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
const { readScratch, writeScratch } = await import('../src/scratch.js');
const { scratchPath } = await import('../src/paths.js');

beforeEach(() => {
  fs.rmSync(process.env.PRISM_STATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(process.env.PRISM_STATE_DIR, { recursive: true });
});

test('a missing scratch file is an empty layer', () => {
  assert.deepEqual(readScratch(), {});
});

test('scratch round-trips as flat YAML in the state directory', () => {
  writeScratch({ 'glass.ior': 1.4, 'glass.noise': 0 });
  assert.equal(scratchPath(), path.join(process.env.PRISM_STATE_DIR, 'scratch.yaml'));
  assert.equal(fs.readFileSync(scratchPath(), 'utf8'), 'glass.ior: 1.4\nglass.noise: 0\n');
  assert.deepEqual(readScratch(), { 'glass.ior': 1.4, 'glass.noise': 0 });
});

test('writing an empty scratch removes the file, so a clean store leaves nothing behind', () => {
  writeScratch({ 'glass.ior': 1.4 });
  writeScratch({});
  assert.equal(fs.existsSync(scratchPath()), false);
  assert.deepEqual(readScratch(), {});
});

test('a scratch file that is not a flat object fails loudly', () => {
  fs.writeFileSync(scratchPath(), '- 1\n- 2\n');
  assert.throws(() => readScratch(), /scratch must be a flat object/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/scratch.test.js`
Expected: FAIL, `Cannot find module '../src/scratch.js'`.

- [ ] **Step 3: Add the path and the module**

Append to `src/paths.js` after `activePath`:

```js
export const scratchPath = () => path.join(stateDir(), 'scratch.yaml');
```

Create `src/scratch.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { scratchPath } from './paths.js';

// The scratch layer: every edit not yet committed. Runtime state, so it lives
// beside active.json rather than in the dotfiles-tracked config directory.
export function readScratch() {
  let text;
  try {
    text = fs.readFileSync(scratchPath(), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  const doc = parse(text) ?? {};
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new Error('scratch must be a flat object');
  }
  return doc;
}

// An empty scratch is no file: a clean store leaves nothing behind.
export function writeScratch(values) {
  const file = scratchPath();
  if (Object.keys(values).length === 0) {
    fs.rmSync(file, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, stringify(values));
  fs.renameSync(tmp, file);
}
```

- [ ] **Step 4: Run the scratch test to verify it passes**

Run: `node --test test/scratch.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Append the scratch tests to the layers test**

Append to `test/layers.test.js`, with `const { writeScratch } = await import('../src/scratch.js');` added beside the other imports:

```js
test('loadStore reads scratch as the topmost layer and reports beneath and held', () => {
  writeValues({ 'a.x': 0.2 });
  writeContext('profile', 'dusk', { source: null, values: { 'a.x': 0.9, 'a.y': true } });
  writeActive({ profile: 'dusk' });
  writeScratch({ 'a.y': false });

  const store = layers.loadStore(defs);
  assert.deepEqual(store.params, { 'a.x': 0.9, 'a.y': false });
  assert.deepEqual(store.layerOf, { 'a.x': 'profile', 'a.y': 'scratch' });
  assert.deepEqual(store.beneath, { 'a.x': 0.9, 'a.y': true }, 'the fold without scratch');
  assert.deepEqual(store.held, { 'a.x': ['base', 'profile'], 'a.y': ['profile', 'scratch'] });
  assert.deepEqual(store.scratch, { 'a.y': false });
  assert.deepEqual(store.layers.map((layer) => layer.kind), ['profile'], 'context layers only');
});

test('loadStore with nothing active: held is empty for a default and names base for an override', () => {
  writeValues({ 'a.x': 0.2 });
  const store = layers.loadStore(defs);
  assert.deepEqual(store.held, { 'a.x': ['base'], 'a.y': [] });
  assert.deepEqual(store.beneath, store.params);
});

test('loadStore validates scratch like every other layer', () => {
  writeScratch({ 'a.x': 7 });
  assert.throws(() => layers.loadStore(defs), /scratch null: a\.x: 7 outside range/);
});

test('withScratch appends scratch as the last layer', () => {
  assert.deepEqual(layers.withScratch([{ kind: 'profile', name: 'p', values: {} }], { 'a.x': 0.1 }), [
    { kind: 'profile', name: 'p', values: {} },
    { kind: 'scratch', name: null, values: { 'a.x': 0.1 } },
  ]);
});
```

- [ ] **Step 6: Run the layers test to verify it fails**

Run: `node --test test/layers.test.js`
Expected: FAIL, `store.held` is undefined and `withScratch` is not a function.

- [ ] **Step 7: Add `DELTA_KINDS` and export `checkLayer`**

In `src/contexts.js` after `LAYER_ORDER` add:

```js
// The kinds that are sparse, hook-activated deltas over the look.
export const DELTA_KINDS = ['wallpaper', 'state'];
```

In `src/resolve.js` change `function checkLayer(` to `export function checkLayer(`.

- [ ] **Step 8: Extend `loadStore`**

In `src/layers.js` add `import { readScratch } from './scratch.js';`, add after `loadLayers`:

```js
// Scratch is always the topmost layer. Until the switch that makes it the
// write target, nothing writes it, so it is empty on every host.
export function withScratch(layers, scratch) {
  return [...layers, { kind: 'scratch', name: null, values: scratch }];
}
```

and in `loadStore` replace `const { params, layerOf } = resolveLayered(defs, base, layers);` with:

```js
  const scratch = readScratch();
  const { params, layerOf } = resolveLayered(defs, base, withScratch(layers, scratch));
  // The fold beneath scratch: what a revert reveals, and what a set normalizes against.
  const beneath = resolveLayered(defs, base, layers).params;
  const held = {};
  for (const key of Object.keys(params)) {
    held[key] = [];
    if (Object.hasOwn(base, key)) held[key].push('base');
    for (const layer of layers) if (Object.hasOwn(layer.values, key)) held[key].push(layer.kind);
    if (Object.hasOwn(scratch, key)) held[key].push('scratch');
  }
```

and add `scratch, beneath, held` to the returned object. Everything else in the file stays as it is.

- [ ] **Step 9: Run the scratch and layers tests, then the suite**

Run: `node --test test/scratch.test.js test/layers.test.js && just test`
Expected: PASS throughout; the additions change no behaviour while scratch is empty.

- [ ] **Step 10: Commit**

```bash
git add src/paths.js src/scratch.js src/contexts.js src/layers.js src/resolve.js test/scratch.test.js test/layers.test.js
git commit -m "feat(store): add the scratch layer and read it above every context"
```

The final `src/layers.js`, which Task 3 installs, is:

```js
import { readValues } from './values.js';
import { LAYER_ORDER, listContexts, readActive, readContext } from './contexts.js';
import { readScratch } from './scratch.js';
import { resolveLayered } from './resolve.js';

export function activeName(active, kind) {
  const entry = active[kind];
  if (entry === undefined) return null;
  return kind === 'wallpaper' ? entry.id : entry;
}

export function activeJson(active) {
  const wallpaper = active.wallpaper === undefined
    ? null
    : { id: active.wallpaper.id, path: active.wallpaper.path };
  return { wallpaper, profile: active.profile ?? null };
}

// The full resolution order, low to high: the two implicit layers under the
// context stack, the context kinds, then scratch. Clients read this rather
// than carrying a copy, so adding a kind reaches them without a second list.
export const RESOLUTION_ORDER = ['default', 'base', ...LAYER_ORDER, 'scratch'];

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

// Scratch is always the topmost layer and the only one that takes edits.
export function withScratch(layers, scratch) {
  return [...layers, { kind: 'scratch', name: null, values: scratch }];
}

export function loadStore(defs) {
  const base = readValues();
  const active = readActive();
  // Listed in the same locked read as the active slots: a list read separately
  // could disagree with the slot it is drawn beside. Names only -- a profile
  // whose file is broken stays listed and fails when it is activated.
  const profiles = listContexts().profile;
  const layers = loadLayers(active);
  const scratch = readScratch();
  const { params, layerOf } = resolveLayered(defs, base, withScratch(layers, scratch));
  // The fold beneath scratch: what a revert reveals, and what a set normalizes against.
  const beneath = resolveLayered(defs, base, layers).params;
  const held = {};
  const fallback = {};
  for (const key of Object.keys(params)) {
    held[key] = [];
    if (Object.hasOwn(base, key)) held[key].push('base');
    for (const layer of layers) if (Object.hasOwn(layer.values, key)) held[key].push(layer.kind);
    if (Object.hasOwn(scratch, key)) held[key].push('scratch');
    fallback[key] = Object.hasOwn(scratch, key) ? beneath[key] : params[key];
  }
  return { base, active, profiles, layers, scratch, params, layerOf, beneath, held, fallback };
}
```

(Reproduced here so Task 3 has it in full; Task 1 installs only the additions above.)

---

### Task 2: The one-time `pinned` repair, and a locked `requirements`

**Files:**
- Modify: `src/contexts.js:56-79` (`readActive`)
- Modify: `src/cli.js:270-283` (`requirements`)
- Test: `test/contexts.test.js:107-128`, `test/cli.test.js`

**Interfaces:**
- Produces: `readActive({ warn } = {})`; `warn(text)` defaults to `process.stderr.write`. The repair rewrites `active.json` without `pinned` and calls `warn` once.

- [ ] **Step 1: Write the failing slot tests**

In `test/contexts.test.js` replace the last four lines of the `active slots round-trip…` test (from `fs.writeFileSync(activePath(), JSON.stringify({ wallpaper: { id: 'abc12345', path: '/w', pinned: 'yes' } }));` to the end of the test) with:

```js
  fs.writeFileSync(activePath(), JSON.stringify({ wallpaper: { id: 'abc12345', path: '/w', given: '/x' } }));
  assert.throws(() => contexts.readActive(), /active wallpaper carries unknown field given/);
});

test('a slot carrying the retired pinned field is repaired once on read, keeping the profile and wallpaper', () => {
  fs.writeFileSync(activePath(), JSON.stringify({ wallpaper: { id: 'abc12345', path: '/w', pinned: false }, profile: 'dusk' }));
  let warned = '';
  const repaired = contexts.readActive({ warn: (text) => { warned += text; } });
  assert.deepEqual(repaired, { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  assert.equal(warned, 'prism: dropped the retired pinned field from active.json\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(activePath(), 'utf8')),
    { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' }, 'the file is rewritten at once');
  warned = '';
  contexts.readActive({ warn: (text) => { warned += text; } });
  assert.equal(warned, '', 'the repair is unreachable once it has run');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/contexts.test.js`
Expected: FAIL, `pinned must be a boolean` and no `unknown field` message.

- [ ] **Step 3: Implement the repair**

In `src/contexts.js` replace the `readActive` function with:

```js
export function readActive({ warn = (text) => process.stderr.write(text) } = {}) {
  const active = readJson(activePath(), {});
  if (typeof active !== 'object' || active === null || Array.isArray(active)) {
    throw new Error('active.json must be an object');
  }
  for (const kind of Object.keys(active)) {
    try {
      assertKind(kind);
    } catch (err) {
      throw new Error(`${activePath()}: ${err.message}`);
    }
  }
  if (active.wallpaper !== undefined) {
    const entry = active.wallpaper;
    if (typeof entry !== 'object' || entry === null
        || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
      throw new Error('active wallpaper must carry id and path');
    }
    assertName(entry.id);
    for (const field of Object.keys(entry)) {
      if (!['id', 'path', 'pinned'].includes(field)) {
        throw new Error(`active wallpaper carries unknown field ${field}`);
      }
    }
    // One-time repair of the pin's retired field (design of 2026-09-19,
    // Section 3): the profile verbs of the previous prism rewrote it as
    // false rather than dropping it, and the hook cannot repair a slot it
    // fails to read. Every caller holds the store lock already.
    if (Object.hasOwn(entry, 'pinned')) {
      active.wallpaper = { id: entry.id, path: entry.path };
      writeActive(active);
      warn('prism: dropped the retired pinned field from active.json\n');
    }
  }
  if (active.profile !== undefined) assertName(active.profile);
  return active;
}
```

- [ ] **Step 4: Run the contexts test to verify it passes**

Run: `node --test test/contexts.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing `requirements` lock test**

In `test/cli.test.js`, directly after the test `reading verbs take the store lock, so they wait for an in-flight write`, add:

```js
test('requirements takes the store lock too, so the pinned repair never writes outside it', async () => {
  const { withLock } = await import('../src/lock.js');
  let order = [];
  const holding = withLock(lockPath(), async () => {
    order.push('locked');
    await new Promise((resolve) => setTimeout(resolve, 60));
    order.push('released');
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const reading = cli.run(['requirements'], { print: () => {} }).then(() => order.push('read'));
  await Promise.all([holding, reading]);
  assert.deepEqual(order, ['locked', 'released', 'read']);
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `node --test test/cli.test.js --test-name-pattern "requirements takes the store lock"`
Expected: FAIL, order is `['locked', 'read', 'released']`.

- [ ] **Step 7: Route `requirements` through the locked snapshot**

In `src/cli.js` inside `case 'requirements'` replace `const { params } = loadStore(defs);` with `const { params } = await snapshot(defs);`.

- [ ] **Step 8: Run it to verify it passes**

Run: `node --test test/cli.test.js --test-name-pattern "requirements takes the store lock"`
Expected: PASS.

- [ ] **Step 9: Run the suite and commit**

Run: `just test`
Expected: PASS.

```bash
git add src/contexts.js src/cli.js test/contexts.test.js test/cli.test.js
git commit -m "feat(store): repair the retired pinned slot field once and lock the requirements read"
```

---

### Task 3: The switch: the new order, and `set` and `unset` write scratch

First task of commit 2. From here to Task 10 the suite is red between tasks; each task runs the tests it touched.

**Files:**
- Modify: `src/contexts.js:9-10` (`LAYER_ORDER`)
- Modify: `src/layers.js` (whole file, to the version printed at the end of Task 1)
- Modify: `src/cli.js:58-119` (`set`, `unset`), imports at `src/cli.js:9-11`
- Test: `test/layers.test.js`, `test/cli.test.js:551-632`

**Interfaces:**
- Consumes: `readScratch`, `writeScratch`, `checkLayer`.
- Produces: `LAYER_ORDER = ['profile','wallpaper','state']`, `RESOLUTION_ORDER = ['default','base','profile','wallpaper','state','scratch']`, `loadStore(defs) -> { base, active, profiles, layers, scratch, params, layerOf, beneath, held, fallback }` with `fallback` meaning what revert reveals; `prism set [--base] <key> <value>` normalizes into scratch; `prism unset [--base] <key>` removes from scratch or base; errors `<key>: not edited` and `<key>: not set in base`.
- Removes: `writeTarget`, `layersBelow`, `store.target`, `store.heldInTarget`, `activeJson`'s `pinned`.

- [ ] **Step 1: The order and the store**

In `src/contexts.js` replace the `LAYER_ORDER` line and its comment with:

```js
// Resolution order of the context kinds, lowest first. Base sits below all of
// them and scratch above; the look is base then profile, and the deltas ride
// on top of the look (2026-09-19 compositional profiles design, Section 1).
export const LAYER_ORDER = ['profile', 'wallpaper', 'state'];
```

Replace `src/layers.js` with the full version printed at the end of Task 1. Then rewrite `test/layers.test.js` from the `writeTarget` test to the end of the file with:

```js
test('the resolution order puts the profile under the deltas and scratch on top', () => {
  assert.deepEqual(layers.RESOLUTION_ORDER, ['default', 'base', 'profile', 'wallpaper', 'state', 'scratch']);
});

test('loadLayers lists the profile before the wallpaper', () => {
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'a.x': 0.7 } });
  writeContext('profile', 'dusk', { source: null, values: { 'a.y': false } });
  assert.deepEqual(layers.loadLayers({ profile: 'dusk', wallpaper: { id: 'abc12345', path: '/w' } }), [
    { kind: 'profile', name: 'dusk', values: { 'a.y': false } },
    { kind: 'wallpaper', name: 'abc12345', values: { 'a.x': 0.7 } },
  ]);
});

test('loadStore: a wallpaper delta shows through under a full profile, and scratch shows over both', () => {
  writeValues({ 'a.x': 0.2 });
  writeContext('profile', 'dusk', { source: null, values: { 'a.x': 0.9, 'a.y': true } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'a.x': 0.7 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  writeScratch({ 'a.y': false });

  const store = layers.loadStore(defs);
  assert.deepEqual(store.params, { 'a.x': 0.7, 'a.y': false });
  assert.deepEqual(store.layerOf, { 'a.x': 'wallpaper', 'a.y': 'scratch' });
  assert.deepEqual(store.beneath, { 'a.x': 0.7, 'a.y': true }, 'the fold without scratch');
  assert.deepEqual(store.held, { 'a.x': ['base', 'profile', 'wallpaper'], 'a.y': ['profile', 'scratch'] });
  // fallback is what revert reveals: the fold beneath scratch for an edited key, the value itself otherwise
  assert.deepEqual(store.fallback, { 'a.x': 0.7, 'a.y': true });
  assert.deepEqual(layers.activeJson(store.active),
    { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
});

test('loadStore with nothing active: held is empty for a default and names base for an override', () => {
  writeValues({ 'a.x': 0.2 });
  const store = layers.loadStore(defs);
  assert.deepEqual(store.params, { 'a.x': 0.2, 'a.y': true });
  assert.deepEqual(store.held, { 'a.x': ['base'], 'a.y': [] });
  assert.deepEqual(store.fallback, { 'a.x': 0.2, 'a.y': true }, 'nothing is edited, so revert reveals nothing');
  assert.deepEqual(layers.activeJson(store.active), { wallpaper: null, profile: null });
});

test('loadStore validates scratch like every other layer', () => {
  writeScratch({ 'a.x': 7 });
  assert.throws(() => layers.loadStore(defs), /scratch null: a\.x: 7 outside range/);
});

test('withScratch appends scratch as the last layer', () => {
  assert.deepEqual(layers.withScratch([{ kind: 'profile', name: 'p', values: {} }], { 'a.x': 0.1 }), [
    { kind: 'profile', name: 'p', values: {} },
    { kind: 'scratch', name: null, values: { 'a.x': 0.1 } },
  ]);
});
```

(This replaces the `writeTarget`, the four old `loadStore …` tests, and Task 1's three appended tests.) Run `node --test test/layers.test.js`: PASS.

- [ ] **Step 2: Rewrite the write-target tests**

In `test/cli.test.js` replace the six tests from `set under an unpinned wallpaper writes base…` through `unset of the last key in a profile context still leaves an empty file…` with:

```js
test('set writes scratch above every layer, and a wallpaper on screen never captures it', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ wallpaper: { id: 'abc12345', path: '/walls/a.jpg' }, profile: 'dusk' });
  const calls = [];
  assert.equal(await cli.run(['set', 'glass.ior', '1.7'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
  assert.equal(readContext('wallpaper', 'abc12345'), null, 'no wallpaper file appears');
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ior': 1.3 }, 'the profile is untouched');
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), 'glass.ior: 1.24\n', 'base untouched');
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.7);
  assert.deepEqual(calls, [], 'no fixture sink binds glass.ior');
});

test('set normalizes: a value the fold beneath already shows is no edit', async () => {
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.3 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  assert.equal(await cli.run(['set', 'glass.ior', '1.5'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.5 });
  // dragging back to where it started leaves no edit behind
  assert.equal(await cli.run(['set', 'glass.ior', '1.3'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), {});
  assert.equal(fs.existsSync(scratchPath()), false);
  // 1.5 is the shipped default, and still an edit when the fold beneath differs
  assert.equal(await cli.run(['set', 'glass.ior', '1.5'], { runner: () => {} }), 0);
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.4 } });
  assert.equal(await cli.run(['set', 'glass.ior', '1.5'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.5 });
});

test('set --base writes through to values.yaml, bypassing scratch', async () => {
  writeContext('profile', 'dusk', { source: null, values: {} });
  writeActive({ profile: 'dusk' });
  assert.equal(await cli.run(['set', '--base', 'glass.ior', '1.1'], { runner: () => {} }), 0);
  assert.match(fs.readFileSync(valuesPath(), 'utf8'), /glass\.ior: 1\.1/);
  assert.deepEqual(readScratch(), {});
  assert.deepEqual(readContext('profile', 'dusk').values, {});
});

test('unset removes the edit from scratch and refuses a key that is not edited', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 1.24\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ profile: 'dusk' });
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });

  const calls = [];
  assert.equal(await cli.run(['unset', 'glass.ior'], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readScratch(), {});
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.3, 'the profile shows through');
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ior': 1.3 }, 'a revert never touches the profile');

  const absent = await runCaptured(['unset', 'glass.ior'], { runner: () => {} });
  assert.notEqual(absent.code, 0);
  assert.match(absent.stderr, /glass\.ior: not edited/);

  await cli.run(['set', '--base', 'glass.ior', '1.1'], { runner: () => {} });
  assert.equal(await cli.run(['unset', '--base', 'glass.ior'], { runner: () => {} }), 0);
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), '{}\n');
  const absentBaseFlag = await runCaptured(['unset', '--base', 'glass.ior'], { runner: () => {} });
  assert.match(absentBaseFlag.stderr, /glass\.ior: not set in base/);
});

test('unset digs an orphan out of scratch the way it does for base', async () => {
  writeScratch({ 'gone.away': 1 });
  const blocked = await runCaptured(['set', 'glass.paneLip', '10'], { runner: () => {} });
  assert.match(blocked.stderr, /unknown param gone\.away in scratch null/);
  assert.equal(await cli.run(['unset', 'gone.away'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), {});
});
```

Add to the imports at the top of `test/cli.test.js`:

```js
const { readScratch, writeScratch } = await import('../src/scratch.js');
```

and add `scratchPath` to the `paths.js` import list.

- [ ] **Step 3: Run them to verify they fail**

Run: `node --test test/cli.test.js --test-name-pattern "scratch|normalizes|not edited|orphan out of scratch|bypassing scratch"`
Expected: FAIL, `Cannot read properties of undefined (reading 'kind')` from the old `store.target`.

- [ ] **Step 4: Rewrite `set` and `unset`**

In `src/cli.js` change the imports:

```js
import { loadStore, loadLayers, withScratch, activeJson, RESOLUTION_ORDER } from './layers.js';
import { listContexts, readContext, readActive, contextPath, VERB_KINDS } from './contexts.js';
import { readScratch, writeScratch } from './scratch.js';
```

(`writeContext` and `deleteContext` leave this import list; `contextSource` is deleted.) Replace `case 'set'` and `case 'unset'` with:

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
          if (toBase) {
            const values = { ...store.base };
            if (isDeepStrictEqual(value, def.default)) delete values[key];
            else values[key] = value;
            writeValues(values);
          } else {
            // Normalized: a value the fold beneath already shows is no edit,
            // so dragging back to where a slider started leaves nothing behind.
            const scratch = { ...store.scratch };
            if (isDeepStrictEqual(value, store.beneath[key])) delete scratch[key];
            else scratch[key] = value;
            writeScratch(scratch);
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
          const base = readValues();
          const scratch = readScratch();
          const held = toBase ? base : scratch;
          const orphan = !defs.has(key) && Object.hasOwn(held, key);
          if (!defs.has(key) && !orphan) throw new Error(`unknown param ${key}`);
          if (!Object.hasOwn(held, key)) {
            throw new Error(toBase ? `${key}: not set in base` : `${key}: not edited`);
          }
          if (!orphan) resolveLayered(defs, base, withScratch(layers, scratch));
          const values = { ...held };
          delete values[key];
          if (toBase) writeValues(values);
          else writeScratch(values);
          resolved = writeResolved(loadStore(defs).params);
        });

        return report(await fanOut({ manifests, resolved, changedKeys: [key], runner: opts.runner }), eprint);
      }
```

- [ ] **Step 5: Run the CLI set and unset tests**

Run: `node --test test/cli.test.js --test-name-pattern "^set|^unset|scratch"`
Expected: PASS for the rewritten tests. Tests named `describe carries the neutral contract…`, `a base override hidden…`, and the `reset` tests still fail; Tasks 4 and 5 own them.

- [ ] **Step 6: Teach doctor to screen scratch**

Spec Section 1: doctor reports an orphan or invalid key in scratch the way it does for any layer, naming the file. Add to `test/cli.test.js` after `doctor screens values.yaml for invalid values…`:

```js
test('doctor screens scratch.yaml for orphans and invalid values, naming the file', async () => {
  await cli.run(['apply'], { runner: () => {} });
  writeScratch({ 'gone.away': 1, 'glass.ior': 99 });
  let out = '';
  const code = await cli.run(['doctor'], { print: (t) => { out += t; }, runner: () => {} });
  assert.equal(code, 1);
  assert.match(out, /doctor: orphan value gone\.away in scratch: no definition — run 'prism unset gone\.away'/);
  assert.match(out, /doctor: scratch: glass\.ior: 99 outside range/);
});
```

Run it to see it fail (doctor throws on the orphan instead of reporting it), then in `src/cli.js` `case 'doctor'`, after the loop over `all[kind]` contexts and before `if (orphans.length > 0 || contextProblems > 0)`, add:

```js
          const scratch = readScratch();
          for (const [key, value] of Object.entries(scratch)) {
            const def = defs.get(key);
            if (!def) {
              print(`doctor: orphan value ${key} in scratch: no definition — run 'prism unset ${key}'\n`);
              contextProblems++;
              continue;
            }
            try {
              validateValue(def, value);
            } catch (error) {
              print(`doctor: scratch: ${error.message}\n`);
              contextProblems++;
            }
          }
```

Run: `node --test test/cli.test.js --test-name-pattern "doctor screens scratch"`
Expected: PASS.

- [ ] **Step 7: No commit**

This task is part of commit 2 (see Commit boundaries). Leave the work staged and continue with Task 4.

---

### Task 4: Reset modes write scratch, and `defaults` becomes `revert`

**Files:**
- Modify: `src/reset.js`
- Modify: `src/cli.js` (`case 'reset'`)
- Test: `test/reset.test.js`, `test/cli.test.js:686-851`

**Interfaces:**
- Produces: `MODES = ['revert', 'symmetric', 'neutral']`; `planReset({ defs, mode, group, held, effective, beneath }) -> { values, changedKeys }`, where a value equal to `beneath[key]` is deleted rather than stored.

- [ ] **Step 1: Update the planner tests**

In `test/reset.test.js` change the `plan` helper and the two `defaults` tests:

```js
const plan = (over) => planReset({
  defs: defs(), mode: 'neutral', group: null, held: {}, effective: {},
  beneath: {}, ...over,
});

test('revert removes every scoped key scratch holds', () => {
  const held = { 'a.lip': 9, 'a.blur': 0.4 };
  const out = plan({ mode: 'revert', held, effective: { 'a.lip': 30, 'a.blur': 0.4 } });
  assert.deepEqual(out.values, {});
  assert.deepEqual(out.changedKeys.sort(), ['a.blur', 'a.lip']);
  assert.deepEqual(held, { 'a.lip': 9, 'a.blur': 0.4 }, 'held is not mutated');
});

test('revert honours the group scope', () => {
  const out = plan({ mode: 'revert', group: 'Glass', held: { 'a.lip': 9, 'a.blur': 0.4 } });
  assert.deepEqual(out.values, { 'a.blur': 0.4 });
  assert.deepEqual(out.changedKeys, ['a.lip']);
});

test('a neutral value the fold beneath already supplies is removed from scratch, not stored', () => {
  const held = { 'a.lip': 9 };
  const out = plan({ held, effective: { 'a.lip': 9 }, beneath: { 'a.lip': 0 } });
  assert.deepEqual(out.values, {}, 'beneath is already neutral, so the edit goes');
  assert.deepEqual(out.changedKeys, ['a.lip']);
});
```

Every other test in the file that passed `normalizeToDefault: true` passes `beneath: <the defaults map>` instead; those that passed `false` pass nothing. Run `grep -n normalizeToDefault test/reset.test.js` and convert each.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/reset.test.js`
Expected: FAIL, `revert` is not a mode.

- [ ] **Step 3: Rewrite the planner**

In `src/reset.js`:

```js
export const MODES = ['revert', 'symmetric', 'neutral'];
```

and replace `planReset` with:

```js
// `held` is the target layer's contents (scratch, or base under --base);
// `effective` is what the skip rules compare against; `beneath` is the fold
// the target sits on, so a value it already supplies is a deletion, not a
// store. That keeps a reset from leaving redundant overrides behind.
export function planReset({ defs, mode, group, held, effective, beneath }) {
  const scoped = scopeOf(defs, group);
  const values = { ...held };

  const put = (def, value) => {
    validateValue(def, value);
    if (isDeepStrictEqual(value, beneath[def.key])) delete values[def.key];
    else values[def.key] = value;
  };

  if (mode === 'revert') {
    for (const def of scoped) delete values[def.key];
  } else if (mode === 'neutral') {
    for (const def of scoped) {
      if (def.neutralize === false) continue;
      if (isDeepStrictEqual(effective[def.key], def.neutral)) continue;
      put(def, def.neutral);
    }
  } else {
    for (const row of pairsOf(scoped)) {
      const value = effective[row.focused.key];
      if (isDeepStrictEqual(effective[row.unfocused.key], value)) continue;
      put(row.unfocused, value);
    }
  }

  const changedKeys = [];
  for (const key of new Set([...Object.keys(held), ...Object.keys(values)])) {
    if (!isDeepStrictEqual(held[key], values[key])) changedKeys.push(key);
  }
  return { values, changedKeys };
}
```

- [ ] **Step 4: Run the planner test to verify it passes**

Run: `node --test test/reset.test.js`
Expected: PASS.

- [ ] **Step 5: Rewrite the CLI reset tests**

In `test/cli.test.js`:

1. Rename every `'defaults'` argv to `'revert'` and update the usage regex in `reset rejects an unknown group and a bad mode` to `/usage: prism reset revert\|symmetric\|neutral/`.
2. Replace `reset defaults removes a base override hidden by a wallpaper`, `reset defaults deletes a pinned wallpaper context it empties`, and `neutral writes the active profile while preserving its lower layers` with:

```js
test('reset revert removes scratch keys in scope and leaves every persisted layer alone', async () => {
  fs.writeFileSync(valuesPath(), 'glass.paneLip: 9\n');
  writeContext('profile', 'p1', { source: null, values: { 'glass.paneLip': 12 } });
  writeActive({ profile: 'p1' });
  await cli.run(['set', 'glass.paneLip', '30'], { runner: () => {} });
  await cli.run(['set', 'glass.roughness', '0.4'], { runner: () => {} });
  await cli.run(['reset', 'revert', '--group', 'Glass'], { runner: () => {} });
  assert.deepEqual(readScratch(), { 'glass.roughness': 0.4 }, 'only the Glass edit is reverted');
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.paneLip'], 12, 'the profile shows through');
  assert.deepEqual(readContext('profile', 'p1').values, { 'glass.paneLip': 12 });
  assert.equal(readValues()['glass.paneLip'], 9);
});

test('reset revert --base removes base overrides: the way back to the shipped defaults', async () => {
  await cli.run(['set', '--base', 'glass.paneLip', '9'], { runner: () => {} });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.paneLip': 30 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  await cli.run(['reset', 'revert', '--base', '--group', 'Glass'], { runner: () => {} });
  assert.equal('glass.paneLip' in readValues(), false);
  assert.equal(readContext('wallpaper', 'w1').values['glass.paneLip'], 30, 'a base reset leaves the delta alone');
});

test('neutral writes scratch above a loaded profile and leaves its file byte-identical', async () => {
  fs.writeFileSync(valuesPath(), 'glass.roughness: 0.3\n');
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.roughness': 0.7 } });
  writeContext('profile', 'p1', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ profile: 'p1', wallpaper: { id: 'w1', path: '/w.png' } });
  const before = fs.readFileSync(contextPath('profile', 'p1'), 'utf8');
  const result = await runCaptured(['reset', 'neutral', '--group', 'Focus'], { runner: () => {} });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(readScratch()['glass.roughness'], 0);
  assert.equal(readScratch()['glass.ior'], 1, 'the profile value is not neutral, so scratch overrides it');
  assert.equal(fs.readFileSync(contextPath('profile', 'p1'), 'utf8'), before);
  assert.equal(readContext('wallpaper', 'w1').values['glass.roughness'], 0.7);
  assert.equal(readValues()['glass.roughness'], 0.3);
});

test('a neutral value the fold beneath already supplies is not stored in scratch', async () => {
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.roughness': 0 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  await cli.run(['set', 'glass.roughness', '0.4'], { runner: () => {} });
  await cli.run(['reset', 'neutral', '--group', 'Focus'], { runner: () => {} });
  assert.equal('glass.roughness' in readScratch(), false, 'the delta is already neutral, so the edit simply goes');
});
```

3. In `symmetric copies what is on screen, or the base value under --base`, the first assertion now reads scratch: `assert.equal(readScratch()['glass.inactive.roughness'], 0.7, 'mirrors the resolved value into scratch');` and the `--base` assertion stays on `readValues()`.
4. In `a reset that changes no contents writes nothing and calls no sink`, the argv is `['reset', 'revert', '--group', 'Glass']` and the comment becomes: `// Nothing is edited, so revert has nothing to remove.` Delete the assertion on `readValues()`.
5. In `reset visits each affected sink once and leaves hidden values alone`, replace the base fixture with an edit: delete the `fs.writeFileSync(valuesPath(), …)` line, add `await cli.run(['set', 'glass.paneLip', '30'], { runner: () => {} });` and `await cli.run(['set', 'debug.backdrop', 'true'], { runner: () => {} });`, and replace the final `readValues()` assertion with `assert.deepEqual(readScratch(), { 'debug.backdrop': true });` (`debug.backdrop` is `control: none`, so a panel-scope revert leaves it).
6. In `reset neutral leaves the exempt parameter alone` and `reset neutral writes the curated values once…` the fixtures use `set --base`; leave them, they still hold.

- [ ] **Step 6: Run the reset tests to verify they fail**

Run: `node --test test/cli.test.js --test-name-pattern "reset|neutral|symmetric"`
Expected: FAIL on `store.target`.

- [ ] **Step 7: Rewrite `case 'reset'` in `src/cli.js`**

```js
      case 'reset': {
        const usage = 'usage: prism reset revert|symmetric|neutral [--base] [--group <name>]';
        let mode = null;
        let group = null;
        let toBase = false;
        for (let index = 0; index < rest.length; index += 1) {
          const arg = rest[index];
          if (arg === '--base') toBase = true;
          else if (arg === '--group') {
            index += 1;
            group = rest[index];
            if (group === undefined) throw new Error(usage);
          } else if (mode === null) mode = arg;
          else throw new Error(usage);
        }
        if (!MODES.includes(mode)) throw new Error(usage);

        const { defs, manifests } = load();
        const groups = visibleGroups(defs);
        if (group !== null && !groups.has(group)) {
          throw new Error(`unknown group ${group}; groups with visible parameters: ${[...groups].sort().join(', ')}`);
        }

        let resolved = null;
        let changedKeys = [];
        await withLock(lockPath(), async () => {
          const store = loadStore(defs);
          // --base targets base and compares against base alone: an overlay
          // that happens to sit at the neutral must not block a base change
          // the user asked for by name. Otherwise the target is scratch.
          const held = toBase ? store.base : store.scratch;
          const effective = toBase ? resolveLayered(defs, store.base, []).params : store.params;
          const beneath = toBase ? resolveLayered(defs, {}, []).params : store.beneath;
          const plan = planReset({ defs, mode, group, held, effective, beneath });
          changedKeys = plan.changedKeys;
          if (changedKeys.length === 0) return;
          if (toBase) writeValues(plan.values);
          else writeScratch(plan.values);
          resolved = writeResolved(loadStore(defs).params);
        });

        if (changedKeys.length === 0) return 0;
        return report(await fanOut({ manifests, resolved, changedKeys, runner: opts.runner }), eprint);
      }
```

- [ ] **Step 8: Run the reset tests to verify they pass**

Run: `node --test test/cli.test.js --test-name-pattern "reset|neutral|symmetric"`
Expected: PASS.

- [ ] **Step 9: No commit**

Part of commit 2. Continue with Task 5.

---

### Task 5: `describe` emits `held` and drops the target

**Files:**
- Modify: `src/cli.js` (`case 'describe'`)
- Test: `test/cli.test.js` (`get, list, and describe read through the active layers`, `describe carries the neutral contract and target ownership`, `a base override hidden by a wallpaper is still held in the target`), `test/context-cli.test.js` (`describe reports the resolution order, low to high`), `integrations/noctalia-plugin/contract.test.mjs`

**Interfaces:**
- Produces: per parameter `held: string[]` (layers holding the key, in resolution order, never `default`); top-level `target` removed; `active.wallpaper` is `{ id, path }`.

- [ ] **Step 1: Update the describe tests**

In `test/cli.test.js`:

1. In `get, list, and describe read through the active layers`, replace the three lines from `assert.deepEqual(d.active, …)` through `const lip = …` `fallback` assertions with:

```js
  assert.deepEqual(d.active, { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  assert.equal(d.target, undefined, 'the target is always scratch and is not stated');
  assert.deepEqual(d.layers, ['default', 'base', 'profile', 'wallpaper', 'state', 'scratch']);
  const lip = d.params.find((x) => x.key === 'glass.paneLip');
  assert.deepEqual([lip.value, lip.layer, lip.fallback, lip.held], [6, 'profile', 6, ['base', 'profile']]);
  const ior = d.params.find((x) => x.key === 'glass.ior');
  assert.deepEqual([ior.value, ior.layer, ior.fallback, ior.held], [1.3, 'wallpaper', 1.3, ['base', 'wallpaper']]);
```

2. Rename `describe carries the neutral contract and target ownership` to `describe carries the neutral contract and held layers` and replace its last two assertions with:

```js
  assert.deepEqual(byKey['glass.paneLip'].held, ['base']);
  assert.deepEqual(byKey['glass.paneShiftX'].held, []);
  assert.equal(byKey['glass.paneLip'].heldInTarget, undefined);
```

3. In `describe emits only the public counter-free JSON shape`, the top-level key list becomes `['active', 'profiles', 'layers', 'rack', 'params']`, the layers expectation becomes the new order, the `described.target` assertion goes, and `'heldInTarget'` in the per-parameter key list becomes `'held'`.
4. Replace `a base override hidden by a wallpaper is still held in the target` with:

```js
test('an edited key reports every layer holding it, scratch last, and its fallback is the fold beneath', async () => {
  await cli.run(['set', '--base', 'glass.paneLip', '9'], { runner: () => {} });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.paneLip': 30 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  await cli.run(['set', 'glass.paneLip', '12'], { runner: () => {} });

  let out = '';
  await cli.run(['describe', '--json'], { print: (t) => { out += t; }, runner: () => {} });
  const param = JSON.parse(out).params.find((p) => p.key === 'glass.paneLip');
  assert.equal(param.layer, 'scratch');
  assert.equal(param.value, 12);
  assert.deepEqual(param.held, ['base', 'wallpaper', 'scratch']);
  assert.equal(param.fallback, 30, 'revert reveals the wallpaper, not base');
});
```

In `test/context-cli.test.js`, in `describe reports the resolution order, low to high`, set the expected order to `['default', 'base', 'profile', 'wallpaper', 'state', 'scratch']` and replace the `model.target` assertion with:

```js
  for (const param of model.params) {
    for (const layer of param.held) assert.ok(model.layers.includes(layer), `${param.key} held in unrankable ${layer}`);
  }
```

In `integrations/noctalia-plugin/contract.test.mjs`:

1. In `describeStore`, replace the `heldInTarget` check with `assert.ok(Array.isArray(param.held), `${param.key} held`);`.
2. In the test body, the `tuned` fixture's `active` becomes `{ profile: 'night', wallpaper: { id: 'abc12345', path: '/nonexistent/wall.png' } }` (no `pinned`); delete the two `target` assertions; the profile-layer expectation becomes `[{ key: 'glass.roughness', value: 0.7, fallback: 0.7 }]` with the comment `// fallback is what revert reveals; nothing is edited, so it is the value itself.`

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test test/cli.test.js test/context-cli.test.js integrations/noctalia-plugin/contract.test.mjs --test-name-pattern "describe|held|edited key"`
Expected: FAIL, `held` undefined and `target` present.

- [ ] **Step 3: Change the emitter**

In `src/cli.js` `case 'describe'` replace `heldInTarget: store.heldInTarget[key],` with `held: store.held[key],` and the final `print` with:

```js
        print(`${JSON.stringify({ active: activeJson(store.active), profiles: store.profiles, layers: RESOLUTION_ORDER, rack, params: described }, null, 2)}\n`);
```

- [ ] **Step 4: Run them to verify they pass**

Run: the Step 2 command. Expected: PASS for the Node tests. The contract test's Lua half still fails until Task 10 teaches the panel `held`; that is why Tasks 3 to 10 share a commit.

- [ ] **Step 5: No commit**

Part of commit 2. Continue with Task 6.

---

### Task 6: Context verbs: the fold, `clear`, and the retired verbs

**Files:**
- Modify: `src/context-cli.js` (whole file)
- Test: `test/context-cli.test.js`

**Interfaces:**
- Consumes: `checkLayer`, `withScratch`, `readScratch`, `writeScratch`.
- Produces: `prism context clear wallpaper <id>`; `changeSlots(deps, mutate, { commit, fold, without })` where `commit()` performs a context-file deletion after validation and returns `true` when it changed something effective, `fold` enables the wallpaper fold, and `without` names a context whose file the next state is computed as if it were already gone; verbs `save`, `pin`, `unpin` gone; usage `list|show|rename|activate|deactivate|delete|clear|wallpaper`.

- [ ] **Step 1: Rewrite the context tests**

In `test/context-cli.test.js`:

1. Add `const { readScratch, writeScratch } = await import('../src/scratch.js');` and `const { loadDefs } = await import('../src/defs.js'); const { defsDir } = await import('../src/paths.js'); const { loadStore } = await import('../src/layers.js');` after the existing imports.
2. In `context list…`, delete the trailing `pinned` block (from `writeActive({ wallpaper: { id: 'abc12345', … pinned: true } })` to the end of the test) and append instead:

```js
  writeScratch({ 'glass.ior': 1.3, 'glass.paneLip': 9 });
  const edited = await runCaptured(['context', 'list']);
  assert.equal(edited.stdout.split('\n').at(-2), '  scratch  2 edits');
```

3. Delete the three `context save…` / `saving a profile into itself…` tests and the two `pin…` tests.
4. In `context verbs reject…`, replace every `'save'` argv with `'delete'` (so `['context', 'delete', 'state', 'dark']`, `['context', 'delete', 'theme', 'x']`, `['context', 'delete', 'profile', 'a b']`) and add to the loop `['context', 'save', 'profile', 'x'], ['context', 'pin', 'wallpaper'], ['context', 'unpin', 'wallpaper'], ['context', 'clear'], ['context', 'clear', 'profile', 'x']`. Add `assert.match((await runCaptured(['context', 'pin', 'wallpaper'])).stderr, /usage: prism context list\|show\|rename\|activate\|deactivate\|delete\|clear\|wallpaper/);`.
5. Append these tests:

```js
test('the hook folds scratch into the wallpaper that leaves, in one locked step', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', wallpaperId(a), { source: a, values: { 'glass.paneLip': 9 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  await cli.run(['set', 'glass.paneLip', '12'], { runner: () => {} });

  const calls = [];
  assert.equal(await cli.run(['context', 'wallpaper', b], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.deepEqual(readContext('wallpaper', wallpaperId(a)),
    { source: a, values: { 'glass.paneLip': 12, 'glass.ior': 1.7 } }, 'the leaving delta absorbs scratch');
  assert.deepEqual(readScratch(), {});
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(b), path: b } });
  const params = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params;
  assert.equal(params['glass.ior'], 1.5, 'the edit left with its wallpaper; the shipped default shows');
  assert.equal(params['glass.paneLip'], 6, 'the shipped default');

  // rotating back brings the nudges back
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.7);
});

test('the first activation keeps scratch: there is no wallpaper to receive it; the next rotation folds it', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
  assert.equal(readContext('wallpaper', wallpaperId(a)), null);
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.7);
  assert.equal(await cli.run(['context', 'wallpaper', b], { runner: () => {} }), 0);
  assert.deepEqual(readContext('wallpaper', wallpaperId(a)), { source: a, values: { 'glass.ior': 1.7 } });
  assert.deepEqual(readScratch(), {});
});

test('activate and deactivate wallpaper fold like the hook; the same wallpaper again folds nothing', async () => {
  const a = wallpaperFile('a.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', 'other001', { source: '/o.jpg', values: {} });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 }, 'a repeat is a no-op, fold included');

  assert.equal(await cli.run(['context', 'activate', 'wallpaper', 'other001'], { runner: () => {} }), 0);
  assert.deepEqual(readContext('wallpaper', wallpaperId(a)).values, { 'glass.ior': 1.7 });
  assert.deepEqual(readScratch(), {});

  await cli.run(['set', 'glass.ior', '1.6'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'deactivate', 'wallpaper'], { runner: () => {} }), 0);
  assert.deepEqual(readContext('wallpaper', 'other001').values, { 'glass.ior': 1.6 });
  assert.deepEqual(readScratch(), {});
  assert.deepEqual(readActive(), {});
});

test('an invalid incoming delta is refused before anything is written', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', wallpaperId(b), { source: b, values: { 'glass.ior': 99 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  const before = {
    scratch: fs.readFileSync(scratchPath(), 'utf8'),
    active: fs.readFileSync(activePath(), 'utf8'),
    resolved: fs.readFileSync(resolvedPath(), 'utf8'),
  };
  const calls = [];
  const refused = await runCaptured(['context', 'wallpaper', b], { runner: (m) => calls.push(m.sink) });
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /wallpaper .*glass\.ior: 99 outside range/);
  assert.deepEqual(calls, []);
  assert.equal(fs.readFileSync(scratchPath(), 'utf8'), before.scratch);
  assert.equal(fs.readFileSync(activePath(), 'utf8'), before.active);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), before.resolved);
  assert.equal(readContext('wallpaper', wallpaperId(a)), null, 'the leaving delta was not written either');
});

test('deleting the active wallpaper clears the slot and leaves scratch: the fold has nowhere to go', async () => {
  const a = wallpaperFile('a.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', wallpaperId(a), { source: a, values: { 'glass.paneLip': 9 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'delete', 'wallpaper', wallpaperId(a)], { runner: () => {} }), 0);
  assert.deepEqual(readActive(), {});
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
});

test('profile activate and deactivate leave scratch alone', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'activate', 'profile', 'dusk'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.ior'], 1.7, 'the edit rides on top');
  assert.equal(await cli.run(['context', 'deactivate', 'profile'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
});

test('clear wallpaper removes the on-screen delta, resolves, fans out, and refuses a stale or untuned id', async () => {
  const a = wallpaperFile('a.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  const id = wallpaperId(a);
  assert.match((await runCaptured(['context', 'clear', 'wallpaper', id])).stderr, /no active wallpaper/);
  writeContext('wallpaper', id, { source: a, values: { 'terminal.background.opacity.inactive': 0.5 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.match((await runCaptured(['context', 'clear', 'wallpaper', 'deadbeef'])).stderr, /wallpaper deadbeef is not on screen/);

  const calls = [];
  assert.equal(await cli.run(['context', 'clear', 'wallpaper', id], { runner: (m, f, keys) => calls.push(keys) }), 0);
  assert.equal(readContext('wallpaper', id), null);
  assert.deepEqual(readActive(), { wallpaper: { id, path: a } }, 'the slot stays');
  // The bus and the fan-out reflect the delta's removal, not the values it
  // held: the next state is computed with the file already gone.
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['terminal.background.opacity.inactive'], 0);
  assert.deepEqual(calls, [['terminal.background.opacity.inactive'], ['terminal.background.opacity.inactive']]);
  assert.deepEqual(loadStore(defs).params, JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params,
    'the store and the bus agree after a clear');
  assert.match((await runCaptured(['context', 'clear', 'wallpaper', id])).stderr, new RegExp(`wallpaper ${id}: untuned`));
});
```

Add `activePath` and `scratchPath` to the `paths.js` import in this file.

- [ ] **Step 2: Run the context tests to verify they fail**

Run: `node --test test/context-cli.test.js`
Expected: FAIL on the fold, `clear`, and the retired verbs still being accepted.

- [ ] **Step 3: Rewrite `src/context-cli.js`**

Replace the whole file with:

```js
import { stringify } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  VERB_KINDS, assertKind, assertName, deleteContext, inspectContext, listContexts, readActive, readContext,
  readContextText, renameContext, wallpaperId, canonicalWallpaperPath, writeActive, writeContext,
} from './contexts.js';
import { activeName, loadLayers, loadStore, withScratch } from './layers.js';
import { readScratch, writeScratch } from './scratch.js';
import { readValues } from './values.js';
import { checkLayer, resolveLayered, writeResolved } from './resolve.js';
import { fanOut } from './fanout.js';

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

// The wallpaper a slot change leaves, or null when none does. A repeat of the
// same wallpaper leaves nothing, so it folds nothing.
function wallpaperLeaving(active, next) {
  if (active.wallpaper === undefined) return null;
  if (next.wallpaper !== undefined && next.wallpaper.id === active.wallpaper.id) return null;
  return active.wallpaper;
}

// The fold: edits made while a wallpaper showed belong to it when it leaves
// (design of 2026-09-19, Section 2). The merged delta to write, or null when
// there is nothing to fold -- no wallpaper leaving, or nothing edited.
function planFold(leaving, scratch) {
  if (leaving === null || Object.keys(scratch).length === 0) return null;
  const delta = readContext('wallpaper', leaving.id);
  return {
    name: leaving.id,
    source: delta === null ? leaving.path : delta.source,
    values: { ...(delta === null ? {} : delta.values), ...scratch },
  };
}

// Apply a slot change. `mutate(active)` computes the next slots and may throw,
// but writes nothing itself; `commit()` performs a context-file change (a
// delete) and reports whether it changed anything effective, and `without`
// names the context that delete removes so the next state is computed and
// validated as if the file were already gone. The whole next state is
// validated before the first write, and the writes follow the Section 8
// order: the merged delta, the cleared scratch, the context delete, the
// slot, the bus. The previous state is allowed not to resolve, in which case
// every bound key fans out (the apply contract): that is how a broken active
// context is recovered from.
async function changeSlots({ defs, manifests, runner }, mutate,
  { commit = () => false, fold = false, without = null } = {}) {
  let outcome = null;
  await withLock(lockPath(), async () => {
    const active = readActive();
    let previous = null;
    try {
      previous = loadStore(defs).params;
    } catch {
      previous = null;
    }
    const base = readValues();
    const scratch = readScratch();
    const next = mutate(active);
    const folded = fold ? planFold(wallpaperLeaving(active, next), scratch) : null;
    if (folded !== null) checkLayer(defs, folded.values, `wallpaper ${folded.name}`);
    const scratchAfter = folded === null ? scratch : {};
    const nextLayers = loadLayers(next).map((layer) => (
      without !== null && layer.kind === without.kind && layer.name === without.name
        ? { ...layer, values: {} }
        : layer));
    const { params } = resolveLayered(defs, base, withScratch(nextLayers, scratchAfter));
    if (folded !== null) {
      writeContext('wallpaper', folded.name, { source: folded.source, values: folded.values });
      writeScratch({});
    }
    const touched = commit() === true;
    const slotsChanged = !isDeepStrictEqual(next, active);
    if (slotsChanged) writeActive(next);
    if (folded === null && !touched && !slotsChanged) return;
    const resolved = writeResolved(params);
    const changedKeys = previous === null
      ? [...new Set(manifests.flatMap((manifest) => manifest.binds.map((bind) => bind.param)))]
      : Object.keys(params).filter((key) => !isDeepStrictEqual(params[key], previous[key]));
    outcome = { resolved, changedKeys };
  });
  if (outcome === null || outcome.changedKeys.length === 0) return null;
  return fanOut({ manifests, resolved: outcome.resolved, changedKeys: outcome.changedKeys, runner });
}

function requireOnScreen(active, id) {
  if (active.wallpaper === undefined) throw new Error('no active wallpaper');
  if (active.wallpaper.id !== id) throw new Error(`wallpaper ${id} is not on screen`);
}

// Returns a fan-out result, or null when nothing reached the bus.
export async function runContext(args, { defs, manifests, print, eprint, runner }) {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'list': {
      if (rest.length !== 0) throw usage('list');
      const { active, all, inspected, scratch } = await withLock(lockPath(), async () => {
        const listed = listContexts();
        return {
          active: readActive(),
          all: listed,
          inspected: Object.fromEntries(VERB_KINDS.map((kind) => [kind,
            Object.fromEntries(listed[kind].map((name) => [name, inspectContext(kind, name)]))])),
          scratch: readScratch(),
        };
      });
      for (const kind of VERB_KINDS) {
        const current = activeName(active, kind);
        for (const name of all[kind]) {
          const entry = inspected[kind][name];
          if (entry === null) continue; // removed between the listing and the read
          if (entry.error !== null) {
            print(`! ${kind} ${name}  ${entry.error} — run 'prism doctor'\n`);
            continue;
          }
          const marker = name === current ? '*' : ' ';
          const source = kind === 'wallpaper' ? `  ${entry.context.source}` : '';
          print(`${marker} ${kind} ${name}${source}\n`);
        }
      }
      if (active.wallpaper && !all.wallpaper.includes(active.wallpaper.id)) {
        print(`* wallpaper ${active.wallpaper.id}  ${active.wallpaper.path} (untuned)\n`);
      }
      const edits = Object.keys(scratch).length;
      if (edits > 0) print(`  scratch  ${edits} ${edits === 1 ? 'edit' : 'edits'}\n`);
      return null;
    }

    // Showing the file is what was asked for, so a file that does not parse is
    // printed as it is, with the reason on stderr.
    case 'show': {
      const { kind, name } = kindAndName(rest, 'show');
      const entry = await withLock(lockPath(), async () => inspectContext(kind, name));
      if (entry === null) throw new Error(`${kind} ${name}: no such context`);
      if (entry.error !== null) {
        print(entry.text);
        eprint(`prism: ${kind} ${name}: ${entry.error} — run 'prism doctor'\n`);
        return null;
      }
      const { context } = entry;
      const doc = kind === 'wallpaper' ? { _source: context.source, ...context.values } : context.values;
      print(stringify(doc));
      return null;
    }

    case 'activate': {
      const { kind, name } = kindAndName(rest, 'activate');
      return changeSlots({ defs, manifests, runner }, (active) => {
        const context = requireContext(kind, name);
        return kind === 'wallpaper'
          ? { ...active, wallpaper: { id: name, path: context.source } }
          : { ...active, profile: name };
      }, { fold: kind === 'wallpaper' });
    }

    case 'deactivate': {
      if (rest.length !== 1) throw usage('deactivate <kind>');
      const [kind] = rest;
      assertKind(kind);
      return changeSlots({ defs, manifests, runner }, (active) => {
        if (kind === 'wallpaper' && active.wallpaper === undefined) throw new Error('no active wallpaper');
        const next = { ...active };
        delete next[kind];
        return next;
      }, { fold: kind === 'wallpaper' });
    }

    case 'delete': {
      const { kind, name } = kindAndName(rest, 'delete');
      let wasActive = false;
      return changeSlots({ defs, manifests, runner }, (active) => {
        wasActive = activeName(active, kind) === name;
        const next = { ...active };
        if (wasActive) delete next[kind];
        return next;
      }, { commit: () => { deleteContext(kind, name); return wasActive; } });
    }

    // Remove the on-screen wallpaper's delta and keep the slot: the wallpaper
    // is active and untuned. The id names what the caller believes is on
    // screen, so a panel drawn before a rotation cannot clear the wrong one.
    case 'clear': {
      if (rest.length !== 2 || rest[0] !== 'wallpaper') throw usage('clear wallpaper <id>');
      const id = rest[1];
      assertName(id);
      return changeSlots({ defs, manifests, runner }, (active) => {
        requireOnScreen(active, id);
        if (readContextText('wallpaper', id) === null) throw new Error(`wallpaper ${id}: untuned`);
        return active;
      }, {
        commit: () => { deleteContext('wallpaper', id); return true; },
        without: { kind: 'wallpaper', name: id },
      });
    }

    // A profile keeps its identity under a new name: the file moves and, when
    // it is the loaded one, the slot follows. Nothing effective changes, so
    // resolved.json and the sinks are never touched. A wallpaper's name is a
    // hash of its path, so it has nothing to rename.
    case 'rename': {
      if (rest.length !== 3) throw usage('rename <kind> <old> <new>');
      const [kind, from, to] = rest;
      assertKind(kind);
      assertName(from);
      assertName(to);
      if (kind !== 'profile') throw new Error('rename is for profiles; a wallpaper is named by its path');
      await withLock(lockPath(), async () => {
        const active = readActive();
        renameContext(kind, from, to);
        if (active.profile === from) writeActive({ ...active, profile: to });
      });
      return null;
    }

    // The hook's entry point. The same wallpaper again (a second connector, a
    // re-set) changes nothing; a different one folds scratch into the one
    // that leaves and activates the new one in the same locked step.
    case 'wallpaper': {
      if (rest.length !== 1) throw usage('wallpaper <path>');
      const wallpaper = canonicalWallpaperPath(rest[0]);
      const id = wallpaperId(wallpaper);
      return changeSlots({ defs, manifests, runner }, (active) => (
        active.wallpaper?.id === id ? active : { ...active, wallpaper: { id, path: wallpaper } }), { fold: true });
    }

    default:
      throw usage('list|show|rename|activate|deactivate|delete|clear|wallpaper');
  }
}
```

- [ ] **Step 4: Run the context tests to verify they pass**

Run: `node --test test/context-cli.test.js`
Expected: PASS. Then run `node --test test/cli.test.js` and fix any test still naming `save`, `pin`, or `pinned` in a fixture (`writeActive` calls with `pinned:` lose that field).

- [ ] **Step 5: No commit**

Part of commit 2. Continue with Task 7.

---

### Task 7: `prism commit`

**Files:**
- Create: `src/commit.js`
- Modify: `src/cli.js` (dispatch, usage line)
- Test: `test/commit.test.js` (new)

**Interfaces:**
- Consumes: `loadStore`, `DELTA_KINDS`, `LAYER_ORDER`, `readContext`, `writeContext`, `deleteContext`, `writeActive`, `writeValues`, `writeScratch`.
- Produces: `runCommit(args, { defs }) -> 0`; `prism commit base | profile [<name>] | wallpaper <id>`.

- [ ] **Step 1: Write the failing commit tests**

Create `test/commit.test.js`:

```js
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
const integ = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-integ-'));
fs.mkdirSync(path.join(integ, 'fastsink'));
fs.writeFileSync(path.join(integ, 'fastsink', 'manifest.yaml'),
  'sink: fastsink\nbinds:\n  - {param: terminal.background.opacity.inactive, liveness: live}\n');
process.env.PRISM_INTEGRATIONS_DIR = integ;

const cli = await import('../src/cli.js');
const { resolvedPath, valuesPath, defsDir } = await import('../src/paths.js');
const { contextPath, readActive, readContext, writeActive, writeContext } = await import('../src/contexts.js');
const { readScratch, writeScratch } = await import('../src/scratch.js');
const { readValues } = await import('../src/values.js');
const { loadDefs } = await import('../src/defs.js');
const { loadStore } = await import('../src/layers.js');

const defs = loadDefs(defsDir());

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(valuesPath(), '{}\n');
});

async function runCaptured(argv, opts = {}) {
  let stderr = '';
  const code = await cli.run(argv, { runner: () => {}, ...opts, eprint: (text) => { stderr += text; } });
  return { code, stderr };
}

// Every commit keeps the screen: the values before and after are identical,
// resolved.json is untouched, and no sink runs.
async function commitKeepsScreen(argv) {
  await cli.run(['apply'], { runner: () => {} });
  const before = loadStore(defs).params;
  const bus = fs.readFileSync(resolvedPath(), 'utf8');
  const calls = [];
  const result = await runCaptured(argv, { runner: (m) => calls.push(m.sink) });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(loadStore(defs).params, before, `${argv.join(' ')} changed an effective value`);
  assert.equal(fs.readFileSync(resolvedPath(), 'utf8'), bus);
  assert.deepEqual(calls, []);
}

test('commit base folds scratch into values.yaml under the default rule and clears scratch', async () => {
  writeScratch({ 'glass.ior': 1.7, 'glass.paneLip': 6 });
  await commitKeepsScreen(['commit', 'base']);
  assert.deepEqual(readValues(), { 'glass.ior': 1.7 }, 'paneLip 6 equals the def default and is dropped');
  assert.deepEqual(readScratch(), {});
});

test('commit base is refused under a loaded profile, and a merging commit refuses empty scratch', async () => {
  writeContext('profile', 'dusk', { source: null, values: {} });
  writeActive({ profile: 'dusk' });
  writeScratch({ 'glass.ior': 1.7 });
  const refused = await runCaptured(['commit', 'base']);
  assert.match(refused.stderr, /profile dusk is loaded; commit profile, or deactivate it first/);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
  writeActive({});
  writeScratch({});
  for (const argv of [['commit', 'base'], ['commit', 'profile'], ['commit', 'wallpaper', 'abc12345']]) {
    writeActive(argv[1] === 'wallpaper' ? { wallpaper: { id: 'abc12345', path: '/w' } } : {});
    if (argv[1] === 'profile') { writeContext('profile', 'p', { source: null, values: {} }); writeActive({ profile: 'p' }); }
    const empty = await runCaptured(argv);
    assert.match(empty.stderr, /nothing to commit/, argv.join(' '));
  }
});

test('commit profile merges scratch into the loaded profile and strips those keys from the active wallpaper delta', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3, 'glass.paneLip': 9 } });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.35, 'glass.noise': 0.2 } });
  writeActive({ profile: 'dusk', wallpaper: { id: 'w1', path: '/w.png' } });
  writeScratch({ 'glass.ior': 1.7 });
  await commitKeepsScreen(['commit', 'profile']);
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ior': 1.7, 'glass.paneLip': 9 }, 'a merge keeps the rest');
  assert.deepEqual(readContext('wallpaper', 'w1').values, { 'glass.noise': 0.2 }, 'the committed key leaves the delta');
  assert.deepEqual(readScratch(), {});
  assert.equal(loadStore(defs).params['glass.ior'], 1.7);
});

test('a commit to the look deletes a delta it empties', async () => {
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.35 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  writeScratch({ 'glass.ior': 1.7 });
  await commitKeepsScreen(['commit', 'base']);
  assert.equal(readContext('wallpaper', 'w1'), null);
  assert.equal(fs.existsSync(contextPath('wallpaper', 'w1')), false);
});

test('commit profile with none loaded is refused', async () => {
  writeScratch({ 'glass.ior': 1.7 });
  assert.match((await runCaptured(['commit', 'profile'])).stderr, /no profile is loaded; commit profile <name> to save one/);
});

test('save-as snapshots the screen, deltas included, strips only scratch keys from the delta, and loads the new profile', async () => {
  fs.writeFileSync(valuesPath(), 'glass.paneLip: 9\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.35, 'glass.noise': 0.2 } });
  writeActive({ profile: 'dusk', wallpaper: { id: 'w1', path: '/w.png' } });
  writeScratch({ 'glass.ior': 1.7 });
  await commitKeepsScreen(['commit', 'profile', 'noon']);
  const noon = readContext('profile', 'noon').values;
  assert.equal(Object.keys(noon).length, defs.size, 'a full snapshot');
  assert.equal(noon['glass.ior'], 1.7, "scratch's value");
  assert.equal(noon['glass.noise'], 0.2, "the delta's value, because it is what was on screen");
  assert.equal(noon['glass.paneLip'], 9, 'base shows through the sparse profile');
  assert.deepEqual(readContext('wallpaper', 'w1').values, { 'glass.noise': 0.2 }, 'an untouched nudge stays');
  assert.deepEqual(readActive(), { profile: 'noon', wallpaper: { id: 'w1', path: '/w.png' } });
  assert.deepEqual(readScratch(), {});
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ior': 1.3 }, 'the old profile is untouched');
});

test('save-as needs no edit, and saving the loaded profile under its own name is the merging commit', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  writeActive({ profile: 'dusk' });
  await commitKeepsScreen(['commit', 'profile', 'copy']);
  assert.equal(readContext('profile', 'copy').values['glass.ior'], 1.3);
  assert.deepEqual(readActive(), { profile: 'copy' });
  assert.match((await runCaptured(['commit', 'profile', 'copy'])).stderr, /nothing to commit/);
  writeActive({});
  await commitKeepsScreen(['commit', 'profile', 'Default-copy']);
  assert.equal(readContext('profile', 'Default-copy').values['glass.ior'], 1.5, 'naming the Default look: the shipped default, since base is empty');
});

test('neutral then save-as makes a neutral profile even when the wallpaper already quiets a key', async () => {
  writeContext('profile', 'dusk', { source: null, values: { 'glass.roughness': 0.5 } });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.roughness': 0 } });
  writeActive({ profile: 'dusk', wallpaper: { id: 'w1', path: '/w.png' } });
  assert.equal(await cli.run(['reset', 'neutral'], { runner: () => {} }), 0);
  assert.equal('glass.roughness' in readScratch(), false, 'already neutral on screen, so no edit');
  await commitKeepsScreen(['commit', 'profile', 'quiet']);
  assert.equal(readContext('profile', 'quiet').values['glass.roughness'], 0);
});

test('commit wallpaper merges scratch into the on-screen delta and refuses a stale id or no wallpaper', async () => {
  writeScratch({ 'glass.ior': 1.7 });
  assert.match((await runCaptured(['commit', 'wallpaper', 'w1'])).stderr, /no active wallpaper/);
  writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
  assert.match((await runCaptured(['commit', 'wallpaper', 'w2'])).stderr, /wallpaper w2 is not on screen/);
  await commitKeepsScreen(['commit', 'wallpaper', 'w1']);
  assert.deepEqual(readContext('wallpaper', 'w1'), { source: '/w.png', values: { 'glass.ior': 1.7 } }, 'created with _source');
  assert.deepEqual(readScratch(), {});
  writeScratch({ 'glass.noise': 0.3 });
  await commitKeepsScreen(['commit', 'wallpaper', 'w1']);
  assert.deepEqual(readContext('wallpaper', 'w1').values, { 'glass.ior': 1.7, 'glass.noise': 0.3 });
});

test('commit rejects a bad destination, a bad name, and stray arguments', async () => {
  for (const argv of [['commit'], ['commit', 'state'], ['commit', 'base', 'x'], ['commit', 'profile', 'a', 'b'],
    ['commit', 'wallpaper'], ['commit', 'profile', 'a b']]) {
    const failure = await runCaptured(argv);
    assert.notEqual(failure.code, 0, `${argv.join(' ')} unexpectedly succeeded`);
  }
  assert.match((await runCaptured(['commit'])).stderr, /usage: prism commit base \| profile \[<name>\] \| wallpaper <id>/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/commit.test.js`
Expected: FAIL, every test with `usage: prism set|unset|…` on stderr (the verb is unknown).

- [ ] **Step 3: Write `src/commit.js`**

```js
import { isDeepStrictEqual } from 'node:util';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  DELTA_KINDS, LAYER_ORDER, assertName, deleteContext, readContext, writeActive, writeContext,
} from './contexts.js';
import { loadStore } from './layers.js';
import { writeScratch } from './scratch.js';
import { writeValues } from './values.js';

function usage() {
  return new Error('usage: prism commit base | profile [<name>] | wallpaper <id>');
}

// A commit never changes an effective value. After the destination is
// written, every active delta above it loses the committed keys, so the
// value scratch supplied keeps showing once scratch is cleared (design of
// 2026-09-19, Section 2). A delta that empties is deleted.
function stripDeltas({ layers, destination, keys }) {
  const rank = LAYER_ORDER.indexOf(destination); // -1 for base: every delta is above it
  for (const layer of layers) {
    if (!DELTA_KINDS.includes(layer.kind) || LAYER_ORDER.indexOf(layer.kind) <= rank) continue;
    if (!keys.some((key) => Object.hasOwn(layer.values, key))) continue;
    const values = { ...layer.values };
    for (const key of keys) delete values[key];
    if (Object.keys(values).length === 0) {
      deleteContext(layer.kind, layer.name);
    } else {
      writeContext(layer.kind, layer.name, { source: readContext(layer.kind, layer.name).source, values });
    }
  }
}

export async function runCommit(args, { defs }) {
  const [destination, ...rest] = args;
  if (!['base', 'profile', 'wallpaper'].includes(destination)) throw usage();
  await withLock(lockPath(), async () => {
    // loadStore validates the whole store before anything is written.
    const store = loadStore(defs);
    const { active, base, layers, scratch } = store;
    const keys = Object.keys(scratch);
    const requireEdits = () => {
      if (keys.length === 0) throw new Error('nothing to commit');
    };

    if (destination === 'base') {
      if (rest.length !== 0) throw usage();
      if (active.profile !== undefined) {
        throw new Error(`profile ${active.profile} is loaded; commit profile, or deactivate it first`);
      }
      requireEdits();
      const values = { ...base };
      for (const key of keys) {
        if (isDeepStrictEqual(scratch[key], defs.get(key).default)) delete values[key];
        else values[key] = scratch[key];
      }
      // Section 8 order: destination, stripped deltas, cleared scratch.
      writeValues(values);
      stripDeltas({ layers, destination: 'base', keys });
      writeScratch({});
      return;
    }

    if (destination === 'wallpaper') {
      if (rest.length !== 1) throw usage();
      const [id] = rest;
      assertName(id);
      if (active.wallpaper === undefined) throw new Error('no active wallpaper');
      if (active.wallpaper.id !== id) throw new Error(`wallpaper ${id} is not on screen`);
      requireEdits();
      const delta = readContext('wallpaper', id);
      writeContext('wallpaper', id, {
        source: delta === null ? active.wallpaper.path : delta.source,
        values: { ...(delta === null ? {} : delta.values), ...scratch },
      });
      stripDeltas({ layers, destination: 'wallpaper', keys });
      writeScratch({});
      return;
    }

    if (rest.length > 1) throw usage();
    const [name] = rest;
    if (name !== undefined) assertName(name);
    if (name === undefined || name === active.profile) {
      if (active.profile === undefined) throw new Error('no profile is loaded; commit profile <name> to save one');
      requireEdits();
      const profile = readContext('profile', active.profile);
      // A merge, not a snapshot, so an imported sparse profile stays sparse.
      writeContext('profile', active.profile, { source: null, values: { ...profile.values, ...scratch } });
      stripDeltas({ layers, destination: 'profile', keys });
      writeScratch({});
      return;
    }
    // Save-as: what is on screen, deltas included, so what you see is what
    // you save. Then the slot, so a re-run after an interruption still
    // snapshots the unchanged screen; then the strip; then the clear.
    writeContext('profile', name, { source: null, values: store.params });
    writeActive({ ...active, profile: name });
    stripDeltas({ layers, destination: 'profile', keys });
    writeScratch({});
  });
  return 0;
}
```

- [ ] **Step 4: Dispatch it from the CLI**

In `src/cli.js` add `import { runCommit } from './commit.js';` and, before `case 'context':`:

```js
      case 'commit': {
        const { defs } = load();
        // Awaited inside the try, so a refusal becomes the one-line error and
        // exit 1 like every other verb rather than an unhandled rejection.
        return await runCommit(rest, { defs });
      }
```

Change the usage line in `default:` to `usage: prism set|unset|get|list|describe|apply|requirements|doctor|context|reset|commit\n`. Add `'commit'` to the verb list in the `every public verb enforces its required and stray arguments` test in `test/cli.test.js` if it enumerates verbs (check with `grep -n "every public verb" -A 15 test/cli.test.js`).

- [ ] **Step 5: Run the commit tests to verify they pass**

Run: `node --test test/commit.test.js test/cli.test.js`
Expected: PASS.

- [ ] **Step 6: No commit**

Part of commit 2. Continue with Task 9 (Task 8 runs after commit 2 lands).

---

### Task 8: Every multi-file verb survives an interruption after any write

Runs after commit 2 has landed (Task 10), because it exercises the finished verbs.

**Files:**
- Test: `test/write-order.test.js` (new)

**Interfaces:**
- Consumes: the verbs from Tasks 6 and 7. No production change is expected; a failure here is a bug in the write order and is fixed in `src/context-cli.js` or `src/commit.js`.

- [ ] **Step 1: Write the resilience test**

Create `test/write-order.test.js`:

```js
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));
process.env.PRISM_INTEGRATIONS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-integ-'));

const cli = await import('../src/cli.js');
const { valuesPath, defsDir } = await import('../src/paths.js');
const { writeActive, writeContext, wallpaperId } = await import('../src/contexts.js');
const { writeScratch } = await import('../src/scratch.js');
const { loadDefs } = await import('../src/defs.js');
const { loadStore } = await import('../src/layers.js');

const defs = loadDefs(defsDir());

function wallpaperFile(name) {
  const dir = path.join(process.env.PRISM_CONFIG_DIR, 'walls');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, '');
  return file;
}

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(valuesPath(), '{}\n');
});

// Every store write ends in a rename or an unlink. Fail the nth one and the
// verb is interrupted right after its (n-1)th write.
async function interruptedAfter(n, argv) {
  const real = { renameSync: fs.renameSync, rmSync: fs.rmSync, unlinkSync: fs.unlinkSync };
  let count = 0;
  const trip = (name) => (...args) => {
    count += 1;
    if (count === n) throw new Error(`injected failure at write ${n}`);
    return real[name](...args);
  };
  fs.renameSync = trip('renameSync');
  fs.rmSync = trip('rmSync');
  fs.unlinkSync = trip('unlinkSync');
  let stderr = '';
  let code;
  try {
    code = await cli.run(argv, { runner: () => {}, eprint: (text) => { stderr += text; } });
  } finally {
    Object.assign(fs, real);
  }
  return { code, stderr, writes: count };
}

// The verbs under test, each with the store it starts from. `screen` is what
// stays true at every prefix; the slot-changing verbs are allowed to change
// it only once the whole verb has run.
const cases = [
  {
    name: 'the hook with a wallpaper leaving',
    setup: () => {
      const a = wallpaperFile('a.jpg');
      const b = wallpaperFile('b.jpg');
      writeContext('wallpaper', wallpaperId(a), { source: a, values: { 'glass.paneLip': 9 } });
      writeActive({ wallpaper: { id: wallpaperId(a), path: a } });
      writeScratch({ 'glass.ior': 1.7 });
      return ['context', 'wallpaper', b];
    },
    visible: true,
  },
  {
    name: 'commit base',
    setup: () => {
      writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.35, 'glass.noise': 0.2 } });
      writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
      writeScratch({ 'glass.ior': 1.7 });
      return ['commit', 'base'];
    },
  },
  {
    name: 'commit profile',
    setup: () => {
      writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
      writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.ior': 1.35 } });
      writeActive({ profile: 'dusk', wallpaper: { id: 'w1', path: '/w.png' } });
      writeScratch({ 'glass.ior': 1.7 });
      return ['commit', 'profile'];
    },
  },
  {
    name: 'save-as',
    setup: () => {
      writeContext('profile', 'dusk', { source: null, values: { 'glass.roughness': 0.5 } });
      writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.roughness': 0.1 } });
      writeActive({ profile: 'dusk', wallpaper: { id: 'w1', path: '/w.png' } });
      writeScratch({ 'glass.roughness': 0.2 });
      return ['commit', 'profile', 'noon'];
    },
  },
  {
    name: 'commit wallpaper',
    setup: () => {
      writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.noise': 0.2 } });
      writeActive({ wallpaper: { id: 'w1', path: '/w.png' } });
      writeScratch({ 'glass.ior': 1.7 });
      return ['commit', 'wallpaper', 'w1'];
    },
  },
];

for (const { name, setup, visible } of cases) {
  test(`${name}: every prefix keeps the screen, and a re-run completes the verb`, async () => {
    // The uninterrupted run is the reference.
    const argv = setup();
    const before = loadStore(defs).params;
    const clean = await interruptedAfter(Infinity, argv);
    assert.equal(clean.code, 0, clean.stderr);
    const reference = { params: loadStore(defs).params, files: snapshotFiles() };
    for (let n = 1; n <= clean.writes; n += 1) {
      for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(valuesPath(), '{}\n');
      const again = setup();
      const interrupted = await interruptedAfter(n, again);
      assert.equal(interrupted.code, 1, `write ${n} should have failed the verb`);
      assert.match(interrupted.stderr, /injected failure/);
      const after = loadStore(defs).params;
      if (!visible || n < clean.writes) {
        assert.deepEqual(after, before, `${name}: write ${n} changed the screen mid-verb`);
      }
      const rerun = await interruptedAfter(Infinity, again);
      assert.equal(rerun.code, 0, `${name}: re-run after write ${n} failed: ${rerun.stderr}`);
      assert.deepEqual(loadStore(defs).params, reference.params, `${name}: re-run after write ${n} disagrees`);
      assert.deepEqual(snapshotFiles(), reference.files, `${name}: files after re-run ${n} differ`);
    }
  });
}

function snapshotFiles() {
  const out = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (!file.endsWith('resolved.json') && !file.endsWith('store.lock') && !file.endsWith('.tmp')) {
        out[path.relative(os.tmpdir(), file)] = fs.readFileSync(file, 'utf8');
      }
    }
  };
  walk(process.env.PRISM_CONFIG_DIR);
  walk(process.env.PRISM_STATE_DIR);
  return out;
}
```

The `visible` flag marks the one verb whose last write is the visible switch; for it the last prefix is allowed to differ from `before`. `resolved.json` is excluded from the file snapshot because the bus is allowed to lag and `prism apply` recovers it, as the spec says.

- [ ] **Step 2: Run it**

Run: `node --test test/write-order.test.js`
Expected: PASS. If a case fails, the write order in the named verb disagrees with Section 8's table; fix the verb, not the test. The store lock uses `node:fs/promises`, so the sync patches never see it and it is not counted; if `interruptedAfter(Infinity, …)` reports zero writes, the verb never reached its writes and the fixture is wrong.

- [ ] **Step 3: Commit**

```bash
git add test/write-order.test.js
git commit -m "test(store): prove every multi-file verb survives an interruption after any write"
```

---

### Task 9: Panel modules: queue verbs and `held`-based presentation

**Files:**
- Modify: `integrations/noctalia-plugin/queue.luau`
- Modify: `integrations/noctalia-plugin/presentation.luau:219-309`
- Test: `integrations/noctalia-plugin/plugin_test.lua:200-225` (counts), `:885-940` (layer ranks, header, pin transport), `:1180-1220` (profile transport and section); `test/plugin-client.test.js:178-190`

**Interfaces:**
- Produces (Lua): `Queue.argvFor` for `{verb="commit", destination="base"|"profile"|"wallpaper", target=<name or id>}` and `{verb="clear", id=<id>}`; `staleAfter` gains `commit` and `clear`, loses `pin` and `save`. `Presentation.holds(param, layer) -> bool`, `Presentation.editedCount(params)`, `Presentation.wallpaperHeader(model) -> {id, name, tuned} | nil`, `Presentation.profileSection(model)` whose first option is `"Default"`. Removed: `layerRanks`, `isShadowed`, `shadowHint`, `overriddenCount`.

- [ ] **Step 1: Write the failing module tests**

In `plugin_test.lua`:

1. Replace the counting block at lines 208-224 with:

```lua
local counted = {
  { key = "g.lip", value = 9, neutral = 0, held = { "base", "scratch" }, ui = { control = "slider", group = "Glass", order = 1 } },
  { key = "f.split", value = false, neutralize = false, held = { "scratch" }, ui = { control = "toggle", group = "Focus", order = 2, header = true } },
  { key = "f.blur", value = 0.3, neutral = 0, held = { "wallpaper" }, ui = { control = "slider", group = "Focus", order = 3, state = "focused", row = "Blur" } },
  { key = "f.blur.off", value = 0.5, neutral = 0, held = {}, ui = { control = "slider", group = "Focus", order = 4, state = "unfocused", row = "Blur" } },
  { key = "f.sat", value = 1, neutral = 1, held = {}, ui = { control = "slider", group = "Focus", order = 5, state = "focused", row = "Sat" } },
  { key = "f.sat.off", value = 1, neutral = 1, held = {}, ui = { control = "slider", group = "Focus", order = 6, state = "unfocused", row = "Sat" } },
}
for _, param in ipairs(counted) do param.edited = Presentation.holds(param, "scratch") end
equal(#Presentation.pairsOf(counted), 2, "two matrix rows")
equal(Presentation.symmetricCount(counted), 1, "one pair differs")
equal(Presentation.neutralCount(counted), 3, "three eligible keys differ")
equal(Presentation.editedCount(counted), 2, "two keys are in scratch")
equal(Presentation.neutralCount({counted[2]}), 0, "an exempt parameter never counts")
equal(Presentation.holds(counted[3], "wallpaper"), true)
equal(Presentation.holds(counted[3], "scratch"), false)
equal(Queue.argvFor({verb = "reset", mode = "neutral"}), {"prism", "reset", "neutral"})
equal(Queue.argvFor({verb = "reset", mode = "revert", group = "Glass"}), {"prism", "reset", "revert", "--group", "Glass"})
assert(Queue.affectsParams({verb = "reset", mode = "neutral"}), "a reset moves the model")
```

2. Replace the block from `-- describe states the store's resolution order…` (around line 885) through the `pin` transport assertions (line 940) with:

```lua
-- The wallpaper header row: which wallpaper is on screen, and how many
-- visible keys its delta holds. Hidden keys and keys the wallpaper does not
-- hold never count, and a key scratch covers still counts for the wallpaper.
local function layered(held, control)
  return { key = "k" .. #held, held = held, layer = held[#held] or "default", ui = { control = control or "slider" } }
end
local header = Presentation.wallpaperHeader({
  active = { wallpaper = { id = "f8eb0556", path = "/pics/Deep Field.jpg" }, profile = nil },
  params = { layered({ "wallpaper" }), layered({ "base" }), layered({ "wallpaper", "scratch" }, "toggle"), layered({ "wallpaper" }, "none") },
})
equal(header.id, "f8eb0556")
equal(header.name, "Deep Field.jpg", "the header names the wallpaper by basename")
equal(header.tuned, 2, "the CLI-only wallpaper parameter is not a visible nudge")
equal(Presentation.wallpaperHeader({ active = { wallpaper = nil, profile = nil }, params = {} }), nil,
  "no wallpaper is no header")

-- Clear and commit name what they act on, and each moves the model.
equal(Queue.argvFor({ verb = "clear", id = "f8eb0556" }), { "prism", "context", "clear", "wallpaper", "f8eb0556" })
equal(Queue.argvFor({ verb = "commit", destination = "base" }), { "prism", "commit", "base" })
equal(Queue.argvFor({ verb = "commit", destination = "profile" }), { "prism", "commit", "profile" })
equal(Queue.argvFor({ verb = "commit", destination = "profile", target = "noon" }), { "prism", "commit", "profile", "noon" })
equal(Queue.argvFor({ verb = "commit", destination = "wallpaper", target = "f8eb0556" }), { "prism", "commit", "wallpaper", "f8eb0556" })
for _, item in ipairs({ { verb = "clear", id = "x" }, { verb = "commit", destination = "base" } }) do
  assert(Queue.affectsParams(item), item.verb .. " must leave the model stale")
end
for _, verb in ipairs({ "pin", "save" }) do
  local ok = pcall(Queue.argvFor, { verb = verb, name = "x" })
  assert(not ok, verb .. " is no longer a queue verb")
end
```

3. In the profile transport block (around line 1183), delete the `save` line and its entry in the `affectsParams` loop, and change the `profileSection` expectations: the options become `{ "Default", "dawn", "dusk", "noon" }` and `{ "Default", "dawn" }`, with the comment `-- Index 0 is the Default look: the unnamed base values, truthful now that the wallpaper delta shows on top of it exactly as on top of a profile.`

In `test/plugin-client.test.js` `the queue speaks only to prism`, replace the `pin` regex with:

```js
  assert.match(source, /if item\.verb == "clear" then return \{ "prism", "context", "clear", "wallpaper", item\.id \} end/);
  assert.match(source, /if item\.verb == "commit" then/);
```

and the `staleAfter` regex with:

```js
  assert.match(source, /local staleAfter = \{\n  set = true, unset = true, reset = true, commit = true, clear = true,\n  activate = true, deactivate = true, delete = true, rename = true,\n\}/);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: FAIL at `Presentation.holds` being nil.

- [ ] **Step 3: Rewrite the queue module's verb table and `argvFor`**

In `queue.luau`:

```lua
-- Commits and clears write no parameter and the profile verbs write none
-- either, but each moves the resolved values or what the layers hold, so
-- every row's edited state has to be re-read once one lands.
local staleAfter = {
  set = true, unset = true, reset = true, commit = true, clear = true,
  activate = true, deactivate = true, delete = true, rename = true,
}
```

and

```lua
function M.argvFor(item)
  if item.verb == "set" then return { "prism", "set", item.key, tostring(item.value) } end
  if item.verb == "unset" then return { "prism", "unset", item.key } end
  if item.verb == "clear" then return { "prism", "context", "clear", "wallpaper", item.id } end
  if item.verb == "commit" then
    local argv = { "prism", "commit", item.destination }
    if item.target ~= nil then argv[#argv + 1] = item.target end
    return argv
  end
  if item.verb == "deactivate" then return { "prism", "context", "deactivate", "profile" } end
  if item.verb == "rename" then return { "prism", "context", "rename", "profile", item.name, item.newName } end
  if item.verb == "reset" then
    local argv = { "prism", "reset", item.mode }
    if item.group ~= nil then
      argv[#argv + 1] = "--group"
      argv[#argv + 1] = item.group
    end
    return argv
  end
  for _, verb in ipairs({ "activate", "delete" }) do
    if item.verb == verb then return { "prism", "context", verb, "profile", item.name } end
  end
  error("unknown queue verb: " .. item.verb)
end
```

- [ ] **Step 4: Rewrite the presentation helpers**

In `presentation.luau` replace everything from `function M.overriddenCount` through the end of `M.profileSection` (lines 219-309) with:

```lua
-- Which layers hold a key is the store's knowledge, stated per parameter in
-- `held`. The panel derives every count from it rather than from the value.
function M.holds(param, layer)
  for _, name in ipairs(param.held or {}) do
    if name == layer then return true end
  end
  return false
end

function M.editedCount(params)
  local count = 0
  for _, param in ipairs(params) do if param.edited then count = count + 1 end end
  return count
end

-- The active wallpaper as a header row: which one, and how many visible keys
-- its delta holds. The id travels with the row so clear and commit name what
-- they act on and a panel drawn before a rotation is refused, not obeyed.
function M.wallpaperHeader(model)
  local wallpaper = model.active.wallpaper
  if wallpaper == nil then return nil end
  local tuned = 0
  for _, param in ipairs(model.params) do
    if param.ui.control ~= "none" and M.holds(param, "wallpaper") then tuned = tuned + 1 end
  end
  return {
    id = wallpaper.id,
    name = tostring(wallpaper.path):match("([^/]+)$") or tostring(wallpaper.path),
    tuned = tuned,
  }
end

-- The store's rule for a context name, checked here so a bad one never becomes
-- a failed command the user has to read out of an error banner.
function M.validProfileName(name)
  return type(name) == "string" and name:match("^[A-Za-z0-9._%-]+$") ~= nil
end

function M.profileExists(model, name)
  for _, candidate in ipairs(model.profiles) do
    if candidate == name then return true end
  end
  return false
end

-- The selector doubles as the clear control: index 0 is the Default look, the
-- unnamed base values. It is truthful now that the wallpaper delta shows on
-- top of Default exactly as it shows on top of any profile.
function M.profileSection(model)
  local options = { "Default" }
  local selectedIndex = 0
  for index, name in ipairs(model.profiles) do
    options[index + 1] = name
    if name == model.active.profile then selectedIndex = index end
  end
  return { options = options, selectedIndex = selectedIndex, activeName = model.active.profile }
end
```

- [ ] **Step 5: Run the module tests**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: the module assertions above pass and the first failure is a panel-rendering assertion below them, which Task 10 owns. The file runs top to bottom, so read the failing line number: inside the blocks edited here it is a Task 9 failure, past them it is Task 10's.

- [ ] **Step 6: No commit**

Part of commit 2. Continue with Task 10.

---

### Task 10: The panel: validator, edits row, wallpaper header, provenance, commit flows

**Files:**
- Modify: `integrations/noctalia-plugin/panel.luau` (most of the file; the line numbers below are from the pre-change file)
- Test: `integrations/noctalia-plugin/plugin_test.lua` (fixtures and the rendering assertions from line 226 on), `test/plugin-client.test.js:150-158`, `integrations/noctalia-plugin/contract.test.mjs` (harness stub)

**Interfaces:**
- Consumes: Task 9's `Presentation.holds`, `editedCount`, `wallpaperHeader`, `profileSection`, and the queue verbs `commit` and `clear`.
- Produces: `validateModel` requiring `held` per parameter and no `target`; `param.edited` and `param.fromWallpaper` flags; the edits row; the wallpaper header with a clear button; `commitName` issuing `commit profile <name>`.

- [ ] **Step 1: Rewrite the panel test fixtures and rendering assertions**

In `plugin_test.lua`, apply these edits in order:

1. The shared fixture (lines 231-323): `resolutionOrder` becomes `{ "default", "base", "profile", "wallpaper", "state", "scratch" }`; delete `target = "base"` from the model; replace the loop that sets `heldInTarget` and the two lines after it with:

```lua
for _, param in ipairs(model.params) do
  param.held = param.layer == "default" and {} or { param.layer }
  if param.key == "glass.focusSplit" then param.neutralize = false
  elseif param.ui.control == "select" then param.neutral = param.values[1]
  elseif param.ui.control == "toggle" then param.neutral = false
  else param.neutral = 0 end
end
-- Blur is edited over base; gaps is the wallpaper's nudge.
model.params[4].layer, model.params[4].held = "scratch", { "base", "scratch" }
model.params[2].layer, model.params[2].held = "wallpaper", { "wallpaper" }
```

2. The stub `panel` tables in this file (line 337 area and every later `panel = {…}`), in `contract.test.mjs`'s harness, and in `test/plugin-panel-lifecycle.test.js` gain `setWantsSecondTicks = function() end` (Task 11 reads it; adding it now keeps the stubs complete).

3. The reset block (lines 410-437) becomes:

```lua
-- The row reset is revert: present on every row, opacity and tooltip carry
-- the edited state, and it optimistically shows the fallback value.
local resetCandidates = {}
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Revert edit" or button.props.tooltip == "Not edited" then
    resetCandidates[#resetCandidates + 1] = button
  end
end
equal(#resetCandidates, 9, "a reset renders for every visible cell: gaps, three mix pairs, and the extra pair")
local editedResets = {}
for _, button in ipairs(resetCandidates) do
  if button.props.tooltip == "Revert edit" and button.props.opacity == 1.0 then editedResets[#editedResets + 1] = button end
end
equal(#editedResets, 1, "only the edited roughness offers a full-strength reset")
for _, button in ipairs(resetCandidates) do
  if button ~= editedResets[1] then assert(button.props.opacity < 1.0, "an unedited reset stays dim") end
end
local sectionResets = 0
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Revert section (1)" and button.props.opacity == 1.0 then sectionResets = sectionResets + 1 end
end
equal(sectionResets, 1, "the Focus rack counts its one edit")
assert(labels["Extra"], "extra section header missing")
```

4. Replace the block that clicks a reset (around lines 448-461, from `local shadowedCell` through the assertions on `roughnessReset`) with:

```lua
local roughnessReset
for _, button in ipairs(collect(byKey(rendered, "glass.roughness")[1], "button")) do
  if button.props.glyph == "restore" then roughnessReset = button end
end
assert(roughnessReset, "the edited roughness carries a reset")
equal(roughnessReset.props.tooltip, "Revert edit")
equal(roughnessReset.props.opacity, 1.0)
roughnessReset.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "unset", "glass.roughness" }))
equal(model.params[4].value, 0.1, "the reset shows the fallback before describe reconciles")
equal(model.params[4].edited, false)
```

5. Delete the block `-- A wallpaper can shadow only the bypass…` through `model.active = {}` (lines 574-593). In its place:

```lua
-- A bypass the wallpaper nudges is not dimmed and still writes; the card's
-- hint says where the value comes from.
noiseBypass.effectiveDrag, noiseBypass.layer, noiseBypass.held = "release", "wallpaper", { "wallpaper" }
model.active = { wallpaper = { id = "f8eb0556", path = "/pics/Deep Field.jpg" } }
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })
equal(light("noise").props.opacity, 1.0, "nothing is shadowed any more")
local hintLabels = {}
for _, label in ipairs(collect(rendered, "label")) do hintLabels[label.props.text or ""] = true end
assert(hintLabels["wallpaper"], "a collapsed card reports the wallpaper's nudge")
local commandsBeforeNudgedLight = #commands
light("noise").props.onClick()
equal(#commands, commandsBeforeNudgedLight + 1, "a nudged bypass light writes like any other")
noiseBypass.layer, noiseBypass.held = "default", {}
model.active = {}
```

6. In `layeredModel` (line 979 on): delete `pinned = false` and `target = "base"`; replace the loop that sets `heldInTarget` with `param.held = param.layer == "default" and {} or { param.layer }` before the neutral assignments.

7. Replace the header and shadow rendering block from `-- The header row names the wallpaper on screen…` (line 1023) through the bare-tree `pin` assertion (line 1116) with:

```lua
-- The header row: a lit glyph while the wallpaper holds nudges, the count,
-- and a clear that names the wallpaper it acts on.
local tree = renderModel(layeredModel())
local shown = labelSet(tree)
assert(shown["4 for this wallpaper"], "the header row must count the wallpaper's visible keys")
local photo = glyphButton(tree, "photo-filled")
assert(photo, "a tuned wallpaper shows the lit glyph")
equal(photo.props.tooltip, "Deep Field.jpg", "the basename lives in the tooltip")
local clear = glyphButton(tree, "eraser")
assert(clear, "a tuned wallpaper offers a clear button")
equal(clear.props.opacity, 1.0)
equal(clear.props.tooltip, "Clear this wallpaper's 4 nudges")
clear.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "context", "clear", "wallpaper", "f8eb0556" }))
writeCallback({ exitCode = 0, stdout = "" })
assert(commands[#commands]:find("describe", 1, true), "a completed clear re-reads the model")

-- Nothing is dimmed: scratch is topmost, so no write can be covered. A row the
-- wallpaper nudges carries a provenance marker instead.
equal(cellFor(tree, "compositor.gaps").props.opacity, 1.0)
assert(shown["wallpaper"], "a nudged row says where its value comes from")
assert(labelSet(tree)["Overridden by wallpaper; pin to edit"] == nil, "the shadow hint is gone")
for _, toggle in ipairs(collect(tree, "toggle")) do equal(toggle.props.opacity, nil, "no toggle dims") end

-- An untuned wallpaper draws the hollow glyph and an inert clear.
local untunedModel = layeredModel()
for _, param in ipairs(untunedModel.params) do
  if param.layer == "wallpaper" then param.layer, param.held = "default", {} end
end
local untunedTree = renderModel(untunedModel)
assert(glyphButton(untunedTree, "photo"), "an untuned wallpaper shows the hollow glyph")
local inertClear = glyphButton(untunedTree, "eraser")
assert(inertClear.props.opacity < 1.0)
equal(inertClear.props.tooltip, "This wallpaper holds no nudges")
local beforeInert = #commands
inertClear.props.onClick()
equal(#commands, beforeInert, "an inert clear enqueues nothing")

-- Editing a row the wallpaper nudges marks it edited at once.
local gaps = model.params[2]
local slider = nil
for _, node in ipairs(collect(tree, "slider")) do
  if node.props.key == "compositor.gaps:slider" then slider = node end
end
slider.props.onChange(64)
slider.props.onDragEnd()
equal(gaps.edited, true, "the write landed in scratch")

-- With no wallpaper there is no header row.
local bareTree = renderModel(layeredModel({ active = {}, rack = { group = "Focus", devices = {} }, params = {
  { key = "glass.enabled", value = true, default = true, layer = "base", fallback = true, held = { "base" },
    effectiveDrag = "release", ui = { control = "toggle", group = "Title", order = 0, label = "Glass" } },
} }))
equal(glyphButton(bareTree, "eraser"), nil, "no wallpaper means no clear button")
```

and delete the old `-- Editing base beneath a wallpaper…` block (lines 1051-1061) which the above replaces. In the color test that follows, replace `heldInTarget = true` with `held = { "base" }`.

8. In the validator block (lines 1119-1178): delete the `target = "theme"` assertion; replace the `noOwnership` assertion with:

```lua
local noHeld = layeredModel()
noHeld.params[2].held = nil
equal(panelError(noHeld), "compositor.gaps has no held layers")
local badHeld = layeredModel()
badHeld.params[2].held = { "theme" }
equal(panelError(badHeld), "compositor.gaps is held in theme, outside the layer order")
local withTarget = layeredModel({ target = "base" })
equal(panelError(withTarget), nil, "an older field the panel does not read is ignored")
```

and in `missingDataFirst` replace `heldInTarget = nil` with `held = nil` (the expected message stays `compositor.gaps has no default`).

9. In the profile block (line 1245 on): every `selectWithOption(…, "-")` becomes `selectWithOption(…, "Default")`; the options expectation becomes `{ "Default", "dawn", "dusk" }`; delete every `target = "profile"` from `profileModel` overrides.

10. Replace the neutral block (`-- Neutralizing everything with a profile loaded…` through `equal(commands[#commands], Shell.command({ "prism", "reset", "neutral" }))` after `bareNeutral`) with:

```lua
-- Neutral lands in scratch above the profile, so nothing is cleared first.
local neutralTree = renderModel(profileModel({ active = { profile = "dawn" } }))
local wide = buttonsByGlyph(neutralTree, "baseline")[1]
assert(wide.props.tooltip:find("everything", 1, true), "the first baseline button is panel-wide")
local beforeWide = #commands
wide.props.onClick()
equal(#commands, beforeWide + 1, "one command")
equal(commands[#commands], Shell.command({ "prism", "reset", "neutral" }))
equal(selectWithOption(rendered, "Default").props.selectedIndex, 1, "the profile stays loaded")
```

11. Replace the save blocks (`-- Saving names the profile first…` through the `resaveTree` assertions, lines 1312-1425) with:

```lua
-- Save-as is one command: commit profile <name> snapshots the screen and
-- loads the new profile, so the selector shows it at once.
local saveTree = renderModel(profileModel())
equal(#collect(saveTree, "input"), 0, "the name field stays out of the way until asked for")
glyphButton(saveTree, "device-floppy").props.onClick()
local nameField = collect(rendered, "input")[1]
assert(nameField, "the save button opens a name field")
nameField.props.onSubmit("noon")
equal(commands[#commands], Shell.command({ "prism", "commit", "profile", "noon" }))
equal(state_activeProfile(), "noon", "the pick shows at once")
writeCallback({ exitCode = 0, stdout = "" })
assert(commands[#commands]:find("describe", 1, true), "a finished batch still re-reads the model")

-- A command error has to survive the refresh that follows it.
local failTree = renderModel(profileModel())
glyphButton(failTree, "device-floppy").props.onClick()
collect(rendered, "input")[1].props.onSubmit("noon")
writeCallback({ exitCode = 1, stdout = "", stderr = "disk full" })
described({ exitCode = 0, stdout = "{}" })
local banner
for _, label in ipairs(collect(rendered, "label")) do
  if label.props.color == "error" and label.props.visible then banner = label.props.text end
end
equal(banner, "disk full", "a successful describe must not erase why the last command failed")
```

where `state_activeProfile` is a helper added just above: `local function state_activeProfile() return selectWithOption(rendered, "Default").props.options[selectWithOption(rendered, "Default").props.selectedIndex + 1] end`. Keep the existing name-validation, delete, and replace-question blocks, changing the two `save` argv expectations in the replace block to `{ "prism", "commit", "profile", "dawn" }` and deleting the `activate` follow-up assertions. Replace the `resaveTree` block with:

```lua
-- Saving the loaded profile under its own name is the merging commit when
-- there are edits, and closes the field without a command when there are none.
local resaveTree = renderModel(profileModel({ active = { profile = "dusk" } }))
local beforeResave = #commands
glyphButton(resaveTree, "device-floppy").props.onClick()
collect(rendered, "input")[1].props.onSubmit("dusk")
equal(#commands, beforeResave, "nothing edited, nothing to commit")
equal(#collect(rendered, "input"), 0, "the field closes")
local editedModel = profileModel({ active = { profile = "dusk" } })
editedModel.params[3].layer, editedModel.params[3].held = "scratch", { "base", "scratch" }
renderModel(editedModel)
glyphButton(rendered, "device-floppy").props.onClick()
collect(rendered, "input")[1].props.onSubmit("dusk")
equal(commands[#commands], Shell.command({ "prism", "commit", "profile" }), "with edits it is the merging commit")
```

12. Append, before the rename block, the edits row assertions:

```lua
-- The edits row: the count, keep-in-look, keep-for-wallpaper, revert,
-- symmetric, neutral. Every button keeps the reset idiom.
local editsModel = profileModel({ active = { profile = "dusk", wallpaper = { id = "f8eb0556", path = "/pics/a.jpg" } } })
editsModel.params[3].layer, editsModel.params[3].held = "scratch", { "base", "scratch" }
editsModel.params[5].layer, editsModel.params[5].held = "scratch", { "base", "scratch" }
local editsTree = renderModel(editsModel)
assert(labelSet(editsTree)["2 edits"], "the edits row counts scratch")
local keep = glyphButton(editsTree, "bookmark")
equal(keep.props.tooltip, "Keep 2 edits in profile dusk")
equal(keep.props.opacity, 1.0)
keep.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "profile" }))
equal(editsModel.params[3].edited, false, "the edits clear optimistically")
local keepWall = glyphButton(editsTree, "photo-check")
equal(keepWall.props.tooltip, "Keep 2 edits for this wallpaper")
keepWall.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "wallpaper", "f8eb0556" }))
local revert = buttonsByGlyph(editsTree, "restore")[1]
equal(revert.props.tooltip, "Revert 2 edits")
revert.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "reset", "revert" }))

local defaultEdits = profileModel({ active = {} })
defaultEdits.params[3].layer, defaultEdits.params[3].held = "scratch", { "scratch" }
local defaultTree = renderModel(defaultEdits)
equal(glyphButton(defaultTree, "bookmark").props.tooltip, "Keep 1 edit in Default")
glyphButton(defaultTree, "bookmark").props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "base" }))
local noWall = glyphButton(defaultTree, "photo-check")
assert(noWall.props.opacity < 1.0, "no wallpaper on screen, so keep-for-wallpaper is inert")
equal(noWall.props.tooltip, "No wallpaper on screen")
local beforeNoWall = #commands
noWall.props.onClick()
equal(#commands, beforeNoWall)

local cleanTree = renderModel(profileModel({ active = {} }))
assert(labelSet(cleanTree)["No edits"], "an empty scratch says so")
assert(glyphButton(cleanTree, "bookmark").props.opacity < 1.0)
equal(glyphButton(cleanTree, "bookmark").props.tooltip, "Nothing to keep")
```

In `test/plugin-client.test.js` (line 158) replace the `rowHint` regex with `/local function rowHint[\s\S]*text = "Unavailable"[\s\S]*text = "wallpaper"[\s\S]*text = "Live"/`.

- [ ] **Step 2: Run the Lua tests to verify they fail**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: FAIL at the first rendering assertion after the fixture (the validator still demands `target`).

- [ ] **Step 3: Rewrite the validator and the edit marking**

In `panel.luau`:

1. Replace line 37's `shadowedOpacity` with `local dimOpacity = 0.55` and its comment with `-- A control that is unavailable, or a bypassed card, dims without going inert.`
2. In `visibleParamError`, replace the `heldInTarget` line with:

```lua
  if type(param.held) ~= "table" or not denseStringArray(param.held) then return param.key .. " has no held layers" end
```

(`denseStringArray` accepts an empty table, which is what an unheld key reports.) Move `denseStringArray` above `visibleParamError`.

3. In `validateModel`, delete the `model.target` check and the `ranks[model.target]` check, and inside the params loop, after the `ranks[param.layer]` check, add:

```lua
    for _, name in ipairs(param.held or {}) do
      if ranks[name] == nil then
        return tostring(param.key) .. " is held in " .. tostring(name) .. ", outside the layer order"
      end
    end
```

(`Presentation.layerRanks` was removed in Task 9; define the ranks locally: `local ranks = {} for index, name in ipairs(model.layers) do ranks[name] = index end`.)

4. Replace `markLayers` with:

```lua
-- Edited means scratch holds the key. Nothing is ever shadowed: scratch is
-- the topmost layer, so every write shows. A row the wallpaper nudges is
-- marked so the user can see which rows a wallpaper changes.
local function markEdits(model)
  for _, param in ipairs(model.params) do
    local visible = param.ui.control ~= "none"
    param.edited = visible and Presentation.holds(param, "scratch")
    param.fromWallpaper = visible and param.layer == "wallpaper"
  end
end
```

and call `markEdits(model)` where `markLayers(model)` was.

5. `updateParam` sets `param.edited = true`; `unsetParam` sets `param.edited = false`.

- [ ] **Step 4: Rewrite the reset and commit actions**

Replace `resetAction` with:

```lua
local function resetAction(mode, group, params)
  return function()
    for _, param in ipairs(params) do
      if mode == "revert" then
        if param.edited then param.value, param.edited = param.fallback, false end
      elseif mode == "neutral" and param.neutralize ~= false and param.value ~= param.neutral then
        updateParam(param, param.neutral)
      end
    end
    if mode == "symmetric" then
      for _, row in ipairs(Presentation.pairsOf(params)) do
        if row.focused.value ~= row.unfocused.value then updateParam(row.unfocused, row.focused.value) end
      end
    end
    enqueue({verb = "reset", mode = mode, group = group})
    render()
  end
end

-- A commit keeps every value and moves the edits into a persisted layer, so
-- the optimistic change is only that nothing is edited any more.
local function commitAction(item, params)
  return function()
    for _, param in ipairs(params) do param.edited = false end
    -- Save-as loads the new profile in the same command, so the selector
    -- shows it at once: the name joins the list the selector is drawn from
    -- as well as the slot, or profileSection would select Default.
    if item.destination == "profile" and item.target ~= nil then
      if not Presentation.profileExists(state.model, item.target) then
        state.model.profiles[#state.model.profiles + 1] = item.target
        table.sort(state.model.profiles)
      end
      state.model.active.profile = item.target
    end
    enqueue(item)
    render()
  end
end
```

Replace `resetButton`'s opacity and tooltip lines with:

```lua
    opacity = param.edited and 1.0 or inertOpacity,
    tooltip = param.edited and "Revert edit" or "Not edited",
    enabled = available,
    onClick = function() if param.edited then unsetParam(param) end end,
```

Replace `rowHint`'s middle loop with:

```lua
  for _, param in ipairs(params) do
    if param.fromWallpaper then
      return ui.label({text = "wallpaper", fontSize = 11, color = "on_surface_variant"})
    end
  end
```

and its comment with `-- a wallpaper's nudge says where a value comes from, and Live is the mildest of the three`.

- [ ] **Step 5: Remove the dimming**

- `headCell(text, param, indent)`: drop the `dimmed` parameter and set `opacity = 1.0`; update the three callers (`singleRow`, `matrixRow`, and any in cards).
- `controlCell`: `opacity = 1.0`.
- `lightRow`: `opacity = available and 1.0 or dimOpacity`.
- `cardHead`: `opacity = 1.0`.
- `deviceCard`: `opacity = card.bypassed and dimOpacity or 1.0`.
- `sectionHeader`: delete the shadow-hint label and the toggle's `opacity` line.
- `render`'s title row: delete the shadow-hint label and the toggle's `opacity` line.

- [ ] **Step 6: The reset buttons, the edits row, and the header**

Replace `resetModeButtons`'s first button with:

```lua
  local edited = Presentation.editedCount(params)
  local buttons = {resetModeButton({
    glyph = "restore", count = edited,
    active = "Revert " .. scope .. " (" .. edited .. ")",
    inert = "No edits in this " .. scope,
    act = resetAction("revert", group, params),
  })}
```

Replace `allRow` with:

```lua
-- The edits row: what scratch holds, where to keep it, and the three resets
-- over everything. Keep-in-look goes to the loaded profile, else to Default.
local function editsRow(model)
  local params = Presentation.visibleParams(model)
  local edited = Presentation.editedCount(params)
  local plural = edited == 1 and " edit" or " edits"
  local look = model.active.profile ~= nil and ("profile " .. model.active.profile) or "Default"
  local wallpaper = model.active.wallpaper
  local children = {
    ui.label({text = edited > 0 and (edited .. plural) or "No edits", fontSize = 12, color = "on_surface_variant", flexGrow = 1}),
    resetModeButton({
      glyph = "bookmark", count = edited,
      active = "Keep " .. edited .. plural .. " in " .. look,
      inert = "Nothing to keep",
      act = commitAction({verb = "commit", destination = model.active.profile ~= nil and "profile" or "base"}, params),
    }),
    resetModeButton({
      glyph = "photo-check", count = wallpaper ~= nil and edited or 0,
      active = "Keep " .. edited .. plural .. " for this wallpaper",
      inert = wallpaper == nil and "No wallpaper on screen" or "Nothing to keep",
      act = commitAction({verb = "commit", destination = "wallpaper", target = wallpaper and wallpaper.id}, params),
    }),
  }
  for _, button in ipairs(resetModeButtons("everything", nil, params)) do children[#children + 1] = button end
  return ui.row({gap = 8, align = "center"}, children)
end
```

`resetModeButtons("everything", …)` builds the revert button with tooltip `Revert everything (N)`; the tests above expect `Revert N edits` for the panel-wide revert, so in `resetModeButtons` special-case the scope: `active = scope == "everything" and ("Revert " .. edited .. (edited == 1 and " edit" or " edits")) or ("Revert " .. scope .. " (" .. edited .. ")")`.

Replace `wallpaperHeaderRow` with:

```lua
-- The wallpaper on screen: a lit glyph while its delta holds nudges, the
-- count, and a clear that names the wallpaper so a stale panel is refused.
local function wallpaperHeaderRow(header)
  local tuned = header.tuned > 0
  local plural = header.tuned == 1 and " nudge" or " nudges"
  return ui.row({gap = 8, align = "center"}, {
    ui.button({
      glyph = tuned and "photo-filled" or "photo",
      variant = "ghost", controlSize = "sm",
      tooltip = header.name,
      onClick = function() end,
    }),
    ui.label({
      text = header.tuned .. " for this wallpaper",
      fontSize = 12, color = "on_surface_variant", flexGrow = 1,
    }),
    ui.button({
      glyph = "eraser", variant = "ghost", controlSize = "sm",
      opacity = tuned and 1.0 or inertOpacity,
      tooltip = tuned and ("Clear this wallpaper's " .. header.tuned .. plural) or "This wallpaper holds no nudges",
      onClick = function()
        if not tuned then return end
        enqueue({verb = "clear", id = header.id})
        render()
      end,
    }),
  })
end
```

In `render`, replace `children[#children + 1] = allRow(state.model)` with `children[#children + 1] = editsRow(state.model)`.

- [ ] **Step 7: Save-as and replace through `commit`**

In `commitName`, replace the `elseif name ~= active …` / `else enqueue save` branches with:

```lua
  elseif name ~= active and Presentation.profileExists(state.model, name) then
    state.confirm = {kind = "replace", name = name}
  elseif name == active and Presentation.editedCount(Presentation.visibleParams(state.model)) == 0 then
    -- nothing to commit: the field just closes
  else
    commitAction({verb = "commit", destination = "profile", target = name ~= active and name or nil},
      Presentation.visibleParams(state.model))()
  end
```

In `confirmRow`, the replace branch becomes `commitAction({verb = "commit", destination = "profile", target = confirm.name}, Presentation.visibleParams(state.model))()`. In `finishWrite`, delete the `activateAfter` block and its comment. Change the save button's tooltip to `"Save what is on screen as a profile"`.

- [ ] **Step 8: Run every panel test**

Run: `lua integrations/noctalia-plugin/plugin_test.lua && node --test test/plugin-client.test.js test/plugin-panel-lifecycle.test.js integrations/noctalia-plugin/contract.test.mjs`
Expected: PASS. Then `just test` for the whole suite.

- [ ] **Step 9: Commit 2**

Run: `just test`
Expected: PASS, the whole suite.

```bash
git add -A src test integrations
git status --short   # only files this plan names, no stray fixtures
git commit -m "feat: move every edit into the scratch layer with typed commits"
```

---

### Task 11: Follow the rotation: a describe every two seconds while open

**Files:**
- Modify: `integrations/noctalia-plugin/panel.luau` (`onOpen`, `onClose`, new global `update`)
- Test: `integrations/noctalia-plugin/plugin_test.lua` (append), `test/plugin-client.test.js` (`panel lifecycle owns refresh…`)

**Interfaces:**
- Consumes: the host's `panel.setWantsSecondTicks(bool)`, which makes Noctalia call the plugin's global `update()` once per second while the panel is open (`~/software/noctalia/src/shell/panel/plugin_panel.cpp`, `kTickIntervalMs = 1000`, dispatching `update` through `ScriptRuntime::enqueueUpdate`). Verified against the installed tree at `v5.0.1-31-g019f16079` on 2026-09-19.
- Produces: `update()` requesting one refresh every second tick through the existing stale-and-replay path.

- [ ] **Step 1: Write the failing refresh tests**

Append to `plugin_test.lua`:

```lua
-- Following the rotation: the store is the only authority on which wallpaper
-- is active, so the panel re-reads describe every two seconds while open,
-- through the same stale-and-replay path as every other refresh.
local ticksWanted = nil
panel.setWantsSecondTicks = function(value) ticksWanted = value end
renderModel(profileModel())
equal(ticksWanted, true, "opening the panel asks for second ticks")
local beforeTicks = #commands
update()
equal(#commands, beforeTicks, "one tick is not yet a refresh")
update()
equal(#commands, beforeTicks + 1, "the second tick refreshes")
assert(commands[#commands]:find("describe", 1, true))
described({ exitCode = 0, stdout = "{}" })

-- During a drag the tick sets one flag and the refresh replays once the
-- panel is idle, however many ticks passed.
local depthSlider
for _, node in ipairs(collect(rendered, "slider")) do
  if node.props.key == "glass.roughness:slider" then depthSlider = node end
end
depthSlider.props.onChange(0.3)
local beforeDrag = #commands
update() update() update() update()
equal(#commands, beforeDrag, "no describe lands during a drag")
depthSlider.props.onDragEnd()
equal(#commands, beforeDrag + 1, "the release writes")
writeCallback({ exitCode = 0, stdout = "" })
equal(#commands, beforeDrag + 2, "then one refresh, not four")
assert(commands[#commands]:find("describe", 1, true))
described({ exitCode = 0, stdout = "{}" })

onClose()
equal(ticksWanted, false, "closing the panel stops the tick")

-- A describe the tick launched must not land over a write that started after
-- it: a periodic describe now races every optimistic edit, not only drags.
-- The write invalidates the outstanding describe, whose result is dropped and
-- replayed once the queue drains.
local raceTree = renderModel(profileModel({ active = { profile = "dawn" } }))
update() update()
assert(commands[#commands]:find("describe", 1, true), "the tick launched a describe")
local staleDescribe = described
selectWithOption(raceTree, "Default").props.onChange(2)
equal(commands[#commands], Shell.command({ "prism", "context", "activate", "profile", "dusk" }))
model = profileModel({ active = { profile = "dawn" } })
staleDescribe({ exitCode = 0, stdout = "{}" })
equal(selectWithOption(rendered, "Default").props.selectedIndex, 2,
  "an older describe must not overwrite the pick made after it launched")
writeCallback({ exitCode = 0, stdout = "" })
assert(commands[#commands]:find("describe", 1, true), "the invalidated describe is replayed once the write lands")
model = profileModel({ active = { profile = "dusk" } })
described({ exitCode = 0, stdout = "{}" })
equal(selectWithOption(rendered, "Default").props.selectedIndex, 2)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: FAIL, `ticksWanted` is nil.

- [ ] **Step 3: Invalidate an outstanding describe when a write enqueues**

In `panel.luau`, in `enqueue`, add before the `Queue.enqueue` call:

```lua
  -- A describe already in flight would land over this write's optimistic
  -- change. Mark it stale the way beginDrag does; described() then keeps the
  -- current model and finishRefresh replays once the queue drains.
  if describeRunning then state.describeInvalidated = true end
```

`described` already treats `state.describeInvalidated` as "drop this result and set `refreshAfterDrag`", so no further change is needed there.

- [ ] **Step 4: Implement the tick**

In `panel.luau` add `ticks = 0,` to the `state` table and replace `onOpen` and `onClose` with:

```lua
-- Opening the panel is a fresh gesture, like starting a batch: the Luau runtime
-- survives a close, so a sticky command error would otherwise greet the next
-- session behind a model that reconciles perfectly well. The host's second
-- tick drives the periodic refresh that follows a wallpaper rotation.
function onOpen(context)
  state.errorText = nil
  state.errorSticky = false
  state.ticks = 0
  panel.setWantsSecondTicks(true)
  refresh()
end

function onClose()
  state.drag = nil
  state.sampleElapsedMs = 0
  panel.setNeedsFrameTick(false)
  panel.setWantsSecondTicks(false)
end

-- Every second tick asks for a describe. A drag or a busy queue turns it into
-- the one pending flag finishRefresh already replays, so a long drag replays
-- one refresh rather than one per tick.
function update()
  state.ticks = state.ticks + 1
  if state.ticks % 2 ~= 0 then return end
  if state.drag or state.queue.inFlight ~= nil or describeRunning then
    state.refreshPending = true
    return
  end
  refresh()
end
```

- [ ] **Step 5: Run it to verify it passes**

Run: `lua integrations/noctalia-plugin/plugin_test.lua && node --test test/plugin-client.test.js test/plugin-panel-lifecycle.test.js && just test`
Expected: PASS. If `plugin-client.test.js`'s lifecycle test greps `onClose` for exact text, extend its regex to allow the new `setWantsSecondTicks(false)` line.

- [ ] **Step 6: Commit**

```bash
git add integrations/noctalia-plugin/panel.luau integrations/noctalia-plugin/plugin_test.lua test/plugin-client.test.js
git commit -m "feat(panel): re-read the store every two seconds while open"
```

---

### Task 12: Documentation

**Files:**
- Modify: `README.md:46-64` (configuration layout), `README.md:91-108` (reset modes)
- Modify: `docs/notes/noctalia-plugin-contract.md` (queue verbs, the profile row, the wallpaper header, the edits row, shadows, describe shape)
- Modify: `docs/specs/2026-09-05-prism-context-layers-design.md:3-4`, `docs/specs/2026-09-10-reset-modes-design.md:3-4` (status lines)
- Modify: `docs/notes/2026-09-13-profile-editing-brief.md` (closing paragraph)

- [ ] **Step 1: README**

Replace the configuration layout block and the paragraph after it with:

```markdown
~/.config/prism/values.yaml                  # base values, dotfiles-tracked per host
~/.config/prism/contexts/profile/<name>.yaml # named profiles, full snapshots
~/.config/prism/contexts/wallpaper/<id>.yaml # per-wallpaper nudges, `_source` names the wallpaper
~/.local/state/prism/active.json             # which contexts are active (runtime state)
~/.local/state/prism/scratch.yaml            # every edit not yet committed (runtime state)
~/.local/state/prism/resolved.json           # the bus: every parameter's effective value
```

```markdown
Values resolve as defaults, then base, then the loaded profile, then the
active wallpaper's nudges, then scratch. Every `prism set` writes scratch, and
a value the layers beneath already show is not stored. `prism commit` moves the
edits somewhere persistent: `commit base` into the base file, `commit profile`
into the loaded profile, `commit profile <name>` as a new profile snapshotting
what is on screen, `commit wallpaper <id>` into the wallpaper's nudges. A
commit never changes what is on screen. When the wallpaper changes, edits made
while the old one showed fold into its nudges automatically; `prism reset
revert` forgets them instead. `prism set --base` writes the base file directly.
`prism context` manages contexts: `list`, `show`, `rename` (profiles),
`activate`, `deactivate`, `delete`, `clear wallpaper <id>`, and
`wallpaper <path>`, the last being what a Noctalia `wallpaper_changed` hook
calls. Design: `docs/specs/2026-09-19-compositional-profiles-design.md`.
```

In the reset modes section: the usage line becomes `prism reset revert|symmetric|neutral [--base] [--group <name>]`, and the sentence beginning `` `defaults` removes overrides…`` becomes `` `revert` forgets the edits in scope; the value revealed comes from the layers beneath. `` The `--base` paragraph stays.

- [ ] **Step 2: The plugin contract note**

In `docs/notes/noctalia-plugin-contract.md`:

1. The verb sentence in "Panel lifecycle and queue ownership" becomes: `` `set`, `unset`, `reset`, `commit`, and the context verbs `activate`, `deactivate`, `clear`, `rename`, and `delete` are the only verbs; anything else fails loudly rather than reaching another backend. Only `set`, `unset`, and `reset` write parameters, but every verb can move what the layers hold or the resolved values, so each counts as affecting the model and forces a refresh. `` Delete the `activateAfter` sentence. Add after the drag paragraph: `While the panel is open it asks the host for second ticks and re-reads describe every two seconds through the same stale-and-replay path, so a wallpaper rotation reaches the header, the edits row, and every provenance marker within a period; a clear or a commit aimed at a wallpaper that has since left is refused by id and shows in the banner.`
2. In "Declarative presentation", replace the reset-buttons sentence with: `Each section shows revert, neutral, and, where it has matrix rows, symmetric buttons. Revert counts keys scratch holds, symmetric counts differing pairs, and neutral counts eligible keys away from their neutral. The edits row under the wallpaper header carries the edited count, keep-in-look (`prism commit profile` under a loaded profile, else `prism commit base`), keep-for-wallpaper (`prism commit wallpaper <id>`), and the same three resets over every visible parameter. Every reset mode writes scratch; nothing clears the profile first.`
3. Replace the per-parameter reset sentence: `a per-parameter reset that reverts the edit (`prism unset`) and shows the fallback value until describe reconciles.`
4. Replace the shadow bullet with: `Nothing is shadowed: scratch is the topmost layer, so every write shows. A row whose value comes from the wallpaper's nudges carries a faint `wallpaper` marker, after `Unavailable` and before `Live` in the marker precedence.`
5. In the profile-row bullet: index 0 is `Default`, the unnamed base look; save opens the name field and issues `prism commit profile <name>`, which snapshots what is on screen and loads the new profile in one command; saving the loaded profile under its own name is `prism commit profile` when there are edits and closes the field otherwise; the replace question issues the same commit.
6. Replace the wallpaper-header bullet with: `When a wallpaper is active the panel draws a header row above the sections: a glyph lit while the wallpaper's delta holds any visible key, the count (`N for this wallpaper`), and a clear button that runs `prism context clear wallpaper <id>` with the id from the model. The basename is the glyph's tooltip. With no active wallpaper there is no header row.`
7. In the describe paragraph: `target` goes; `held` replaces `heldInTarget` (`the list of layers that hold the key, in resolution order, never default`); `layers` is `default, base, profile, wallpaper, state, scratch`; `fallback` is `what revert would reveal`. The one-sided failure list gains `<key> has no held layers` and loses the `target` message.

- [ ] **Step 3: Status lines and the brief**

Prepend to the `**Status:**` line of `docs/specs/2026-09-05-prism-context-layers-design.md`: `Superseded 2026-09-19 for the resolution order, the write target, the pin, and save by [compositional profiles](2026-09-19-compositional-profiles-design.md); the file layout, the verbs it keeps, and the describe fields it introduced remain as revised there. ` Prepend to the reset-modes spec's status line: `Revised 2026-09-19 by [compositional profiles](2026-09-19-compositional-profiles-design.md): every mode writes scratch and `defaults` is `revert`. ` Append to the brief:

```markdown
## Outcome (2026-09-19)

The [compositional profiles design](../specs/2026-09-19-compositional-profiles-design.md)
answers this brief by changing the store rather than the controls: edits land in a
scratch layer, the edited count is derived from describe's `held`, the panel-wide
neutral no longer clears the profile, save-as is New, and a profile is never emptied
by a reset. Managing an unloaded profile from the panel stays an idea (prism-920f31);
loading one first now costs a compositor reload and no lost work.
```

- [ ] **Step 4: Check and commit**

Run: `just check && just test`
Expected: both pass.

```bash
git add README.md docs/notes/noctalia-plugin-contract.md docs/specs/2026-09-05-prism-context-layers-design.md docs/specs/2026-09-10-reset-modes-design.md docs/notes/2026-09-13-profile-editing-brief.md
git commit -m "docs: describe the scratch layer, commits, and the panel's edits row"
```

---

### Task 13: Desktop acceptance and closeout

**Files:**
- Modify: `docs/specs/2026-09-19-compositional-profiles-design.md:4` (status line)
- Tasks: the Section 12 map, through the `tasks` CLI only

- [ ] **Step 1: Point the running shell at the worktree**

```bash
ls -l ~/.local/share/noctalia/plugins/prism
ln -sfn "$(pwd)/integrations/noctalia-plugin" ~/.local/share/noctalia/plugins/prism
noctalia msg plugins disable khughitt/prism && noctalia msg plugins enable khughitt/prism
sleep 2 && noctalia msg panel-open khughitt/prism:panel
```

Record the original link target so it can be restored after the merge. `~/bin/prism` must also resolve to this worktree's `bin/prism` for the hook and the panel to speak the new verbs; check with `readlink -f ~/bin/prism` and repoint it for the session if it does not.

- [ ] **Step 2: Walk the spec's acceptance list**

Spec Section 9, items 1 to 6. Hover and drag behaviour cannot be automated on this machine (no pointer automation), so the user performs the gestures; `grim -g "<x>,<y> <w>x<h>" out.png` captures the panel for the record. For each item, note the result on the task: `tasks note prism-aec90f "acceptance <n>: <observed>"`.

- [ ] **Step 3: Restore the links, mark the spec, and close the tasks**

Restore `~/.local/share/noctalia/plugins/prism` and `~/bin/prism` to their original targets. Change the spec's status line to `**Status:** implemented on branch prism-aec90f; desktop acceptance <date>; plan docs/plans/2026-09-19-compositional-profiles.md`. The superseded tasks were dropped and the reframed ideas noted when this plan was filed (2026-09-19); what remains is closing the tasks the implementation now satisfies:

```bash
tasks done prism-bf3ae9 "Revert under a loaded profile removes edits and leaves the profile file untouched (compositional profiles, Section 4)"
tasks done prism-ad2b12 "Revert and neutral both remain and both write scratch, so every level is safe (Section 4)"
tasks done prism-b8b589 "The edits row counts scratch keys from describe's held field (Section 7)"
tasks unshelve prism-49a068 && tasks done prism-49a068 "Default names the base look in the selector; reset revert --base returns base to the shipped defaults"
tasks unshelve prism-8a8eac && tasks done prism-8a8eac "Save-as snapshots what is on screen and loads the new profile; it is New"
tasks done prism-b6d7ee "The panel re-reads describe every two seconds on the host's second tick (Section 7)"
tasks check
```

`prism-3415ef` appears under `prime`'s closeout once its children close; confirm and `tasks done prism-3415ef "Editing controls and reset semantics settled by the compositional profiles design"`.

- [ ] **Step 4: Finish the branch**

Run `just gate`. Then merge with the finishing-a-development-branch skill: the merge commit closes `prism-aec90f` with `tasks done prism-aec90f "<one line>"` in the same commit as the merge, and the worktree is unlocked and removed afterwards (`git worktree unlock .worktrees/prism-aec90f && git worktree remove .worktrees/prism-aec90f`).
