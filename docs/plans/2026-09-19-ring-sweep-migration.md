# Ring sweep key and stored-settings migration implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** draft, 2026-09-19; awaiting review before execution.

**Goal:** Replace `glass.ring.driftHz` with `glass.ring.sweepMs` so the niri sink emits the new compositor's `ring-sweep-ms`, and give Prism one explicit, backed-up `prism migrate` that rewrites every stored occurrence of a replaced key, with `doctor` pointing at it.

**Architecture:** A definition may declare `replaces: <old key>`; `loadDefs` validates the declaration and refuses a replacement whose target is still defined. A new `src/migrate.js` turns that declaration into a pure per-store rewrite (`migrateValues`), a whole-store plan over base and every context file, active or not (`planMigration`), and a locked run that copies each touched file byte for byte under the state dir before writing (`runMigration`). `prism migrate` prints the plan's report; `doctor` recognises an orphan key that a definition replaces and names the command. The niri renderer and manifest switch to the new key; the old key never reaches generated config.

**Tech Stack:** Node.js 20+, the existing `yaml` dependency, `node:test` with `node:assert/strict`. No new dependencies.

**Spec:** niri-material `docs/specs/2026-09-18-ring-focus-motion-design.md`, §5 (Prism contract and rollout) and §7 (the Prism tests). The task body of `prism-eff23a` restates it. The compositor side is merged on niri-material `materials-26.04` (`597aba66`) and pinned for packaging (`24a3a5d7`).

**Task:** `prism-eff23a` (started in `.worktrees/prism-eff23a`). Depends on niri-material `material-7fd09c` (done).

## Global constraints

- Key names, verbatim: the definition is `glass.ring.sweepMs`, type `int`, `range: [0, 10000]`, `default: 1500`, `neutral: 1500`, `replaces: glass.ring.driftHz`. It takes the retired key's slot: `ui.group: Ring`, `ui.order: 530`.
- The niri sink emits `ring-sweep-ms <n>` in every `response "default"` block it writes and never emits `ring-drift-hz`. There is no version that accepts or emits both keys, by decision (spec §5, rollback paragraph); do not add a compatibility path.
- Conversion rule, verbatim from spec §5: `driftHz 0` becomes `sweepMs 0`; any positive rate becomes `1500` (the new default); a file that already holds `sweepMs` keeps that value, loses `driftHz`, and the report says so.
- `prism migrate` walks base and **every** context file, active or not. Before rewriting anything it copies every file it will touch into a timestamped directory under Prism's state dir, keeping each file's path relative to the config dir. It reports each file, key, and the backup location. A second run changes nothing and creates no backup.
- A context file that does not parse aborts the migration before any write, with the same message `doctor` prints for it.
- `doctor` reports a pending migration (an orphan key some definition `replaces`) and names `prism migrate`; it still exits 1.
- `idle-after-ms` is native config, not a Prism control. `ring-inset`/`ring-width` stay in `prism-d8ee06`; `light-ior` in `prism-0ea68f`. Oscillator periods and impulse constants stay unexposed.
- The repository's rules: every task mutation through the `tasks` CLI, `tasks check` before each commit (the pre-commit hook runs `just check`), conventional commits, no attribution trailers. `just test` before each commit; `node --test test/<file>` is the inner loop for one file.
- Paths shown to the user are written relative to the Prism main checkout: `.worktrees/prism-eff23a/…`.

## File structure

| File | Responsibility |
| --- | --- |
| `defs/glass.yaml` | The one definition change: `glass.ring.sweepMs` replaces `glass.ring.driftHz` in the Ring group. |
| `src/defs.js` | Validates `replaces` on a def and, after all files load, that no def replaces a still-defined key and no key is replaced twice. |
| `src/migrate.js` (new) | `replacements(defs)`, `convertValue`, `migrateValues` (pure), `planMigration` (reads the store), `backupDir`, `runMigration` (copies, then writes; caller holds the lock). |
| `src/cli.js` | The `migrate` verb; `doctor`'s pending-migration line in both the base and context orphan loops; usage string. |
| `integrations/niri/render.js`, `integrations/niri/manifest.yaml` | Emit and bind `glass.ring.sweepMs` as `ring-sweep-ms`. |
| `resources/profiles/Aurora.yaml`, `resources/profiles/Rainbow.yaml` | Starter snapshots carry `glass.ring.sweepMs: 1500`; repository resources are edited, not migrated. |
| `test/defs.test.js`, `test/glass-defs.test.js`, `test/plugin-presentation.test.js`, `test/niri-render.test.js`, `test/niri-apply.test.js` | Existing suites follow the key. |
| `test/migrate.test.js` (new), `test/cli.test.js` | The migration's unit tests; the verb and the doctor hint end to end. |
| `README.md` | The migration and its backup directory in the configuration layout. |

---

### Task 1: The definition, its validation, and the niri emission

The definition and the sink change together: a renderer reading a key that no longer exists emits `ring-drift-hz undefined`, so neither half is green alone.

**Files:**
- Modify: `defs/glass.yaml:392-398`
- Modify: `src/defs.js` (`loadDefs` after the file loop; `validateDef`)
- Modify: `integrations/niri/render.js:36`, `integrations/niri/manifest.yaml:65`
- Modify: `resources/profiles/Aurora.yaml:62`, `resources/profiles/Rainbow.yaml:62`
- Test: `test/defs.test.js`, `test/glass-defs.test.js:49,402,415,451`, `test/plugin-presentation.test.js:60`, `test/niri-render.test.js:69,110,142,200,523,568-572`, `test/niri-apply.test.js:47`

**Interfaces:**
- Produces: a def may carry `replaces: <key>` (string matching the key grammar `^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$`). `loadDefs` throws `X replaces Y, which is still defined` and `Y is replaced by both A and B`. Task 2 reads `def.replaces` and nothing else.

- [ ] **Step 1: Write the failing defs tests**

Append to `test/defs.test.js`:

```js
test('the ring sweep replaces the ring drift rate', () => {
  const defs = loadDefs(defsDir());
  const sweep = defs.get('glass.ring.sweepMs');
  assert.deepEqual([sweep.type, sweep.range, sweep.default, sweep.neutral], ['int', [0, 10000], 1500, 1500]);
  assert.equal(sweep.replaces, 'glass.ring.driftHz');
  assert.deepEqual([sweep.ui.group, sweep.ui.order, sweep.ui.unit], ['Ring', 530, 'ms']);
  assert.equal(defs.has('glass.ring.driftHz'), false);
});

test('replaces must name a key', () => {
  const dir = dirWith('- {key: a.b, type: int, range: [0, 1], default: 0, neutral: 0, replaces: 7, ui: {group: g, control: slider, step: 1, label: B, order: 1}, description: d}\n');
  assert.throws(() => loadDefs(dir), /replaces must name a key/);
  const self = dirWith('- {key: a.b, type: int, range: [0, 1], default: 0, neutral: 0, replaces: a.b, ui: {group: g, control: slider, step: 1, label: B, order: 1}, description: d}\n');
  assert.throws(() => loadDefs(self), /cannot replace itself/);
});

test('a def cannot replace a key that is still defined, and a key is replaced at most once', () => {
  const live = dirWith(
    '- {key: a.old, type: int, range: [0, 1], default: 0, neutral: 0, ui: {group: g, control: slider, step: 1, label: O, order: 1}, description: d}\n'
    + '- {key: a.new, type: int, range: [0, 1], default: 0, neutral: 0, replaces: a.old, ui: {group: g, control: slider, step: 1, label: N, order: 2}, description: d}\n');
  assert.throws(() => loadDefs(live), /a\.new replaces a\.old, which is still defined/);
  const twice = dirWith(
    '- {key: a.one, type: int, range: [0, 1], default: 0, neutral: 0, replaces: a.old, ui: {group: g, control: slider, step: 1, label: O, order: 1}, description: d}\n'
    + '- {key: a.two, type: int, range: [0, 1], default: 0, neutral: 0, replaces: a.old, ui: {group: g, control: slider, step: 1, label: N, order: 2}, description: d}\n');
  assert.throws(() => loadDefs(twice), /a\.old is replaced by both a\.one and a\.two/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/defs.test.js`
Expected: the three new tests FAIL (`sweep` is undefined; the invalid dirs load without throwing).

- [ ] **Step 3: Replace the definition**

In `defs/glass.yaml` replace the `glass.ring.driftHz` entry (lines 392–398) with:

```yaml
- key: glass.ring.sweepMs
  type: int
  range: [0, 10000]
  default: 1500
  neutral: 1500
  replaces: glass.ring.driftHz
  ui: {group: Ring, control: slider, step: 100, label: Sweep, order: 530, unit: ms}
  description: How long the ring light takes for its one lap when a window gains focus, easing out to rest; 0 skips the lap, as do reduced motion and animations off
```

- [ ] **Step 4: Validate `replaces` in `src/defs.js`**

In `validateDef`, after the `bad key` check, add:

```js
  if (Object.hasOwn(def, 'replaces')) {
    if (typeof def.replaces !== 'string' || !KEY_RE.test(def.replaces)) fail('replaces must name a key');
    if (def.replaces === def.key) fail('a def cannot replace itself');
  }
```

and lift the key pattern into a module constant used by both checks:

```js
const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;
```

(replace the inline regex in the `bad key` line with `KEY_RE.test(def.key)`).

In `loadDefs`, after the `for (const f of files)` loop and before `return defs;`:

```js
  // A replacement is a rename across a release: the old key must be gone
  // from the definitions, or the store could hold both with a straight face.
  const replacedBy = new Map();
  for (const def of defs.values()) {
    if (def.replaces === undefined) continue;
    if (defs.has(def.replaces)) {
      throw new Error(`${def.key} replaces ${def.replaces}, which is still defined`);
    }
    if (replacedBy.has(def.replaces)) {
      throw new Error(`${def.replaces} is replaced by both ${replacedBy.get(def.replaces)} and ${def.key}`);
    }
    replacedBy.set(def.replaces, def.key);
  }
```

- [ ] **Step 5: Switch the sink**

`integrations/niri/render.js:36` becomes:

```js
    `        ring-sweep-ms ${params['glass.ring.sweepMs']}`,
```

`integrations/niri/manifest.yaml:65` becomes:

```yaml
  - {param: glass.ring.sweepMs, liveness: reload}
```

Both starter profiles: replace `glass.ring.driftHz: 15` with `glass.ring.sweepMs: 1500`.

- [ ] **Step 6: Follow the key through the existing suites**

`test/glass-defs.test.js`:
- line 49: `'glass.ring.sweepMs': { range: [0, 10000], default: 1500 },`
- line 402: `'glass.ring.focus', 'glass.ring.colorSource', 'glass.ring.color', 'glass.ring.sweepMs',`
- line 415: `'glass.ring.sweepMs': 'Ring',`
- line 451: `'glass.ring.color': '#ccccff', 'glass.ring.sweepMs': 1500,`

`test/plugin-presentation.test.js:60`: `'glass.ring.sweepMs',`

`test/niri-apply.test.js:47`: `'glass.ring.sweepMs': 1200,`

`test/niri-render.test.js`:
- line 69: `'glass.ring.sweepMs': 1200,`
- lines 110, 142, 200: `        ring-sweep-ms 1200`
- line 523: `+ '        ring-color "#f2c14e"\n        ring-sweep-ms 1200\n    }';`
- replace the test at lines 568–572 with:

```js
test('a zero sweep skips the lap, and the retired drift key never reaches the config', () => {
  const kdl = renderNiriFragment(with_({ 'glass.ring.sweepMs': 0 }));

  assert.equal(count(kdl, 'ring-sweep-ms 0'), 2);
  assert.equal(count(kdl, 'ring-drift-hz'), 0);
  assert.equal(count(renderNiriFragment(resolved), 'ring-drift-hz'), 0);
});
```

- [ ] **Step 7: Run the suite**

Run: `just test`
Expected: every file passes; `grep -rn driftHz src integrations defs resources test` returns only `test/defs.test.js` (the replacement tests) and `test/glass-defs.test.js`/`test/niri-render.test.js` only if a comment mentions it — there should be no live reference.

- [ ] **Step 8: Commit**

```bash
tasks check
git add defs/glass.yaml src/defs.js integrations/niri/render.js integrations/niri/manifest.yaml \
  resources/profiles/Aurora.yaml resources/profiles/Rainbow.yaml test/defs.test.js \
  test/glass-defs.test.js test/plugin-presentation.test.js test/niri-render.test.js \
  test/niri-apply.test.js tasks/prism-eff23a.md
git commit -m "feat(defs): glass.ring.sweepMs replaces driftHz; the niri sink emits ring-sweep-ms"
```

---

### Task 2: The migration as pure functions over one store

**Files:**
- Create: `src/migrate.js`
- Test: `test/migrate.test.js` (new)

**Interfaces:**
- Consumes: `def.replaces` from Task 1; `readValues`/`writeValues` (`src/values.js`), `VERB_KINDS`, `listContexts`, `readContext`, `writeContext`, `contextPath` (`src/contexts.js`), `configDir`, `stateDir`, `valuesPath` (`src/paths.js`).
- Produces, for Task 3:
  - `replacements(defs): Map<oldKey, def>`
  - `convertValue(value, def): value`
  - `migrateValues(values, defs): { values, changes: [{ from, to, old, value, kept }] }`
  - `planMigration(defs): [{ where, kind, name, path, source, values, changes }]` — `where` is `base`, `profile <name>` or `wallpaper <id>`; `kind` is `'base'|'profile'|'wallpaper'`; only files with changes appear; throws on a malformed context.
  - `backupDir(now: Date): string` — `<stateDir>/migrations/<YYYYMMDDTHHMMSSZ>`
  - `runMigration(defs, { now }): { files, backup }` — `backup` is `null` when nothing changed. Caller holds the store lock.

- [ ] **Step 1: Write the failing unit tests**

Create `test/migrate.test.js`:

```js
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-mig-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-mig-state-'));

const { loadDefs } = await import('../src/defs.js');
const { defsDir, valuesPath } = await import('../src/paths.js');
const { readValues, writeValues } = await import('../src/values.js');
const { writeContext, readContext, contextPath } = await import('../src/contexts.js');
const { replacements, convertValue, migrateValues, planMigration, backupDir, runMigration } =
  await import('../src/migrate.js');

const defs = loadDefs(defsDir());
const sweep = defs.get('glass.ring.sweepMs');

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
});

test('the shipped definitions declare exactly one replacement', () => {
  const map = replacements(defs);
  assert.deepEqual([...map.keys()], ['glass.ring.driftHz']);
  assert.equal(map.get('glass.ring.driftHz').key, 'glass.ring.sweepMs');
});

test('zero carries over; any other value takes the new default', () => {
  assert.equal(convertValue(0, sweep), 0);
  assert.equal(convertValue(25, sweep), 1500);
  assert.equal(convertValue(1, sweep), 1500);
  // a replacing def whose range excludes zero cannot keep it
  assert.equal(convertValue(0, { ...sweep, range: [1, 10] }), 1500);
});

test('migrateValues rewrites one flat store and reports each change', () => {
  const converted = migrateValues({ 'glass.ior': 1.3, 'glass.ring.driftHz': 25 }, defs);
  assert.deepEqual(converted.values, { 'glass.ior': 1.3, 'glass.ring.sweepMs': 1500 });
  assert.deepEqual(converted.changes,
    [{ from: 'glass.ring.driftHz', to: 'glass.ring.sweepMs', old: 25, value: 1500, kept: false }]);

  const zero = migrateValues({ 'glass.ring.driftHz': 0 }, defs);
  assert.deepEqual(zero.values, { 'glass.ring.sweepMs': 0 });

  const collision = migrateValues({ 'glass.ring.driftHz': 12, 'glass.ring.sweepMs': 800 }, defs);
  assert.deepEqual(collision.values, { 'glass.ring.sweepMs': 800 });
  assert.deepEqual(collision.changes,
    [{ from: 'glass.ring.driftHz', to: 'glass.ring.sweepMs', old: 12, value: 800, kept: true }]);

  const untouched = { 'glass.ior': 1.3 };
  const same = migrateValues(untouched, defs);
  assert.deepEqual(same, { values: { 'glass.ior': 1.3 }, changes: [] });
  assert.notEqual(same.values, untouched, 'a copy, never the input');
});

test('planMigration covers base and every context, active or not, and skips clean files', () => {
  writeValues({ 'glass.ring.driftHz': 25 });
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.driftHz': 0 } });
  writeContext('profile', 'plain', { source: null, values: { 'glass.ior': 1.4 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.driftHz': 12, 'glass.ring.sweepMs': 800 } });
  // no active.json at all: activity plays no part

  const plan = planMigration(defs);
  assert.deepEqual(plan.map((file) => file.where), ['base', 'profile dusk', 'wallpaper abc12345']);
  assert.deepEqual(plan.map((file) => file.path),
    [valuesPath(), contextPath('profile', 'dusk'), contextPath('wallpaper', 'abc12345')]);
  assert.equal(plan[2].source, '/w');
  assert.deepEqual(plan[2].values, { 'glass.ring.sweepMs': 800 });
});

test('planMigration aborts on a context that does not parse', () => {
  writeValues({ 'glass.ring.driftHz': 25 });
  fs.mkdirSync(path.dirname(contextPath('profile', 'bad')), { recursive: true });
  fs.writeFileSync(contextPath('profile', 'bad'), '- not\n- flat\n');
  assert.throws(() => planMigration(defs), /profile bad: context must be a flat object/);
});

test('backupDir is a compact UTC timestamp under the state dir', () => {
  assert.equal(backupDir(new Date('2026-09-19T22:41:07.123Z')),
    path.join(process.env.PRISM_STATE_DIR, 'migrations', '20260919T224107Z'));
});

test('runMigration copies every touched file byte for byte, then rewrites, and is a no-op the second time', () => {
  fs.writeFileSync(valuesPath(), 'glass.ring.driftHz: 25   # hand-written spacing survives in the backup\nglass.ior: 1.3\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.driftHz': 0 } });
  writeContext('profile', 'plain', { source: null, values: { 'glass.ior': 1.4 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.driftHz': 12, 'glass.ring.sweepMs': 800 } });
  const originals = {
    base: fs.readFileSync(valuesPath()),
    dusk: fs.readFileSync(contextPath('profile', 'dusk')),
    wall: fs.readFileSync(contextPath('wallpaper', 'abc12345')),
    plain: fs.readFileSync(contextPath('profile', 'plain')),
  };

  const now = new Date('2026-09-19T22:41:07Z');
  const { files, backup } = runMigration(defs, { now });
  assert.equal(backup, backupDir(now));
  assert.equal(files.length, 3);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'values.yaml')), originals.base);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'contexts', 'profile', 'dusk.yaml')), originals.dusk);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'contexts', 'wallpaper', 'abc12345.yaml')), originals.wall);
  assert.equal(fs.existsSync(path.join(backup, 'contexts', 'profile', 'plain.yaml')), false);

  assert.deepEqual(readValues(), { 'glass.ring.sweepMs': 1500, 'glass.ior': 1.3 });
  assert.deepEqual(readContext('profile', 'dusk').values, { 'glass.ring.sweepMs': 0 });
  assert.deepEqual(readContext('wallpaper', 'abc12345'), { source: '/w', values: { 'glass.ring.sweepMs': 800 } });
  assert.deepEqual(fs.readFileSync(contextPath('profile', 'plain')), originals.plain);

  const after = [valuesPath(), contextPath('profile', 'dusk'), contextPath('wallpaper', 'abc12345')]
    .map((file) => fs.readFileSync(file));
  const second = runMigration(defs, { now: new Date('2026-09-19T22:42:00Z') });
  assert.deepEqual(second, { files: [], backup: null });
  assert.deepEqual([valuesPath(), contextPath('profile', 'dusk'), contextPath('wallpaper', 'abc12345')]
    .map((file) => fs.readFileSync(file)), after);
  assert.deepEqual(fs.readdirSync(path.join(process.env.PRISM_STATE_DIR, 'migrations')), ['20260919T224107Z']);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/migrate.test.js`
Expected: FAIL at the import — `Cannot find module '../src/migrate.js'`.

- [ ] **Step 3: Write `src/migrate.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { configDir, stateDir, valuesPath } from './paths.js';
import { readValues, writeValues } from './values.js';
import { VERB_KINDS, contextPath, listContexts, readContext, writeContext } from './contexts.js';

// Replaced key -> the definition that replaces it. `loadDefs` has already
// refused a replacement whose target is still defined or is claimed twice.
export function replacements(defs) {
  const map = new Map();
  for (const def of defs.values()) {
    if (def.replaces !== undefined) map.set(def.replaces, def);
  }
  return map;
}

// The value the replacing key takes for a stored value of the replaced one.
// Zero means "off" on both sides of a motion control (a ring that never
// moves), so it carries over when the new range admits it; any other value
// has no equivalent under a different unit and takes the new default.
export function convertValue(value, def) {
  const admitsZero = def.range !== undefined && def.range[0] <= 0 && def.range[1] >= 0;
  return value === 0 && admitsZero ? 0 : def.default;
}

// One flat store (base or a context): a rewritten copy and each change made.
// A file already holding the replacing key keeps that value and loses the old
// one; the change says so with `kept: true`.
export function migrateValues(values, defs) {
  const out = { ...values };
  const changes = [];
  for (const [from, def] of replacements(defs)) {
    if (!Object.hasOwn(out, from)) continue;
    const old = out[from];
    delete out[from];
    const kept = Object.hasOwn(out, def.key);
    if (!kept) out[def.key] = convertValue(old, def);
    changes.push({ from, to: def.key, old, value: out[def.key], kept });
  }
  return { values: out, changes };
}

// Every store file, active or not: base, then each context in listing order.
// Only files with a change are returned. A context that does not parse throws
// here, before anything is written, with the message `doctor` prints for it.
export function planMigration(defs) {
  const files = [];
  const base = migrateValues(readValues(), defs);
  if (base.changes.length > 0) {
    files.push({ where: 'base', kind: 'base', name: null, path: valuesPath(), source: null, ...base });
  }
  const all = listContexts();
  for (const kind of VERB_KINDS) {
    for (const name of all[kind]) {
      const context = readContext(kind, name);
      const migrated = migrateValues(context.values, defs);
      if (migrated.changes.length === 0) continue;
      files.push({
        where: `${kind} ${name}`, kind, name, path: contextPath(kind, name), source: context.source, ...migrated,
      });
    }
  }
  return files;
}

export function backupDir(now) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return path.join(stateDir(), 'migrations', stamp);
}

// Copies every file the plan touches, byte for byte and at its path relative
// to the config dir, then rewrites them through the same writers `set` uses.
// The caller holds the store lock. Nothing to change means nothing written,
// no backup made.
export function runMigration(defs, { now = new Date() } = {}) {
  const files = planMigration(defs);
  if (files.length === 0) return { files, backup: null };
  const backup = backupDir(now);
  for (const file of files) {
    const copy = path.join(backup, path.relative(configDir(), file.path));
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(file.path, copy);
  }
  for (const file of files) {
    if (file.kind === 'base') writeValues(file.values);
    else writeContext(file.kind, file.name, { source: file.source, values: file.values });
  }
  return { files, backup };
}
```

- [ ] **Step 4: Run the unit tests**

Run: `node --test test/migrate.test.js`
Expected: 7 tests PASS.

- [ ] **Step 5: Run the suite and commit**

Run: `just test` — all pass.

```bash
tasks check
git add src/migrate.js test/migrate.test.js
git commit -m "feat(migrate): rewrite replaced keys across base and every context, with a byte-for-byte backup"
```

---

### Task 3: `prism migrate` and the doctor hint

**Files:**
- Modify: `src/cli.js` (imports; new `case 'migrate'` before `case 'context'`; `doctor`'s two orphan loops; the usage string in `default`)
- Test: `test/cli.test.js`

**Interfaces:**
- Consumes: `runMigration`, `replacements` from Task 2.
- Produces: the verb's output lines, verbatim:
  - `migrate: nothing to migrate` (exit 0, no backup)
  - `migrate: backup <dir>`
  - `migrate: <where>: <from> <old> -> <to> <value>`
  - `migrate: <where>: <from> <old> removed; <to> <value> kept`
  - `migrate: done — run 'prism apply' to hand the new keys to the sinks`
  - doctor: `doctor: pending migration: <from> in <where> is replaced by <to> — run 'prism migrate'`

- [ ] **Step 1: Write the failing CLI tests**

Append to `test/cli.test.js`:

```js
test('migrate rewrites the replaced ring key everywhere, backs the files up, reports, and is idempotent', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ring.driftHz: 25\nglass.ior: 1.3\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.driftHz': 0 } });
  writeContext('profile', 'plain', { source: null, values: { 'glass.ior': 1.4 } });
  writeContext('wallpaper', 'abc12345', { source: '/w', values: { 'glass.ring.driftHz': 12, 'glass.ring.sweepMs': 800 } });
  const base = fs.readFileSync(valuesPath());

  let out = '';
  assert.equal(await cli.run(['migrate'], { print: (s) => { out += s; } }), 0);
  const backup = out.match(/^migrate: backup (.+)$/m)[1];
  assert.ok(backup.startsWith(path.join(process.env.PRISM_STATE_DIR, 'migrations', '')), backup);
  assert.match(out, /^migrate: base: glass\.ring\.driftHz 25 -> glass\.ring\.sweepMs 1500$/m);
  assert.match(out, /^migrate: profile dusk: glass\.ring\.driftHz 0 -> glass\.ring\.sweepMs 0$/m);
  assert.match(out, /^migrate: wallpaper abc12345: glass\.ring\.driftHz 12 removed; glass\.ring\.sweepMs 800 kept$/m);
  assert.match(out, /^migrate: done — run 'prism apply' to hand the new keys to the sinks$/m);
  assert.doesNotMatch(out, /plain/);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'values.yaml')), base);
  assert.deepEqual(readValues(), { 'glass.ring.sweepMs': 1500, 'glass.ior': 1.3 });
  assert.deepEqual(readContext('wallpaper', 'abc12345').values, { 'glass.ring.sweepMs': 800 });

  out = '';
  assert.equal(await cli.run(['migrate'], { print: (s) => { out += s; } }), 0);
  assert.equal(out, 'migrate: nothing to migrate\n');
  assert.equal(fs.readdirSync(path.join(process.env.PRISM_STATE_DIR, 'migrations')).length, 1);
});

test('migrate takes no arguments and aborts whole on a context that does not parse', async () => {
  const usage = await runCaptured(['migrate', 'now']);
  assert.equal(usage.code, 1);
  assert.match(usage.stderr, /usage: prism migrate/);

  fs.writeFileSync(valuesPath(), 'glass.ring.driftHz: 25\n');
  fs.mkdirSync(path.dirname(contextPath('profile', 'bad')), { recursive: true });
  fs.writeFileSync(contextPath('profile', 'bad'), '- not\n- flat\n');
  const failure = await runCaptured(['migrate'], { print: () => {} });
  assert.equal(failure.code, 1);
  assert.match(failure.stderr, /profile bad: context must be a flat object/);
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), 'glass.ring.driftHz: 25\n', 'base untouched');
  assert.equal(fs.existsSync(path.join(process.env.PRISM_STATE_DIR, 'migrations')), false, 'no backup made');
});

test('doctor names a pending migration in base and in a context, and is quiet once it has run', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ring.driftHz: 25\n');
  writeContext('profile', 'dusk', { source: null, values: { 'glass.ring.driftHz': 0 } });
  let out = '';
  assert.equal(await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } }), 1);
  assert.match(out, /^doctor: pending migration: glass\.ring\.driftHz in base is replaced by glass\.ring\.sweepMs — run 'prism migrate'$/m);
  assert.match(out, /^doctor: pending migration: glass\.ring\.driftHz in profile dusk is replaced by glass\.ring\.sweepMs — run 'prism migrate'$/m);
  assert.doesNotMatch(out, /orphan value glass\.ring\.driftHz/);

  assert.equal(await cli.run(['migrate'], { print: () => {} }), 0);
  assert.equal(await cli.run(['apply'], { runner: () => {} }), 0);
  out = '';
  await cli.run(['doctor'], { runner: () => {}, print: (s) => { out += s; } });
  assert.doesNotMatch(out, /pending migration/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/cli.test.js`
Expected: the three new tests FAIL (`migrate` falls to the usage default and exits 2; doctor prints the orphan line).

- [ ] **Step 3: Add the verb**

In `src/cli.js` add the import:

```js
import { replacements, runMigration } from './migrate.js';
```

Insert before `case 'context':`:

```js
      // One explicit step across a rename release: every stored occurrence of
      // a replaced key, in base and every context whether active or not, is
      // rewritten under the lock after a byte-for-byte backup. It does not
      // apply: the user reads the report, then applies.
      case 'migrate': {
        if (rest.length !== 0) throw new Error('usage: prism migrate');
        const { defs } = load();
        const { files, backup } = await withLock(lockPath(), async () => runMigration(defs));
        if (files.length === 0) {
          print('migrate: nothing to migrate\n');
          return 0;
        }
        print(`migrate: backup ${backup}\n`);
        for (const file of files) {
          for (const change of file.changes) {
            print(change.kept
              ? `migrate: ${file.where}: ${change.from} ${JSON.stringify(change.old)} removed; ${change.to} ${JSON.stringify(change.value)} kept\n`
              : `migrate: ${file.where}: ${change.from} ${JSON.stringify(change.old)} -> ${change.to} ${JSON.stringify(change.value)}\n`);
          }
        }
        print("migrate: done — run 'prism apply' to hand the new keys to the sinks\n");
        return 0;
      }
```

Update the usage string in `default`:

```js
        eprint('usage: prism set|unset|get|list|describe|apply|requirements|doctor|migrate|context|reset\n');
```

- [ ] **Step 4: Teach doctor the pending migration**

In `case 'doctor'`, inside the `withLock` callback, before the `orphans` loop add `const replaced = replacements(defs);` and change the two orphan reports:

Base (replacing the `for (const key of orphans)` body):

```js
          for (const key of orphans) {
            if (replaced.has(key)) {
              print(`doctor: pending migration: ${key} in base is replaced by ${replaced.get(key).key} — run 'prism migrate'\n`);
            } else {
              print(`doctor: orphan value ${key}: no definition — run 'prism unset ${key}'\n`);
            }
            problems++;
          }
```

Context (replacing the `if (!def) { … continue; }` block inside the context loop):

```js
                if (!def) {
                  if (replaced.has(key)) {
                    print(`doctor: pending migration: ${key} in ${kind} ${name} is replaced by ${replaced.get(key).key} — run 'prism migrate'\n`);
                  } else {
                    print(`doctor: orphan value ${key} in ${kind} ${name}: no definition — edit ${contextPath(kind, name)}\n`);
                  }
                  contextProblems++;
                  continue;
                }
```

- [ ] **Step 5: Run the CLI tests, then the suite**

Run: `node --test test/cli.test.js` — the three new tests PASS and the existing doctor tests still pass (an orphan no def replaces keeps its old line).
Run: `just test` — all pass.

- [ ] **Step 6: Commit**

```bash
tasks check
git add src/cli.js test/cli.test.js
git commit -m "feat(cli): prism migrate rewrites replaced keys under the lock; doctor names the pending migration"
```

---

### Task 4: Documentation, task record, and the rollout handoff

**Files:**
- Modify: `README.md` (Configuration layout block and the paragraph under it)
- Modify: `docs/plans/2026-09-19-ring-sweep-migration.md` (this file's Status line)
- Task record via the CLI only.

- [ ] **Step 1: Document the migration**

In `README.md`, add to the configuration layout code block after the `resolved.json` line:

```
~/.local/state/prism/migrations/<stamp>/     # byte-for-byte copies of the store files `prism migrate` rewrote
```

and after the paragraph that ends `docs/specs/2026-09-05-prism-context-layers-design.md`.` add:

```markdown
A definition may replace a retired one (`replaces: <old key>` in `defs/`).
The store is never rewritten behind your back: `prism doctor` reports a
pending migration wherever a replaced key is still stored, and `prism migrate`
rewrites base and every profile and wallpaper context, active or not, after
copying each file it touches into a timestamped directory under the state
dir. It converts what has an equivalent (`glass.ring.driftHz 0` becomes
`glass.ring.sweepMs 0`) and falls back to the new default otherwise; a file
that already holds the new key keeps its value. Then `prism apply`. Rollback
is copying the backup back over the config dir.
```

- [ ] **Step 2: Verify the README renders the same keys the code uses**

Run: `grep -n 'sweepMs\|migrate' README.md` — the paragraph and the layout line are present; `grep -rn 'driftHz' README.md` returns only the conversion example.

- [ ] **Step 3: Set this plan's status and close the task**

Change the `**Status:**` line of this file to `implemented on \`prism-eff23a\` (commits listed at merge); awaiting the rollout of §5 below.`

```bash
tasks note prism-eff23a "sweepMs replaces driftHz; niri sink emits ring-sweep-ms; prism migrate with backup under state/migrations; doctor hint. Rollout: install niri 26.04.r436.g597aba66, prism migrate + apply, restart session."
tasks done prism-eff23a "glass.ring.sweepMs replaces driftHz; prism migrate rewrites every store with a backup; doctor names it"
tasks check
git add README.md docs/plans/2026-09-19-ring-sweep-migration.md tasks/prism-eff23a.md
git commit -m "docs: prism migrate and the ring sweep key; close prism-eff23a"
```

- [ ] **Step 4: Full gate before handing the branch over**

Run: `just gate`
Expected: `check` and `test` both pass; `tasks check` reports zero errors.

---

## Rollout after merge (the user's steps, spec §5 order)

Not plan tasks; recorded so the handoff is one place.

1. In niri-material `packaging/arch`: `makepkg -si` (the PKGBUILD is pinned at `26.04.r436.g597aba66`). The running compositor is untouched; `niri --version` reports `597aba66`.
2. Merge `prism-eff23a` into Prism `main` (the panel and `prism apply` run the `main` checkout), then `prism migrate`, read the report, `prism apply`. The file on disk now says `ring-sweep-ms`; the running old compositor rejects the reload and keeps its config — expected until step 3.
3. Restart the niri session. `niri validate -c ~/.config/niri/config.kdl` passes beforehand; afterwards the ring runs its one lap on focus gain.

Rollback: copy `~/.local/state/prism/migrations/<stamp>/` back over `~/.config/prism/`, reinstall the previous niri package and the previous Prism, `prism apply`, restart.

## Self-review

- Spec §5 coverage: definition with `replaces` (Task 1); sink emits `ring-sweep-ms`, never `ring-drift-hz` (Task 1, tested); migrate over base + all contexts, conversion rule, collision kept, backup before write, report of files/keys/backup (Tasks 2–3); doctor names the command (Task 3); `idle-after-ms` untouched (constraint); rollout and rollback (handoff section, README).
- Spec §7 Prism tests: both materials carry `ring-sweep-ms` default/override (`niri-render.test.js`, the fixture uses 1200 and the zero case 0; `both materials carry the same response block` counts two); no `ring-drift-hz` in output (Task 1 Step 6); migration over three stores with the collision case, byte-for-byte backup, report naming every file and the kept collision, second run a no-op (Task 2 and Task 3 tests); doctor hint (Task 3).
- Type consistency: `migrateValues` change shape `{ from, to, old, value, kept }` is what `cli.js` prints; `planMigration` entries carry `where`, `kind`, `name`, `path`, `source`, `values`, `changes`, which `runMigration` and the verb consume; `backupDir(now)` takes a `Date` in both the test and `runMigration`.
- Placeholders: none; every step carries its code and command.
