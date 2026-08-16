# Prism Noctalia Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Prism's wall of backend-oriented controls with a six-control Quick view, collapsed semantic sections, consistent reset/help affordances, live glass drag feedback, and a native-looking Noctalia bar icon.

**Architecture:** Definitions own labels, groups, order, and slider steps; manifests own sink-cost drag overrides; `describe` aggregates both into a consumer-ready model. A small import-free presentation module is shared by QML and Node tests, while the existing persistent client and FIFO write queue remain unchanged.

**Tech Stack:** Node.js ESM, YAML definitions/manifests, Qt Quick/QML, Noctalia 5.x components, `node:test`, `qmllint`.

## Global Constraints

- Use TDD for each behavior change: observe the focused test fail before editing production code.
- Keep the existing persistent `PrismClient`, FIFO queue, sample coalescing, release ordering, refresh coalescing, and CLI commands.
- Do not add a daemon, IPC path, compatibility layer, dependency, bulk-reset command, or hard-coded parameter list in QML.
- Keep `bindings[]` public entries exactly `{sink, liveness}` and retain `effectiveLiveness`; append `effectiveDrag` immediately after it.
- Quantize only panel slider writes. Direct `prism set` input remains exact.
- QML-shared JavaScript must be import-free and QV4-compatible: no object spread.
- Use named-path staging and conventional commits. Do not stage unrelated files.
- Do not write machine-specific absolute paths into code or documentation.

---

### Task 1: Add definition-driven presentation metadata

**Files:**
- Modify: `src/defs.js`
- Modify: `defs/compositor.yaml`
- Modify: `defs/glass.yaml`
- Modify: `defs/terminal.yaml`
- Modify: `test/defs.test.js`
- Modify: `test/glass-defs.test.js`

**Interfaces:**
- Consumes: existing `validateDef(def, src)` and `loadDefs(dir)`.
- Produces: every visible definition has `ui.label: string` and unique `ui.order: integer`; all visible numeric defaults lie on their slider grids.

- [ ] **Step 1: Add failing validation and shipped-definition tests**

Extend `test/defs.test.js` so inline YAML fixtures that pass `loadDefs` include valid metadata before the condition they intend to test. Add focused cases proving:

```js
assert.throws(() => loadDefs(dirWith(
  '- {key: a.one, type: bool, default: true, ui: {group: A, control: toggle, order: 10}, description: d}\n')),
/ui\.label required/);
assert.throws(() => loadDefs(dirWith(
  '- {key: a.one, type: bool, default: true, ui: {group: A, control: toggle, label: One, order: 1.5}, description: d}\n')),
/ui\.order must be an integer/);
const duplicateOrderDir = dirWith(
  '- {key: a.one, type: bool, default: true, ui: {group: A, control: toggle, label: One, order: 10}, description: d}\n');
fs.writeFileSync(path.join(duplicateOrderDir, 'b.yaml'),
  '- {key: a.two, type: bool, default: false, ui: {group: B, control: toggle, label: Two, order: 10}, description: d}\n');
assert.throws(() => loadDefs(duplicateOrderDir), /duplicate ui\.order 10/);
```

Keep `control: none` fixtures valid without `label` or `order`.

In `test/glass-defs.test.js`, load all shipped definitions and assert every visible numeric definition satisfies:

```js
const n = (def.default - def.range[0]) / def.ui.step;
assert.ok(Math.abs(n - Math.round(n)) <= 1e-9, `${def.key} default is off-grid`);
```

Do not use `Number.isInteger(n)`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test test/defs.test.js test/glass-defs.test.js
```

Expected: failures for absent validation, duplicate orders, and the six off-grid slider definitions.

- [ ] **Step 3: Implement the minimal definition contract**

In `validateDef`, require a trimmed non-empty label and integer order only when `ui.control !== 'none'`:

```js
if (def.ui.control !== 'none') {
  if (typeof def.ui.label !== 'string' || def.ui.label.trim() === '') fail('ui.label required');
  if (!Number.isInteger(def.ui.order)) fail('ui.order must be an integer');
}
```

In `loadDefs`, detect cross-file duplicate visible orders after validating each definition. Include both keys in the error so the conflict is actionable.

Apply these exact groups, labels, and orders:

| Order | Group | Key | Label |
| ---: | --- | --- | --- |
| 10 | Quick | `terminal.background.opacity.active` | Focused terminal opacity |
| 20 | Quick | `terminal.background.opacity.inactive` | Unfocused terminal opacity |
| 30 | Quick | `compositor.gaps` | Window spacing |
| 40 | Quick | `glass.roughness` | Glass blur |
| 50 | Quick | `glass.transmission` | Glass clarity |
| 60 | Quick | `glass.attenuationColor` | Glass tint |
| 100 | Opacity & Focus | `terminal.window.opacity.active` | Focused window opacity |
| 110 | Opacity & Focus | `terminal.window.opacity.inactive` | Unfocused window opacity |
| 120 | Opacity & Focus | `terminal.blur` | Background blur |
| 130 | Opacity & Focus | `terminal.saturation.active` | Focused saturation |
| 140 | Opacity & Focus | `terminal.saturation.inactive` | Unfocused saturation |
| 150 | Opacity & Focus | `terminal.noise.active` | Focused noise |
| 160 | Opacity & Focus | `terminal.noise.inactive` | Unfocused noise |
| 200 | Glass Shape | `glass.paneLip` | Edge bevel |
| 210 | Glass Shape | `glass.paneShiftX` | Horizontal pane offset |
| 220 | Glass Shape | `glass.paneShiftY` | Vertical pane offset |
| 300 | Glass Optics | `glass.ior` | Refraction |
| 310 | Glass Optics | `glass.thickness` | Glass thickness |
| 320 | Glass Optics | `glass.attenuationDistance` | Tint depth |
| 330 | Glass Optics | `glass.chromaticAberration` | Color fringing |
| 340 | Glass Optics | `glass.distortion` | Distortion |
| 350 | Glass Optics | `glass.distortionScale` | Distortion scale |
| 360 | Glass Optics | `glass.anisotropicBlur` | Directional blur |
| 400 | Motion | `glass.jellyFlex` | Flex |
| 410 | Motion | `glass.jellyRipple` | Ripple |
| 420 | Motion | `glass.springDampingRatio` | Motion damping |
| 430 | Motion | `glass.springStiffness` | Motion stiffness |
| 440 | Motion | `glass.springEpsilon` | Settle threshold |
| 500 | Diagnostics | `glass.gridOverlay` | Drafting grid |
| 510 | Diagnostics | `glass.calibrate` | Calibration visuals |
| 520 | Diagnostics | `glass.probeExposure` | Wallpaper exposure |
| 530 | Diagnostics | `glass.samples` | Render samples |

Leave `terminal.apps` hidden. Change only these steps:

```text
glass.thickness             0.1
glass.attenuationDistance   1
glass.distortionScale       0.01
glass.springDampingRatio    0.05
glass.springStiffness       1
glass.springEpsilon         0.000001
```

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --test test/defs.test.js test/glass-defs.test.js
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/defs.js defs/compositor.yaml defs/glass.yaml defs/terminal.yaml test/defs.test.js test/glass-defs.test.js
git diff --cached --check
git commit -m "feat: add semantic prism presentation metadata"
```

---

### Task 2: Put pointer-drag policy at the manifest boundary

**Files:**
- Modify: `src/manifest.js`
- Modify: `src/cli.js`
- Modify: `integrations/kitty/manifest.yaml`
- Modify: `test/manifest.test.js`
- Modify: `test/cli.test.js`

**Interfaces:**
- Consumes: manifest bindings `{param, liveness, drag?}`.
- Produces: `describe --json` keeps public `bindings[]` as `{sink, liveness}`, retains `effectiveLiveness`, and appends `effectiveDrag: 'live' | 'release' | null`.

- [ ] **Step 1: Add failing manifest-policy tests**

In `test/manifest.test.js`, add this small helper beside the existing `integ`
fixture helper, then prove the only accepted override is `drag: release` on a
live binding:

```js
function loadBinding(fields) {
  const root = integ({
    'alpha/manifest.yaml': `sink: alpha\nbinds:\n  - param: a.x\n${fields}\n`,
  });
  return loadManifests(root, defs)[0].binds[0];
}

assert.equal(loadBinding('    liveness: live\n    drag: release').drag, 'release');
assert.throws(() => loadBinding('    liveness: live\n    drag: sample'), /bad drag/);
assert.throws(() => loadBinding('    liveness: reload\n    drag: release'),
  /drag: release requires liveness: live/);
```

- [ ] **Step 2: Add failing describe-shape and aggregation tests**

Extend the existing CLI fixture manifests to cover four cases:

```yaml
# every binding live, no override
- {param: glass.roughness, liveness: live}
# live capability, expensive adapter
- {param: terminal.background.opacity.active, liveness: live, drag: release}
# mixed live/reload
- {param: compositor.gaps, liveness: live}
- {param: compositor.gaps, liveness: reload}
# glass.ior intentionally unbound
```

Assert `effectiveDrag` is respectively `live`, `release`, `release`, and `null`. Assert `effectiveLiveness` remains present and correct. Assert the override binding is exposed publicly as exactly:

```js
[{ sink: 'kitty', liveness: 'live' }]
```

Update the exact ordered-key assertion in `test/cli.test.js` to:

```js
assert.deepEqual(Object.keys(p), [
  'key', 'type', 'range', 'default', 'value', 'modified', 'ui', 'description',
  'bindings', 'effectiveLiveness', 'effectiveDrag',
]);
```

Preserve whatever existing conditional handling the test uses for the optional `values` key; the new key must be immediately after `effectiveLiveness` in `src/cli.js`'s object literal.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
node --test test/manifest.test.js test/cli.test.js
```

Expected: failures for missing validation and missing `effectiveDrag`.

- [ ] **Step 4: Implement manifest validation and aggregation**

In `loadManifests`, after liveness validation, fail explicitly unless the optional override is exactly valid:

```js
if (b.drag !== undefined && b.drag !== 'release') {
  throw new Error(`${file}: bad drag ${JSON.stringify(b.drag)}`);
}
if (b.drag === 'release' && b.liveness !== 'live') {
  throw new Error(`${file}: drag: release requires liveness: live`);
}
```

In `describe`, retain raw bindings long enough to aggregate policy, but keep the public mapping unchanged:

```js
const rawBindings = manifests.flatMap((manifest) => manifest.binds
  .filter((binding) => binding.param === key)
  .map((binding) => ({ ...binding, sink: manifest.sink })));
const bindings = rawBindings.map(({ sink, liveness }) => ({ sink, liveness }));
const effectiveDrag = rawBindings.length === 0
  ? null
  : rawBindings.some((binding) => binding.liveness !== 'live' || binding.drag === 'release')
    ? 'release'
    : 'live';
```

Append `effectiveDrag` directly after `effectiveLiveness`. Add `drag: release` to both terminal-background-opacity bindings in `integrations/kitty/manifest.yaml`; no other manifest gains the field.

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
node --test test/manifest.test.js test/cli.test.js
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/manifest.js src/cli.js integrations/kitty/manifest.yaml test/manifest.test.js test/cli.test.js
git diff --cached --check
git commit -m "feat: describe effective pointer drag policy"
```

---

### Task 3: Share presentation sorting and numeric normalization

**Files:**
- Create: `integrations/noctalia-plugin/presentation.mjs`
- Create: `test/plugin-presentation.test.js`

**Interfaces:**
- Produces: `groupParams(params) -> Array<{name, params}>`, `stepPrecision(step) -> integer`, `quantizeValue(value, step) -> number`, and `formatValue(value, step) -> string`.
- Consumers: `Panel.qml`, `ParamControl.qml`, and Node tests. The module must remain import-free and QV4-compatible.

- [ ] **Step 1: Write failing helper tests**

Create `test/plugin-presentation.test.js` with direct ESM imports and exact assertions:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatValue, groupParams, quantizeValue, stepPrecision,
} from '../integrations/noctalia-plugin/presentation.mjs';

test('groups visible params in presentation order with Quick first', () => {
  const params = [
    { key: 'b.two', ui: { control: 'toggle', group: 'Beta', order: 20 } },
    { key: 'q.one', ui: { control: 'slider', group: 'Quick', order: 50 } },
    { key: 'a.one', ui: { control: 'toggle', group: 'Alpha', order: 10 } },
    { key: 'hidden.one', ui: { control: 'none', group: 'CLI' } },
    { key: 'b.one', ui: { control: 'toggle', group: 'Beta', order: 15 } },
  ];
  assert.deepEqual(groupParams(params).map((group) => ({
    name: group.name,
    keys: group.params.map((param) => param.key),
  })), [
    { name: 'Quick', keys: ['q.one'] },
    { name: 'Alpha', keys: ['a.one'] },
    { name: 'Beta', keys: ['b.one', 'b.two'] },
  ]);
});

test('quantizes panel writes to step precision', () => {
  assert.equal(stepPrecision(0.000001), 6);
  assert.equal(quantizeValue(20.000000000000004, 0.1), 20);
  assert.equal(quantizeValue(2.2199999999999998, 0.01), 2.22);
});

test('formats values without binary noise or trailing zeros', () => {
  assert.equal(formatValue(0.000100, 0.000001), '0.0001');
  assert.equal(formatValue(0.0040, 0.0001), '0.004');
  assert.equal(formatValue(0.0600, 0.01), '0.06');
});
```

- [ ] **Step 2: Run the helper test and verify RED**

Run:

```bash
node --test test/plugin-presentation.test.js
```

Expected: failure because `presentation.mjs` does not exist.

- [ ] **Step 3: Implement the import-free helper**

Create `presentation.mjs` with ordinary functions and explicit objects. Use this exact numeric boundary:

```js
// Import-free for QML and node. QV4 cannot parse object spread.
export function stepPrecision(step) {
  var text = String(step).toLowerCase();
  var exponentAt = text.indexOf('e-');
  if (exponentAt !== -1) {
    var coefficient = text.slice(0, exponentAt);
    var fractional = coefficient.indexOf('.') === -1
      ? 0
      : coefficient.length - coefficient.indexOf('.') - 1;
    return Number(text.slice(exponentAt + 2)) + fractional;
  }
  return text.indexOf('.') === -1 ? 0 : text.length - text.indexOf('.') - 1;
}

export function quantizeValue(value, step) {
  return Number(Number(value).toFixed(stepPrecision(step)));
}

export function formatValue(value, step) {
  return String(quantizeValue(value, step));
}
```

Implement `groupParams` without mutating the input:

```js
export function groupParams(params) {
  var visible = [];
  for (var i = 0; i < params.length; i++) {
    if (params[i].ui.control !== 'none') visible.push(params[i]);
  }
  visible.sort(function(a, b) { return a.ui.order - b.ui.order; });

  var groups = [];
  var byName = {};
  for (var j = 0; j < visible.length; j++) {
    var name = visible[j].ui.group;
    if (!byName[name]) {
      byName[name] = { name: name, params: [] };
      groups.push(byName[name]);
    }
    byName[name].params.push(visible[j]);
  }

  for (var k = 0; k < groups.length; k++) {
    if (groups[k].name === 'Quick' && k !== 0) {
      groups.unshift(groups.splice(k, 1)[0]);
      break;
    }
  }
  return groups;
}
```

Do not add generic grouping options.

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --test test/plugin-presentation.test.js
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add integrations/noctalia-plugin/presentation.mjs test/plugin-presentation.test.js
git diff --cached --check
git commit -m "feat: add noctalia presentation helpers"
```

---

### Task 4: Replace the wall of controls with Quick and quiet sections

**Files:**
- Create: `integrations/noctalia-plugin/ParamControl.qml`
- Modify: `integrations/noctalia-plugin/Panel.qml`
- Modify: `test/plugin-client.test.js`

**Interfaces:**
- Consumes: Task 2's `effectiveDrag`, Task 3's `Presentation.groupParams`, `Presentation.quantizeValue`, and `Presentation.formatValue`; existing `PrismClient.set(key, value, sample)` and `unset(key)`.
- Produces: one parameter row component and a panel that retains expanded state across describe refreshes but resets it when the panel root is destroyed.

- [ ] **Step 1: Re-anchor existing lifecycle tests before moving code**

Make `test/plugin-client.test.js` read both files:

```js
const panel = await readFile(new URL('../integrations/noctalia-plugin/Panel.qml', import.meta.url), 'utf8');
const control = await readFile(new URL('../integrations/noctalia-plugin/ParamControl.qml', import.meta.url), 'utf8');
```

Move only slider-source assertions from `panel` to `control`. Preserve the existing contracts for sample-only drains, keyboard/wheel debounce, pointer release, and destruction flush. Run:

```bash
node --test test/plugin-client.test.js
```

Expected: RED because `ParamControl.qml` does not exist; do not weaken or delete the lifecycle assertions.

- [ ] **Step 2: Add failing structural assertions for the new behavior**

Add source-contract tests that require all of these facts:

```js
assert.match(panel, /property var expandedGroups: \(\{\}\)/);
assert.match(panel, /function setGroupExpanded\(name, expanded\)/);
assert.match(panel, /root\.expandedGroups = next/);
assert.doesNotMatch(panel, /expandedGroups\[[^\]]+\]\s*=/);
assert.match(panel, /Presentation\.groupParams\(model\.params\)/);

assert.match(control, /readonly property bool liveDrag: param\.effectiveDrag === "live"/);
assert.match(control, /showReset: false/);
assert.match(control, /tooltipText: "Reset to default"/);
assert.equal(control.match(/tooltipText: "Reset to default"/g)?.length, 1);
assert.match(control, /Presentation\.formatValue\(value, stepSize\)/);
```

For write correctness, isolate the `sendSlider` helper and assert every slider write site calls it; reject direct slider `client.set(param.key, value...)` calls. The helper must contain:

```qml
client.set(param.key, Presentation.quantizeValue(value, stepSize), sample)
```

- [ ] **Step 3: Implement `ParamControl.qml` with native controls**

Give the component only these public inputs:

```qml
required property var param
required property var client
property var screen: null
readonly property real stepSize: param.ui.step === undefined ? 0.01 : param.ui.step
readonly property bool liveDrag: param.effectiveDrag === "live"
```

Keep the existing two timers and pointer state. Route drag samples, pointer release, keyboard/wheel debounce, and destruction flush through:

```qml
function sendSlider(value, sample) {
  client.set(param.key, Presentation.quantizeValue(value, stepSize), sample)
}
```

Configure native controls as follows:

- `NValueSlider`: `label`, `description`, `defaultValue`, `showReset: false`, current range/step/value, and `text: Presentation.formatValue(value, stepSize)`.
- `NToggle`: native `label`, `description`, `defaultValue`, and current checked/write behavior.
- `NComboBox`: native `label`, `description`, `defaultValue`, current options, and selected write behavior.
- `NColorPicker`: wrap only this control in `NLabel` for label/description; keep accept-time color conversion.
- Disable the row when `param.effectiveDrag === null` and show a quiet `unavailable` hint; show `on release` only when it equals `release`.
- Add one fixed-width trailing `NIconButton`, visible only when `param.modified`, with icon `restore`, smaller visual treatment, tooltip `Reset to default`, and `client.unset(param.key)`. Do not use native slider reset.

Use the existing `selectOptions` and `colorHex` logic locally in this component; they are two small control-format adapters, not new shared APIs.

- [ ] **Step 4: Implement Quick and advanced section composition in `Panel.qml`**

Import the shared module:

```qml
import "presentation.mjs" as Presentation
```

Replace `groupedParams` with `Presentation.groupParams(model.params)`. Add:

```qml
property var expandedGroups: ({})

function setGroupExpanded(name, expanded) {
  var next = {};
  var keys = Object.keys(root.expandedGroups);
  for (var i = 0; i < keys.length; i++) {
    next[keys[i]] = root.expandedGroups[keys[i]];
  }
  next[name] = expanded;
  root.expandedGroups = next;
}
```

Render `Quick` directly in one quiet themed surface. For every other group, compose a quiet inline header from `NIcon`, `NText`, and `NIconButton`:

- clicking the header toggles `expandedGroups[modelData.name] === true` through `setGroupExpanded`;
- the chevron reflects expanded state;
- the header shows a subtle modified count;
- a small `Reset` section button appears only when modified and calls existing `resetGroup`;
- content visibility follows expanded state without deleting pending writes;
- every row is `ParamControl { param: modelData; client: root.client; screen: ... }`.

Do not use `NCollapsible`, persist state outside the panel, or duplicate parameter keys in QML.

- [ ] **Step 5: Run QML and Node verification**

Run:

```bash
node --test test/plugin-client.test.js test/plugin-presentation.test.js
qmllint integrations/noctalia-plugin/Main.qml integrations/noctalia-plugin/PrismClient.qml integrations/noctalia-plugin/Panel.qml integrations/noctalia-plugin/ParamControl.qml integrations/noctalia-plugin/BarWidget.qml
npm test
```

Expected: all Node tests pass and `qmllint` exits 0.

- [ ] **Step 6: Commit**

```bash
git add integrations/noctalia-plugin/ParamControl.qml integrations/noctalia-plugin/Panel.qml test/plugin-client.test.js
git diff --cached --check
git commit -m "feat: streamline noctalia prism controls"
```

---

### Task 5: Match Noctalia's native bar capsule

**Files:**
- Modify: `integrations/noctalia-plugin/BarWidget.qml`
- Modify: `test/plugin-client.test.js`

**Interfaces:**
- Consumes: installed Noctalia `Style`, `Color`, and `BarService` APIs.
- Produces: the existing panel toggle with the native capsule geometry/colors and monochrome `wand` icon.

- [ ] **Step 1: Add a failing source-contract test**

Add one focused test that pins the copied Noctalia contract rather than merely matching the icon:

```js
const bar = await readFile(new URL('../integrations/noctalia-plugin/BarWidget.qml', import.meta.url), 'utf8');

assert.match(bar, /import qs\.Services\.UI/);
assert.match(bar, /baseSize: Style\.getCapsuleHeightForScreen\(screen\?\.name\)/);
assert.match(bar, /applyUiScale: false/);
assert.match(bar, /customRadius: Style\.radiusL/);
assert.match(bar, /icon: "wand"/);
assert.match(bar, /colorBg: Style\.capsuleColor/);
assert.match(bar, /colorFg: Color\.mOnSurface/);
assert.match(bar, /colorBgHover: Color\.mHover/);
assert.match(bar, /colorFgHover: Color\.mOnHover/);
assert.match(bar, /colorBorder: "transparent"/);
assert.match(bar, /colorBorderHover: "transparent"/);
assert.match(bar, /border\.color: Style\.capsuleBorderColor/);
assert.match(bar, /border\.width: Style\.capsuleBorderWidth/);
assert.match(bar, /tooltipDirection: BarService\.getTooltipDirection\(screen\?\.name\)/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/plugin-client.test.js
```

Expected: the new capsule assertions fail against the current `palette` button.

- [ ] **Step 3: Copy the installed native capsule properties exactly**

Add `import qs.Commons` and `import qs.Services.UI`, retain `NIconButton`, and set exactly the properties asserted above. Preserve `tooltipText: "Prism"`, all injected plugin properties, and the existing `pluginApi.togglePanel(screen, root)` handler.

Do not add custom sizing, colors, animation, or a Prism-specific icon asset.

- [ ] **Step 4: Run focused and QML verification**

Run:

```bash
node --test test/plugin-client.test.js
qmllint integrations/noctalia-plugin/BarWidget.qml
npm test
```

Expected: all tests pass and `qmllint` exits 0.

- [ ] **Step 5: Commit**

```bash
git add integrations/noctalia-plugin/BarWidget.qml test/plugin-client.test.js
git diff --cached --check
git commit -m "fix: match noctalia bar capsule styling"
```

---

### Task 6: Verify the live system and true up its contracts

**Files:**
- Modify: `docs/notes/noctalia-plugin-contract.md`
- Modify: `docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md`
- Modify: `docs/superpowers/plans/2026-08-15-prism-v1.md`
- Modify: `docs/superpowers/specs/2026-08-16-prism-noctalia-panel-design.md`
- Modify: `docs/superpowers/plans/2026-08-16-prism-noctalia-panel.md`

**Interfaces:**
- Consumes: the complete implementation and the live Noctalia/niri-glass/kitty installation.
- Produces: manual acceptance evidence, restored user state, and documentation whose status/checklists match the tree.

- [ ] **Step 1: Verify the static model before touching the live panel**

Run the worktree CLI directly and assert the shipped contract:

```bash
bin/prism describe --json | jq -e '
  (.params | length) == 33 and
  ([.params[] | select(.ui.control != "none")] | length) == 32 and
  ([.params[] | select(.ui.group == "Quick") | .key] | length) == 6 and
  ([.params[] | select(.key | startswith("glass.")) | .effectiveDrag] | all(. == "live")) and
  ([.params[] | select(.key == "terminal.background.opacity.active" or .key == "terminal.background.opacity.inactive") | .effectiveDrag] | all(. == "release"))'
```

Run the automated gates:

```bash
npm test
qmllint integrations/noctalia-plugin/Main.qml integrations/noctalia-plugin/PrismClient.qml integrations/noctalia-plugin/Panel.qml integrations/noctalia-plugin/ParamControl.qml integrations/noctalia-plugin/BarWidget.qml
```

Expected: the `jq` predicate succeeds, all Node tests pass, and QML lint exits 0.

- [ ] **Step 2: Record and redirect both live code paths**

The plugin link and spawned CLI must both resolve to the worktree. Record the permanent target and make a temporary `PATH` directory without changing the permanent Prism installation:

```bash
prism_plugin_link="$HOME/.config/noctalia/plugins/prism"
prism_plugin_target=$(readlink "$prism_plugin_link")
prism_test_bin=$(mktemp -d)
ln -s "$PWD/bin/prism" "$prism_test_bin/prism"
ln -sfn "$PWD/integrations/noctalia-plugin" "$prism_plugin_link"
qs kill -c noctalia-shell --any-display
PATH="$prism_test_bin:$PATH" qs -d -c noctalia-shell
```

Before interaction, confirm the plugin link and CLI source:

```bash
readlink "$prism_plugin_link"
PATH="$prism_test_bin:$PATH" command -v prism
```

If Noctalia fails to restart, restore the link and ordinary launch immediately using Step 6 before debugging.

- [ ] **Step 3: Snapshot Prism values and perform the UI acceptance checklist**

Create a private snapshot without changing the tracked/user-owned file:

```bash
prism_values_backup=$(mktemp)
cp "$HOME/.config/prism/values.yaml" "$prism_values_backup"
```

Manually verify and record pass/fail for each item:

1. Quick shows exactly six controls; all five advanced sections start collapsed.
2. Expand a section, change a value, and wait for describe refresh: it stays open. Close/reopen the panel: all advanced sections collapse.
3. Drag several glass sliders: visible panes track before pointer release, and the final displayed/stored values agree.
4. Drag both terminal-background opacity sliders: neither applies mid-drag; each release applies the final value once without drag-rate flicker.
5. Drag Window spacing: compositor gaps and glass panes change together only on release.
6. Reset a modified slider, toggle, select, color, and a multi-parameter section: values/default indicators/counts clear and no queued unset disappears.
7. Confirm descriptions remain one line where space permits and unbound controls, if any, say `unavailable`.
8. Run `rm "$prism_test_bin/prism"`, attempt one panel write, and confirm the error banner remains visible while the panel stays usable. Then run `ln -s "$PWD/bin/prism" "$prism_test_bin/prism"`, retry the same write, and confirm recovery.

9. Compare the bar widget to its neighbors: `wand` is monochrome and its size, background, border, foreground, and hover treatment match.

- [ ] **Step 4: Diagnose live glass only if acceptance item 3 fails**

If panes do not move before release, trace the existing path without adding a new channel:

```text
ParamControl onMoved
  -> sendSlider(..., true)
  -> PrismClient queue/process
  -> values.yaml and resolved.json
  -> generated niri-glass.json inode/content
  -> niri-glass FileView reload
```

Fix the first broken link with a failing regression test, rerun Task 4's focused/full checks, and commit that fix separately. If the path works, skip this step; do not add polling, a daemon, or parallel QML state.

- [ ] **Step 5: Restore values atomically and verify system health**

Restore through a real file in the same directory so the final rename is atomic:

```bash
prism_values_restore=$(mktemp "$HOME/.config/prism/.values.restore.XXXXXX")
cp "$prism_values_backup" "$prism_values_restore"
mv "$prism_values_restore" "$HOME/.config/prism/values.yaml"
bin/prism apply
bin/prism doctor
```

Expected: `apply` and `doctor` succeed. Keep the backup until the plugin and ordinary launch are also restored.

- [ ] **Step 6: Restore the permanent plugin target and ordinary launch**

```bash
ln -sfn "$prism_plugin_target" "$prism_plugin_link"
qs kill -c noctalia-shell --any-display
qs -d -c noctalia-shell
rm "$prism_values_backup"
rm "$prism_test_bin/prism"
rmdir "$prism_test_bin"
```

Verify:

```bash
readlink "$prism_plugin_link"
command -v prism
bin/prism doctor
```

Expected: the plugin link equals the recorded target, ordinary `prism` resolution is restored, and doctor succeeds.

- [ ] **Step 7: Update documentation from the evidence**

Update `docs/notes/noctalia-plugin-contract.md` with:

- the exact native capsule properties and `qs.Services.UI` dependency;
- quiet inline section composition and why `NCollapsible` is unsuitable;
- native control label/description/default APIs and the Prism-owned Reset;
- optional manifest `drag: release` and aggregated `effectiveDrag`.

In the v1 design and plan, replace stale backend-group/liveness-badge prose with the semantic presentation and distinguish `effectiveLiveness` capability from `effectiveDrag` interaction. At `docs/superpowers/plans/2026-08-15-prism-v1.md`'s literal describe-shape contract (currently around line 1070), retain `bindings: [{sink, liveness}]` and add `effectiveDrag` after `effectiveLiveness`.

Only after automated and manual evidence exists:

- mark this plan's completed checkboxes;
- change this design's status from `Approved — ready for implementation planning` to `Implemented on feature branch — merge pending`;
- add exact implementation commit hashes from `git log --oneline`;
- correct any old manual-acceptance checkbox or status claim that the live evidence supersedes.

Grep for propagated drift:

```bash
rg -n "backend-named|liveness badge|live / reload|effectiveLiveness|group sections|reset group|open manual|wall of" docs README.md
```

Read every hit; update only stale user-facing claims, not historical review rationale or code examples that are explicitly labeled historical.

- [ ] **Step 8: Run final verification and commit named paths**

Run:

```bash
npm test
qmllint integrations/noctalia-plugin/Main.qml integrations/noctalia-plugin/PrismClient.qml integrations/noctalia-plugin/Panel.qml integrations/noctalia-plugin/ParamControl.qml integrations/noctalia-plugin/BarWidget.qml
bin/prism doctor
git diff --check
git status --short
```

Stage only the five documentation paths:

```bash
git add docs/notes/noctalia-plugin-contract.md docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md docs/superpowers/plans/2026-08-15-prism-v1.md docs/superpowers/specs/2026-08-16-prism-noctalia-panel-design.md docs/superpowers/plans/2026-08-16-prism-noctalia-panel.md
git diff --cached --name-only
git diff --cached --check
git commit -m "docs: record streamlined noctalia panel"
```

The staged-path list must contain exactly those five files.

## Merge-time requirement

When this branch is integrated into `main`, change the new design status from `Implemented on feature branch — merge pending` to the actual merged commit and rerun the documentation drift grep in the merge commit. A design status must not claim a merge before its commit is an ancestor of `main`.
