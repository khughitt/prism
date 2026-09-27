# Rotation keeps edits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A wallpaper rotation keeps the screen and the pending edits, changing only the keys a saved incoming pair sets; the ring follows Noctalia's palette through a `colors_changed` hook instead of the rotation.

**Architecture:** `changeSlots` (`src/context-cli.js`) stops saving the outgoing pair on a wallpaper transition and instead computes the new scratch with a pure `carryScratch(previous, beneath, pairValues)`. Fan-out serializes each sink's apply under a per-sink lock so two hooks firing together cannot leave an older render last. The niri sink reads its accent from a prism-owned palette file rendered by a Noctalia 5 user template.

**Tech Stack:** Node 20 ESM, `node:test`, the `yaml` package, Noctalia 5.1 templates and hooks.

**Spec:** `docs/specs/2026-09-27-rotation-keeps-edits-design.md`

## Global Constraints

- A wallpaper transition writes no pair and no look; it writes only the runtime file (slots and scratch together) and `resolved.json`.
- The rule: a wallpaper transition changes only the keys the incoming pair sets; every other visible value stays where it was.
- Profile selection, look recovery, active-profile deletion, `context clear wallpaper` and `context delete wallpaper` keep their current behavior.
- Palette file: `noctalia-palette.json` in prism's state directory (`stateDir()`), holding `{"primary": "#rrggbb"}`; `PRISM_NOCTALIA_COLORS` still overrides the path.
- A missing palette file means the manual color; a malformed one fails the apply.
- No machine names or absolute home paths in code comments or docs (the pre-commit hook rejects hostnames).
- Setup in a fresh worktree: `npm install` (README, Development prerequisites). Gates: `just test`, `just check` before each commit.
- Task records: `tasks start <child>` before a task's first code change, and `tasks done <child> "<result>"` staged into that task's code commit (AGENTS.md). Never edit `tasks/*.md` by hand.

## Review Focus

1. **Deactivating the wallpaper while a tuned pair is on screen** — the pair's values carry into scratch, and the screen does not change. Pinned in Task 1 (activate/deactivate test).
2. **Rotating onto a pair while a pending edit equals the pair's value** — the edit is dropped rather than left as a redundant scratch key, and the count falls. Pinned in Task 1 (pair-wins test asserts exact scratch).
3. **The hook firing for the wallpaper already on screen after a carry** — a no-op that does not re-carry or touch scratch. Pinned in Task 1 (activate/deactivate test repeats the same wallpaper).
4. **A sink apply that throws while holding the sink lock** — the lock is released and the next apply of that sink proceeds. Pinned in Task 2.
5. **A palette file left over in the old `mPrimary` shape** (someone points `PRISM_NOCTALIA_COLORS` at the dead Noctalia 4 file) — the apply fails naming the file and `primary`, rather than silently resting on the manual color. Pinned in Task 3.

---

### Task 1: Rotation carries the screen instead of saving the outgoing pair

**Files:**
- Create: `src/carry.js`
- Modify: `src/context-cli.js:40-95` (`changeSlots`)
- Modify: `test/context-cli.test.js:440-497` (the three fold tests), `:521-530` (delete test)
- Modify: `test/write-order.test.js:119-139` (the four wallpaper-transition cases) and `:190-203` (the harness's expected scratch and screen checks)
- Create: `test/carry.test.js`
- Modify: `README.md:74-80`, `README.md:173` (the write-order table)

**Interfaces:**
- Produces: `carryScratch(previous: Record<string, unknown>, beneath: Record<string, unknown>, pairValues: Record<string, unknown>) => Record<string, unknown>` exported from `src/carry.js`.

- [ ] **Step 0: Set up and claim**

```bash
npm install
tasks start prism-7eed95
```

- [ ] **Step 1: Write the failing unit test for `carryScratch`**

Create `test/carry.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { carryScratch } from '../src/carry.js';

test('carryScratch keeps what differs from the new fold and yields the pair its keys', () => {
  const previous = { a: 1, b: 2, c: 3, d: [1, 2] };
  const beneath = { a: 1, b: 5, c: 9, d: [1, 2] };
  assert.deepEqual(carryScratch(previous, beneath, { c: 9 }), { b: 2 },
    'a equals the fold, c belongs to the pair, d is deep-equal');
});

test('carryScratch of an unchanged fold is empty', () => {
  assert.deepEqual(carryScratch({ a: 1 }, { a: 1 }, {}), {});
});

test('carryScratch drops a pending value equal to the pair value', () => {
  assert.deepEqual(carryScratch({ a: 7 }, { a: 7 }, { a: 7 }), {});
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/carry.test.js`
Expected: FAIL, `Cannot find module '.../src/carry.js'`.

- [ ] **Step 3: Implement `src/carry.js`**

```js
import { isDeepStrictEqual } from 'node:util';

// The scratch a wallpaper transition leaves: every value that was visible
// before and that the fold after it (without scratch) would not show, except
// the keys the incoming pair sets, which the pair owns. Nothing is saved; the
// screen changes only where the pair speaks (2026-09-27 rotation design).
export function carryScratch(previous, beneath, pairValues) {
  const scratch = {};
  for (const [key, value] of Object.entries(previous)) {
    if (Object.hasOwn(pairValues, key)) continue;
    if (!isDeepStrictEqual(value, beneath[key])) scratch[key] = value;
  }
  return scratch;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test test/carry.test.js`
Expected: 3 passing.

- [ ] **Step 5: Replace the fold tests with the carry behavior**

In `test/context-cli.test.js`, replace the three tests `the hook folds scratch into the wallpaper that leaves, in one locked step`, `the first activation keeps scratch: …` and `activate and deactivate wallpaper fold like the hook; …` (lines 440-497) with:

```js
test('a rotation between untuned wallpapers keeps scratch, writes no pair, and reaches no sink', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  await cli.run(['set', 'glass.paneLip', '12'], { runner: () => {} });

  const calls = [];
  assert.equal(await cli.run(['context', 'wallpaper', b], { runner: (m) => calls.push(m.sink) }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7, 'glass.paneLip': 12 });
  assert.equal(readContext('wallpaper', wallpaperId(a)), null, 'the leaving wallpaper gained no pair');
  assert.equal(readContext('wallpaper', wallpaperId(b)), null);
  assert.deepEqual(readActive(), { wallpaper: { id: wallpaperId(b), path: b } });
  assert.deepEqual(calls, [], 'no resolved value changed');
});

test('a rotation onto a saved pair changes only the keys the pair sets', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', wallpaperId(b), { source: b, values: { 'glass.paneLip': 9 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  await cli.run(['set', 'glass.paneLip', '12'], { runner: () => {} });

  assert.equal(await cli.run(['context', 'wallpaper', b], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 }, 'the pair owns paneLip; ior stays pending');
  const params = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params;
  assert.equal(params['glass.paneLip'], 9);
  assert.equal(params['glass.ior'], 1.7);
  assert.deepEqual(readContext('wallpaper', wallpaperId(b)), { source: b, values: { 'glass.paneLip': 9 } });
});

test('leaving a saved pair carries its values as pending edits that Keep for wallpaper can save', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', wallpaperId(a), { source: a, values: { 'glass.paneLip': 9 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), {});

  assert.equal(await cli.run(['context', 'wallpaper', b], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.paneLip': 9 });
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.paneLip'], 9, 'the screen did not change');
  assert.deepEqual(readContext('wallpaper', wallpaperId(a)), { source: a, values: { 'glass.paneLip': 9 } }, 'the pair is untouched');

  assert.equal(await cli.run(['commit', 'wallpaper', wallpaperId(b)], { runner: () => {} }), 0);
  assert.deepEqual(readContext('wallpaper', wallpaperId(b)).values, { 'glass.paneLip': 9 });
  assert.deepEqual(readScratch(), {});
});

test('the first activation lets the incoming pair win over pending edits for its keys only', async () => {
  const a = wallpaperFile('a.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', wallpaperId(a), { source: a, values: { 'glass.paneLip': 9 } });
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  await cli.run(['set', 'glass.paneLip', '12'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.paneLip'], 9);
});

test('activate and deactivate wallpaper carry like the hook; the same wallpaper again changes nothing', async () => {
  const a = wallpaperFile('a.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  writeContext('wallpaper', 'other001', { source: '/o.jpg', values: { 'glass.paneLip': 9 } });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.ior', '1.7'], { runner: () => {} });
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 }, 'a repeat is a no-op');

  assert.equal(await cli.run(['context', 'activate', 'wallpaper', 'other001'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7 });
  assert.equal(readContext('wallpaper', wallpaperId(a)), null);
  const before = fs.readFileSync(activePath(), 'utf8');
  assert.equal(await cli.run(['context', 'activate', 'wallpaper', 'other001'], { runner: () => {} }), 0);
  assert.equal(fs.readFileSync(activePath(), 'utf8'), before, 'repeating after a carry re-carries nothing');

  assert.equal(await cli.run(['context', 'deactivate', 'wallpaper'], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.ior': 1.7, 'glass.paneLip': 9 }, 'the leaving pair is carried');
  assert.deepEqual(readContext('wallpaper', 'other001').values, { 'glass.paneLip': 9 });
  assert.deepEqual(readActive(), {});
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.paneLip'], 9);
});

test('a pending glass off survives rotation and is written into no pair', async () => {
  const a = wallpaperFile('a.jpg');
  const b = wallpaperFile('b.jpg');
  const c = wallpaperFile('c.jpg');
  const { wallpaperId } = await import('../src/contexts.js');
  assert.equal(await cli.run(['context', 'wallpaper', a], { runner: () => {} }), 0);
  await cli.run(['set', 'glass.enabled', 'false'], { runner: () => {} });
  for (const next of [b, c]) assert.equal(await cli.run(['context', 'wallpaper', next], { runner: () => {} }), 0);
  assert.deepEqual(readScratch(), { 'glass.enabled': false });
  for (const wall of [a, b, c]) assert.equal(readContext('wallpaper', wallpaperId(wall)), null);
});
```

In the test `deleting the active wallpaper clears the slot and leaves scratch: …` (around line 521), add after the existing `readScratch` assertion:

```js
  assert.equal(JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params['glass.paneLip'], 6, 'the deleted pair is not carried');
```

- [ ] **Step 5b: Update the interruption and retry cases**

`test/write-order.test.js` runs every transition with a failure injected after each durable write, then retries, and checks exact ownership. Its fixture (`pairStore`) is Aurora on `w1`, with scratch `{ glass.roughness: 0.73, terminal.background.opacity.inactive: 0.51 }`. Aurora's values are `roughness 0.3, ior 1.4`, its `w1` pair is `roughness 0.4, noise 0.22`, and its `w2` pair is `roughness 0.45`. `glass.noise` defaults to 0.

In the harness (the `for (const scenario of cases)` loop), let a case name its expected scratch and declare that it keeps the screen. Replace

```js
    const expectedRuntime = { active: JSON.parse(JSON.stringify(scenario.next?.(seed) ?? seed.active)),
      scratch: scenario.keepScratch ? seed.scratch : {} };
```

with

```js
    const expectedRuntime = { active: JSON.parse(JSON.stringify(scenario.next?.(seed) ?? seed.active)),
      scratch: scenario.scratch ?? (scenario.keepScratch ? seed.scratch : {}) };
```

and replace

```js
    if (argv[0] === 'commit' || argv[1] === 'rename'
        || (scenario.fold && isDeepStrictEqual(expectedRuntime.active, seed.active))) {
```

with

```js
    if (argv[0] === 'commit' || argv[1] === 'rename' || scenario.keepsScreen
        || (scenario.fold && isDeepStrictEqual(expectedRuntime.active, seed.active))) {
```

Replace the four cases `wallpaper hook rotation`, `explicit wallpaper rotation`, `wallpaper deactivation` and `first wallpaper activation retains pending edits` with:

```js
  ...[
    ['wallpaper hook rotation', ({ w2 }) => ['context', 'wallpaper', w2.path]],
    ['explicit wallpaper rotation', ({ w2 }) => ['context', 'activate', 'wallpaper', w2.id]],
  ].map(([name, argv]) => ({
    // w2's pair owns roughness; w1's noise and the pending opacity are carried.
    name: `${name} carries pending edits and writes no pair`, argv,
    scratch: { 'glass.noise': 0.22, 'terminal.background.opacity.inactive': 0.51 },
    next: ({ active, w2 }) => ({ ...active, wallpaper: w2 }),
    writes: () => [activePath(), resolvedPath()],
  })),
  {
    name: 'wallpaper deactivation carries the leaving pair and keeps the screen',
    argv: () => ['context', 'deactivate', 'wallpaper'], keepsScreen: true,
    scratch: { 'glass.roughness': 0.73, 'glass.noise': 0.22, 'terminal.background.opacity.inactive': 0.51 },
    next: ({ active }) => ({ profile: active.profile }),
    writes: () => [activePath(), resolvedPath()], completedRefusal: /no active wallpaper/,
  },
  {
    // w1's pair owns roughness and noise; only the pending opacity survives.
    name: 'first wallpaper activation lets the incoming pair win its keys', seed: { hasWallpaper: false },
    argv: ({ w1 }) => ['context', 'wallpaper', w1.path],
    scratch: { 'terminal.background.opacity.inactive': 0.51 },
    next: ({ active, w1 }) => ({ ...active, wallpaper: w1 }),
    writes: () => [activePath(), resolvedPath()],
  },
```

No case sets `fold: true` any more for a wallpaper transition, so `expectedLooks` stays equal to the seeded looks: the harness then checks, at every prefix, that no look document was written. A retry after the runtime write is a same-wallpaper no-op for the hook and explicit cases, and a `no active wallpaper` refusal for deactivation. Both converge on the final files, which the harness already asserts.

- [ ] **Step 6: Run the context and write-order tests and see the new ones fail**

Run: `node --test test/context-cli.test.js test/write-order.test.js`
Expected: the six new rotation tests in `context-cli.test.js` and the four transition cases in `write-order.test.js` FAIL (scratch comes back `{}`, and a look document is written). The delete test and every profile-selection case pass.

- [ ] **Step 7: Change `changeSlots`**

In `src/context-cli.js`, add the import:

```js
import { carryScratch } from './carry.js';
```

Replace the block from `const wallpaperChanged = …` through `const { params } = resolveLayered(defs, base, withScratch(loadLayers(next, incomingLook), scratchAfter));` with:

```js
    // A wallpaper transition (the hook, activate or deactivate wallpaper) saves
    // nothing: it carries the screen across and lets only the incoming pair's
    // keys change. Clear and delete keep the slot or name their own intent.
    const rotation = intent === 'wallpaper' && active.wallpaper?.id !== next.wallpaper?.id;
    const saveOutgoing = !recoverOutgoing && active.wallpaper !== undefined && selectLook;
    let scratchAfter = recoverOutgoing ? scratch : (selectLook ? {} : scratch);
    let folded = null;
    if (saveOutgoing && Object.keys(scratch).length) {
      const id = active.wallpaper.id;
      const old = Object.hasOwn(outgoingLook.wallpapers, id) ? outgoingLook.wallpapers[id] : null;
      folded = { ...outgoingLook, wallpapers: { ...outgoingLook.wallpapers,
        [id]: { source: old?.source ?? active.wallpaper.path, values: { ...old?.values, ...scratch } } } };
      resolveLayered(defs, base, withScratch(loadLayers(active, folded), scratch));
    }
    let incomingLook = folded && active.profile === next.profile ? folded : readLook(next.profile ?? null);
    if (without?.kind === 'wallpaper' && incomingLook !== null) {
      incomingLook = { ...incomingLook, wallpapers: { ...incomingLook.wallpapers } };
      delete incomingLook.wallpapers[without.name];
    }
    const incomingLayers = loadLayers(next, incomingLook);
    if (rotation) {
      const pair = incomingLayers.find((layer) => layer.kind === 'wallpaper')?.values ?? {};
      scratchAfter = carryScratch(previous, resolveLayered(defs, base, incomingLayers).params, pair);
    }
    const { params } = resolveLayered(defs, base, withScratch(incomingLayers, scratchAfter));
```

`previous` is never `null` on a rotation: the only paths that leave it `null` are look recovery (intent `select-profile`/`delete-profile`) and a `without` wallpaper, neither of which is a rotation.

- [ ] **Step 8: Run the whole suite**

Run: `just test`
Expected: all pass. If `profile selection and wallpaper rotation commute with empty scratch` fails, stop and report: with empty scratch and no pair for the outgoing `old` wallpaper, the carry is empty in both orders, so the two should still commute.

- [ ] **Step 9: Update the README**

In `README.md`, replace the sentence at lines 78-80 (`A wallpaper rotation saves the outgoing pair; the first wallpaper activation and repeated observations of the same wallpaper preserve scratch.`) with:

```markdown
A wallpaper rotation (the Noctalia hook, or `context activate`/`deactivate
wallpaper`) saves nothing. It keeps the screen, changing only the keys the
incoming look–wallpaper pair sets, and every other visible value that the new
fold would not show stays as a pending edit. Leaving a tuned wallpaper therefore
turns its values into pending edits; Keep for wallpaper saves them to the
wallpaper now showing. Repeated observations of the same wallpaper are no-ops.
```

In the write-order table (line 173), change the first row's operation from `Select a look or rotate wallpaper with outgoing edits` to `Select a look with outgoing edits`, and add after it:

```markdown
| Rotate wallpaper | Runtime with next slots and carried scratch; bus | Runtime publishes the slot and the carried scratch together. After it, `prism apply` repairs a stale bus. |
```

- [ ] **Step 10: Commit**

```bash
just check
tasks done prism-7eed95 "Rotation carries the screen and pending edits; no pair is written on a wallpaper transition"
git add src/carry.js src/context-cli.js test/carry.test.js test/context-cli.test.js test/write-order.test.js README.md tasks/
git commit -m "feat(context): rotation carries the screen and pending edits instead of saving the outgoing pair"
```

---

### Task 2: Serialize each sink's apply

**Files:**
- Modify: `src/paths.js` (add `sinkLockPath`)
- Modify: `src/fanout.js:63-85` (`fanOut`)
- Modify: `test/fanout.test.js`

**Interfaces:**
- Produces: `sinkLockPath(sink: string) => string`, `path.join(stateDir(), 'sinks', \`${sink}.lock\`)`.
- Consumes: `withLock(lockPath, fn)` from `src/lock.js`.

- [ ] **Step 0: Claim**

Run: `tasks start prism-853e92`

- [ ] **Step 1: Write the failing tests**

Append to `test/fanout.test.js`:

```js
const { sinkLockPath } = await import('../src/paths.js');

test('an apply waits for the sink lock another apply of that sink holds', async () => {
  freshState();
  const order = [];
  let release;
  const held = withLock(sinkLockPath('fast'), () => new Promise((resolve) => { release = resolve; order.push('holder'); }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const waiting = fanOut({ manifests: [manifests[0]], resolved, changedKeys: ['a.x'], runner: () => order.push('apply') });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(order, ['holder'], 'the apply has not run while the lock is held');
  release();
  await held;
  assert.deepEqual((await waiting).applied, ['fast']);
  assert.deepEqual(order, ['holder', 'apply']);
});

test('a throwing apply releases its sink lock', async () => {
  freshState();
  const first = await fanOut({ manifests: [manifests[0]], resolved, changedKeys: ['a.x'], runner: () => { throw new Error('boom'); } });
  assert.equal(first.failed.length, 1);
  assert.equal(fs.existsSync(sinkLockPath('fast')), false);
  const second = await fanOut({ manifests: [manifests[0]], resolved, changedKeys: ['a.x'], runner: () => {} });
  assert.deepEqual(second.applied, ['fast']);
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/fanout.test.js`
Expected: FAIL. `sinkLockPath` is not exported, so the calls throw a `TypeError` (`sinkLockPath is not a function`).

- [ ] **Step 3: Implement**

In `src/paths.js`, after `statusLockPath`:

```js
// One lock per sink: two hooks firing together (a rotation's fan-out and the
// palette's colors_changed apply) must not interleave one sink's render.
export const sinkLockPath = (sink) => path.join(stateDir(), 'sinks', `${sink}.lock`);
```

In `src/fanout.js`, import `sinkLockPath` alongside the other paths, and in `fanOut` replace

```js
      runner(manifest, resolvedPath(), changedKeys);
```

with

```js
      // The apply reads resolved.json and its own inputs (the palette) inside
      // the lock, so whichever render of this sink runs last sees the newest.
      await withLock(sinkLockPath(manifest.sink), async () => runner(manifest, resolvedPath(), changedKeys));
```

The existing `try`/`catch` around it still records the failure; `withLock` releases in its `finally`.

- [ ] **Step 4: Run and see them pass**

Run: `node --test test/fanout.test.js`
Expected: all pass, including `child fan-outs wait for the status lock and retain unique snapshots`.

- [ ] **Step 5: Full suite and commit**

```bash
just test
just check
tasks done prism-853e92 "Fan-out serializes each sink's apply under a per-sink lock"
git add src/paths.js src/fanout.js test/fanout.test.js tasks/
git commit -m "feat(fanout): serialize each sink's apply under a per-sink lock"
```

---

### Task 3: The ring reads a prism-owned palette rendered by a Noctalia template

**Files:**
- Create: `integrations/niri/noctalia-palette.template`
- Modify: `integrations/niri/palette.js`
- Modify: `integrations/niri/apply:21-27` (comment only)
- Modify: `test/niri-render.test.js:705-720`, `test/niri-apply.test.js:320-395`
- Create: `test/noctalia-palette-template.test.js`
- Modify: `README.md` (new section before `## Command line`)

**Interfaces:**
- Produces: `noctaliaColorsPath() => string` (unchanged name, new default `path.join(stateDir(), 'noctalia-palette.json')`), `readNoctaliaAccent(file) => string | null` reading `primary`.

- [ ] **Step 0: Claim**

Run: `tasks start prism-916f49`

- [ ] **Step 1: Update the tests to the new shape**

In `test/niri-render.test.js`, in `the palette reader rests on absence and fails on a broken file`, change the file name and keys:

```js
  const file = path.join(dir, 'noctalia-palette.json');

  assert.equal(readNoctaliaAccent(file), null, 'a fresh machine has no palette');

  fs.writeFileSync(file, JSON.stringify({ primary: '#BAD065' }));
  assert.equal(readNoctaliaAccent(file), '#BAD065', 'uppercase hex is a color');

  fs.writeFileSync(file, '{ not json');
  assert.throws(() => readNoctaliaAccent(file), /not valid JSON/);

  fs.writeFileSync(file, JSON.stringify({ primary: 'blue' }));
  assert.throws(() => readNoctaliaAccent(file), /primary missing or not a #rrggbb color/);

  fs.writeFileSync(file, JSON.stringify({ mPrimary: '#BAD065' }));
  assert.throws(() => readNoctaliaAccent(file), new RegExp(`${file}: primary missing`),
    'the Noctalia 4 colors.json shape is not a palette');
```

Add a test for the default path:

```js
test('the palette defaults to prism state and honours the override', () => {
  const saved = process.env.PRISM_NOCTALIA_COLORS;
  delete process.env.PRISM_NOCTALIA_COLORS;
  try {
    assert.equal(noctaliaColorsPath(), path.join(stateDir(), 'noctalia-palette.json'));
    process.env.PRISM_NOCTALIA_COLORS = '/elsewhere.json';
    assert.equal(noctaliaColorsPath(), '/elsewhere.json');
  } finally {
    if (saved === undefined) delete process.env.PRISM_NOCTALIA_COLORS;
    else process.env.PRISM_NOCTALIA_COLORS = saved;
  }
});
```

Add `noctaliaColorsPath` to that file's existing import from `../integrations/niri/palette.js`, and import `stateDir` from `../src/paths.js`.

In `test/niri-apply.test.js`, replace every `JSON.stringify({ mPrimary: … })` with `JSON.stringify({ primary: … })`, and the expected message `/mPrimary missing or not a #rrggbb color/` with `/primary missing or not a #rrggbb color/`.

- [ ] **Step 2: Write the template contract test**

Create `test/noctalia-palette-template.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readNoctaliaAccent } from '../integrations/niri/palette.js';

const template = fileURLToPath(new URL('../integrations/niri/noctalia-palette.template', import.meta.url));

function hasNoctalia() {
  try { execFileSync('noctalia', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; }
}

test('the template renders a palette the niri sink accepts', { skip: hasNoctalia() ? false : 'noctalia is not installed' }, (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-template-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'noctalia-palette.json');
  const theme = path.join(dir, 'theme.json');
  // A fixed palette, so the render needs no image and no running shell.
  fs.writeFileSync(theme, JSON.stringify({ dark: { primary: '#a1b2c3' }, light: { primary: '#a1b2c3' } }));
  execFileSync('noctalia', ['theme', '--theme-json', theme, '-r', `${template}:${out}`], { stdio: 'pipe' });
  assert.equal(readNoctaliaAccent(out).toLowerCase(), '#a1b2c3');
});
```

Noctalia 5.1 accepts this partial token map: `noctalia theme --theme-json <file> -r <in>:<out>` rendered `{"primary": "#a1b2c3"}` when the plan was written. The test is skipped, with the reason shown, on a machine without Noctalia.

- [ ] **Step 3: Run the tests and see them fail**

Run: `node --test test/niri-render.test.js test/niri-apply.test.js test/noctalia-palette-template.test.js`
Expected: FAIL on `primary` (the reader still reads `mPrimary`), on the default path, and on the missing template file.

- [ ] **Step 4: Implement**

Create `integrations/niri/noctalia-palette.template` (one line, no trailing comment; Noctalia renders `hex` as `#rrggbb`):

```text
{"primary": "{{ colors.primary.default.hex }}"}
```

Replace `integrations/niri/palette.js` with:

```js
import fs from 'node:fs';
import path from 'node:path';
import { stateDir } from '../../src/paths.js';

// Noctalia renders noctalia-palette.template here on every palette change
// (a user template in the Noctalia config), and its colors_changed hook then
// runs `prism apply niri`, so an apply always reads the current palette.
export function noctaliaColorsPath() {
  return process.env.PRISM_NOCTALIA_COLORS ?? path.join(stateDir(), 'noctalia-palette.json');
}

// null on a machine where the template has not rendered yet: the ring then
// rests on the manual color. A file that exists but does not parse or carries
// no usable primary is an error — the user chose this source, and a broken
// one must fail the apply rather than silently freeze the ring.
export function readNoctaliaAccent(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  let colors;
  try {
    colors = JSON.parse(text);
  } catch {
    throw new Error(`${file}: not valid JSON`);
  }
  const accent = colors?.primary;
  if (typeof accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accent)) {
    throw new Error(`${file}: primary missing or not a #rrggbb color`);
  }
  return accent;
}
```

In `integrations/niri/apply`, change the comment's `a broken colors.json` to `a broken palette file`.

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test test/niri-render.test.js test/niri-apply.test.js test/noctalia-palette-template.test.js`
Expected: all pass (the template test runs on a machine with Noctalia installed).

- [ ] **Step 6: Document the Noctalia side**

In `README.md`, before `## Command line`, add:

````markdown
## Noctalia palette

The ring's `noctalia` color source (`glass.ring.colorSource`) reads
`noctalia-palette.json` in prism's state directory, which a Noctalia user template
renders on every palette change. Noctalia's `colors_changed` hook, which fires
after the templates are written and only when the palette changed, re-renders
the niri sink. The wallpaper hook stays `prism context wallpaper`. The
template is registered with the other user templates (a `templates.toml` in the
Noctalia config directory):

```toml
[theme.templates.user.prism]
input_path  = "<prism checkout>/integrations/niri/noctalia-palette.template"
output_path = "$XDG_STATE_HOME/prism/noctalia-palette.json"
```

and the hook sits beside `wallpaper_changed` in `config.toml`:

```toml
[hooks]
colors_changed = ["prism apply niri"]
```

Until the template has rendered once, the ring rests on the manual color.
`PRISM_NOCTALIA_COLORS` points the sink at another file.
````

- [ ] **Step 7: Full suite and commit**

```bash
just test
just check
tasks done prism-916f49 "The niri ring reads its accent from a prism-owned palette rendered by a Noctalia user template"
git add integrations/niri/noctalia-palette.template integrations/niri/palette.js integrations/niri/apply test/niri-render.test.js test/niri-apply.test.js test/noctalia-palette-template.test.js README.md tasks/
git commit -m "feat(niri): read the ring accent from a prism-owned Noctalia palette template"
```

---

### Task 4: Land and accept on the desktop

Depends on `dots-632c20` (the Noctalia config registers the template and the `colors_changed` hook). The hooks call `~/bin/prism`, which runs the main checkout, so acceptance happens after the merge.

**Files:** none in prism beyond the task records and the two spec status lines.

- [ ] **Step 0: Claim**

Run: `tasks start prism-a8df28` (it depends on `dots-632c20`; land that first, Step 2, if `start` reports the dependency open).

- [ ] **Step 1: Merge the branch**

Run `just gate` in `.worktrees/rotation-keeps-edits`, then merge `prism-5f6046-rotation` into `main` (superpowers:finishing-a-development-branch).

- [ ] **Step 2: Land `dots-632c20`**

In the dotfiles checkout, per that task: add the `[theme.templates.user.prism]` entry to `noctalia/templates.toml`, the tracked template registry, beside the other `[theme.templates.user.*]` entries. Add `colors_changed = ["~/bin/prism apply niri"]` to the `[hooks]` table in `noctalia/config.toml`, and leave `wallpaper_changed` as it is. Close `dots-632c20` in the dotfiles commit. Trigger a re-render (`noctalia msg` theme re-apply, see Noctalia's Media & UI → Theme IPC) and confirm `noctalia-palette.json` appears in prism's state directory.

- [ ] **Step 3: Desktop acceptance (spec items 1–3, 6, 8)**

With the panel open on an untuned wallpaper, make two edits and run `systemctl --user start wali-rotate.service` three times:
- the edits count stays at 2 and nothing on the glass changes (item 1);
- onto a wallpaper with a saved pair for the loaded look, only that pair's keys change (item 2);
- leaving it raises the edit count by the pair's keys (item 3);
- the ring takes the new palette's primary each time the colorscheme changes, with `sink-status.json` showing a niri apply after the template write (item 8);
- Glass off from the panel stays off across the rotations (item 6).

Record the outcome with `tasks note prism-5f6046 "<what was observed>"`.

- [ ] **Step 4: Close**

Set the spec's status line to `implemented and accepted <date>` and amend the 2026-09-20 pairs spec's status line with `Rotate and first-activation rows amended by 2026-09-27-rotation-keeps-edits-design.md`. Then, in one commit with those two edits:

```bash
tasks done prism-a8df28 "Merged; palette template and colors_changed hook live; desktop acceptance passed"
tasks done prism-5f6046 "Rotation keeps the screen and pending edits; only a saved incoming pair changes settings; the ring follows the palette"
tasks check
git add docs/specs tasks/
git commit -m "docs(spec): rotation keeps edits accepted on the desktop (prism-5f6046)"
```

The parent closes last: `tasks done` refuses it while any of its four children is open.
