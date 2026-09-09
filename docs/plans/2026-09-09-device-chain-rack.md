# Device chain rack implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** not started.

**Goal:** Render the Focus optics as a rack of device cards in the shader's order, each with an always-visible mix, expandable details, a category light, and a real bypass the niri sink honours.

**Architecture:** A new rack file under `defs/rack/` names the devices and the matrix rows, shared keys, and bypass key each owns; a loader validates it against the defs and `describe --json` carries it verbatim. Eight bool bypass params join `glass.yaml`; the niri renderer owns a dry-value table keyed by those params. The Luau panel gains a pure `rack(model)` resolver and a card renderer that reuses the existing matrix cells, reset buttons, and queue.

**Tech Stack:** Node.js 20+ with the existing `yaml` dependency and `node:test`; Luau under Noctalia plugin API 22 with the plain-`lua` test harness; niri-material KDL.

**Spec:** `docs/specs/2026-09-08-device-chain-rack-design.md`

**Task:** `prism-9331c1`, first piece of goal `prism-a03862`.

## Global constraints

- Every value on the bus stays a flat scalar. No structured value, no synthetic mix parameter.
- The rack lives at `defs/rack/devices.yaml`. `loadDefs` is not changed; it reads only the `.yaml` files directly inside `defs/`.
- Device ids, in this order: `backdrop`, `distortion`, `refraction`, `fringing`, `directionalBlur`, `tint`, `saturation`, `noise`. Categories: `source`, `geometry`, `optic`, `post`. `fringing` and `directionalBlur` require `refraction`.
- Bypass keys are `glass.bypass.<device id>`, type `bool`, default `false`, `control: toggle`, group Focus, no `state`, labels `Bypass <device label>`, orders 400 to 470 in steps of ten, all bound by the niri manifest with `liveness: reload`.
- Dry values, applied to both materials while the key is true: backdrop `roughness 0` and `backdrop-blur false`; distortion `distortion 0`; refraction `ior 1`, `chromatic-aberration 0`, `anisotropic-blur 0`; fringing `chromatic-aberration 0`; directionalBlur `anisotropic-blur 0`; tint `attenuation-color "#ffffff"`; saturation `saturation 1`; noise `noise 0`. Nothing else in the KDL changes.
- Terminal opacity moves to `ui.group: Terminal`; the two keys are otherwise untouched.
- The panel names no parameter keys. Cards, lights, and details are derived from `describe` output only.
- Category colors are constants in `presentation.luau`: source `#5b9cf6`, geometry `#c78bfa`, optic `#4fd1c5`, post `#f6ad55`. Card fill is the category color with hex alpha `1f`.
- Conventional commits, no attribution trailers. Use `tasks` for every task mutation: `tasks start <id>` before a task, `tasks note` as evidence changes, `tasks done <id> "<what landed>"` in the implementation commit, `tasks check` before finishing.
- Run `just test` (Node suite plus the Lua plugin test) before every commit that touches code.

## Working tree and prerequisites

Work on branch `device-chain` in `.worktrees/device-chain`. Read the spec, `AGENTS.md`, and `docs/notes/noctalia-plugin-contract.md`. Run `tasks prime` and `git status --short` before editing. The plugin tests run with plain `lua`; `just test` runs both suites.

Task 1 is the shared contract and lands first. Tasks 2, 3, and 4 are independent of each other and are marked parallel. Task 5 needs Tasks 2 and 4, because the plugin contract test runs the real CLI against the panel validator. Task 6 needs everything.

## Files and responsibilities

| Files | Responsibility |
| --- | --- |
| `defs/glass.yaml`, `defs/terminal.yaml`, `defs/rack/devices.yaml`, `integrations/niri/manifest.yaml` | The contract: bypass keys, the Terminal group, the rack file, and the sink bindings |
| `test/glass-defs.test.js`, `test/plugin-presentation.test.js` | Pin the shipped groups, rows, and bypass keys |
| `src/rack.js`, `test/rack.test.js` | Load and validate the rack against the defs |
| `src/cli.js`, `test/cli.test.js` | `describe --json` carries `rack` |
| `integrations/niri/render.js`, `test/niri-render.test.js` | Dry values while bypassed; the cross-check against the rack file |
| `integrations/noctalia-plugin/presentation.luau`, `plugin_test.lua` | Pure rack resolution, silenced flag, per-card params |
| `integrations/noctalia-plugin/panel.luau`, `plugin_test.lua` | Model validation of the rack, cards, lights, expanders |
| `README.md`, `docs/notes/noctalia-plugin-contract.md`, the spec, this plan | Record the shipped layout and status |

---

### Task 1: The contract: bypass keys, the Terminal group, the rack file, and the sink bindings

**Files:**
- Modify: `defs/glass.yaml` (append after `glass.inactive.saturation`)
- Modify: `defs/terminal.yaml:5,11`
- Create: `defs/rack/devices.yaml`
- Modify: `integrations/niri/manifest.yaml` (append)
- Modify: `test/glass-defs.test.js:198-318`
- Modify: `test/plugin-presentation.test.js:8-50`

**Interfaces:**
- Consumes: the def schema in `src/defs.js` (`validateDef`), which already accepts a bool toggle with no `state`.
- Produces: eight defs `glass.bypass.<id>`; `defs/rack/devices.yaml` in the shape Task 2 validates and Task 4 resolves; `terminal.background.opacity.*` in group `Terminal`.

- [ ] **Step 1: Write the failing defs tests**

In `test/glass-defs.test.js`, make four edits and leave the `NEWLY_SPLIT` and `RECEDED` constants and their tests untouched.

(a) Remove the `'Terminal opacity'` row from `MATRIX` and add two constants directly after it:

```js
// The terminal opacity pair is a kitty sink parameter, not a glass stage, so
// it sits in its own matrix section rather than among the rack's devices.
const TERMINAL = ['Terminal opacity', 'terminal.background.opacity.active', 'terminal.background.opacity.inactive'];

// One bypass per rack device, shared by both focus states: the niri sink
// writes the device's dry value while the key is true and the mix keeps its
// number (docs/specs/2026-09-08-device-chain-rack-design.md).
const BYPASS = [
  ['glass.bypass.backdrop', 'Bypass backdrop', 400],
  ['glass.bypass.distortion', 'Bypass distortion', 410],
  ['glass.bypass.refraction', 'Bypass refraction', 420],
  ['glass.bypass.fringing', 'Bypass fringing', 430],
  ['glass.bypass.directionalBlur', 'Bypass directional blur', 440],
  ['glass.bypass.tint', 'Bypass tint', 450],
  ['glass.bypass.saturation', 'Bypass saturation', 460],
  ['glass.bypass.noise', 'Bypass noise', 470],
];
```

(b) Replace the test `'the focus matrix pairs every focused optic with an unfocused twin'` with:

```js
function assertPair(defs, group, [row, focusedKey, unfocusedKey]) {
  const focused = defs.get(focusedKey);
  const unfocused = defs.get(unfocusedKey);
  assert.equal(focused.ui.group, group, focusedKey);
  assert.equal(unfocused.ui.group, group, unfocusedKey);
  assert.equal(focused.ui.state, 'focused', focusedKey);
  assert.equal(unfocused.ui.state, 'unfocused', unfocusedKey);
  assert.equal(focused.ui.row, row);
  assert.equal(unfocused.ui.row, row);
  assert.equal(unfocused.ui.order, focused.ui.order + 1, row);
  assert.deepEqual(unfocused.range, focused.range, row);
  assert.equal(unfocused.ui.step, focused.ui.step, row);
  assert.equal(unfocused.ui.display, focused.ui.display, row);
  assert.equal(unfocused.ui.scale, focused.ui.scale, row);
  assert.equal(unfocused.ui.unit, focused.ui.unit, row);
}

test('the focus matrix pairs every focused optic with an unfocused twin', () => {
  const defs = loadDefs(defsDir());

  for (const pair of MATRIX) assertPair(defs, 'Focus', pair);
  assertPair(defs, 'Terminal', TERMINAL);
  const split = defs.get('glass.focusSplit');
  assert.equal(split.ui.group, 'Focus');
  assert.equal(split.ui.control, 'toggle');
  assert.equal(split.ui.header, true);
  assert.equal(split.ui.state, undefined);
  assert.equal(defs.get('glass.backdropBlur').ui.header, undefined);
  const stateful = [...defs.values()].filter((def) => def.ui.state !== undefined).map((def) => def.key);
  assert.deepEqual(stateful.sort(), [...MATRIX, TERMINAL].flatMap(([, a, b]) => [a, b]).sort());
});

test('every rack device has one shared bool bypass toggle in the Focus group', () => {
  const defs = loadDefs(defsDir());

  for (const [key, label, order] of BYPASS) {
    const def = defs.get(key);
    assert.ok(def, key);
    assert.equal(def.type, 'bool', key);
    assert.equal(def.default, false, key);
    assert.equal(def.ui.group, 'Focus', key);
    assert.equal(def.ui.control, 'toggle', key);
    assert.equal(def.ui.label, label, key);
    assert.equal(def.ui.order, order, key);
    assert.equal(def.ui.state, undefined, key);
    assert.equal(def.ui.header, undefined, key);
    assert.equal(defs.has(key.replace('glass.bypass.', 'glass.inactive.bypass.')), false,
      `${key} gained a per-state twin; bypass is shared`);
  }
  assert.match(defs.get('glass.bypass.refraction').description, /fringing/i);
  assert.match(defs.get('glass.bypass.refraction').description, /directional blur/i);
  assert.match(defs.get('glass.bypass.refraction').description, /blur flattens/i);
  assert.match(defs.get('glass.bypass.noise').description, /both materials/i);
});
```

(c) Replace the test `'everything outside the matrix is shared glass'` with:

```js
test('everything outside the matrix is shared glass or the terminal pair', () => {
  const defs = loadDefs(defsDir());
  const shared = [...defs.values()]
    .filter((def) => def.ui.control !== 'none' && def.ui.group !== 'Focus' && def.ui.group !== 'Title')
    .map((def) => def.key);

  assert.deepEqual(shared.sort(), [
    'compositor.gaps', 'glass.paneLip', 'glass.paneShiftX',
    'glass.paneShiftY', 'glass.jellyFlex', 'glass.jellyRipple',
    'terminal.background.opacity.active', 'terminal.background.opacity.inactive',
  ].sort());
  for (const key of shared) {
    assert.equal(defs.get(key).ui.group, key.startsWith('terminal.') ? 'Terminal' : 'Glass', key);
  }
});
```

(d) If any other assertion in the file enumerates Focus keys or the `MATRIX` length, update it to the new table; the file is the authority on what the executor finds.

In `test/plugin-presentation.test.js`, inside `'shipped presentation is a Glass section and a Focus matrix'`, replace the row expectations and group set:

```js
  assert.deepEqual(rows.map((row) => row.row), [
    'Frosted backdrop', 'Blur', 'Tint', 'Tint distance', 'Refraction',
    'Depth', 'Fringing', 'Distortion', 'Distortion detail', 'Directional blur',
    'Noise', 'Noise type', 'Saturation',
    'Bypass backdrop', 'Bypass distortion', 'Bypass refraction', 'Bypass fringing',
    'Bypass directional blur', 'Bypass tint', 'Bypass saturation', 'Bypass noise',
  ]);
  assert.deepEqual(rows.filter((row) => row.single).map((row) => row.single), [
    'glass.noiseType',
    'glass.bypass.backdrop', 'glass.bypass.distortion', 'glass.bypass.refraction',
    'glass.bypass.fringing', 'glass.bypass.directionalBlur', 'glass.bypass.tint',
    'glass.bypass.saturation', 'glass.bypass.noise',
  ]);
  assert.ok(rows.filter((row) => !row.single).every((row) => row.focused && row.unfocused));

  const terminal = ordered.filter((def) => def.ui.group === 'Terminal').map((def) => def.key);
  assert.deepEqual(terminal, ['terminal.background.opacity.active', 'terminal.background.opacity.inactive']);

  const groups = new Set(visible.map((def) => def.ui.group));
  assert.deepEqual([...groups].sort(), ['Focus', 'Glass', 'Terminal', 'Title']);
  assert.equal(visible.length,
    1 + glass.length + 1 + terminal.length + rows.reduce((n, row) => n + (row.single ? 1 : 2), 0));
```

- [ ] **Step 2: Run the two test files and confirm they fail**

Run: `node --test test/glass-defs.test.js test/plugin-presentation.test.js`
Expected: FAIL. The bypass keys do not exist, the terminal pair is still in Focus.

- [ ] **Step 3: Move terminal opacity to the Terminal group**

In `defs/terminal.yaml`, change `group: Focus` to `group: Terminal` on both `terminal.background.opacity.active` (line 5) and `terminal.background.opacity.inactive` (line 11). Nothing else changes.

- [ ] **Step 4: Add the eight bypass keys**

Append to `defs/glass.yaml`:

```yaml

# Bypass: one per rack device, shared by both focus states. The niri sink
# writes the device's dry value into both materials while the key is true; the
# mix parameters keep their numbers, so switching the device back on restores
# them exactly. The rack (defs/rack/devices.yaml) says which device each key
# belongs to.
- key: glass.bypass.backdrop
  type: bool
  default: false
  ui: {group: Focus, control: toggle, label: Bypass backdrop, order: 400}
  description: Silence the backdrop stage; both materials get blur 0 and no frosted backdrop while set, and the Blur and Frosted backdrop values keep their numbers
- key: glass.bypass.distortion
  type: bool
  default: false
  ui: {group: Focus, control: toggle, label: Bypass distortion, order: 410}
  description: Silence the distortion stage; both materials get distortion 0 while set, and the Distortion and Distortion detail values keep their numbers
- key: glass.bypass.refraction
  type: bool
  default: false
  ui: {group: Focus, control: toggle, label: Bypass refraction, order: 420}
  description: Silence the refraction stage; both materials get refraction 1, fringing 0, and directional blur 0 while set, because those two ride the refraction taps, and Blur flattens too since its strength scales with refraction above 1. Every value keeps its number
- key: glass.bypass.fringing
  type: bool
  default: false
  ui: {group: Focus, control: toggle, label: Bypass fringing, order: 430}
  description: Silence the fringing stage; both materials get fringing 0 while set, and the Fringing values keep their numbers
- key: glass.bypass.directionalBlur
  type: bool
  default: false
  ui: {group: Focus, control: toggle, label: Bypass directional blur, order: 440}
  description: Silence the directional blur stage; both materials get directional blur 0 while set, and the Directional blur values keep their numbers
- key: glass.bypass.tint
  type: bool
  default: false
  ui: {group: Focus, control: toggle, label: Bypass tint, order: 450}
  description: Silence the tint stage; both materials get a white tint while set, which absorbs nothing at any distance, and the Tint and Tint distance values keep their numbers
- key: glass.bypass.saturation
  type: bool
  default: false
  ui: {group: Focus, control: toggle, label: Bypass saturation, order: 460}
  description: Silence the saturation stage; both materials get saturation 1 while set, and the Saturation values keep their numbers
- key: glass.bypass.noise
  type: bool
  default: false
  ui: {group: Focus, control: toggle, label: Bypass noise, order: 470}
  description: Silence the noise stage; both materials get noise 0 while set, since the grain type is shared, and the Noise values keep their numbers
```

- [ ] **Step 5: Create the rack file**

Create `defs/rack/devices.yaml`:

```yaml
# The rack: the Focus group as an ordered list of devices, in the order the
# material shader applies them (niri-material docs/materials/render-pipeline.md).
# `mix` and `rows` name matrix rows by their ui.row label; `shared` names keys
# with no state; `bypass` names the device's bool toggle. `requires` names an
# earlier device whose bypass also silences this one. Every visible parameter
# in the group other than its header toggle must belong to exactly one device.
group: Focus
devices:
  - device: backdrop
    label: Backdrop
    category: source
    mix: Blur
    rows: [Frosted backdrop]
    shared: []
    bypass: glass.bypass.backdrop
  - device: distortion
    label: Distortion
    category: geometry
    mix: Distortion
    rows: [Distortion detail]
    shared: []
    bypass: glass.bypass.distortion
  - device: refraction
    label: Refraction
    category: optic
    mix: Refraction
    rows: [Depth]
    shared: []
    bypass: glass.bypass.refraction
  - device: fringing
    label: Fringing
    category: optic
    mix: Fringing
    rows: []
    shared: []
    bypass: glass.bypass.fringing
    requires: refraction
  - device: directionalBlur
    label: Directional blur
    category: optic
    mix: Directional blur
    rows: []
    shared: []
    bypass: glass.bypass.directionalBlur
    requires: refraction
  - device: tint
    label: Tint
    category: optic
    mix: Tint
    rows: [Tint distance]
    shared: []
    bypass: glass.bypass.tint
  - device: saturation
    label: Saturation
    category: post
    mix: Saturation
    rows: []
    shared: []
    bypass: glass.bypass.saturation
  - device: noise
    label: Noise
    category: post
    mix: Noise
    rows: []
    shared: [glass.noiseType]
    bypass: glass.bypass.noise
```

- [ ] **Step 6: Bind the bypass keys in the niri manifest**

Append to `integrations/niri/manifest.yaml`:

```yaml
  - {param: glass.bypass.backdrop, liveness: reload}
  - {param: glass.bypass.distortion, liveness: reload}
  - {param: glass.bypass.refraction, liveness: reload}
  - {param: glass.bypass.fringing, liveness: reload}
  - {param: glass.bypass.directionalBlur, liveness: reload}
  - {param: glass.bypass.tint, liveness: reload}
  - {param: glass.bypass.saturation, liveness: reload}
  - {param: glass.bypass.noise, liveness: reload}
```

Without these, `describe` reports no consumer for the keys and the panel draws them as `Unavailable` with disabled controls.

- [ ] **Step 7: Run the whole suite**

Run: `just test`
Expected: PASS. `loadDefs` ignores the `rack` directory because it filters on the `.yaml` suffix of direct entries. If any other test enumerates Focus keys or the manifest bind count, update its expectation to include the eight keys and say so in the commit body.

- [ ] **Step 8: Commit**

```bash
git add defs test integrations/niri/manifest.yaml
git commit -m "feat(defs): bypass keys, the rack file, and a Terminal group for the device chain"
```

---

### Task 2: Load and validate the rack, and carry it in describe

**Files:**
- Create: `src/rack.js`
- Create: `test/rack.test.js`
- Modify: `src/cli.js:137-178` (the `describe` case)
- Modify: `test/cli.test.js` (add one test)

**Interfaces:**
- Consumes: `loadDefs(dir)` from `src/defs.js` returning `Map<key, def>`; `defsDir()` from `src/paths.js`.
- Produces: `loadRack(dir, defs)` and `validateRack(rack, defs)` in `src/rack.js`, both returning the validated rack object `{ group, devices: [{ device, label, category, mix, rows, shared, bypass, requires? }] }`; `CATEGORIES`; `describe --json` output gains a top-level `rack` field holding that object verbatim.

- [ ] **Step 1: Write the failing loader tests**

Create `test/rack.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDefs } from '../src/defs.js';
import { loadRack, validateRack } from '../src/rack.js';
import { defsDir } from '../src/paths.js';

// A small group with one matrix row, one shared select, one header toggle,
// and one bypass toggle, so every validation rule has something to bite.
const DEFS = `
- {key: t.on, type: bool, default: true, ui: {group: Title, control: toggle, label: On, order: 0}, description: d}
- {key: r.split, type: bool, default: true, ui: {group: R, control: toggle, label: Split, order: 1, header: true}, description: d}
- {key: r.blur, type: float, range: [0, 1], default: 0, ui: {group: R, control: slider, step: 0.1, label: Blur, order: 2, state: focused, row: Blur}, description: d}
- {key: r.inactive.blur, type: float, range: [0, 1], default: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused blur, order: 3, state: unfocused, row: Blur}, description: d}
- {key: r.depth, type: float, range: [0, 1], default: 0, ui: {group: R, control: slider, step: 0.1, label: Depth, order: 4, state: focused, row: Depth}, description: d}
- {key: r.inactive.depth, type: float, range: [0, 1], default: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused depth, order: 5, state: unfocused, row: Depth}, description: d}
- {key: r.kind, type: enum, values: [a, b], default: a, ui: {group: R, control: select, label: Kind, order: 6}, description: d}
- {key: r.bypass.one, type: bool, default: false, ui: {group: R, control: toggle, label: Bypass one, order: 7}, description: d}
- {key: r.bypass.two, type: bool, default: false, ui: {group: R, control: toggle, label: Bypass two, order: 8}, description: d}
- {key: r.amount, type: float, range: [0, 1], default: 0, ui: {group: R, control: slider, step: 0.1, label: Amount, order: 9}, description: d}
- {key: g.gap, type: int, range: [0, 9], default: 1, ui: {group: G, control: slider, step: 1, label: Gap, order: 10}, description: d}
`;

function defsFrom(yamlText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-rack-'));
  fs.writeFileSync(path.join(dir, 'a.yaml'), yamlText);
  return loadDefs(dir);
}

const defs = defsFrom(DEFS);

// Covers every row and key in group R except the header toggle.
const complete = { group: 'R', devices: [
  { device: 'one', label: 'One', category: 'optic', mix: 'Blur', rows: [], shared: ['r.kind'], bypass: 'r.bypass.one' },
  { device: 'two', label: 'Two', category: 'post', mix: 'Depth', rows: [], shared: ['r.amount'], bypass: 'r.bypass.two', requires: 'one' },
] };

test('a complete rack validates and comes back verbatim', () => {
  assert.deepEqual(validateRack(complete, defs), complete);
});

test('the shipped rack loads against the shipped defs in shader order', () => {
  const rack = loadRack(defsDir(), loadDefs(defsDir()));
  assert.equal(rack.group, 'Focus');
  assert.deepEqual(rack.devices.map((d) => d.device), [
    'backdrop', 'distortion', 'refraction', 'fringing', 'directionalBlur', 'tint', 'saturation', 'noise',
  ]);
  assert.deepEqual(rack.devices.filter((d) => d.requires).map((d) => [d.device, d.requires]),
    [['fringing', 'refraction'], ['directionalBlur', 'refraction']]);
  assert.deepEqual(rack.devices.find((d) => d.device === 'noise').shared, ['glass.noiseType']);
});

test('loadDefs still loads with the rack directory beside the def files', () => {
  const shipped = loadDefs(defsDir());
  assert.ok(shipped.has('glass.bypass.noise'));
  assert.ok(fs.existsSync(path.join(defsDir(), 'rack', 'devices.yaml')));
});

test('a row with two parameters of one state is rejected before a device can claim it', () => {
  const doubled = defsFrom(DEFS + `- {key: r.blur2, type: float, range: [0, 1], default: 0, ui: {group: R, control: slider, step: 0.1, label: Blur again, order: 11, state: focused, row: Blur}, description: d}\n`);
  assert.throws(() => validateRack(complete, doubled), /row Blur in group R has two focused parameters/);
});

const rackWith = (edit) => {
  const rack = structuredClone(complete);
  edit(rack);
  return rack;
};

test('the rack file shape is checked before its contents', () => {
  assert.throws(() => validateRack({ devices: complete.devices }, defs), /group must be a non-empty string/);
  assert.throws(() => validateRack({ group: 'R', devices: [] }, defs), /devices must be a non-empty list/);
});

test('device ids are camelCase and unique, categories fixed, labels present', () => {
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].device = 'One'; }), defs), /device One: bad id/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[1].device = 'one'; }), defs), /device one: duplicate id/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].category = 'light'; }), defs), /category must be one of source\|geometry\|optic\|post/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].label = ' '; }), defs), /device one: label required/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].colour = 'red'; }), defs), /device one: unknown field colour/);
});

test('rows and keys must exist in the group and belong to exactly one device', () => {
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].mix = 'Gap'; }), defs), /device one: no matrix row Gap in group R/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].rows = ['Depth']; }), defs), /device two: row Depth already belongs to one/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].shared = ['r.kind', 'r.kind']; }), defs), /device one: r.kind already belongs to one/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].shared = ['r.blur']; }), defs), /device one: no shared parameter r.blur in group R/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].shared = ['g.gap']; }), defs), /device one: no shared parameter g.gap in group R/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[1].shared = []; }), defs), /r.amount in group R belongs to no device/);
  // Rows are checked before keys, so dropping device two reports its row first.
  assert.throws(() => validateRack(rackWith((r) => { r.devices.pop(); }), defs), /row Depth in group R belongs to no device/);
});

test('bypass must be a bool toggle without state, and requires an earlier device', () => {
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].bypass = 'r.amount'; r.devices[1].shared = ['r.bypass.one']; }), defs), /device one: bypass r.amount must be a bool toggle/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[0].requires = 'two'; }), defs), /device one: requires must name an earlier device/);
  assert.throws(() => validateRack(rackWith((r) => { r.devices[1].requires = 'two'; }), defs), /device two: requires must name an earlier device/);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/rack.test.js`
Expected: FAIL with `Cannot find module '../src/rack.js'`.

- [ ] **Step 3: Write the loader**

Create `src/rack.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const CATEGORIES = ['source', 'geometry', 'optic', 'post'];
const FIELDS = ['device', 'label', 'category', 'mix', 'rows', 'shared', 'bypass', 'requires'];

// The rack names where each parameter sits in the chain; a def says what the
// parameter is. It lives one directory below the defs so loadDefs, which reads
// every .yaml directly inside defs/ as a list of params, never sees it.
export function loadRack(dir, defs) {
  const file = path.join(dir, 'rack', 'devices.yaml');
  return validateRack(parse(fs.readFileSync(file, 'utf8')), defs);
}

export function validateRack(rack, defs) {
  const fail = (msg) => { throw new Error(`invalid rack: ${msg}`); };
  if (typeof rack?.group !== 'string' || rack.group.trim() === '') fail('group must be a non-empty string');
  if (!Array.isArray(rack.devices) || rack.devices.length === 0) fail('devices must be a non-empty list');
  const group = rack.group;

  // What the group holds: matrix rows by label, stateless visible keys, and
  // the header toggle, which belongs to the section rather than a device.
  const rows = new Map();
  const singles = new Set();
  for (const def of defs.values()) {
    if (def.ui.group !== group || def.ui.control === 'none') continue;
    if (def.ui.state !== undefined) {
      const row = rows.get(def.ui.row) ?? {};
      // loadDefs does not pair rows; the panel's sections() rejects a doubled
      // state, and so must the rack, or one of the two defs silently vanishes.
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

  const ids = new Set();
  const rowOwner = new Map();
  const keyOwner = new Map();
  for (const device of rack.devices) {
    const id = device?.device;
    const where = `device ${id ?? '?'}`;
    if (typeof id !== 'string' || !/^[a-z][a-zA-Z0-9]*$/.test(id)) fail(`${where}: bad id`);
    if (ids.has(id)) fail(`${where}: duplicate id`);
    for (const field of Object.keys(device)) {
      if (!FIELDS.includes(field)) fail(`${where}: unknown field ${field}`);
    }
    if (typeof device.label !== 'string' || device.label.trim() === '') fail(`${where}: label required`);
    if (!CATEGORIES.includes(device.category)) fail(`${where}: category must be one of ${CATEGORIES.join('|')}`);
    if (!Array.isArray(device.rows) || !Array.isArray(device.shared)) fail(`${where}: rows and shared must be lists`);
    for (const label of [device.mix, ...device.rows]) {
      if (typeof label !== 'string' || !rows.has(label)) fail(`${where}: no matrix row ${label} in group ${group}`);
      if (rowOwner.has(label)) fail(`${where}: row ${label} already belongs to ${rowOwner.get(label)}`);
      rowOwner.set(label, id);
    }
    for (const key of [...device.shared, device.bypass]) {
      if (typeof key !== 'string' || !singles.has(key)) fail(`${where}: no shared parameter ${key} in group ${group}`);
      if (keyOwner.has(key)) fail(`${where}: ${key} already belongs to ${keyOwner.get(key)}`);
      keyOwner.set(key, id);
    }
    const bypass = defs.get(device.bypass);
    if (bypass.type !== 'bool' || bypass.ui.control !== 'toggle') fail(`${where}: bypass ${device.bypass} must be a bool toggle`);
    if (device.requires !== undefined && (typeof device.requires !== 'string' || !ids.has(device.requires))) {
      fail(`${where}: requires must name an earlier device`);
    }
    ids.add(id);
  }
  for (const label of rows.keys()) {
    if (!rowOwner.has(label)) fail(`row ${label} in group ${group} belongs to no device`);
  }
  for (const key of singles) {
    if (!keyOwner.has(key)) fail(`${key} in group ${group} belongs to no device`);
  }
  return rack;
}
```

`ids.add(id)` runs after the `requires` check, so a device can only require one listed above it and never itself.

- [ ] **Step 4: Run the loader tests**

Run: `node --test test/rack.test.js`
Expected: PASS. If an error-message regex in the test disagrees with the message the code produces, align the test to the message above; the messages in Step 3 are the contract.

- [ ] **Step 5: Write the failing describe test**

Append to `test/cli.test.js`:

```js
test('describe carries the rack verbatim', async () => {
  let out = '';
  await cli.run(['describe', '--json'], { runner: () => {}, print: (s) => { out += s; } });
  const { rack } = JSON.parse(out);
  assert.equal(rack.group, 'Focus');
  assert.deepEqual(rack.devices.map((d) => d.device), [
    'backdrop', 'distortion', 'refraction', 'fringing', 'directionalBlur', 'tint', 'saturation', 'noise',
  ]);
  assert.deepEqual(rack.devices[3], {
    device: 'fringing', label: 'Fringing', category: 'optic', mix: 'Fringing',
    rows: [], shared: [], bypass: 'glass.bypass.fringing', requires: 'refraction',
  });
  assert.equal(Object.hasOwn(rack.devices[0], 'requires'), false);
});
```

Run: `node --test test/cli.test.js`
Expected: FAIL, `rack` is undefined.

- [ ] **Step 6: Emit the rack from describe**

In `src/cli.js`, add the import next to the other `src/` imports:

```js
import { loadRack } from './rack.js';
```

In the `describe` case, after `const store = await snapshot(defs);`, add:

```js
        const rack = loadRack(defsDir(), defs);
```

and change the final `print` to include it:

```js
        print(`${JSON.stringify({ active: activeJson(store.active), profiles: store.profiles, layers: RESOLUTION_ORDER, target: store.target.kind, rack, params: described }, null, 2)}\n`);
```

`defsDir` is already imported by `load()`; confirm rather than assume.

- [ ] **Step 7: Run the suite and commit**

Run: `just test`
Expected: PASS.

```bash
git add src/rack.js src/cli.js test/rack.test.js test/cli.test.js
git commit -m "feat(rack): load the device rack against the defs and carry it in describe"
```

---

### Task 3: Dry values in the niri sink

**Files:**
- Modify: `integrations/niri/render.js:50-63`
- Modify: `test/niri-render.test.js` (fixture and new tests)

**Interfaces:**
- Consumes: `resolved.params` including the eight `glass.bypass.*` booleans from Task 1; `defs/rack/devices.yaml` for the cross-check.
- Produces: exported `DRY` table keyed by bypass param; `renderNiriFragment` applies it inside `glassFor` for both materials.

- [ ] **Step 1: Extend the fixture and write the failing tests**

In `test/niri-render.test.js`, add the bypass keys to the `resolved.params` fixture, after `'glass.inactive.saturation': 0.85,`:

```js
  'glass.bypass.backdrop': false,
  'glass.bypass.distortion': false,
  'glass.bypass.refraction': false,
  'glass.bypass.fringing': false,
  'glass.bypass.directionalBlur': false,
  'glass.bypass.tint': false,
  'glass.bypass.saturation': false,
  'glass.bypass.noise': false,
```

Add the imports at the top:

```js
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { renderNiriFragment, DRY } from '../integrations/niri/render.js';
import { defsDir } from '../src/paths.js';
```

(replace the existing `renderNiriFragment` import line; keep whatever the file already imports). Append the tests:

```js
const count = (text, needle) => text.split(needle).length - 1;

test('a bypassed device writes its dry value into both materials and nothing else moves', () => {
  const noise = renderNiriFragment(with_({ 'glass.bypass.noise': true }));
  assert.equal(count(noise, 'noise 0 type="fine"'), 2);
  assert.equal(count(noise, 'noise 0.02'), 0);
  assert.equal(count(noise, 'saturation 0.85'), 1, 'the unfocused saturation is untouched');

  const backdrop = renderNiriFragment(with_({ 'glass.bypass.backdrop': true }));
  assert.equal(count(backdrop, 'roughness 0\n'), 2);
  assert.equal(count(backdrop, 'backdrop-blur false'), 2);

  const tint = renderNiriFragment(with_({ 'glass.bypass.tint': true }));
  assert.equal(count(tint, 'attenuation-color "#ffffff"'), 2);
  assert.equal(count(tint, 'attenuation-distance 178'), 1, 'tint distance keeps its focused value');
  assert.equal(count(tint, 'attenuation-distance 70'), 1, 'tint distance keeps its unfocused value');

  const distortion = renderNiriFragment(with_({ 'glass.bypass.distortion': true }));
  assert.equal(count(distortion, 'distortion 0 scale=0.05'), 1);
  assert.equal(count(distortion, 'distortion 0 scale=0.4'), 1);

  // Both window rules carry an inert `saturation 1` of their own, so the two
  // materials make four in total; the unfocused 0.85 is what must be gone.
  const saturation = renderNiriFragment(with_({ 'glass.bypass.saturation': true }));
  assert.equal(count(saturation, 'saturation 1\n'), 4);
  assert.equal(count(saturation, 'saturation 0.85'), 0);

  assert.equal(count(renderNiriFragment(with_({ 'glass.bypass.fringing': true })), 'chromatic-aberration 0\n'), 2);
  assert.equal(count(renderNiriFragment(with_({ 'glass.bypass.directionalBlur': true })), 'anisotropic-blur 0\n'), 2);
});

// Fringing and directional blur ride the refraction taps: at ior 1 the jittered
// taps coincide, but fringing's green and blue channels keep an index above 1
// and would refract on their own. Bypassing the carrier zeroes both, and the
// output is the same whether or not the dependents were set.
test('bypassing refraction also silences fringing and directional blur', () => {
  const withDependents = renderNiriFragment(with_({ 'glass.bypass.refraction': true }));
  assert.equal(count(withDependents, 'ior 1\n'), 2);
  assert.equal(count(withDependents, 'chromatic-aberration 0\n'), 2);
  assert.equal(count(withDependents, 'anisotropic-blur 0\n'), 2);
  assert.equal(count(withDependents, 'thickness 32'), 1, 'depth keeps its focused value');
  assert.equal(count(withDependents, 'thickness 44'), 1, 'depth keeps its unfocused value');

  const withoutDependents = renderNiriFragment(with_({
    'glass.bypass.refraction': true,
    'glass.chromaticAberration': 0,
    'glass.inactive.chromaticAberration': 0,
    'glass.anisotropicBlur': 0,
    'glass.inactive.anisotropicBlur': 0,
  }));
  assert.equal(withoutDependents, withDependents);
});

test('every rack device has a dry entry and every dry entry is a rack device', () => {
  const rack = parse(fs.readFileSync(path.join(defsDir(), 'rack', 'devices.yaml'), 'utf8'));
  assert.deepEqual(Object.keys(DRY).sort(), rack.devices.map((device) => device.bypass).sort());
});
```

- [ ] **Step 2: Run and confirm the failures**

Run: `node --test test/niri-render.test.js`
Expected: FAIL, `DRY` is not exported and no dry value is applied.

- [ ] **Step 3: Add the dry table and apply it**

In `integrations/niri/render.js`, replace the `glassFor` definition with:

```js
// What "off" means for each rack device, keyed by its bypass parameter. The
// rack (defs/rack/devices.yaml) says where a device sits in the chain; this
// table says what the material does without it, which is sink knowledge.
// Refraction carries fringing and directional blur on its taps, so its bypass
// zeroes both: at ior 1 the depth-jittered taps coincide, but fringing's green
// and blue channels would keep an index above 1 and refract on their own.
export const DRY = {
  'glass.bypass.backdrop': { roughness: 0, backdropBlur: false },
  'glass.bypass.distortion': { distortion: 0 },
  'glass.bypass.refraction': { ior: 1, chromaticAberration: 0, anisotropicBlur: 0 },
  'glass.bypass.fringing': { chromaticAberration: 0 },
  'glass.bypass.directionalBlur': { anisotropicBlur: 0 },
  'glass.bypass.tint': { attenuationColor: '#ffffff' },
  'glass.bypass.saturation': { saturation: 1 },
  'glass.bypass.noise': { noise: 0 },
};

// A bypass is shared by both focus states, so the override lands in whichever
// material this is building. The resolved values on the bus are untouched.
const glassFor = (params, prefix) => {
  const glass = Object.fromEntries(OPTICS.map((optic) => [optic, params[`${prefix}${optic}`]]));
  for (const [key, dry] of Object.entries(DRY)) {
    if (params[key] === true) Object.assign(glass, dry);
  }
  return glass;
};
```

- [ ] **Step 4: Run the suite**

Run: `just test`
Expected: PASS. `test/niri-apply.test.js` renders through the same function; if its fixture lacks the bypass keys the output is unchanged, because an absent key is not `true`.

- [ ] **Step 5: Commit**

```bash
git add integrations/niri/render.js test/niri-render.test.js
git commit -m "feat(niri): write each device's dry value into both materials while bypassed"
```

---

### Task 4: Resolve the rack in the presentation module

**Files:**
- Modify: `integrations/noctalia-plugin/presentation.luau` (add `categoryColors`, `rack`, `cardParams`, `rackParams`; give `sections` a group to skip)
- Modify: `integrations/noctalia-plugin/plugin_test.lua` (golden vectors, after the `sections` vectors)

**Interfaces:**
- Consumes: a describe model with `rack` in the shape Task 2 emits and `params` carrying `ui.group`, `ui.state`, `ui.row`, `ui.header`, `value`, `key`.
- Produces: `Presentation.categoryColors` (table by category); `Presentation.rack(model)` returning `{ group, header, cards }` where each card is `{ device, label, category, mix = {row, focused, unfocused}, rows = {...}, shared = {param...}, bypass = param, requires = card|nil, bypassed = bool, silenced = bool }`; `Presentation.cardParams(card)` (bypass, then mix pair, detail pairs, shared); `Presentation.rackParams(rack)` (header toggle if any, then every card's params); `Presentation.sections(params, skipGroup)`.

- [ ] **Step 1: Write the failing golden vectors**

In `plugin_test.lua`, after the `equal(Presentation.overriddenCount(...), 2)` line, add:

```lua
-- The rack resolves describe's device list against the group's rows and keys.
-- Every visible parameter in the group other than the header must belong to a
-- device, so a definition added without one fails here instead of vanishing.
local rackParams = {
  { key = "r.split", value = true, ui = { control = "toggle", group = "Rack", order = 1, header = true } },
  { key = "r.blur", value = 0.2, ui = { control = "slider", group = "Rack", order = 2, state = "focused", row = "Blur" } },
  { key = "r.inactive.blur", value = 0.5, ui = { control = "slider", group = "Rack", order = 3, state = "unfocused", row = "Blur" } },
  { key = "r.depth", value = 1, ui = { control = "slider", group = "Rack", order = 4, state = "focused", row = "Depth" } },
  { key = "r.inactive.depth", value = 1, ui = { control = "slider", group = "Rack", order = 5, state = "unfocused", row = "Depth" } },
  { key = "r.kind", value = "a", ui = { control = "select", group = "Rack", order = 6 } },
  { key = "r.bypass.one", value = false, ui = { control = "toggle", group = "Rack", order = 7 } },
  { key = "r.bypass.two", value = false, ui = { control = "toggle", group = "Rack", order = 8 } },
  { key = "g.one", value = 1, ui = { control = "slider", group = "Glass", order = 9 } },
  { key = "hidden", value = 1, ui = { control = "none", group = "Rack" } },
}
local rackModel = { params = rackParams, rack = { group = "Rack", devices = {
  { device = "one", label = "One", category = "optic", mix = "Blur", rows = {}, shared = { "r.kind" }, bypass = "r.bypass.one" },
  { device = "two", label = "Two", category = "post", mix = "Depth", rows = {}, shared = {}, bypass = "r.bypass.two", requires = "one" },
} } }
local rack = Presentation.rack(rackModel)
equal(rack.group, "Rack")
equal(rack.header, rackParams[1])
equal(#rack.cards, 2)
equal(rack.cards[1].device, "one")
equal(rack.cards[1].label, "One")
equal(rack.cards[1].category, "optic")
equal(rack.cards[1].mix, { row = "Blur", focused = rackParams[2], unfocused = rackParams[3] })
equal(rack.cards[1].rows, {})
equal(rack.cards[1].shared, { rackParams[6] })
equal(rack.cards[1].bypass, rackParams[7])
equal(rack.cards[1].requires, nil)
equal(rack.cards[1].bypassed, false)
equal(rack.cards[1].silenced, false)
equal(rack.cards[2].mix.row, "Depth")
equal(rack.cards[2].requires, rack.cards[1])
equal(Presentation.cardParams(rack.cards[1]), { rackParams[7], rackParams[2], rackParams[3], rackParams[6] })
equal(Presentation.rackParams(rack), {
  rackParams[1], rackParams[7], rackParams[2], rackParams[3], rackParams[6], rackParams[8], rackParams[4], rackParams[5],
})
equal(Presentation.categoryColors.optic, "#4fd1c5")
equal(Presentation.categoryColors.post, "#f6ad55")
equal(Presentation.categoryColors.source, "#5b9cf6")
equal(Presentation.categoryColors.geometry, "#c78bfa")

-- A bypassed upstream silences its dependents; the dependent's own key stands.
rackParams[7].value = true
local bypassed = Presentation.rack(rackModel)
equal(bypassed.cards[1].bypassed, true)
equal(bypassed.cards[1].silenced, false)
equal(bypassed.cards[2].bypassed, false)
equal(bypassed.cards[2].silenced, true)
rackParams[7].value = false

-- The rack's group is served by the rack, not by sections.
equal(#Presentation.sections(rackParams, "Rack"), 1)
equal(Presentation.sections(rackParams, "Rack")[1].name, "Glass")
equal(#Presentation.sections(rackParams), 2)

local function rackFails(edit, pattern)
  local params, devices = {}, {}
  for i, p in ipairs(rackParams) do params[i] = { key = p.key, value = p.value, ui = p.ui } end
  for i, d in ipairs(rackModel.rack.devices) do
    devices[i] = { device = d.device, label = d.label, category = d.category, mix = d.mix, rows = {}, shared = {}, bypass = d.bypass, requires = d.requires }
    for j, s in ipairs(d.shared) do devices[i].shared[j] = s end
  end
  local model = { params = params, rack = { group = "Rack", devices = devices } }
  edit(model)
  local ok, err = pcall(Presentation.rack, model)
  assert(not ok, "expected a rack error matching " .. pattern)
  assert(tostring(err):find(pattern, 1, true), "expected " .. pattern .. ", got " .. tostring(err))
end
rackFails(function(m) m.rack = nil end, "prism describe returned no rack")
rackFails(function(m) m.rack.devices[1].mix = "Gap" end, "device one names no matrix row Gap")
rackFails(function(m) m.rack.devices[1].shared = { "r.nope" } end, "device one names no parameter r.nope")
rackFails(function(m) m.rack.devices[2].mix = "Blur" end, "row Blur belongs to two devices")
rackFails(function(m) m.rack.devices[2].shared = { "r.kind" } end, "parameter r.kind belongs to two devices")
rackFails(function(m) m.rack.devices[2] = nil end, "row Depth belongs to no device")
rackFails(function(m) m.rack.devices[1].shared = {} end, "parameter r.kind belongs to no device")
rackFails(function(m) m.rack.devices[2].requires = "three" end, "device two requires unknown device three")
rackFails(function(m) m.rack.devices[1].category = "light" end, "device one has unknown category light")
-- sections() rejects these two shapes; the rack path must not let them through.
rackFails(function(m)
  m.params[#m.params + 1] = { key = "r.blur2", value = 0, ui = { control = "slider", group = "Rack", order = 12, state = "focused", row = "Blur" } }
end, "row Blur has two focused parameters")
rackFails(function(m)
  m.params[#m.params + 1] = { key = "r.split2", value = true, ui = { control = "toggle", group = "Rack", order = 13, header = true } }
end, "section Rack has two header toggles")
```

- [ ] **Step 2: Run and confirm it fails**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: FAIL, `attempt to call a nil value (field 'rack')`.

- [ ] **Step 3: Implement the rack resolver**

In `presentation.luau`, change the `sections` signature and its filter so a group can be skipped:

```lua
function M.sections(params, skipGroup)
  local visible = {}
  for _, param in ipairs(params) do
    if param.ui.control ~= "none" and param.ui.group ~= "Title" and param.ui.group ~= skipGroup then
      visible[#visible + 1] = param
    end
  end
```

(the rest of `sections` is unchanged). Then add, before `return M`:

```lua
-- One color per device category. Noctalia gives a plugin no theme palette, so
-- these are constants; a card's fill is the same color at hex alpha 1f.
M.categoryColors = { source = "#5b9cf6", geometry = "#c78bfa", optic = "#4fd1c5", post = "#f6ad55" }

-- The rack: the group describe names, as an ordered list of device cards. Each
-- card owns one mix row (always shown), detail rows and shared keys (shown
-- when expanded), and its bypass key. The panel resolves row labels and keys
-- against params itself and refuses a rack that does not cover the group, so
-- a definition added without a device fails loudly instead of vanishing.
function M.rack(model)
  local rack = model.rack
  if type(rack) ~= "table" or type(rack.group) ~= "string" or type(rack.devices) ~= "table" then
    error("prism describe returned no rack", 0)
  end
  local rows, singles, header = {}, {}, nil
  for _, param in ipairs(model.params) do
    if param.ui.control ~= "none" and param.ui.group == rack.group then
      if param.ui.state ~= nil then
        local row = rows[param.ui.row] or { row = param.ui.row }
        if row[param.ui.state] ~= nil then
          error("row " .. param.ui.row .. " has two " .. param.ui.state .. " parameters")
        end
        row[param.ui.state] = param
        rows[param.ui.row] = row
      elseif param.ui.header == true then
        if header ~= nil then error("section " .. rack.group .. " has two header toggles") end
        header = param
      else
        singles[param.key] = param
      end
    end
  end
  local claimedRows, claimedKeys, byId, cards = {}, {}, {}, {}
  local function takeRow(label, id)
    local row = rows[label]
    if row == nil or row.focused == nil or row.unfocused == nil then
      error("device " .. id .. " names no matrix row " .. tostring(label))
    end
    if claimedRows[label] then error("row " .. label .. " belongs to two devices") end
    claimedRows[label] = true
    return row
  end
  local function takeKey(key, id)
    local param = singles[key]
    if param == nil then error("device " .. id .. " names no parameter " .. tostring(key)) end
    if claimedKeys[key] then error("parameter " .. key .. " belongs to two devices") end
    claimedKeys[key] = true
    return param
  end
  for _, device in ipairs(rack.devices) do
    local id = tostring(device.device)
    if M.categoryColors[device.category] == nil then
      error("device " .. id .. " has unknown category " .. tostring(device.category))
    end
    local card = { device = id, label = device.label, category = device.category, rows = {}, shared = {} }
    card.mix = takeRow(device.mix, id)
    for _, label in ipairs(device.rows or {}) do card.rows[#card.rows + 1] = takeRow(label, id) end
    for _, key in ipairs(device.shared or {}) do card.shared[#card.shared + 1] = takeKey(key, id) end
    card.bypass = takeKey(device.bypass, id)
    if device.requires ~= nil then
      card.requires = byId[device.requires]
        or error("device " .. id .. " requires unknown device " .. tostring(device.requires))
    end
    byId[id] = card
    cards[#cards + 1] = card
  end
  for label in pairs(rows) do
    if not claimedRows[label] then error("row " .. label .. " belongs to no device") end
  end
  for key in pairs(singles) do
    if not claimedKeys[key] then error("parameter " .. key .. " belongs to no device") end
  end
  for _, card in ipairs(cards) do
    card.bypassed = card.bypass.value == true
    card.silenced = card.requires ~= nil and card.requires.bypass.value == true
  end
  return { group = rack.group, header = header, cards = cards }
end

-- Bypass first: it is the first row of the expanded card.
function M.cardParams(card)
  local list = { card.bypass, card.mix.focused, card.mix.unfocused }
  for _, row in ipairs(card.rows) do
    list[#list + 1] = row.focused
    list[#list + 1] = row.unfocused
  end
  for _, param in ipairs(card.shared) do list[#list + 1] = param end
  return list
end

function M.rackParams(rack)
  local list = {}
  if rack.header then list[#list + 1] = rack.header end
  for _, card in ipairs(rack.cards) do
    for _, param in ipairs(M.cardParams(card)) do list[#list + 1] = param end
  end
  return list
end
```

`ipairs` stops at the first nil, so a `devices` list with a hole (the `m.rack.devices[2] = nil` case) simply ends early and the unclaimed-row check reports it.

- [ ] **Step 4: Run the Lua tests**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: PASS through the new vectors. The later panel-rendering assertions still pass because the panel has not changed yet.

- [ ] **Step 5: Commit**

```bash
git add integrations/noctalia-plugin/presentation.luau integrations/noctalia-plugin/plugin_test.lua
git commit -m "feat(panel): resolve the device rack from describe in the presentation module"
```

---

### Task 5: Render the rack as device cards

**Files:**
- Modify: `integrations/noctalia-plugin/panel.luau` (`validateModel`, `state`, `headCell`, `singleRow`, `matrixRow`, `appendSection`, `render`)
- Modify: `integrations/noctalia-plugin/plugin_test.lua` (the rendered-tree model and assertions)

**Interfaces:**
- Consumes: `Presentation.rack`, `Presentation.cardParams`, `Presentation.rackParams`, `Presentation.categoryColors`, `Presentation.sections(params, skipGroup)` from Task 4; the `rack` field of real `describe` output from Task 2 (the contract test runs the CLI); the existing `controlCell`, `resetButton`, `infoButton`, `rowHint`, `writeParam`, `unsetParam`, `resetGroup`, `matrixHeader`.
- Produces: the rendered rack section; `state.expanded[deviceId]`; the light row keyed `<device>:light`, the card column keyed `<device>:card`, the chevron button with tooltips `Show details` / `Hide details`.

- [ ] **Step 1: Extend the test model and write the failing render assertions**

In `plugin_test.lua`, the rendered-tree `model` (the one with `glass.enabled`, `compositor.gaps`, ...) needs a rack and the params it covers. Replace its `glass.noiseType` entry and the closing `} }` with:

```lua
  {
    key = "glass.noiseType", value = "fine", default = "fine", layer = "default", fallback = "fine",
    effectiveDrag = "release", values = { "white", "fine" },
    ui = { control = "select", group = "Focus", order = 275, label = "Noise type" },
  },
  {
    key = "glass.bypass.backdrop", value = false, default = false, layer = "default", fallback = false,
    effectiveDrag = "release",
    ui = { control = "toggle", group = "Focus", order = 400, label = "Bypass backdrop" },
  },
  {
    key = "glass.bypass.saturation", value = true, default = false, layer = "base", fallback = false,
    effectiveDrag = "release",
    ui = { control = "toggle", group = "Focus", order = 460, label = "Bypass saturation" },
  },
  {
    key = "glass.bypass.noise", value = false, default = false, layer = "default", fallback = false,
    effectiveDrag = "release",
    ui = { control = "toggle", group = "Focus", order = 470, label = "Bypass noise" },
  },
  {
    key = "terminal.background.opacity.active", value = 0, default = 0, layer = "default", fallback = 0,
    effectiveDrag = "release", range = { 0, 1 },
    ui = { control = "slider", group = "Terminal", order = 210, step = 0.01, label = "Terminal opacity", display = "percent", state = "focused", row = "Terminal opacity" },
  },
  {
    key = "terminal.background.opacity.inactive", value = 0, default = 0, layer = "default", fallback = 0,
    effectiveDrag = "release", range = { 0, 1 },
    ui = { control = "slider", group = "Terminal", order = 211, step = 0.01, label = "Unfocused terminal opacity", display = "percent", state = "unfocused", row = "Terminal opacity" },
  },
}, rack = { group = "Focus", devices = {
  { device = "backdrop", label = "Backdrop", category = "source", mix = "Blur", rows = {}, shared = {}, bypass = "glass.bypass.backdrop" },
  { device = "saturation", label = "Saturation", category = "post", mix = "Saturation", rows = {}, shared = {}, bypass = "glass.bypass.saturation", requires = "backdrop" },
  { device = "noise", label = "Noise", category = "post", mix = "Noise", rows = {}, shared = { "glass.noiseType" }, bypass = "glass.bypass.noise" },
} } }
```

The Noise device needs a Noise mix row: add these two params before `glass.noiseType`:

```lua
  {
    key = "glass.noise", value = 0, default = 0, layer = "default", fallback = 0,
    effectiveDrag = "release", range = { 0, 1 },
    ui = { control = "slider", group = "Focus", order = 320, step = 0.01, label = "Noise", display = "percent", state = "focused", row = "Noise" },
  },
  {
    key = "glass.inactive.noise", value = 0.02, default = 0.02, layer = "default", fallback = 0.02,
    effectiveDrag = "release", range = { 0, 1 },
    ui = { control = "slider", group = "Focus", order = 321, step = 0.01, label = "Unfocused noise", display = "percent", state = "unfocused", row = "Noise" },
  },
```

Now several existing assertions change meaning. Update them in place:

- `assert(labels["Blur"] and labels["Gaps"], "row labels missing")` becomes `assert(labels["Backdrop"] and labels["Gaps"], "row labels missing")`: the card displays the device label, not the mix row label.
- `assert(labels["Noise type"], "shared select row missing")` becomes `assert(labels["Noise type"] == nil, "details stay hidden until a card is expanded")`.
- `equal(#collect(rendered, "select"), 2, ...)` becomes `equal(#collect(rendered, "select"), 1, "only the profile selector while every card is collapsed")`, and the `paramSelect(rendered).props.options` / `selectedIndex` lines move below the expansion step added next.
- `equal(#collect(rendered, "toggle"), 2, "title and Focus header toggles")` stays (bypass toggles live in the collapsed details).
- `equal(#resetCandidates, 6, ...)` becomes `equal(#resetCandidates, 9, "a reset renders for every visible cell: gaps, three mix pairs, and the terminal pair")`.
- `equal(#overriddenResets, 1, ...)` stays: the saturation bypass override is in a collapsed row.
- The section reset count: `"Reset section (1)"` becomes `"Reset section (2)"` for the Focus rack, because the rack reset counts the bypass override too, and add `assert(labels["Terminal"], "terminal section header missing")`.

The noise-type write loop further down starts with `local noise = model.params[#model.params]`; the last param is now the terminal pair, so replace that line with:

```lua
local noise
for _, param in ipairs(model.params) do
  if param.key == "glass.noiseType" then noise = param end
end
```

and, because that loop re-runs `dofile` and reopens the panel, it must expand the Noise card before reading `paramSelect(rendered)`: after each `described({ exitCode = 0, stdout = "{}" })` inside that loop, add `chevron("noise").props.onClick()`. The `chevron` helper is defined in the block below, so place the whole block below above that loop.

Then add, after the reset assertions:

```lua
-- Cards: one per device in rack order, each with a light whose glyph and color
-- say active, bypassed, or silenced by an upstream bypass.
local function byKey(tree, key, found)
  found = found or {}
  if type(tree) ~= "table" then return found end
  if tree.props and tree.props.key == key then found[#found + 1] = tree end
  for _, child in ipairs(tree.children or {}) do byKey(child, key, found) end
  return found
end
equal(#byKey(rendered, "backdrop:card"), 1)
equal(#byKey(rendered, "saturation:card"), 1)
equal(#byKey(rendered, "noise:card"), 1)
equal(byKey(rendered, "backdrop:card")[1].props.fill, "#5b9cf61f")
equal(byKey(rendered, "saturation:card")[1].props.opacity < 1.0, true, "a bypassed card dims")
equal(byKey(rendered, "noise:card")[1].props.opacity, 1.0)
local function light(device)
  local row = byKey(rendered, device .. ":light")[1]
  return row, collect(row, "glyph")[1]
end
local _, backdropLight = light("backdrop")
equal(backdropLight.props.name, "circle-filled")
equal(backdropLight.props.color, "#5b9cf6")
local _, saturationLight = light("saturation")
equal(saturationLight.props.name, "circle")
equal(saturationLight.props.color, "on_surface_variant")

-- Clicking a light flips the bypass key with a plain set, whatever the layer.
-- The stub host never completes a write, so the reset above left an unset in
-- flight and anything enqueued now would only wait behind it: start clean.
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })
local commandsBeforeLight = #commands
local backdropLightRow = light("backdrop")
backdropLightRow.props.onClick()
equal(#commands, commandsBeforeLight + 1)
assert(commands[#commands]:find("set", 1, true) and commands[#commands]:find("glass.bypass.backdrop", 1, true)
  and commands[#commands]:find("true", 1, true), "light click sets the bypass")

-- Silenced: active itself, but the device it requires is bypassed.
for _, param in ipairs(model.params) do
  if param.key == "glass.bypass.backdrop" then param.value, param.layer = true, "base" end
  if param.key == "glass.bypass.saturation" then param.value, param.layer = false, "default" end
end
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })
local _, silencedLight = light("saturation")
equal(silencedLight.props.name, "circle")
equal(silencedLight.props.color, "#f6ad55", "a silenced light keeps its category color, hollow")
for _, param in ipairs(model.params) do
  if param.key == "glass.bypass.backdrop" then param.value, param.layer = false, "default" end
  if param.key == "glass.bypass.saturation" then param.value, param.layer = true, "base" end
end
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })

-- Expanding a card shows the bypass row first, then details; the bypass row
-- carries the ordinary reset that issues unset.
local function chevron(device)
  for _, button in ipairs(collect(byKey(rendered, device .. ":card")[1], "button")) do
    if button.props.tooltip == "Show details" or button.props.tooltip == "Hide details" then return button end
  end
  return nil
end
equal(chevron("noise").props.tooltip, "Show details")
chevron("noise").props.onClick()
equal(chevron("noise").props.tooltip, "Hide details")
equal(#collect(rendered, "select"), 2, "the noise type select appears once its card is expanded")
equal(paramSelect(rendered).props.options, { "white", "fine" })
equal(paramSelect(rendered).props.selectedIndex, 1)
local noiseCard = byKey(rendered, "noise:card")[1]
local expandedToggles = collect(noiseCard, "toggle")
equal(#expandedToggles, 1, "the bypass row's toggle")
local detailRows = {}
for _, node in ipairs(collect(noiseCard, "column")) do
  if node.props.key == "glass.bypass.noise:row" or node.props.key == "glass.noiseType:row" then
    detailRows[#detailRows + 1] = node.props.key
  end
end
equal(detailRows, { "glass.bypass.noise:row", "glass.noiseType:row" })
chevron("saturation").props.onClick()
local saturationCard = byKey(rendered, "saturation:card")[1]
local bypassReset
for _, button in ipairs(collect(saturationCard, "button")) do
  if button.props.tooltip == "Remove override" and button.props.opacity == 1.0 then bypassReset = button end
end
assert(bypassReset, "the bypass row of a bypassed-in-base device offers a full-strength reset")
bypassReset.props.onClick()
assert(commands[#commands]:find("'unset' 'glass.bypass.saturation'", 1, true), "bypass reset enqueues prism unset")

-- Expansion survives close and reopen within a session.
onClose()
onOpen({})
described({ exitCode = 0, stdout = "{}" })
equal(chevron("noise").props.tooltip, "Hide details")
chevron("noise").props.onClick()
equal(chevron("noise").props.tooltip, "Show details")

-- The terminal pair still renders as a plain matrix section.
local terminalSliders = {}
for _, node in ipairs(collect(rendered, "slider")) do terminalSliders[node.props.key] = true end
assert(terminalSliders["terminal.background.opacity.active:slider"] and terminalSliders["terminal.background.opacity.inactive:slider"],
  "terminal matrix sliders missing")

-- A model without a rack is a contract error, named.
local savedRack = model.rack
model.rack = nil
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })
local errorLabel = collect(rendered, "label")[1]
equal(errorLabel.props.text, "prism describe returned no rack")
model.rack = savedRack
```

The block above is one contiguous Lua snippet: paste it after the existing reset assertions.

**Migrate the other panel fixtures.** `validateModel` now refuses a model without `rack`, so every fixture that reaches it needs one:

- `layeredModel(overrides)` in `plugin_test.lua`: add a bypass param and a rack. Append to its `params` list, after `glass.inactive.roughness` and before `debug.backdrop`:

  ```lua
      { key = "glass.bypass.backdrop", value = false, default = false, layer = "default", fallback = false,
        effectiveDrag = "release", ui = { control = "toggle", group = "Focus", order = 400, label = "Bypass backdrop" } },
  ```

  and add a `rack` field to the table beside `target`:

  ```lua
    rack = { group = "Focus", devices = {
      { device = "backdrop", label = "Backdrop", category = "source", mix = "Blur", rows = {}, shared = {}, bypass = "glass.bypass.backdrop" },
    } },
  ```

  The bypass sits on `default`, so the header still counts `4 overrides`. The `cellFor` assertions key on parameter keys, which the mix cells keep; the shadow hint still renders from `rowHint` inside the card.
- The `bareTree` model overrides `params` with a lone title toggle, so give it `rack = { group = "Focus", devices = {} }` in the same overrides table. `Presentation.rack` accepts an empty device list when the group holds no parameters; the loader is what refuses an empty file.
- `test/plugin-panel-lifecycle.test.js`: its harness model has only a Title toggle and a Quick slider. Add a Focus group and a rack. After the `glass.depth` entry add:

  ```lua
    {
      key = "glass.focusSplit", value = true, default = true, layer = "default", fallback = true,
      effectiveDrag = "release", description = "",
      ui = {control = "toggle", group = "Focus", order = 200, label = "Focus-state glass", header = true},
    },
    {
      key = "glass.noise", value = 0, default = 0, layer = "default", fallback = 0,
      effectiveDrag = "release", description = "", range = {0, 1},
      ui = {control = "slider", group = "Focus", order = 320, label = "Noise", step = 0.01, state = "focused", row = "Noise"},
    },
    {
      key = "glass.inactive.noise", value = 0.02, default = 0.02, layer = "default", fallback = 0.02,
      effectiveDrag = "release", description = "", range = {0, 1},
      ui = {control = "slider", group = "Focus", order = 321, label = "Unfocused noise", step = 0.01, state = "unfocused", row = "Noise"},
    },
    {
      key = "glass.bypass.noise", value = false, default = false, layer = "default", fallback = false,
      effectiveDrag = "release", description = "",
      ui = {control = "toggle", group = "Focus", order = 470, label = "Bypass noise"},
    },
  ```

  and change the model's opening line to carry the rack:

  ```lua
  local model = {active = {}, profiles = {}, layers = {"default", "base", "wallpaper", "state", "profile"}, target = "base",
    rack = {group = "Focus", devices = {
      {device = "noise", label = "Noise", category = "post", mix = "Noise", rows = {}, shared = {}, bypass = "glass.bypass.noise"},
    }}, params = {
  ```

  Its `ui` stub enumerates the kinds it will build; add `"glyph"` to that list (`{"button", "column", "glyph", "label", ...}`), or the light's glyph is a nil call. The test drives only the `glass.depth` slider, which stays in the Quick section, so nothing else in it changes.

- [ ] **Step 2: Run and confirm it fails**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: FAIL at the first card assertion, no `backdrop:card` node.

- [ ] **Step 3: Validate the rack in the model check**

In `panel.luau`, at the end of `validateModel` before `return nil`, after the `sections` pcall, change the sections call and add the rack check:

```lua
  local rackOk, rackError = pcall(Presentation.rack, model)
  if not rackOk then return tostring(rackError) end
  local sectionsOk, sectionsError = pcall(Presentation.sections, model.params, model.rack.group)
  if not sectionsOk then return tostring(sectionsError) end
  return nil
```

(the rack check goes first so a missing rack reports itself rather than a stray Focus row). Add `expanded = {}` to the `state` table at the top of the file; it is not cleared in `onOpen` or `onClose`, so expansion lasts for the shell session.

- [ ] **Step 4: Give rows an indent and render the cards**

Change `headCell` to accept an indent and shrink the label to fit:

```lua
local function headCell(text, param, dimmed, indent)
  indent = indent or 0
  local children = {}
  if indent > 0 then children[#children + 1] = ui.spacer({width = indent}) end
  children[#children + 1] = ui.label({text = text, fontWeight = "medium", maxWidth = labelColumnWidth - indent, maxLines = 1})
  children[#children + 1] = infoButton(param)
  return ui.row({width = headColumnWidth, gap = 6, align = "center", opacity = dimmed and shadowedOpacity or 1.0}, children)
end
```

Thread it through `singleRow(param, indent)` and `matrixRow(row, indent)` by passing `indent` into their `headCell` calls. Every existing caller passes nothing and gets 0.

Add, after `matrixHeader`:

```lua
local detailIndent = 26
local lightWidth = 20

-- The light: category color while the device is active, grey and hollow while
-- its own bypass is set, hollow in the category color while the device it
-- requires is bypassed. A glyph in a clickable row, because a toggle carries
-- no tooltip and a button no color at the API this plugin declares. The click
-- is a plain set: the bypass row inside the card carries the reset.
local function lightRow(card)
  local color = card.bypassed and "on_surface_variant" or Presentation.categoryColors[card.category]
  local name = (card.bypassed or card.silenced) and "circle" or "circle-filled"
  return ui.row({
    key = card.device .. ":light", width = lightWidth, align = "center", justify = "center",
    onClick = function() writeParam(card.bypass, not (card.bypass.value == true)) end,
  }, {
    ui.glyph({name = name, size = 12, color = color}),
  })
end

-- The card's head spans the same fixed width as every other head cell, so the
-- mix cells line up under the matrix header: light, chevron, label, info.
local function cardHead(card, expanded)
  local mix = card.mix
  return ui.row({width = headColumnWidth, gap = 6, align = "center", opacity = (mix.focused.shadowed and mix.unfocused.shadowed) and shadowedOpacity or 1.0}, {
    lightRow(card),
    ui.button({
      glyph = expanded and "chevron-down" or "chevron-right",
      variant = "ghost",
      controlSize = "sm",
      tooltip = expanded and "Hide details" or "Show details",
      onClick = function()
        state.expanded[card.device] = not expanded
        render()
      end,
    }),
    ui.label({text = card.label, fontWeight = "medium", maxWidth = labelColumnWidth - lightWidth - 34, maxLines = 1}),
    infoButton(mix.focused),
  })
end

local function deviceCard(card)
  local expanded = state.expanded[card.device] == true
  local mix = card.mix
  local children = {
    ui.row({gap = 8, align = "center"}, {
      cardHead(card, expanded),
      controlCell(mix.focused, 1),
      ui.separator({orientation = "vertical", spacing = 4}),
      controlCell(mix.unfocused, 1),
    }),
  }
  local hint = rowHint({mix.focused, mix.unfocused})
  if hint then children[#children + 1] = ui.row({gap = 8, align = "center", justify = "end"}, {hint}) end
  if expanded then
    children[#children + 1] = singleRow(card.bypass, detailIndent)
    for _, row in ipairs(card.rows) do children[#children + 1] = matrixRow(row, detailIndent) end
    for _, param in ipairs(card.shared) do children[#children + 1] = singleRow(param, detailIndent) end
  end
  return ui.column({
    key = card.device .. ":card", gap = 2, paddingV = 4, paddingH = 6, radius = 8,
    fill = Presentation.categoryColors[card.category] .. "1f",
    opacity = card.bypassed and shadowedOpacity or 1.0,
  }, children)
end
```

Pull the section header out of `appendSection` so the rack can share it. Replace the start of `appendSection` (everything up to and including the `ui.row` that holds the section name, the header-toggle label, the shadow hint, the toggle or spacer, and the section reset) with a helper and a call:

```lua
local function sectionHeader(name, toggle, sectionParams)
  local overriddenCount = Presentation.overriddenCount(sectionParams)
  return ui.row({gap = 8, align = "center"}, {
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
    ui.button({
      glyph = "restore",
      variant = "ghost",
      controlSize = "sm",
      opacity = overriddenCount > 0 and 1.0 or inertOpacity,
      tooltip = overriddenCount > 0 and ("Reset section (" .. overriddenCount .. ")") or "No overrides in this section",
      onClick = function() if overriddenCount > 0 then resetGroup(sectionParams) end end,
    }),
  })
end

local function appendSection(children, section)
  local sectionParams = Presentation.sectionParams(section)
  children[#children + 1] = ui.separator({spacing = 6})
  children[#children + 1] = sectionHeader(section.name, section.toggle, sectionParams)
  local hasMatrix = false
  for _, row in ipairs(section.rows) do
    if row.param == nil then hasMatrix = true end
  end
  if hasMatrix then children[#children + 1] = matrixHeader() end
  for _, row in ipairs(section.rows) do
    children[#children + 1] = row.param and singleRow(row.param) or matrixRow(row)
  end
end

local function appendRack(children, rack)
  children[#children + 1] = ui.separator({spacing = 6})
  children[#children + 1] = sectionHeader(rack.group, rack.header, Presentation.rackParams(rack))
  children[#children + 1] = matrixHeader()
  for _, card in ipairs(rack.cards) do children[#children + 1] = deviceCard(card) end
end
```

In `render`, replace the sections loop with the rack in the position its group would have taken. The Focus group's header toggle carries the lowest order in its group, and sections are ordered by first appearance, so:

```lua
    local rack = Presentation.rack(state.model)
    local sections = Presentation.sections(state.model.params, rack.group)
    local rackPlaced = false
    for _, section in ipairs(sections) do
      if not rackPlaced and rack.header ~= nil and section.rows[1] ~= nil then
        local first = section.rows[1].param or section.rows[1].focused
        if first.ui.order > rack.header.ui.order then
          appendRack(children, rack)
          rackPlaced = true
        end
      end
      appendSection(children, section)
    end
    if not rackPlaced then appendRack(children, rack) end
```

With the shipped defs this yields Glass, Focus (the rack), Terminal.

- [ ] **Step 5: Run the Lua tests**

Run: `lua integrations/noctalia-plugin/plugin_test.lua`
Expected: PASS. The stub `ui` accepts any element kind, so `glyph` needs no harness change.

- [ ] **Step 6: Expand every card in the describe-contract harness**

`integrations/noctalia-plugin/contract.test.mjs` feeds real `describe` output to the panel and asserts that every control kind describe emits is drawn by at least one row. With every card collapsed the noise-type select is not drawn, so the harness must expand the cards first. In the `inspect` function of the `harness` string, after the `described({...})` call and before `local errorLabel`, add:

```lua
  -- Every card starts collapsed; the contract is that each control kind can
  -- be drawn, so open them all before reading the rows.
  for _, node in ipairs(collect(rendered)) do
    if node.kind == "button" and node.props.tooltip == "Show details" then node.props.onClick() end
  end
```

`collect` there returns every node, and `render()` replaces `rendered` on each click, so the loop iterates a snapshot and the final `rendered` holds every card open. Run: `node --test integrations/noctalia-plugin/contract.test.mjs`. Expected: PASS, with `report.error` undefined for both models.

- [ ] **Step 7: Run the whole suite and commit**

Run: `just test`
Expected: PASS.

```bash
git add integrations/noctalia-plugin/panel.luau integrations/noctalia-plugin/plugin_test.lua integrations/noctalia-plugin/contract.test.mjs
git commit -m "feat(panel): render the Focus group as a rack of device cards with lights and bypass"
```

---

### Task 6: Integrate, document, and hand over for desktop acceptance

**Files:**
- Modify: `README.md:31-33`
- Modify: `docs/notes/noctalia-plugin-contract.md` (the Declarative presentation section)
- Modify: `docs/specs/2026-09-08-device-chain-rack-design.md` (status line)
- Modify: `docs/plans/2026-09-09-device-chain-rack.md` (status line)

**Interfaces:**
- Consumes: everything above on one branch.
- Produces: a merged-ready branch, docs that describe the shipped panel, a task record that says what was verified and what waits on the desktop.

- [ ] **Step 1: Run the full suite on the merged branch**

Run: `just test`
Expected: PASS. Then run `prism describe --json | head -40` from the worktree's `bin/prism` against a throwaway config (`PRISM_CONFIG_DIR=$(mktemp -d) PRISM_STATE_DIR=$(mktemp -d) bin/prism describe --json`) and confirm the `rack` field prints before `params`.

- [ ] **Step 2: Check the real describe output against the panel's validator**

`integrations/noctalia-plugin/contract.test.mjs` (`'real describe output satisfies the panel model validator'`) spawns the real CLI and runs the panel's `validateModel` over its output. Run: `node --test integrations/noctalia-plugin/contract.test.mjs`. Expected: PASS for both the fresh and the tuned store, with every control kind drawn once the harness expands the cards (Task 5 Step 6).

- [ ] **Step 3: Update the README**

Replace lines 31 to 33 of `README.md` (the sentence beginning "The Noctalia integration is a native v5 plugin") with:

```
The Noctalia integration is a native
v5 plugin under `integrations/noctalia-plugin/`; its panel is a shared `Glass`
section for the frame and pane motion, a `Focus` rack with one card per glass
stage in the shader's order (Backdrop, Distortion, Refraction, Fringing,
Directional blur, Tint, Saturation, Noise), and a `Terminal` matrix for the
terminal opacity pair. Each card shows its mix for both focus states, a light
colored by category that bypasses the stage when clicked, and a chevron that
reveals its other parameters. Bypass is a real `glass.bypass.<device>` value:
the niri sink writes the stage's dry value into both materials while it is
set and the mix keeps its number. Bypassing Refraction also silences Fringing
and Directional blur, which ride its taps, and flattens Blur. Design:
`docs/specs/2026-09-08-device-chain-rack-design.md`.
```

- [ ] **Step 4: Update the plugin contract note**

In `docs/notes/noctalia-plugin-contract.md`, under `## Declarative presentation`, replace the bullet beginning "Every other `ui.group` is a section" with:

```
- Every other `ui.group` is a section, ordered by first appearance in
  `ui.order`, except the group `describe` names in `rack.group`, which is
  drawn as the rack. Sections are always open; there is no Quick group.
  Each section shows a reset that removes every override its parameters hold
  in the write target, dim while the section holds no overrides.
- The rack is one card per device in `rack.devices` order. A card's head is a
  light, a chevron, the device label, and the mix row's info button, in the
  same fixed span as every other head cell; then the mix row's focused and
  unfocused cells. The light is a glyph: `circle-filled` in the category color
  while active, `circle` in `on_surface_variant` while the device's bypass key
  is true, `circle` in the category color while the device it `requires` is
  bypassed. Clicking the light sets the bypass key. The chevron expands the
  card; expansion is panel memory keyed by device id and lasts the shell
  session. Expanded, the card lists the bypass key as an ordinary single row
  (with the per-parameter reset that issues `unset`), then its detail matrix
  rows, then its shared single rows, all indented. A bypassed card dims. A
  model without `rack`, a device naming a row or key the group does not
  carry, or a visible parameter in the group that no device claims is a
  contract error and shows as the banner.
```

- [ ] **Step 5: Mark the spec and plan as implemented**

In the spec, change the status line to `**Status:** implemented on \`device-chain\` at <sha>; suite passing; desktop acceptance pending.` with the real short sha of the Task 5 commit. In this plan, change `**Status:** not started.` to the same wording.

- [ ] **Step 6: Commit and record the task**

```bash
git add README.md docs/notes/noctalia-plugin-contract.md docs/specs/2026-09-08-device-chain-rack-design.md docs/plans/2026-09-09-device-chain-rack.md
git commit -m "docs: describe the rack panel and record the device-chain rack as implemented"
```

Then `tasks note prism-9331c1 "<what was verified: suite counts, describe output, what desktop acceptance still needs>"`.

- [ ] **Step 7: Hand over the desktop acceptance checklist**

Desktop acceptance cannot be automated here (no pointer automation). Give the user this checklist, with the exact commands:

```
# The panel runs `prism` from PATH, and ~/bin/prism points at the main checkout,
# whose describe has no rack; switch both, and record the original CLI target.
readlink ~/bin/prism   # note this; it is what to restore
ln -sfn /mnt/ssd/Dropbox/prism/.worktrees/device-chain/bin/prism ~/bin/prism
ln -sfn /mnt/ssd/Dropbox/prism/.worktrees/device-chain/integrations/noctalia-plugin ~/.local/share/noctalia/plugins/prism
noctalia msg plugins disable khughitt/prism
noctalia msg plugins enable khughitt/prism
# wait a beat
noctalia msg panel-open khughitt/prism:panel
```

Check: eight cards under Focus in shader order with colored fills; lights lit; clicking Noise's light greys it and the grain disappears on the desktop; expanding Noise shows Bypass noise (on) with a lit reset, then Noise type; resetting the bypass row un-bypasses; bypassing Refraction hollows the Fringing and Directional blur lights; the Terminal section still shows the opacity sliders. Afterwards restore both links: `ln -sfn <the readlink output> ~/bin/prism` and the plugin link back to the main checkout's `integrations/noctalia-plugin`, then disable and enable the plugin again. Do this before merging as well if the branch is left for a while, or the panel and CLI disagree the moment the worktree moves. `tasks done prism-9331c1` is the user's call after that check, in the merge commit.
