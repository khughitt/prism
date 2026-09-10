# Neutral and symmetric reset modes implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** planned; not started.

**Goal:** Give the panel two more reset modes beside reset-to-defaults — symmetric, which mirrors focused values onto unfocused, and neutral, which quiets every parameter to a curated baseline — and serve all three from one batched CLI verb.

**Architecture:** Every visible def gains a `neutral:` value (or `neutralize: false` for the one exemption), validated at load with the same `validateValue` the store uses. A new `src/reset.js` computes a whole mutation from a store snapshot and returns the proposed target values plus the keys that actually change; `prism reset <mode>` writes it under one lock and fans out once. `describe` carries `neutral`, `neutralize`, and a new `heldInTarget` per parameter, so the Luau panel counts locally and issues exactly one command per click.

**Tech Stack:** Node.js 20+ with the existing `yaml` dependency and `node:test`; Luau under Noctalia plugin API 22 with the plain-`lua` test harness.

**Spec:** `docs/specs/2026-09-10-reset-modes-design.md`

**Task:** `prism-91edc5`. Follow-up filed: `prism-b25061` (undo).

## Global constraints

- Every value on the bus stays a flat scalar. No new parameter is added to the bus by this work.
- A def with a visible control (`ui.control ~= 'none'`) declares **exactly one** of `neutral: <value>` or `neutralize: false`. A `control: none` def declares neither. `neutralize` is only ever `false`.
- The one exemption is `glass.focusSplit`. Nothing else uses `neutralize`.
- Both halves of a matrix row declare the **same** `neutral`. Rows are identified by `(ui.group, ui.row)` — never by `ui.row` alone — in `src/defs.js`, `src/reset.js`, and `presentation.luau` alike.
- The curated neutral values, verbatim (Section 2 of the spec):
  - `0`: `glass.roughness`, `glass.inactive.roughness`, `glass.chromaticAberration`, `glass.inactive.chromaticAberration`, `glass.anisotropicBlur`, `glass.inactive.anisotropicBlur`, `glass.distortion`, `glass.inactive.distortion`, `glass.noise`, `glass.inactive.noise`, `glass.paneLip`, `glass.paneShiftX`, `glass.paneShiftY`, `glass.jellyFlex`, `glass.jellyRipple`, `terminal.background.opacity.active`, `terminal.background.opacity.inactive`
  - `false`: `glass.backdropBlur`, `glass.inactive.backdropBlur`, and all eight `glass.bypass.*`
  - `1`: `glass.ior`, `glass.inactive.ior`, `glass.saturation`, `glass.inactive.saturation`
  - `'#ffffff'`: `glass.attenuationColor`, `glass.inactive.attenuationColor`
  - `true`: `glass.enabled`
  - `24`: `compositor.gaps`
  - `20`: `glass.thickness`, `glass.inactive.thickness`
  - `60`: `glass.attenuationDistance`, `glass.inactive.attenuationDistance`
  - `0.5`: `glass.distortionScale`, `glass.inactive.distortionScale`
  - `fine`: `glass.noiseType`
  - `neutralize: false`: `glass.focusSplit`
- CLI syntax: `prism reset defaults|symmetric|neutral [--base] [--group <name>]`. The mode is positional. There is no `--mode` flag.
- A reset that changes no target contents writes nothing, does not write `resolved.json`, and calls no runner. Selection by a skip rule is not the same as a change; the test is on the target layer's resulting contents.
- Value comparison everywhere uses `isDeepStrictEqual` (Node) or `~=` on scalars (Luau). No case folding for colors.
- Glyphs are `restore` (existing), `equal` (symmetric), `baseline` (neutral). All three are present in `~/software/noctalia/assets/fonts/tabler.json`; `ripple-off` and `circle-off` are verified fallbacks if a visual check rejects `baseline`.
- Conventional commits, **no AI attribution trailer or footer** (a pre-commit hook rejects one). Use `tasks` for every task mutation: `tasks note` as evidence changes, `tasks done prism-91edc5 "<what landed>"` in the final commit, `tasks check` before finishing.
- Run `just test` before every commit that touches code. `just check` is the pre-commit gate and runs automatically.

## Working tree and prerequisites

Work on branch `reset-modes` in `.worktrees/reset-modes`; it already holds the spec and the task records. Read the spec, `AGENTS.md`, and `docs/notes/noctalia-plugin-contract.md` before Task 1.

The worktree has no `node_modules`. Run `npm install` once before the first test run.

The chain is mostly linear. Task 1 lands the contract and everything depends on it. **Task 4 needs Task 2**: it validates and counts fields `describe` only emits after Task 2, and its full-suite check runs the real payload through the panel. **Task 5 needs Tasks 3 and 4**: its buttons issue the verb Task 3 adds and count what Task 4 maps. Task 3 needs only Task 1, so `1 → 3` and `1 → 2 → 4` may run in parallel, joining at Task 5. Task 6 needs everything.

```
1 ─┬─> 2 ──> 4 ─┬─> 5 ──> 6
   └─> 3 ───────┘
```

## Files and responsibilities

| Files | Responsibility |
| --- | --- |
| `src/defs.js`, `defs/*.yaml`, `test/defs.test.js`, `test/glass-defs.test.js`, `test/niri-render.test.js` | The contract: the `neutral` field, its validation, and the curated values |
| `src/layers.js`, `src/cli.js` (`describe`), `test/cli.test.js`, `integrations/noctalia-plugin/contract.test.mjs` | `describe` carries `neutral`, `neutralize`, `heldInTarget` |
| `src/reset.js`, `src/cli.js` (`reset`), `test/reset.test.js`, `test/cli.test.js` | Compute, validate, and apply a whole mutation under one lock |
| `integrations/noctalia-plugin/presentation.luau`, `plugin_test.lua` | Group-keyed rows, and the three counts |
| `integrations/noctalia-plugin/plugin_test.lua`, `test/plugin-panel-lifecycle.test.js` | Both panel harnesses' fixture models gain the fields `validateModel` now requires |
| `integrations/noctalia-plugin/panel.luau`, `queue.luau`, `plugin_test.lua` | `heldInTarget` for overrides, the three buttons, the panel-wide row, the `reset` queue verb |
| `docs/notes/noctalia-plugin-contract.md`, `README.md`, the spec, this plan | Record what shipped |

---

### Task 1: The `neutral` field and the curated values

**Files:**
- Modify: `src/defs.js:44-108` (`validateDef`), `src/defs.js:15-41` (`loadDefs`)
- Modify: `defs/glass.yaml`, `defs/terminal.yaml`, `defs/compositor.yaml`
- Modify: `test/defs.test.js`
- Modify: `test/glass-defs.test.js`
- Modify: `test/niri-render.test.js`

**Interfaces:**
- Produces: `def.neutral` (any scalar) and `def.neutralize === false` on loaded defs. `loadDefs` throws on a def that declares both or neither, on a `neutral` that fails `validateValue`, and on a matrix row whose halves disagree.

- [ ] **Step 1: Write the failing validator tests**

Append to `test/defs.test.js`. `dirWith` already exists at the top of that file.

```js
const VISIBLE = 'ui: {group: G, control: slider, step: 1, label: L, order: 1}';

test('a visible def declares exactly one of neutral and neutralize', () => {
  const neither = `- {key: a.one, type: int, range: [0, 4], default: 0, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(neither)), /a\.one.*neutral/);

  const both = `- {key: a.one, type: int, range: [0, 4], default: 0, neutral: 0, neutralize: false, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(both)), /a\.one.*neutral/);

  const one = `- {key: a.one, type: int, range: [0, 4], default: 0, neutral: 2, description: d, ${VISIBLE}}`;
  assert.equal(loadDefs(dirWith(one)).get('a.one').neutral, 2);
});

test('neutralize is false or absent, never true', () => {
  const yes = `- {key: a.one, type: int, range: [0, 4], default: 0, neutralize: true, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(yes)), /neutralize must be false/);

  const no = `- {key: a.one, type: int, range: [0, 4], default: 0, neutralize: false, description: d, ${VISIBLE}}`;
  assert.equal(loadDefs(dirWith(no)).get('a.one').neutralize, false);
});

test('a neutral is validated like any other value at load', () => {
  const high = `- {key: a.one, type: int, range: [0, 4], default: 0, neutral: 9, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(high)), /a\.one/);

  const wrongType = `- {key: a.one, type: int, range: [0, 4], default: 0, neutral: hello, description: d, ${VISIBLE}}`;
  assert.throws(() => loadDefs(dirWith(wrongType)), /a\.one/);

  const badEnum = '- {key: a.two, type: enum, values: [x, y], default: x, neutral: z, description: d, '
    + 'ui: {group: G, control: select, label: L, order: 2}}';
  assert.throws(() => loadDefs(dirWith(badEnum)), /a\.two/);
});

test('a control:none def declares no neutral', () => {
  const invisible = '- {key: a.hidden, type: bool, default: false, neutral: false, description: d, ui: {group: G, control: none}}';
  assert.throws(() => loadDefs(dirWith(invisible)), /a\.hidden/);

  const clean = '- {key: a.hidden, type: bool, default: false, description: d, ui: {group: G, control: none}}';
  assert.equal(loadDefs(dirWith(clean)).get('a.hidden').neutral, undefined);
});

test('both halves of a matrix row declare the same neutral', () => {
  const row = (state, order, neutral) => `- {key: a.${state}, type: int, range: [0, 4], default: 0, neutral: ${neutral}, `
    + `description: d, ui: {group: G, control: slider, step: 1, label: L${order}, order: ${order}, state: ${state}, row: R}}`;
  const disagree = [row('focused', 1, 2), row('unfocused', 2, 3)].join('\n');
  assert.throws(() => loadDefs(dirWith(disagree)), /G.*R.*a\.focused.*a\.unfocused/);
  const agree = [row('focused', 1, 2), row('unfocused', 2, 2)].join('\n');
  assert.equal(loadDefs(dirWith(agree)).get('a.unfocused').neutral, 2);
});

test('two groups may reuse one row label', () => {
  // Keys are lowercase-led dotted names; the group name is not part of the key.
  const half = (group, state, order) => `- {key: ${group.toLowerCase()}.${state}, type: int, range: [0, 4], `
    + `default: 0, neutral: 1, description: d, ui: {group: ${group}, control: slider, step: 1, `
    + `label: L${order}, order: ${order}, state: ${state}, row: Blur}}`;
  const text = [half('One', 'focused', 1), half('One', 'unfocused', 2),
    half('Two', 'focused', 3), half('Two', 'unfocused', 4)].join('\n');
  const defs = loadDefs(dirWith(text));
  assert.equal(defs.size, 4);
});

test('a matrix half may not be exempt', () => {
  const half = (state, order) => `- {key: a.${state}, type: int, range: [0, 4], default: 0, neutralize: false, `
    + `description: d, ui: {group: G, control: slider, step: 1, label: L${order}, order: ${order}, `
    + `state: ${state}, row: R}}`;
  // Both halves absent a neutral would compare equal, pass the same-neutral
  // rule, and let bulk neutral skip a pair that can diverge.
  assert.throws(() => loadDefs(dirWith([half('focused', 1), half('unfocused', 2)].join('\n'))),
    /a\.focused.*must declare a neutral/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm install && node --test test/defs.test.js`
Expected: the seven new tests FAIL (no rule rejects anything yet); the pre-existing tests in the file PASS.

- [ ] **Step 3: Implement the validator rules**

In `src/defs.js`, add the import at the top:

```js
import { validateValue } from './values.js';
```

In `validateDef`, after the existing `if (def.default === undefined) fail('default required');`:

```js
  const declaresNeutral = Object.hasOwn(def, 'neutral');
  const declaresNeutralize = Object.hasOwn(def, 'neutralize');
  if (def.ui.control === 'none') {
    if (declaresNeutral || declaresNeutralize) fail('control: none takes no neutral or neutralize');
  } else {
    if (declaresNeutral === declaresNeutralize) {
      fail('a visible def declares exactly one of neutral and neutralize');
    }
    if (declaresNeutralize && def.neutralize !== false) fail('neutralize must be false when present');
    // The default's value is checked at resolve time; nothing ever resolves a
    // neutral, so this is its only check.
    if (declaresNeutral) validateValue(def, def.neutral);
  }
```

`validateValue` throws with the key already in its message, so a failure names the def without `fail` wrapping it.

In `loadDefs`, alongside the existing `orders` and `headers` maps, add the row map and the check. Rows are keyed by group **and** label, so two groups may reuse a label:

```js
  const rows = new Map();
```

and inside the per-def loop, after the `headers` block:

```js
      if (def.ui.state !== undefined) {
        // Exemption is for single parameters. Two exempt halves would compare
        // equal on their absent neutrals and pass, and bulk neutral would then
        // leave a divergent pair standing -- the exact thing the same-neutral
        // rule exists to prevent.
        if (def.neutralize === false) {
          throw new Error(`invalid def ${def.key}: a matrix row's halves must declare a neutral`);
        }
        const id = `${def.ui.group}\u0000${def.ui.row}`;
        const twin = rows.get(id);
        if (twin === undefined) rows.set(id, def);
        else if (!isDeepStrictEqual(twin.neutral, def.neutral)) {
          throw new Error(`group ${def.ui.group} row ${def.ui.row}: ${twin.key} and ${def.key} `
            + 'declare different neutrals; a row\'s halves must neutralize alike');
        }
      }
```

with `import { isDeepStrictEqual } from 'node:util';` at the top of the file.

- [ ] **Step 4: Run the tests to verify the new ones pass and the shipped defs now fail**

Run: `node --test test/defs.test.js`
Expected: the seven new tests PASS. Every other test that loads a def with a visible control — the shipped defs via `loadDefs(defsDir())`, and this file's own fixtures — now FAILS with `a visible def declares exactly one of neutral and neutralize`. Both are expected; Steps 5 and 6 fix them in that order.

- [ ] **Step 5: Migrate the existing fixtures**

The rule applies to every def any test loads, not only the shipped ones. `test/defs.test.js` has about thirty fixture defs with a visible control and `test/rack.test.js` about twelve; each needs a `neutral:` in range for its type. Two things to watch:

- A test that asserts a *different* failure will now throw the neutral error first and pass for the wrong reason — or fail with an unexpected message. Give those fixtures a valid `neutral` so the rule under test is still what trips.
- `test/plugin-presentation.test.js` builds its params from the shipped defs, so it needs no fixture change; it must keep passing untouched.

Run `node --test test/defs.test.js test/rack.test.js test/plugin-presentation.test.js` after this step and read every failure message: each should name the rule its test is about.

- [ ] **Step 6: Add the curated values to the shipped defs**

Add a `neutral:` line to every visible def, between `default:` and `ui:`, using the values in Global Constraints. `defs/compositor.yaml` gets `neutral: 24` on `compositor.gaps`. `defs/terminal.yaml` gets `neutral: 0` on both opacity keys and nothing on `terminal.apps`. `defs/debug.yaml` is untouched (`debug.backdrop` is `control: none`).

`defs/glass.yaml` gets one exemption and one comment. Replace the `glass.focusSplit` def with:

```yaml
# The one parameter bulk neutral leaves alone: the split is panel structure, not
# a value to quiet, and a row's halves neutralize alike, so neutral is already
# symmetric with the split on.
- key: glass.focusSplit
  type: bool
  default: true
  neutralize: false
  ui: {group: Focus, control: toggle, label: Focus-state glass, order: 200, header: true}
  description: Give unfocused terminals their own glass material; off keeps one material and never resets the pane motion on focus
```

Add this comment above `glass.thickness`, so the reason a survivor survives sits with it:

```yaml
# An enabler: at thickness 0 the slab has no volume, so refraction and tint have
# nothing to act through and a neutral pane could never be explored back out of.
```

and the equivalent above `glass.attenuationDistance` ("at the 65535 ceiling tint absorbs nothing; at the floor of 1 it goes black at once") and `glass.distortionScale` ("at either end of its log range distortion reads as a slow warp or as noise").

- [ ] **Step 7: Run the whole suite**

Run: `just test`
Expected: PASS.

- [ ] **Step 8: Pin the curated table**

Append to `test/glass-defs.test.js`:

```js
// The curated neutral set from docs/specs/2026-09-10-reset-modes-design.md,
// Section 2. This table is the design: a change here should be a change there.
const NEUTRAL = {
  'glass.enabled': true,
  'compositor.gaps': 24,
  'glass.paneLip': 0, 'glass.paneShiftX': 0, 'glass.paneShiftY': 0,
  'glass.jellyFlex': 0, 'glass.jellyRipple': 0,
  'glass.backdropBlur': false, 'glass.inactive.backdropBlur': false,
  'glass.roughness': 0, 'glass.inactive.roughness': 0,
  'glass.attenuationColor': '#ffffff', 'glass.inactive.attenuationColor': '#ffffff',
  'glass.attenuationDistance': 60, 'glass.inactive.attenuationDistance': 60,
  'glass.ior': 1, 'glass.inactive.ior': 1,
  'glass.thickness': 20, 'glass.inactive.thickness': 20,
  'glass.chromaticAberration': 0, 'glass.inactive.chromaticAberration': 0,
  'glass.distortion': 0, 'glass.inactive.distortion': 0,
  'glass.distortionScale': 0.5, 'glass.inactive.distortionScale': 0.5,
  'glass.anisotropicBlur': 0, 'glass.inactive.anisotropicBlur': 0,
  'glass.noise': 0, 'glass.inactive.noise': 0,
  'glass.noiseType': 'fine',
  'glass.saturation': 1, 'glass.inactive.saturation': 1,
  'glass.bypass.backdrop': false, 'glass.bypass.distortion': false,
  'glass.bypass.refraction': false, 'glass.bypass.fringing': false,
  'glass.bypass.directionalBlur': false, 'glass.bypass.tint': false,
  'glass.bypass.saturation': false, 'glass.bypass.noise': false,
  'terminal.background.opacity.active': 0, 'terminal.background.opacity.inactive': 0,
};

test('every visible parameter neutralizes to its curated value', () => {
  const defs = loadDefs(defsDir());
  for (const [key, neutral] of Object.entries(NEUTRAL)) {
    assert.deepEqual(defs.get(key).neutral, neutral, key);
  }
  // Exactly one exemption, and the table covers everything else that is visible.
  const exempt = [...defs.values()].filter((def) => def.neutralize === false).map((def) => def.key);
  assert.deepEqual(exempt, ['glass.focusSplit']);
  const visible = [...defs.values()].filter((def) => def.ui.control !== 'none' && def.neutralize !== false);
  assert.deepEqual(visible.map((def) => def.key).sort(), Object.keys(NEUTRAL).sort());
});

test('neutral saturation and refraction are identities, not zeroes', () => {
  const defs = loadDefs(defsDir());
  // The reason the field is explicit rather than derived: zero is a strong
  // effect for one of these and out of range for the other.
  assert.equal(defs.get('glass.saturation').neutral, 1);
  assert.equal(defs.get('glass.ior').neutral, 1);
  assert.equal(defs.get('glass.ior').range[0], 1);
});
```

- [ ] **Step 9: Cross-check the sink's dry table**

Append to `test/niri-render.test.js`. Import `DRY` from `../integrations/niri/render.js` if the file does not already; the module exports it.

```js
test('the sink dry values agree with the defs neutrals', () => {
  const defs = loadDefs(defsDir());
  // DRY names optics without a prefix and applies them to both materials, so
  // each entry is checked against the focused key and its inactive twin.
  for (const overrides of Object.values(DRY)) {
    for (const [optic, value] of Object.entries(overrides)) {
      for (const key of [`glass.${optic}`, `glass.inactive.${optic}`]) {
        assert.deepEqual(defs.get(key).neutral, value, key);
      }
    }
  }
  // The enablers are deliberately absent from DRY: a bypassed device says
  // nothing about the depth or distance the next one needs.
  const named = new Set(Object.values(DRY).flatMap((o) => Object.keys(o)));
  for (const optic of ['thickness', 'attenuationDistance', 'distortionScale']) {
    assert.equal(named.has(optic), false, optic);
  }
});
```

- [ ] **Step 10: Run the suite and commit**

Run: `just test`
Expected: PASS.

```bash
git add src/defs.js defs/ test/defs.test.js test/rack.test.js test/glass-defs.test.js test/niri-render.test.js
git commit -m "feat(defs): give every visible parameter a neutral value

A visible def now declares exactly one of neutral: <value> or
neutralize: false, validated at load with the same validateValue the
store uses -- nothing ever resolves a neutral, so this is its only
check. Both halves of a matrix row must declare the same neutral, which
makes a neutral pane symmetric by construction; rows are keyed by
(group, row) so two groups may reuse a label.

Neutral is a value rather than a derived rule because it is not zero
often enough to matter: saturation neutralizes to 1 because 0 is
greyscale, refraction to 1 because 0 is out of range, tint to white
because white absorbs nothing."
```

---

### Task 2: `describe` carries `neutral`, `neutralize`, and `heldInTarget`

**Files:**
- Modify: `src/layers.js:60-81` (`loadStore`)
- Modify: `src/cli.js:139-180` (`describe`)
- Modify: `test/cli.test.js`
- Modify: `integrations/noctalia-plugin/contract.test.mjs`

**Interfaces:**
- Consumes: `def.neutral` / `def.neutralize` from Task 1.
- Produces: `loadStore(defs)` returns an added `heldInTarget` — an object keyed by param key, `true` when the write-target layer's own values hold that key. `describe --json` emits `neutral`, `neutralize`, and `heldInTarget` per parameter.

- [ ] **Step 1: Write the failing tests**

Append to `test/cli.test.js`:

```js
test('describe carries the neutral contract and target ownership', async () => {
  let out = '';
  await cli.run(['set', '--base', 'glass.paneLip', '9'], { runner: () => {} });
  const code = await cli.run(['describe', '--json'], { print: (t) => { out += t; }, runner: () => {} });
  assert.equal(code, 0);
  const model = JSON.parse(out);
  const byKey = Object.fromEntries(model.params.map((param) => [param.key, param]));

  assert.equal(byKey['glass.paneLip'].neutral, 0);
  assert.equal(byKey['glass.paneLip'].neutralize, undefined);
  assert.equal(byKey['glass.focusSplit'].neutralize, false);
  assert.equal(byKey['glass.focusSplit'].neutral, undefined);
  assert.equal(byKey['terminal.apps'].neutral, undefined);

  assert.equal(byKey['glass.paneLip'].heldInTarget, true);
  assert.equal(byKey['glass.paneShiftX'].heldInTarget, false);
});

test('a base override hidden by a wallpaper is still held in the target', async () => {
  await cli.run(['set', '--base', 'glass.paneLip', '9'], { runner: () => {} });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.paneLip': 30 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png', pinned: false } });

  let out = '';
  await cli.run(['describe', '--json'], { print: (t) => { out += t; }, runner: () => {} });
  const param = JSON.parse(out).params.find((p) => p.key === 'glass.paneLip');
  // The value comes from the wallpaper, so the row is shadowed; but base -- the
  // write target -- does hold the key, so there is something there to reset.
  assert.equal(param.layer, 'wallpaper');
  assert.equal(param.value, 30);
  assert.equal(param.heldInTarget, true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/cli.test.js`
Expected: FAIL — `undefined !== 0` on `neutral`, then `undefined !== true` on `heldInTarget`.

- [ ] **Step 3: Expose target ownership from the store**

In `src/layers.js`, inside `loadStore`, after `const target = writeTarget(active);`:

```js
  // What the target layer itself holds, which is not the same question as where
  // a value comes from: a base override hidden by a wallpaper answers no to the
  // second and yes to this one, and it is this one a reset acts on.
  const heldValues = target.kind === 'base'
    ? base
    : layers.find((layer) => layer.kind === target.kind && layer.name === target.name).values;
  const heldInTarget = {};
```

and inside the existing `for (const key of Object.keys(params))` loop, beside the `fallback` assignment:

```js
    heldInTarget[key] = Object.hasOwn(heldValues, key);
```

Add `heldInTarget` to the returned object.

- [ ] **Step 4: Emit the three fields**

In `src/cli.js`, in the `describe` case, add to the object pushed into `described`, beside `default`:

```js
            neutral: def.neutral,
            neutralize: def.neutralize,
            heldInTarget: store.heldInTarget[key],
```

`JSON.stringify` drops an `undefined` field, so an exempt def emits `neutralize: false` and no `neutral`, and a visible def emits `neutral` and no `neutralize` — which is exactly what the panel validates.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/cli.test.js`
Expected: PASS.

- [ ] **Step 6: Assert the contract against the real payload**

In `integrations/noctalia-plugin/contract.test.mjs`, find the assertions over the parsed `describe` output and add:

```js
for (const param of model.params) {
  assert.equal(typeof param.heldInTarget, 'boolean', `${param.key} heldInTarget`);
  if (param.ui.control === 'none') continue;
  const declares = (param.neutral !== undefined) !== (param.neutralize !== undefined);
  assert.ok(declares, `${param.key} declares exactly one of neutral and neutralize`);
}
```

- [ ] **Step 7: Run the suite and commit**

Run: `just test`
Expected: PASS.

```bash
git add src/layers.js src/cli.js test/cli.test.js integrations/noctalia-plugin/contract.test.mjs
git commit -m "feat(describe): carry neutral, neutralize, and target ownership

heldInTarget answers a question layer == target cannot: a base override
hidden by a wallpaper does not supply the visible value, but the write
target does hold the key, so a reset has something to remove. The panel
counts against it in the next commit."
```

---

### Task 3: `prism reset`

**Files:**
- Create: `src/reset.js`
- Create: `test/reset.test.js`
- Modify: `src/cli.js` (a new `case 'reset'`, and the usage line at the `default` branch)
- Modify: `test/cli.test.js`

**Interfaces:**
- Consumes: `def.neutral` / `def.neutralize` (Task 1); `loadStore`'s `base`, `layers`, `target`, `params` (existing).
- Produces:
  - `MODES` — `['defaults', 'symmetric', 'neutral']`.
  - `visibleGroups(defs)` → `Set<string>` of `ui.group` names having at least one visible def.
  - `planReset({ defs, mode, group, held, effective, normalizeToDefault })` → `{ values, changedKeys }`. `group` is `null` for panel-wide. `held` is the target layer's current values object (not mutated). `effective` is the map a skip rule compares against and symmetric copies from. `normalizeToDefault` is true when the target is base. Throws when a symmetric copy fails the unfocused def's validation.

- [ ] **Step 1: Write the failing planner tests**

Create `test/reset.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDefs } from '../src/defs.js';
import { planReset, visibleGroups } from '../src/reset.js';

const YAML = `
- {key: a.lip, type: int, range: [0, 64], default: 6, neutral: 0, description: d,
   ui: {group: Glass, control: slider, step: 1, label: Lip, order: 1}}
- {key: a.split, type: bool, default: true, neutralize: false, description: d,
   ui: {group: Focus, control: toggle, label: Split, order: 2, header: true}}
- {key: a.blur, type: float, range: [0, 1], default: 0.08, neutral: 0, description: d,
   ui: {group: Focus, control: slider, step: 0.01, label: Blur, order: 3, state: focused, row: Blur}}
- {key: a.blur.off, type: float, range: [0, 1], default: 0.5, neutral: 0, description: d,
   ui: {group: Focus, control: slider, step: 0.01, label: Unfocused blur, order: 4, state: unfocused, row: Blur}}
- {key: a.opacity, type: float, range: [0, 1], default: 0, neutral: 0, description: d,
   ui: {group: Terminal, control: slider, step: 0.01, label: Opacity, order: 5}}
- {key: a.hidden, type: bool, default: false, description: d, ui: {group: Hidden, control: none}}
`;

function defs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-reset-'));
  fs.writeFileSync(path.join(dir, 'a.yaml'), YAML);
  return loadDefs(dir);
}

const plan = (over) => planReset({
  defs: defs(), mode: 'neutral', group: null, held: {}, effective: {},
  normalizeToDefault: false, ...over,
});

test('visibleGroups skips a group with no visible parameter', () => {
  assert.deepEqual([...visibleGroups(defs())].sort(), ['Focus', 'Glass', 'Terminal']);
});

test('defaults removes every scoped key the target holds, shadowed or not', () => {
  const held = { 'a.lip': 9, 'a.blur': 0.4 };
  const out = plan({ mode: 'defaults', held, effective: { 'a.lip': 30, 'a.blur': 0.4 } });
  assert.deepEqual(out.values, {});
  assert.deepEqual(out.changedKeys.sort(), ['a.blur', 'a.lip']);
  assert.deepEqual(held, { 'a.lip': 9, 'a.blur': 0.4 }, 'held is not mutated');
});

test('defaults honours the group scope', () => {
  const out = plan({ mode: 'defaults', group: 'Glass', held: { 'a.lip': 9, 'a.blur': 0.4 } });
  assert.deepEqual(out.values, { 'a.blur': 0.4 });
  assert.deepEqual(out.changedKeys, ['a.lip']);
});

test('neutral writes each eligible key and skips the exempt one', () => {
  const effective = { 'a.lip': 6, 'a.split': true, 'a.blur': 0.08, 'a.blur.off': 0.5, 'a.opacity': 0.3 };
  const out = plan({ effective });
  assert.deepEqual(out.values, { 'a.lip': 0, 'a.blur': 0, 'a.blur.off': 0, 'a.opacity': 0 });
  assert.equal('a.split' in out.values, false);
});

test('neutral skips a key already at its neutral', () => {
  const effective = { 'a.lip': 0, 'a.blur': 0.08, 'a.blur.off': 0.5 };
  const out = plan({ effective });
  assert.equal('a.lip' in out.values, false);
});

test('symmetric mirrors focused onto unfocused and leaves singles alone', () => {
  const effective = { 'a.lip': 6, 'a.blur': 0.08, 'a.blur.off': 0.5 };
  const out = plan({ mode: 'symmetric', effective });
  assert.deepEqual(out.values, { 'a.blur.off': 0.08 });
});

test('symmetric skips a pair already equal', () => {
  const effective = { 'a.blur': 0.08, 'a.blur.off': 0.08 };
  const out = plan({ mode: 'symmetric', effective });
  assert.deepEqual(out.changedKeys, []);
});

test('a rejected copy leaves no partial batch behind', () => {
  // Nothing forces a row's halves to share a range, so a copy can overflow.
  // Two rows, in file order: Blur copies cleanly, then Tint overflows its
  // twin's narrower range. The clean copy must not survive the rejection.
  // Tint's default stays inside its narrowed range, or the def would fail to
  // resolve and the throw would come from the wrong place.
  const twoRows = `${YAML}
- {key: a.tint, type: float, range: [0, 1], default: 0, neutral: 0, description: d,
   ui: {group: Focus, control: slider, step: 0.01, label: Tint, order: 6, state: focused, row: Tint}}
- {key: a.tint.off, type: float, range: [0, 0.2], default: 0.1, neutral: 0, description: d,
   ui: {group: Focus, control: slider, step: 0.01, label: Unfocused tint, order: 7, state: unfocused, row: Tint}}
`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-reset-'));
  fs.writeFileSync(path.join(dir, 'a.yaml'), twoRows);
  const held = { 'a.lip': 9 };
  assert.throws(() => planReset({
    defs: loadDefs(dir), mode: 'symmetric', group: 'Focus', held,
    effective: { 'a.blur': 0.9, 'a.blur.off': 0.1, 'a.tint': 0.9, 'a.tint.off': 0.1 },
    normalizeToDefault: false,
  }), /a\.tint\.off/);
  // The caller's map is untouched: planReset works on a copy and the copy is
  // discarded with the throw, so a.blur.off's successful copy goes with it.
  assert.deepEqual(held, { 'a.lip': 9 });
});

test('a selected key can still be no change at all', () => {
  // The trap the contents check exists for. a.opacity neutralizes to 0, which
  // is also its default: an overlay supplies 0.5, base holds nothing, the skip
  // rule selects the key, and the base rule then deletes one that was never
  // there. Selection is not change.
  const out = planReset({
    defs: defs(), mode: 'neutral', group: 'Terminal', held: {},
    effective: { 'a.opacity': 0.5 }, normalizeToDefault: true,
  });
  assert.deepEqual(out.values, {});
  assert.deepEqual(out.changedKeys, []);
});

test('a write away from the def default is stored at base', () => {
  // The other half of the same rule: a.lip neutralizes to 0 against a default
  // of 6, so base holds it.
  const out = planReset({
    defs: defs(), mode: 'neutral', group: 'Glass', held: {},
    effective: { 'a.lip': 6 }, normalizeToDefault: true,
  });
  assert.deepEqual(out.values, { 'a.lip': 0 });
  assert.deepEqual(out.changedKeys, ['a.lip']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/reset.test.js`
Expected: FAIL with `Cannot find module '../src/reset.js'`.

- [ ] **Step 3: Write the planner**

Create `src/reset.js`:

```js
import { isDeepStrictEqual } from 'node:util';
import { validateValue } from './values.js';

export const MODES = ['defaults', 'symmetric', 'neutral'];

const isVisible = (def) => def.ui.control !== 'none';

export function visibleGroups(defs) {
  const groups = new Set();
  for (const def of defs.values()) if (isVisible(def)) groups.add(def.ui.group);
  return groups;
}

function scopeOf(defs, group) {
  const scoped = [...defs.values()].filter(isVisible);
  return group === null ? scoped : scoped.filter((def) => def.ui.group === group);
}

// Matrix rows in the scope, keyed by group and label: two groups may reuse a
// label, and a row with only one half in scope is not a pair.
function pairsOf(scoped) {
  const rows = new Map();
  for (const def of scoped) {
    if (def.ui.state === undefined) continue;
    const id = `${def.ui.group}\u0000${def.ui.row}`;
    const row = rows.get(id) ?? {};
    row[def.ui.state] = def;
    rows.set(id, row);
  }
  return [...rows.values()].filter((row) => row.focused !== undefined && row.unfocused !== undefined);
}

// The whole mutation, computed against one snapshot and never applied in
// pieces. `changedKeys` is empty when the target layer would come out with the
// contents it already has -- which is not the same as "no key was selected",
// because a value equal to the def default becomes a deletion at base and the
// key may not have been there to delete.
export function planReset({ defs, mode, group, held, effective, normalizeToDefault }) {
  const scoped = scopeOf(defs, group);
  const values = { ...held };

  const put = (def, value) => {
    validateValue(def, value);
    if (normalizeToDefault && isDeepStrictEqual(value, def.default)) delete values[def.key];
    else values[def.key] = value;
  };

  if (mode === 'defaults') {
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/reset.test.js`
Expected: PASS.

- [ ] **Step 5: Commit the planner**

```bash
git add src/reset.js test/reset.test.js
git commit -m "feat(reset): plan a whole reset mutation from one snapshot

Three modes over one scope, returning the target layer's proposed
contents and the keys that actually change. A skip rule selecting a key
is not the same as a change: at base a value equal to the def default
becomes a deletion, and the key may never have been there. Symmetric
validates each copy against the unfocused def, because nothing forces a
row's halves to share a range."
```

- [ ] **Step 6: Write the failing CLI tests**

`values.yaml` is YAML, not JSON. Add the store's own reader beside the other dynamic imports at the top of `test/cli.test.js`:

```js
const { readValues } = await import('../src/values.js');
```

Then append:

```js
test('reset neutral writes the curated values once and fans out once', async () => {
  const calls = [];
  await cli.run(['set', '--base', 'glass.paneLip', '30'], { runner: () => {} });
  const code = await cli.run(['reset', 'neutral', '--group', 'Glass'],
    { runner: (m, f, keys) => calls.push([m.sink, keys]) });
  assert.equal(code, 0);
  const values = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params;
  assert.equal(values['glass.paneLip'], 0);
  assert.equal(values['glass.jellyRipple'], 0);
  assert.equal(values['compositor.gaps'], 24);
  // gensink binds glass.paneLip; each affected sink is called at most once.
  assert.deepEqual(calls.map(([sink]) => sink), ['gensink']);
  assert.equal(calls[0][1].includes('glass.paneLip'), true);
});

test('reset neutral leaves the exempt parameter alone', async () => {
  await cli.run(['set', '--base', 'glass.focusSplit', 'false'], { runner: () => {} });
  await cli.run(['reset', 'neutral'], { runner: () => {} });
  assert.equal(readValues()['glass.focusSplit'], false);
});

test('reset symmetric mirrors focused onto unfocused', async () => {
  await cli.run(['set', '--base', 'glass.roughness', '0.3'], { runner: () => {} });
  await cli.run(['reset', 'symmetric', '--group', 'Focus'], { runner: () => {} });
  const values = JSON.parse(fs.readFileSync(resolvedPath(), 'utf8')).params;
  assert.equal(values['glass.inactive.roughness'], 0.3);
  assert.equal(values['glass.roughness'], 0.3);
});

test('symmetric copies what is on screen, or the base value under --base', async () => {
  await cli.run(['set', '--base', 'glass.roughness', '0.3'], { runner: () => {} });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.roughness': 0.7 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png', pinned: false } });

  // Unpinned, so the target is still base -- but the source differs.
  await cli.run(['reset', 'symmetric', '--group', 'Focus'], { runner: () => {} });
  assert.equal(readValues()['glass.inactive.roughness'], 0.7, 'mirrors the resolved value');

  await cli.run(['reset', 'symmetric', '--base', '--group', 'Focus'], { runner: () => {} });
  assert.equal(readValues()['glass.inactive.roughness'], 0.3, 'mirrors the base value alone');
});

test('reset defaults removes a base override hidden by a wallpaper', async () => {
  await cli.run(['set', '--base', 'glass.paneLip', '9'], { runner: () => {} });
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.paneLip': 30 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png', pinned: false } });
  await cli.run(['reset', 'defaults', '--group', 'Glass'], { runner: () => {} });
  assert.equal('glass.paneLip' in readValues(), false);
});

test('reset defaults deletes a pinned wallpaper context it empties', async () => {
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.paneLip': 30 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png', pinned: true } });
  await cli.run(['reset', 'defaults', '--group', 'Glass'], { runner: () => {} });
  // Same rule unset follows: an emptied wallpaper context is not left behind.
  assert.equal(readContext('wallpaper', 'w1'), null);
  assert.equal(fs.existsSync(contextPath('wallpaper', 'w1')), false);
});

test('a reset that changes no contents writes nothing and calls no sink', async () => {
  // The trap: the wallpaper supplies 0.5, base holds nothing, and the neutral
  // is the def default. The skip rule selects the key; the base rule then
  // deletes one that was never there.
  writeContext('wallpaper', 'w1', {
    source: '/w.png',
    values: { 'terminal.background.opacity.inactive': 0.5 },
  });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png', pinned: false } });
  fs.rmSync(resolvedPath(), { force: true });

  const calls = [];
  const code = await cli.run(['reset', 'neutral', '--group', 'Terminal'],
    { runner: (m) => calls.push(m.sink) });
  assert.equal(code, 0);
  assert.deepEqual(calls, []);
  assert.equal(fs.existsSync(resolvedPath()), false, 'resolved.json is not rewritten');
  assert.equal('terminal.background.opacity.inactive' in readValues(), false);
});

test('reset refuses a store it cannot resolve, and writes nothing', async () => {
  fs.writeFileSync(valuesPath(), 'glass.ior: 99\n');   // out of range
  const before = fs.readFileSync(valuesPath(), 'utf8');
  const calls = [];
  const out = await runCaptured(['reset', 'neutral'], { runner: (m) => calls.push(m.sink) });
  assert.equal(out.code, 1);
  assert.match(out.stderr, /glass\.ior/);
  // The whole mutation is computed before anything is written, so a refusal
  // leaves no partial batch behind.
  assert.equal(fs.readFileSync(valuesPath(), 'utf8'), before);
  assert.deepEqual(calls, []);
});

test('reset rejects an unknown group and a bad mode', async () => {
  const bad = await runCaptured(['reset', 'neutral', '--group', 'Nope'], { runner: () => {} });
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /unknown group Nope/);
  assert.match(bad.stderr, /Focus/);

  const mode = await runCaptured(['reset', 'sideways'], { runner: () => {} });
  assert.equal(mode.code, 1);
  assert.match(mode.stderr, /usage: prism reset/);
});

test('reset --base writes beneath an overlay', async () => {
  writeContext('wallpaper', 'w1', { source: '/w.png', values: { 'glass.paneLip': 0 } });
  writeActive({ wallpaper: { id: 'w1', path: '/w.png', pinned: false } });
  await cli.run(['set', '--base', 'glass.paneLip', '30'], { runner: () => {} });
  // The overlay already sits at the neutral; --base must still act on base.
  await cli.run(['reset', 'neutral', '--base', '--group', 'Glass'], { runner: () => {} });
  // paneLip neutralizes to 0 against a default of 6, so base holds 0 rather
  // than losing the key.
  assert.equal(readValues()['glass.paneLip'], 0);
});
```

**A coverage limit, stated rather than implied.** The two refusals sit at different points in the sequence, and only one has a CLI test:

- `reset refuses a store it cannot resolve` fails while `loadStore` reads the snapshot, *before* the mutation is computed. That is what the CLI test above exercises.
- A rejection *during* batch construction — a symmetric copy that overflows its twin's range — cannot be provoked end to end, because every shipped matrix row's halves share a range. Only `test/reset.test.js` covers it, against a fixture, including that the caller's `held` map survives untouched.

Nothing here tests a rejection after a partial write, because the code has no such point: the write follows the plan.

- [ ] **Step 7: Run to verify they fail**

Run: `node --test test/cli.test.js`
Expected: FAIL — `prism reset` is not a verb, so `cli.run` hits the `default` branch and returns 2.

- [ ] **Step 8: Wire the verb**

In `src/cli.js`, add the imports:

```js
import { MODES, planReset, visibleGroups } from './reset.js';
import { resolveLayered } from './resolve.js';
```

(`resolveLayered` joins the existing `./resolve.js` import line.) Add the case after `unset`:

```js
      case 'reset': {
        const usage = 'usage: prism reset defaults|symmetric|neutral [--base] [--group <name>]';
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
          const target = toBase ? { kind: 'base', name: null } : store.target;
          const held = target.kind === 'base'
            ? store.base
            : store.layers.find((layer) => layer.kind === target.kind && layer.name === target.name).values;
          // --base compares against, and copies from, the base layer alone: an
          // overlay that happens to sit at the neutral must not block a base
          // change the user asked for by name.
          const effective = toBase ? resolveLayered(defs, store.base, []).params : store.params;
          const plan = planReset({
            defs, mode, group, held, effective, normalizeToDefault: target.kind === 'base',
          });
          changedKeys = plan.changedKeys;
          if (changedKeys.length === 0) return;
          if (target.kind === 'base') writeValues(plan.values);
          else if (target.kind === 'wallpaper' && Object.keys(plan.values).length === 0) {
            deleteContext(target.kind, target.name);
          } else {
            writeContext(target.kind, target.name, {
              source: contextSource(store.active, target),
              values: plan.values,
            });
          }
          resolved = writeResolved(loadStore(defs).params);
        });

        if (changedKeys.length === 0) return 0;
        return report(await fanOut({ manifests, resolved, changedKeys, runner: opts.runner }), eprint);
      }
```

Update the `default` branch's usage line:

```js
        eprint('usage: prism set|unset|get|list|describe|apply|doctor|context|reset\n');
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `node --test test/cli.test.js test/reset.test.js`
Expected: PASS. If `reset --base writes beneath an overlay` fails, read its assertion message: `glass.paneLip` neutralizes to `0` while its default is `6`, so base must *hold* `0` rather than have the key removed. Correct the assertion to `assert.equal(JSON.parse(...)['glass.paneLip'], 0)` — the fixture, not the implementation, is what needs to agree with the shipped defaults.

- [ ] **Step 10: Run the suite and commit**

Run: `just test`
Expected: PASS.

```bash
git add src/cli.js test/cli.test.js
git commit -m "feat(cli): add prism reset defaults|symmetric|neutral

One verb, one lock, one resolve, one fan-out. The section reset the
panel issues today is one unset per overridden key -- around
twenty-five locks, resolves, and compositor reloads for the Focus rack;
this is the same result in one.

--base compares against and copies from the base layer alone, so an
overlay sitting at the neutral cannot block a base change asked for by
name."
```

---

### Task 4: The panel counts target ownership, and rows carry their group

**Files:**
- Modify: `integrations/noctalia-plugin/presentation.luau:160-205` (`M.sections`)
- Modify: `integrations/noctalia-plugin/panel.luau:120-145` (`validateModel`), `:176-186` (`markLayers`), `:277-281` (`updateParam`)
- Modify: `integrations/noctalia-plugin/plugin_test.lua`

**Interfaces:**
- Consumes: `param.heldInTarget`, `param.neutral`, `param.neutralize` from Task 2.
- Produces: `param.overridden` now means "the write target holds this key". `M.sections` keys rows on `(group, row)`.

- [ ] **Step 1: Write the failing Lua tests**

In `integrations/noctalia-plugin/plugin_test.lua`, after the existing `M.sections` golden vectors, add:

```lua
-- Two groups may reuse a row label: the defs allow it, so the panel must
-- resolve rows by group and label rather than by label alone.
local reusedLabel = {
  { key = "one.f", ui = { control = "slider", group = "One", order = 1, state = "focused", row = "Blur" } },
  { key = "one.u", ui = { control = "slider", group = "One", order = 2, state = "unfocused", row = "Blur" } },
  { key = "two.f", ui = { control = "slider", group = "Two", order = 3, state = "focused", row = "Blur" } },
  { key = "two.u", ui = { control = "slider", group = "Two", order = 4, state = "unfocused", row = "Blur" } },
}
local reused = Presentation.sections(reusedLabel)
equal(#reused, 2, "one section per group")
equal(reused[1].rows[1].focused.key, "one.f")
equal(reused[2].rows[1].focused.key, "two.f")

-- A row still needs both halves inside its own group.
local halfRow = {
  { key = "one.f", ui = { control = "slider", group = "One", order = 1, state = "focused", row = "Blur" } },
  { key = "two.u", ui = { control = "slider", group = "Two", order = 2, state = "unfocused", row = "Blur" } },
}
local ok, err = pcall(Presentation.sections, halfRow)
assert(not ok and tostring(err):find("Blur", 1, true), "a one-sided row must fail")
```

- [ ] **Step 2: Run to verify they fail**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: FAIL with `row Blur spans sections One and Two`.

- [ ] **Step 3: Update the existing spans-sections assertion**

`plugin_test.lua:180-183` asserts the message `Blur spans sections` for a fixture whose `Blur` label is split between `Focus` and `Glass`. Once rows are group-keyed that fixture builds two one-sided rows instead, and the missing-half check catches it. Keep the case — it now pins that a label split across groups never silently pairs — but **do not pin which half is named**: the validation loop iterates `rowsByName` with `pairs`, which is unordered, so either incomplete row can fail first and the message alternates between runs.

The existing `fails(candidate, pattern)` helper takes one literal substring. Add a sibling that takes several and accepts any:

```lua
local function failsAny(candidate, patterns)
  local ok, err = pcall(Presentation.sections, candidate)
  assert(not ok, "expected a failure, got none")
  for _, pattern in ipairs(patterns) do
    if tostring(err):find(pattern, 1, true) then return end
  end
  error("unexpected failure: " .. tostring(err))
end
```

and convert that one case to `failsAny({...}, {"Blur has no unfocused", "Blur has no focused"})`. Leave the other `fails` calls alone: each of those has exactly one incomplete row, so its message is deterministic.

- [ ] **Step 4: Key rows on group and label**

In `presentation.luau`, in `M.sections`, replace the row bookkeeping. The `spans sections` error and the `row.section` field both go: with a group in the key, a row can no longer be reached from two groups, and a label split across groups now yields two rows, each of which trips the existing "has no focused/unfocused parameter" check.

```lua
    if param.ui.state ~= nil then
      local id = param.ui.group .. "\0" .. param.ui.row
      local row = rowsByName[id]
      if not row then
        row = { row = param.ui.row }
        rowsByName[id] = row
        section.rows[#section.rows + 1] = row
      end
      if row[param.ui.state] ~= nil then
        error("row " .. param.ui.row .. " has two " .. param.ui.state .. " parameters")
      end
      row[param.ui.state] = param
```

and drop the `row.section = nil` line from the trailing validation loop, which now reads:

```lua
  for _, row in pairs(rowsByName) do
    for _, state in ipairs({ "focused", "unfocused" }) do
      if row[state] == nil then error("row " .. row.row .. " has no " .. state .. " parameter") end
    end
  end
```

- [ ] **Step 5: Run to verify they pass**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: PASS, including the retitled spans-sections case.

- [ ] **Step 6: Teach both panel harnesses the new fields, and write the failing ownership test**

`validateModel` is about to require `heldInTarget` on every parameter and exactly one of `neutral` / `neutralize` on every visible one. Two fixture models must gain them or every render test fails on the banner instead of on the behaviour under test:

- `integrations/noctalia-plugin/plugin_test.lua`, the model at roughly lines 195-278 (groups `Title`, `Glass`, `Focus`, `Terminal`);
- `test/plugin-panel-lifecycle.test.js`, the `newHost()` model inside each `String.raw` script.

Give every visible param a `neutral` matching its type (`0` for a slider, `false` for a toggle, the first option for a select, `"#ffffff"` for a color), except the Focus header toggle, which gets `neutralize = false`.

**`heldInTarget` is not uniformly false.** These fixtures already encode which rows are overridden, through `layer == target`; blanket-falsing the new field would silently change what they assert. For each param, set `heldInTarget = (param.layer == model.target)` — the value that reproduces today's meaning — and only then add the new case: pick one param whose `layer` ranks *above* `target` and set its `heldInTarget = true`, so the fixture carries a held-but-shadowed row that no fixture had before. Then assert:

Assert on the chosen parameter by key, not on "some button somewhere": an unrelated held row would satisfy a loose search while the ownership bug survived. `controlCell` sets `key = param.key` on the cell row, and the harness already has a `byKey` helper.

```lua
-- Overridden means "the target holds this key", not "the value comes from
-- there": a base override under a wallpaper is both shadowed and resettable.
-- Name the row the fixture made held-but-shadowed; any other row passing this
-- would hide the bug rather than catch it.
local shadowedKey = "<the key you gave heldInTarget = true>"
local cell = byKey(rendered, shadowedKey)[1]
assert(cell ~= nil, "the held-but-shadowed cell must render")
local reset = nil
for _, button in ipairs(collect(cell, "button")) do
  if button.props.glyph == "restore" then reset = button end
end
assert(reset ~= nil, shadowedKey .. " must carry a reset")
equal(reset.props.tooltip, "Remove override")
equal(reset.props.opacity, 1.0, "a held override resets at full strength even under a shadow")
reset.props.onClick()
equal(commands[#commands], Shell.command({"prism", "unset", shadowedKey}))
```

The existing assertion `exactly the base-overridden roughness row offers a full-strength reset` counts one; the new fixture makes it two. Update the count and say which two, rather than loosening the assertion.

- [ ] **Step 7: Run to verify it fails**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: FAIL — the shadowed row's reset is dim and reads `No override to remove`.

- [ ] **Step 8: Count ownership**

In `panel.luau`, `markLayers`:

```lua
    param.overridden = visible and param.heldInTarget == true
```

and `updateParam` loses its guard — a write under a shadow does land in the target, so the target does now hold the key:

```lua
local function updateParam(param, value)
  param.value = value
  param.overridden = true
end
```

In `validateModel`'s per-parameter loop (`visibleParamError`), add:

```lua
  if type(param.heldInTarget) ~= "boolean" then return param.key .. " has no target ownership" end
  if param.ui.control ~= "none" then
    if (param.neutral ~= nil) == (param.neutralize ~= nil) then
      return param.key .. " must declare exactly one of neutral and neutralize"
    end
  end
```

Note `visibleParamError` is only called for visible params in the existing code; keep the `control ~= "none"` guard anyway so the function stays true standalone.

- [ ] **Step 9: Run to verify it passes**

Run: `lua integrations/noctalia-plugin/plugin_test.lua && just test`
Expected: PASS. The Node contract test from Task 2 now exercises the new `validateModel` checks against real `describe` output.

- [ ] **Step 10: Commit**

```bash
git add integrations/noctalia-plugin/presentation.luau integrations/noctalia-plugin/panel.luau \
  integrations/noctalia-plugin/plugin_test.lua test/plugin-panel-lifecycle.test.js
git commit -m "fix(panel): count overrides by target ownership, not by source layer

A base override hidden by a wallpaper was neither counted by the
section reset nor offered a live row reset, though the target held it
and prism unset would remove it. heldInTarget answers the right
question, and updateParam's shadow guard goes with it: a write under a
shadow does land in the target.

Rows are keyed by group and label, matching the defs, so two sections
may reuse a label. The spans-sections error is unreachable once they
are and the missing-half error already covers what it guarded."
```

---

### Task 5: The three buttons, the panel-wide row, and the queue verb

**Files:**
- Modify: `integrations/noctalia-plugin/presentation.luau` (append `M.pairsOf`, `M.symmetricCount`, `M.neutralCount`, `M.visibleParams`)
- Modify: `integrations/noctalia-plugin/queue.luau:9-20,53-63`
- Modify: `integrations/noctalia-plugin/panel.luau` (`sectionHeader`, `resetGroup`, a new panel-wide row, the render body)
- Modify: `integrations/noctalia-plugin/plugin_test.lua`

**Interfaces:**
- Consumes: `M.sections`, `M.sectionParams`, `M.rackParams`, `M.overriddenCount` (existing); `param.neutral`, `param.neutralize`, `param.heldInTarget` (Tasks 2 and 4).
- Produces:
  - `M.pairsOf(params)` → array of `{focused, unfocused}` in first-appearance order, keyed by `(group, row)`.
  - `M.symmetricCount(params)` → number of pairs whose two values differ.
  - `M.neutralCount(params)` → number of eligible params not at their neutral.
  - `M.visibleParams(model)` → every param with a control, for the panel-wide row.
  - `Queue.argvFor({verb = "reset", mode = ..., group = ...})` → `{"prism", "reset", mode}` plus `{"--group", group}` when `group` is set.

- [ ] **Step 1: Write the failing count and queue tests**

Append to `plugin_test.lua`:

```lua
-- The three counts and their units: restore counts keys the target holds,
-- symmetric counts differing pairs, neutral counts differing eligible keys.
-- `overriddenCount` reads `overridden`, the flag panel.luau derives from
-- `heldInTarget` in markLayers. This is the presentation module's own contract,
-- so the fixture supplies the derived flag; the mapping itself is Task 4's test.
local counted = {
  { key = "g.lip", value = 9, neutral = 0, overridden = true,
    ui = { control = "slider", group = "Glass", order = 1 } },
  { key = "f.split", value = false, neutralize = false, overridden = true,
    ui = { control = "toggle", group = "Focus", order = 2, header = true } },
  { key = "f.blur", value = 0.3, neutral = 0, overridden = false,
    ui = { control = "slider", group = "Focus", order = 3, state = "focused", row = "Blur" } },
  { key = "f.blur.off", value = 0.5, neutral = 0, overridden = false,
    ui = { control = "slider", group = "Focus", order = 4, state = "unfocused", row = "Blur" } },
  { key = "f.sat", value = 1, neutral = 1, overridden = false,
    ui = { control = "slider", group = "Focus", order = 5, state = "focused", row = "Sat" } },
  { key = "f.sat.off", value = 1, neutral = 1, overridden = false,
    ui = { control = "slider", group = "Focus", order = 6, state = "unfocused", row = "Sat" } },
}
equal(#Presentation.pairsOf(counted), 2, "two matrix rows")
equal(Presentation.symmetricCount(counted), 1, "only Blur differs; Sat already matches")
equal(Presentation.neutralCount(counted), 3, "lip, blur, blur.off; split is exempt and sat is at neutral")
equal(Presentation.overriddenCount(counted), 2, "two keys held in the target")

equal(Presentation.neutralCount({ counted[2] }), 0, "an exempt parameter never counts")

-- One click, one command.
equal(Queue.argvFor({ verb = "reset", mode = "neutral" }), { "prism", "reset", "neutral" })
equal(Queue.argvFor({ verb = "reset", mode = "defaults", group = "Focus" }),
  { "prism", "reset", "defaults", "--group", "Focus" })
assert(Queue.affectsParams({ verb = "reset", mode = "neutral" }), "a reset moves the model")
```

- [ ] **Step 2: Run to verify they fail**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: FAIL — `attempt to call a nil value (field 'pairsOf')`.

- [ ] **Step 3: Add the counts**

Append to `presentation.luau`, before `return M`:

```lua
-- Matrix rows in a parameter list, keyed by group and label because two
-- sections may reuse a label. A row with one half is not a pair.
function M.pairsOf(params)
  local rows, order = {}, {}
  for _, param in ipairs(params) do
    if param.ui.control ~= "none" and param.ui.state ~= nil then
      local id = param.ui.group .. "\0" .. param.ui.row
      local row = rows[id]
      if row == nil then
        row = {}
        rows[id] = row
        order[#order + 1] = id
      end
      row[param.ui.state] = param
    end
  end
  local list = {}
  for _, id in ipairs(order) do
    local row = rows[id]
    if row.focused ~= nil and row.unfocused ~= nil then list[#list + 1] = row end
  end
  return list
end

function M.symmetricCount(params)
  local count = 0
  for _, row in ipairs(M.pairsOf(params)) do
    if row.focused.value ~= row.unfocused.value then count = count + 1 end
  end
  return count
end

-- Eligible means visible and not exempt. The exempt parameter is the focus
-- split: it is panel structure, not a value to quiet.
function M.neutralCount(params)
  local count = 0
  for _, param in ipairs(params) do
    if param.ui.control ~= "none" and param.neutralize ~= false and param.value ~= param.neutral then
      count = count + 1
    end
  end
  return count
end

function M.visibleParams(model)
  local list = {}
  for _, param in ipairs(model.params) do
    if param.ui.control ~= "none" then list[#list + 1] = param end
  end
  return list
end
```

- [ ] **Step 4: Add the queue verb**

In `queue.luau`, add `reset = true` to the `staleAfter` table, and in `M.argvFor`, before the final `error`:

```lua
  if item.verb == "reset" then
    local argv = { "prism", "reset", item.mode }
    if item.group ~= nil then
      argv[#argv + 1] = "--group"
      argv[#argv + 1] = item.group
    end
    return argv
  end
```

- [ ] **Step 5: Run to verify they pass**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: PASS.

- [ ] **Step 6: Write the failing button tests**

Append to the panel-render block of `plugin_test.lua`:

```lua
local function buttonsByGlyph(tree, glyph)
  local found = {}
  for _, node in ipairs(collect(tree, "button")) do
    if node.props.glyph == glyph then found[#found + 1] = node end
  end
  return found
end

-- One set per section plus one panel-wide. This harness draws three section
-- headers -- Glass, the Focus rack, and Terminal -- and Title is not a section.
-- Glass holds one plain slider and no matrix row, so it draws no mirror.
equal(#buttonsByGlyph(rendered, "baseline"), 4, "three sections and the panel-wide row")
equal(#buttonsByGlyph(rendered, "equal"), 3, "Focus, Terminal, and panel-wide; not Glass")

local panelWide = buttonsByGlyph(rendered, "baseline")[1]
assert(panelWide.props.tooltip:find("everything", 1, true), "the panel-wide tooltip names its scope")
panelWide.props.onClick()
equal(commands[#commands], "prism reset neutral", "the panel-wide neutral sends one command with no group")
```

The harness records commands as whole strings through `Shell.command`, so compare against `Shell.command({"prism", "reset", "neutral"})` if a raw string comparison fails.

- [ ] **Step 7: Run to verify they fail**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: FAIL — no button carries glyph `baseline`.

- [ ] **Step 8: Draw the buttons**

In `panel.luau`, replace `resetGroup` with a single batched action, and add a shared button builder above `sectionHeader`:

```lua
-- One click, one command. The panel does not loop: a section reset issued key
-- by key is one lock, one resolve, and one compositor reload per key.
local function resetAction(mode, group, params)
  return function()
    for _, param in ipairs(params) do
      if mode == "defaults" then
        if param.overridden then
          param.value = param.fallback
          param.overridden = false
        end
      elseif mode == "neutral" then
        if param.neutralize ~= false and param.value ~= param.neutral then
          updateParam(param, param.neutral)
        end
      end
    end
    if mode == "symmetric" then
      for _, row in ipairs(Presentation.pairsOf(params)) do
        if row.focused.value ~= row.unfocused.value then
          updateParam(row.unfocused, row.focused.value)
        end
      end
    end
    enqueue({verb = "reset", mode = mode, group = group})
    render()
  end
end

-- The reset idiom, three times over: always in the tree, opacity carries the
-- state, the tooltip explains, and the guard lives in the handler.
local function resetModeButton(spec)
  return ui.button({
    glyph = spec.glyph,
    variant = "ghost",
    controlSize = "sm",
    opacity = spec.count > 0 and 1.0 or inertOpacity,
    tooltip = spec.count > 0 and spec.active or spec.inert,
    onClick = function() if spec.count > 0 then spec.act() end end,
  })
end

-- Section headers say "section"; the panel-wide row says "everything".
-- The count sits beside the noun it counts, not after the clause that explains
-- the consequence: "Reset section (2); values fall back ...", never
-- "Reset section; values fall back ... (2)".
local function resetModeButtons(scope, group, params)
  local held = Presentation.overriddenCount(params)
  local buttons = {
    resetModeButton({
      glyph = "restore", count = held,
      active = "Reset " .. scope .. " (" .. held .. "); values fall back to the layer beneath",
      inert = "No overrides in this " .. scope,
      act = resetAction("defaults", group, params),
    }),
  }
  if #Presentation.pairsOf(params) > 0 then
    local differing = Presentation.symmetricCount(params)
    buttons[#buttons + 1] = resetModeButton({
      glyph = "equal", count = differing,
      active = "Mirror focused onto unfocused (" .. differing .. ")",
      inert = "Focused and unfocused already match",
      act = resetAction("symmetric", group, params),
    })
  end
  local away = Presentation.neutralCount(params)
  buttons[#buttons + 1] = resetModeButton({
    glyph = "baseline", count = away,
    active = "Neutralize " .. scope .. " (" .. away .. ")",
    inert = scope == "everything" and "Everything is already neutral" or "Section is already neutral",
    act = resetAction("neutral", group, params),
  })
  return buttons
end
```

`sectionHeader` then ends with those buttons instead of its single reset. Replace its trailing `ui.button({glyph = "restore", ...})` with an unpacked list — Luau has no `table.unpack` spread inside a table constructor here, so build the children list explicitly:

```lua
local function sectionHeader(name, toggle, sectionParams)
  local children = {
    ui.label({text = name, fontSize = 15, fontWeight = "bold", flexGrow = 1}),
    ui.label({text = toggle and (toggle.ui.label or toggle.key) or "", fontSize = 12, color = "on_surface_variant", visible = toggle ~= nil}),
    ui.label({
      text = toggle and toggle.shadowed and Presentation.shadowHint(toggle) or "",
      fontSize = 11, color = "on_surface_variant", visible = toggle ~= nil and toggle.shadowed == true,
    }),
    toggle and ui.toggle({
      checked = toggle.value == true,
      enabled = toggle.effectiveDrag ~= nil,
      opacity = toggle.shadowed and shadowedOpacity or 1.0,
      onChange = function(value) writeParam(toggle, value == true or value == "true") end,
    }) or ui.spacer({}),
  }
  for _, button in ipairs(resetModeButtons("section", name, sectionParams)) do
    children[#children + 1] = button
  end
  return ui.row({gap = 8, align = "center"}, children)
end
```

Add the panel-wide row, drawn under the wallpaper header and above the first section:

```lua
-- The same three, over everything. An ordinary button row: prism-284a61's dice
-- will sit in it when it arrives.
local function allRow(model)
  local children = {ui.label({text = "All", fontSize = 12, color = "on_surface_variant", flexGrow = 1})}
  for _, button in ipairs(resetModeButtons("everything", nil, Presentation.visibleParams(model))) do
    children[#children + 1] = button
  end
  return ui.row({gap = 8, align = "center"}, children)
end
```

and insert `children[#children + 1] = allRow(state.model)` in the render body immediately after the wallpaper header row is appended.

- [ ] **Step 9: Run to verify they pass**

Run: `lua integrations/noctalia-plugin/plugin_test.lua && just test`
Expected: PASS after two updates to existing assertions, neither of which is a loosening:

- **Counts.** Every assertion counting buttons in the rendered tree goes up: two or three more per section, plus the panel-wide row.
- **The section reset tooltip.** `the Focus rack counts its two overrides` matches the literal `Reset section (2)`; it is now `Reset section (2); values fall back to the layer beneath`. Update the literal.

- [ ] **Step 10: Commit**

```bash
git add integrations/noctalia-plugin/
git commit -m "feat(panel): add symmetric and neutral resets beside reset-to-defaults

Three buttons per section and one panel-wide row, each issuing a single
prism reset. Symmetric is drawn only where a section has matrix rows,
which is structural, so nothing appears or disappears as a value
crosses its default.

The counts name three different units: restore counts keys the target
holds, symmetric counts pairs whose halves differ, neutral counts
eligible keys away from their neutral."
```

---

### Task 6: Documentation, acceptance, and close

**Files:**
- Modify: `docs/notes/noctalia-plugin-contract.md`
- Modify: `README.md`
- Modify: `docs/specs/2026-09-10-reset-modes-design.md` (status header)
- Modify: `docs/plans/2026-09-10-reset-modes.md` (status header)

- [ ] **Step 1: Update the plugin contract note**

Four edits:

1. The verb list — `set`, `unset`, `pin`, `reset`, and the profile verbs are the only verbs.
2. The section description — each section shows three resets: remove every override the target holds, mirror focused onto unfocused where the section has matrix rows, and neutralize. A panel-wide row carries the same three under the wallpaper header.
3. The describe shape — `neutral`, `neutralize`, and `heldInTarget` join `default`, `layer`, and `fallback`. **A parameter is overridden when `heldInTarget` is true**, replacing the note's current `layer == target`.
4. The shadow paragraph — its sentence "Writing under a shadow does not mark the row overridden" is now wrong and is replaced: a write under a shadow lands in the target and does mark the row overridden; what the shadow still explains is that the value on screen comes from above.

- [ ] **Step 2: Update the README**

Add `reset` to the CLI verb list with its one-line syntax.

- [ ] **Step 3: Run the full gate**

Run: `just gate`
Expected: PASS, zero warnings from `tasks check`.

- [ ] **Step 4: Desktop acceptance**

This cannot be automated: there is no pointer automation on this machine, so the user confirms it.

**Two paths must move, not one.** The panel shells out to whatever `prism` is on `PATH`, and `~/bin/prism` is a symlink to the **main checkout's** `bin/prism`. Since `bin/prism` resolves `src/cli.js`, `defs/`, and `integrations/` relative to itself, leaving it alone would run the new panel against the old CLI: no `reset` verb, and a `describe` with no `neutral` or `heldInTarget`, so the panel would show its contract banner and nothing else. Switch both:

```bash
tree=$(git rev-parse --show-toplevel)        # this worktree, whatever it is called
# 1. The CLI, its defs, and its sinks.
ln -sfn "$tree/bin/prism" ~/bin/prism
# 2. The plugin. The ~/.config copy is not what the shell loads.
ln -sfn "$tree/integrations/noctalia-plugin" ~/.local/share/noctalia/plugins/prism
```

The worktree needs its own dependencies — `bin/prism` says so rather than throwing a module-resolution stack trace. Verify both switches before touching the panel:

```bash
npm install --prefix "$tree"
readlink -f ~/bin/prism                     # must name this worktree
prism reset 2>&1 | head -1                  # must print the reset usage, not the verb list
prism describe --json | head -40            # must show a neutral and a heldInTarget
```

The store (`~/.config/prism`, `~/.local/state/prism`) is shared and is not switched: acceptance runs against real values, which is the point. Then reload the shell:

```bash
noctalia msg plugins disable khughitt/prism
noctalia msg plugins enable khughitt/prism
```

`enable` finishes asynchronously; wait a beat before `noctalia msg panel-open khughitt/prism:panel`. Then walk the five steps in the spec's Section 5, in order:

1. neutralize **panel-wide** and confirm the pane goes quiet with the survivors intact;
2. confirm the geometry reached zero, then raise Refraction and confirm it reads — **this decides `paneLip`**. If refraction does not read against a zero bevel, move `glass.paneLip` to the enablers at `6`, update the spec's Section 2 table and `test/glass-defs.test.js`, and re-run `just test`;
3. neutralize panel-wide again, then raise Blur and Directional blur and confirm they behave as the spec predicts at `ior 1`;
4. mirror a section with divergent halves and confirm parity;
5. reset a section to defaults with a wallpaper pinned and confirm one reload rather than a visible cascade.

Also confirm the two new glyphs read at a glance. `equal` and `baseline` are verified present in `~/software/noctalia/assets/fonts/tabler.json`; `ripple-off` and `circle-off` are verified fallbacks. Swapping one is a one-line change in `resetModeButtons`.

**Restore both symlinks when the branch merges**, pointing them back at the main checkout (`git worktree list` names it first). A worktree deleted while `~/bin/prism` still names it leaves the CLI broken for every shell on the machine, not just this session.

- [ ] **Step 5: Record the outcome and close**

Update both status headers to name the implementation commit and the acceptance date. Then:

```bash
tasks note prism-91edc5 "Desktop acceptance: <what the five steps showed, including the paneLip verdict>"
tasks done prism-91edc5 "Symmetric and neutral resets ship beside reset-to-defaults, served by one batched prism reset verb"
tasks check
git add docs/ tasks/
git commit -m "docs: record the reset modes as shipped

<one line on the paneLip verdict from acceptance>"
```

---

## Notes for the executor

- **The main checkout holds untracked copies** of `tasks/prism-91edc5.md` and `tasks/prism-b315f9.md` that predate this branch. `prism-91edc5` differs: the branch copy carries the status, owner, and notes. The branch record is the one to keep; delete the untracked copies in the main checkout at merge time.
- **`glass.focusSplit` is the only exemption.** If a step tempts you to add a second, stop: the exemption exists because the split is panel structure rather than a value, and any other candidate is probably a curation decision that belongs in the spec's Section 2 table.
- **Do not add a confirmation dialog.** It was considered and declined; undo is `prism-b25061`.
- **Do not implement inherit-from-focused** (`prism-7e4766`) here. Symmetric writes real values and stays correct if that lands later.
