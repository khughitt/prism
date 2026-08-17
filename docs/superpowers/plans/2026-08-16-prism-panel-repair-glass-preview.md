# Prism panel repair and isolated glass preview implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the live niri-glass configuration path, make the Prism panel compact and immediately responsive, add persistent glass enablement, and add a transient isolated material preview.

**Architecture:** niri-glass continues to own rendering and gains one named Quickshell IPC target plus a second bounded surface that reuses the production material. Prism continues to own persistent values and adds one definition-driven title toggle; preview state remains panel-local and travels through the existing FIFO without causing unnecessary `describe` refreshes. Dotfiles owns the two consumer links and the stable `qs -c niri-glass` launch contract.

**Tech Stack:** Node.js ESM, YAML definitions/manifests, Qt 6 QML/Qt Quick 3D, Quickshell IPC/layer shell, zsh/bash dotfiles tests, `node:test`.

**Implementation status:** Tasks 1–6 landed on `main`: niri-glass `6219993`,
`12eb73d`, normal-layer lifecycle fix `90bc36d`, and preview lifecycle fix
`bdb83e8`; Prism `1c5d887`, `e480ffb`, `d392aad`, and scrollbar repair
`eb3a865`, followed by Diagnostics layout/padding repair `dc8ef4b`; dotfiles
`0c7fb78`. Task 7 additionally produced reviewed Kitty
race fixes `a1fc62b` and `7665605`, passed static/transport/preview/restoration
gates, and completed
the neutral sweep. Manual Passes 1–2 accepted slider/toggle/color optimistic
updates, reconciliation, Reset alignment/clearing, and persistent Glass
disable/re-enable across panel and controlled Noctalia lifecycles; Preview
show, diagnostic grid/wallpaper switch, and close/reopen cleanup are
also accepted. Diagnostics layout, direct-IPC click-through/focus, and live
Preview dragging have since passed. Overlapping-drag fix `93790d9` evolved
through `c783d13` and `13ce02c` to final `c3a0a32`; the series is reviewed,
merged, loaded, and manually accepted after restart. Failed-write banner/
recovery also passed. The historical neutral sweep found an opaque/milky flat
face and correctly stopped before guessing a shader change. Focused niri-glass
fix `af7b05f` found that encoded `#263238` entered linear shader math and Qt
encoded it again as `#6c7a81`; its accepted runtime run reproduced `#263238`
on the isolated neutral face and normal procedural-grid parity.

## Repositories and global constraints

- `[prism]` tasks run in the existing `feat/prism-panel-ui` worktree.
- `[niri-glass]` tasks run in the niri-glass repository; `[dotfiles]` tasks run in the dotfiles repository. Commit each repository separately with conventional commits.
- The cross-repository order is load-bearing: niri-glass `conf.enabled` first; then Prism's seed/definition/binding; niri-glass preview IPC before the Prism preview caller; dotfiles wiring before live acceptance.
- Never use `git add .` or `git add -A`. Stage only the paths named by the current task, then compare `git diff --cached --name-only` with that list before committing.
- Preserve the existing dirty dotfiles `prism/*/values.yaml`; no task stages or rewrites it. Live acceptance snapshots and restores the active sparse store atomically.
- Do not put personal absolute paths in code or documentation. Dotfiles may use its existing portable `${HOME}/d/...` checkout convention; Prism and niri-glass must use `qs -c niri-glass`.
- Keep preview state out of `values.yaml`, `resolved.json`, definitions, and manifests. Only `glass.enabled` is persistent.
- Keep the current Prism FIFO, same-key sample coalescing, release ordering, error banner, and describe-refresh replay.
- A queue drain refreshes only when the batch contained a parameter write and its last completed item was not a sample.
- QML-shared JavaScript remains import-free and QV4-compatible: no object spread.
- Use `/usr/lib/qt6/bin/qmllint`, not the Qt 5 binary. Unresolved `qs.*` import/type warnings are expected; exit code 0 is the gate.
- Do not change shader terms or shipped material defaults unless Task 7's neutral sweep proves a remaining defect. Stop and discuss that evidence before expanding scope.

---

### Task 1 `[niri-glass]`: Add the live glass-enabled schema key

**Files:**
- Modify: `shell.qml`
- Create: `test/shell-contract.test.mjs`

**Interfaces:**
- Consumes: the existing `JsonAdapter` named `conf` and normal `PanelWindow` named `win`.
- Produces: `conf.enabled: bool`, default `true`; the normal layer's visibility follows it without stopping config watching or IPC.

- [x] **Step 1: Add the failing source-contract test**

Create `test/shell-contract.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../shell.qml", import.meta.url), "utf8");

test("normal glass has a true-by-default live enable switch", () => {
  assert.match(shell, /property bool enabled: true/);
  const normalWindow = shell.slice(shell.indexOf("id: win"), shell.indexOf("property string wallpaperPath"));
  assert.match(normalWindow, /visible: conf\.enabled/);
});

test("disabling the normal layer does not disable the config watcher", () => {
  const fileView = shell.slice(shell.indexOf("FileView {"), shell.indexOf("Variants {"));
  assert.match(fileView, /watchChanges: true/);
  assert.doesNotMatch(fileView, /conf\.enabled/);
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/shell-contract.test.mjs
```

Expected: the enable-switch test fails because `conf.enabled` and the visibility binding do not exist.

- [x] **Step 3: Add the minimal schema and visibility binding**

In the `JsonAdapter`, add the property before the geometry values:

```qml
property bool enabled: true
```

In the normal `PanelWindow`, immediately after `screen: modelData`, add:

```qml
visible: conf.enabled
```

Do not gate the `FileView`, wallpaper process, event stream, or shell root. Re-enabling must use already-live state.

- [x] **Step 4: Verify and commit**

Run:

```bash
node --test test/*.test.mjs
/usr/lib/qt6/bin/qmllint shell.qml
git diff --check
```

Expected: all niri-glass Node tests pass and Qt 6 lint exits 0.

Stage exactly:

```bash
git add shell.qml test/shell-contract.test.mjs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: add live glass enable switch"
```

---

### Task 2 `[prism]`: Bind glass enablement and extract the title presentation slot

**Files:**
- Modify: `test/fixtures/niri-glass-seed.json`
- Modify: `defs/glass.yaml`
- Modify: `integrations/niri-glass/manifest.yaml`
- Modify: `integrations/noctalia-plugin/presentation.mjs`
- Modify: `test/glass-defs.test.js`
- Modify: `test/niri-glass-render.test.js`
- Modify: `test/plugin-presentation.test.js`

**Interfaces:**
- Consumes: Task 1's `conf.enabled: true` and existing `groupParams(params)`.
- Produces: persistent `glass.enabled`; `titleParam(params) -> param`; `groupParams(params)` excludes `Title` and keeps the existing six body groups with `Quick` first.

- [x] **Step 1: Add the QML-mirroring seed key and verify the intended RED transition**

Add this first property to `test/fixtures/niri-glass-seed.json`:

```json
"enabled": true,
```

Run:

```bash
node --test test/glass-defs.test.js
```

Expected: FAIL with `missing def glass.enabled`. This proves the fixture is enforcing the cross-repository schema boundary.
The focused command reports that intended failure; running the full suite at
this intermediate point also makes `test/niri-glass-render.test.js` fail its
closed rendered-key-set assertion until Step 3 lands.

- [x] **Step 2: Add failing title-routing and rendered-output assertions**

Import `titleParam` in `test/plugin-presentation.test.js` and extend the synthetic fixture with:

```js
{ key: 'title.enabled', ui: { control: 'toggle', group: 'Title', order: 0 } },
```

Before the existing body-group assertion, add:

```js
assert.equal(titleParam(params).key, 'title.enabled');
assert.equal(groupParams(params).flatMap((group) => group.params)
  .some((param) => param.ui.group === 'Title'), false);
```

Replace the shipped-structure coverage tail with:

```js
const title = titleParam(defs);
assert.equal(title.key, 'glass.enabled');
assert.equal(title.ui.control, 'toggle');
const renderedKeys = groups.flatMap((group) => group.params.map((param) => param.key));
assert.equal(renderedKeys.length, 32);
assert.equal(new Set(renderedKeys).size, 32);
const allRenderedKeys = [title.key].concat(renderedKeys);
assert.equal(allRenderedKeys.length, 33);
assert.equal(new Set(allRenderedKeys).size, 33);
assert.deepEqual(allRenderedKeys.slice().sort(), visible.map((def) => def.key).sort());
```

In `test/niri-glass-render.test.js`, add:

```js
test('glass enablement renders true by default and follows resolution', () => {
  const defs = loadDefs(defsDir());
  assert.equal(renderGlassConfig({ params: resolveParams(defs, {}) }).enabled, true);
  assert.equal(renderGlassConfig({ params: resolveParams(defs, { 'glass.enabled': false }) }).enabled, false);
});
```

Run:

```bash
node --test test/glass-defs.test.js test/niri-glass-render.test.js test/plugin-presentation.test.js
```

Expected: failures for the missing definition, binding/output, and `titleParam` export.

- [x] **Step 3: Add the definition and manifest binding**

Add this first definition to `defs/glass.yaml`:

```yaml
- key: glass.enabled
  type: bool
  default: true
  ui: {group: Title, control: toggle, label: Glass, order: 0}
  description: Render the niri glass layer
```

Add this first glass binding in `integrations/niri-glass/manifest.yaml`:

```yaml
- {param: glass.enabled, liveness: live}
```

No renderer branch is needed: `renderGlassConfig` already strips the `glass.` prefix generically.

- [x] **Step 4: Implement the title/body split in the existing helper**

Add to `presentation.mjs`:

```js
export function titleParam(params) {
  var matches = [];
  for (var i = 0; i < params.length; i++) {
    if (params[i].ui.control !== 'none' && params[i].ui.group === 'Title') {
      matches.push(params[i]);
    }
  }
  if (matches.length !== 1 || matches[0].ui.control !== 'toggle') {
    throw new Error('Title must contain exactly one visible toggle');
  }
  return matches[0];
}
```

Change the visible filter in `groupParams` so `Title` is extracted, not returned:

```js
if (params[i].ui.control !== 'none' && params[i].ui.group !== 'Title') {
  visible.push(params[i]);
}
```

Keep the existing Quick-first `unshift`; the exact body group order remains:

```text
Quick, Opacity & Focus, Glass Shape, Glass Optics, Motion, Diagnostics
```

- [x] **Step 5: Verify and commit**

Run:

```bash
node --test test/glass-defs.test.js test/niri-glass-render.test.js test/plugin-presentation.test.js
npm test
git diff --check
```

Expected: all Prism tests pass; defaults render 34 total parameters, 33 visible, 32 in body groups, one in `Title`, and six in Quick.

Stage exactly:

```bash
git add test/fixtures/niri-glass-seed.json defs/glass.yaml integrations/niri-glass/manifest.yaml integrations/noctalia-plugin/presentation.mjs test/glass-defs.test.js test/niri-glass-render.test.js test/plugin-presentation.test.js
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: add glass enable presentation slot"
```

---

### Task 3 `[prism]`: Compact the panel and make controls optimistic

**Files:**
- Modify: `integrations/noctalia-plugin/Panel.qml`
- Modify: `integrations/noctalia-plugin/ParamControl.qml`
- Modify: `test/plugin-client.test.js`

**Interfaces:**
- Consumes: Task 2's `Presentation.titleParam` and unchanged body-group array.
- Produces: a definition-driven title toggle, no visible Quick heading, compact rows, locally immediate displayed values, and Reset/hint alignment on the control line.

- [x] **Step 1: Add failing structural assertions**

In `test/plugin-client.test.js`, add:

```js
test('panel extracts the title toggle without naming its parameter key', () => {
  assert.match(panel, /property var titleSetting: null/);
  assert.match(panel, /root\.titleSetting = Presentation\.titleParam\(model\.params\)/);
  assert.match(panel, /root\.client\.set\(root\.titleSetting\.key, checked, false\)/);
  assert.doesNotMatch(panel, /glass\.enabled/);
});

test('basic controls start directly below the title and use compact type', () => {
  assert.doesNotMatch(panel, /text: "Quick"/);
  assert.match(panel, /text: "Prism"[\s\S]*pointSize: Style\.fontSizeL/);
  assert.match(control, /id: parameterLabel[\s\S]*pointSize: Style\.fontSizeM/);
  assert.match(control, /id: parameterDescription[\s\S]*pointSize: Style\.fontSizeS/);
  assert.match(control, /textSize: Style\.fontSizeS/);
});

test('controls update local display state before writing', () => {
  assert.match(control, /property var displayedValue: param\.value/);
  assert.match(control, /value: root\.displayedValue/);
  assert.match(control, /root\.displayedValue = value;[\s\S]*sendSlider\(value,/);
  assert.match(control, /root\.displayedValue = checked;[\s\S]*root\.client\.set\(root\.param\.key, checked, false\)/);
  assert.match(control, /root\.displayedValue = key;[\s\S]*root\.client\.set\(root\.param\.key, key, false\)/);
  assert.match(control, /root\.displayedValue = hex;[\s\S]*root\.client\.set\(root\.param\.key, hex, false\)/);
});

test('hint and reset share the trailing edge of the control row', () => {
  const row = control.slice(control.indexOf('id: controlRow'));
  const hintAt = row.indexOf('id: livenessHint');
  const resetAt = row.indexOf('id: resetButton');
  assert.ok(hintAt >= 0 && resetAt > hintAt);
  assert.match(row.slice(hintAt, resetAt), /pointSize: Style\.fontSizeXS/);
  assert.match(row.slice(resetAt), /baseSize: Style\.baseWidgetSize \* 0\.6/);
});

test('Prism owns the sole per-parameter modified indicator', () => {
  assert.doesNotMatch(control, /defaultValue:/);
});
```

Adjust the existing grouping assertion to require both assignments:

```js
assert.match(panel, /root\.titleSetting = Presentation\.titleParam\(model\.params\)/);
assert.match(panel, /root\.groups = Presentation\.groupParams\(model\.params\)/);
```

The second assertion is load-bearing for optimistic reconciliation: replacing
the group model recreates delegates and restores each `displayedValue` binding.
An in-place update must add explicit reconciliation before this assertion can
be relaxed.

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test test/plugin-client.test.js
```

Expected: failures for title extraction, the visible Quick heading, compact type, local state, and row alignment.

- [x] **Step 3: Implement the title slot and compact group spacing**

In `Panel.qml`, add root state:

```qml
property var titleSetting: null
property bool titleValue: true
```

Update the describe handler in this order:

```qml
root.titleSetting = Presentation.titleParam(model.params);
root.titleValue = root.titleSetting.value === true;
root.groups = Presentation.groupParams(model.params);
```

Replace the standalone title with this row:

```qml
RowLayout {
  Layout.fillWidth: true

  NText {
    Layout.fillWidth: true
    text: "Prism"
    pointSize: Style.fontSizeL
    font.weight: Style.fontWeightBold
  }

  NText {
    visible: root.titleSetting !== null
    text: root.titleSetting ? root.titleSetting.ui.label : ""
    pointSize: Style.fontSizeS
  }

  NToggle {
    visible: root.titleSetting !== null
    Layout.fillWidth: false
    label: ""
    description: ""
    checked: root.titleValue
    onToggled: function(checked) {
      root.titleValue = checked;
      root.client.set(root.titleSetting.key, checked, false);
    }
  }
}
```

Remove the Quick `NText` completely. Retain the Quick surface and direct-open behavior. Reduce panel outer margins from `Style.marginL` to `Style.marginM`, group-list spacing from `Style.marginL` to `Style.marginM`, parameter-list spacing from `Style.marginM` to `Style.marginS`, and the Quick surface padding from `Style.marginM` to `Style.marginS`.

- [x] **Step 4: Recompose `ParamControl` around one Prism-owned label block and control row**

Add:

```qml
property var displayedValue: param.value
```

Change the outer root to `ColumnLayout` with `spacing: Style.marginXS`. Put these labels first:

```qml
NText {
  id: parameterLabel
  Layout.fillWidth: true
  text: root.param.ui.label || ""
  pointSize: Style.fontSizeM
  font.weight: Style.fontWeightMedium
}

NText {
  id: parameterDescription
  Layout.fillWidth: true
  text: root.param.description || ""
  pointSize: Style.fontSizeS
  color: Color.mOnSurfaceVariant
  elide: Text.ElideRight
}
```

Place all four mutually exclusive native controls in one `RowLayout { id: controlRow }`. Set every native `label` and `description` to `""`. Use these value bindings and handlers:

Remove every native `defaultValue` assignment as well. With Prism-owned labels,
the native label indicator is absent intentionally; the trailing Reset icon is
the sole per-parameter modified marker, and the section count remains the
group-level marker.

```qml
NValueSlider {
  value: root.displayedValue
  text: Presentation.formatValue(root.displayedValue, root.stepSize)
  textSize: Style.fontSizeS
  onMoved: function(value) {
    root.displayedValue = value;
    if (pointerPressed) {
      if (liveDrag && !sampleGate.running) {
        sendSlider(value, true);
        sampleGate.restart();
      }
    } else {
      pendingValue = value;
      commitGate.restart();
    }
  }
}

NToggle {
  checked: root.displayedValue === true
  onToggled: function(checked) {
    root.displayedValue = checked;
    root.client.set(root.param.key, checked, false);
  }
}

NComboBox {
  currentKey: String(root.displayedValue)
  onSelected: function(key) {
    root.displayedValue = key;
    root.client.set(root.param.key, key, false);
  }
}

NColorPicker {
  selectedColor: root.displayedValue
  onColorSelected: function(color) {
    var hex = root.colorHex(color);
    root.displayedValue = hex;
    root.client.set(root.param.key, hex, false);
  }
}
```

Keep the existing slider timers, pointer/release behavior, quantization helper, and destruction flush unchanged apart from assigning `displayedValue` first.

After the controls, add the trailing hint then Reset:

```qml
NText {
  id: livenessHint
  visible: root.param.effectiveDrag === null || root.param.effectiveDrag === "release"
  text: root.param.effectiveDrag === null ? "unavailable" : "on release"
  pointSize: Style.fontSizeXS
  color: Color.mOnSurfaceVariant
  opacity: 0.55
}

NIconButton {
  id: resetButton
  visible: root.param.modified
  baseSize: Style.baseWidgetSize * 0.6
  icon: "restore"
  tooltipText: "Reset to default"
  onClicked: {
    root.displayedValue = root.param.default;
    root.client.unset(root.param.key);
  }
}
```

- [x] **Step 5: Verify and commit**

Run:

```bash
node --test test/plugin-client.test.js test/plugin-presentation.test.js
npm test
/usr/lib/qt6/bin/qmllint integrations/noctalia-plugin/Main.qml integrations/noctalia-plugin/PrismClient.qml integrations/noctalia-plugin/Panel.qml integrations/noctalia-plugin/ParamControl.qml integrations/noctalia-plugin/BarWidget.qml
git diff --check
```

Expected: all Node tests pass and Qt 6 lint exits 0 with only the documented unresolved `qs.*` family of warnings.

Stage exactly:

```bash
git add integrations/noctalia-plugin/Panel.qml integrations/noctalia-plugin/ParamControl.qml test/plugin-client.test.js
git diff --cached --name-only
git diff --cached --check
git commit -m "fix: compact prism controls and update values eagerly"
```

---

### Task 4 `[niri-glass]`: Add the shared material and isolated preview IPC

**Files:**
- Create: `GlassMaterial.qml`
- Create: `PreviewSurface.qml`
- Create: `assets/diagnostic-grid.svg`
- Create: `preview.mjs`
- Create: `test/preview.test.mjs`
- Modify: `test/shell-contract.test.mjs`
- Modify: `shell.qml`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1's live `conf`, current wallpaper path, `WallMap.cropFillUv`, slab mesh, and production shaders.
- Produces: `IpcHandler` target `prismGlass`; `showPreview(output, side, diagnosticBackground)`; idempotent `hidePreview()`; one preview surface on the selected output; one `GlassMaterial` used by normal panes and preview.

- [x] **Step 1: Add failing pure preview-state tests**

Create `test/preview.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import * as Preview from "../preview.mjs";

test("show validates and replaces transient preview state", () => {
  const first = Preview.show(["DP-1", "HDMI-A-1"], "DP-1", "left", false);
  assert.deepEqual(first, { visible: true, output: "DP-1", side: "left", diagnosticBackground: false });
  const moved = Preview.show(["DP-1", "HDMI-A-1"], "HDMI-A-1", "right", true);
  assert.deepEqual(moved, { visible: true, output: "HDMI-A-1", side: "right", diagnosticBackground: true });
  assert.throws(() => Preview.show(["DP-1"], "missing", "left", false), /unknown output/);
  assert.throws(() => Preview.show(["DP-1"], "DP-1", "center", false), /invalid side/);
});

test("hide is idempotent and starts hidden", () => {
  assert.deepEqual(Preview.hide(), Preview.hidden());
  assert.deepEqual(Preview.hide(), Preview.hidden());
});
```

Extend `test/shell-contract.test.mjs`:

```js
const material = await readFile(new URL("../GlassMaterial.qml", import.meta.url), "utf8");
const preview = await readFile(new URL("../PreviewSurface.qml", import.meta.url), "utf8");
const grid = await readFile(new URL("../assets/diagnostic-grid.svg", import.meta.url), "utf8");

test("normal panes and preview use the same material component", () => {
  assert.equal((shell.match(/GlassMaterial\s*\{/g) || []).length, 1);
  assert.equal((preview.match(/GlassMaterial\s*\{/g) || []).length, 1);
  assert.doesNotMatch(shell, /materials: CustomMaterial\s*\{/);
});

test("preview is bounded, overlay, and input transparent", () => {
  assert.match(preview, /WlrLayershell\.layer: WlrLayer\.Overlay/);
  assert.match(preview, /WlrLayershell\.keyboardFocus: WlrKeyboardFocus\.None/);
  assert.match(preview, /exclusionMode: ExclusionMode\.Ignore/);
  assert.match(preview, /mask: Region\s*\{\}/);
  assert.match(preview, /Math\.min\(1200, screen\.width \* 0\.42\)/);
  assert.match(preview, /Math\.min\(900, screen\.height \* 0\.70\)/);
  assert.match(preview, /source: Qt\.resolvedUrl\("assets\/studio_small_09_1k\.hdr"\)/);
  assert.match(preview, /probeExposure: config\.probeExposure/);
});

test("shell exposes the fixed prismGlass IPC contract", () => {
  assert.match(shell, /target: "prismGlass"/);
  assert.match(shell, /function showPreview\(output: string, side: string, diagnosticBackground: bool\)/);
  assert.match(shell, /function hidePreview\(\)/);
});

test("diagnostic background is the fixed neutral 40/200 grid", () => {
  assert.match(grid, /fill="#263238"/);
  assert.match(grid, /M40 0V200M80 0V200M120 0V200M160 0V200/);
  assert.match(grid, /M\.5 0V200M199\.5 0V200/);
});
```

- [x] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test test/preview.test.mjs test/shell-contract.test.mjs
```

Expected: failures for missing `preview.mjs`, shared material, preview surface, and IPC target.

- [x] **Step 3: Implement the import-free preview state helper**

Create `preview.mjs`:

```js
export function hidden() {
  return { visible: false, output: "", side: "right", diagnosticBackground: false };
}

export function show(outputs, output, side, diagnosticBackground) {
  if (outputs.indexOf(output) === -1) throw new Error("unknown output: " + output);
  if (side !== "left" && side !== "right") throw new Error("invalid side: " + side);
  return {
    visible: true,
    output: output,
    side: side,
    diagnosticBackground: diagnosticBackground === true,
  };
}

export function hide() {
  return hidden();
}
```

Do not add history or persistence; current state is one replaced object.

- [x] **Step 4: Extract the production custom material once**

Create `GlassMaterial.qml` as the existing `CustomMaterial` block with these inputs:

```qml
import QtQuick
import QtQuick3D

CustomMaterial {
  id: root
  required property var config
  required property Texture wallpaperTexture
  property vector2d jellyMove: Qt.vector2d(0, 0)
  property vector2d jellyResize: Qt.vector2d(0, 0)
  property real jellyActivity: 0
  property real jellyTime: 0
  property real jellyRipple: 0
  property vector3d jellyOffset: Qt.vector3d(0, 0, 0)
  required property vector2d paneSize
  required property real slabDepth
  property bool gridOverlay: false
  property real glint: 0
  property vector2d glintDirection: Qt.vector2d(1, -1)
  required property vector2d screenSize
  required property vector2d uvScale
  required property vector2d uvOffset

  function checked(name, value, low, high, fallback) {
    if (typeof value === "number" && value >= low && value <= high) return value;
    console.warn("glasspanes: config " + name + "=" + value
      + " outside [" + low + ", " + high + "]; using " + fallback);
    return fallback;
  }

  shadingMode: CustomMaterial.Shaded
  vertexShader: "shaders/glass.vert"
  fragmentShader: "shaders/glass.frag"
  property vector2d uJellyMove: root.jellyMove
  property vector2d uJellyResize: root.jellyResize
  property real uJellyActivity: root.jellyActivity
  property real uJellyTime: root.jellyTime
  property real uJellyRipple: root.jellyRipple
  property vector3d uJellyOffset: root.jellyOffset
  property vector2d uPaneSize: root.paneSize
  property real uSlabDepth: root.slabDepth
  property TextureInput uWallpaper: TextureInput { texture: root.wallpaperTexture }
  property real uIor: checked("ior", config.ior, 1, 3, 1.5)
  property real uThickness: checked("thickness", config.thickness, 0.1, 200, 20)
  property real uGlassRoughness: checked("roughness", config.roughness, 0, 1, 0.08)
  property real uTransmission: checked("transmission", config.transmission, 0, 1, 0.95)
  property color uAttColor: config.attenuationColor
  property real uAttDistance: checked("attenuationDistance", config.attenuationDistance, 1, 10000, 60)
  property real uChromAb: checked("chromaticAberration", config.chromaticAberration, 0, 2, 0)
  property real uDistortion: checked("distortion", config.distortion, 0, 2, 0)
  property real uDistortionScale: checked("distortionScale", config.distortionScale, 0.01, 10, 0.5)
  property int uSampleCount: checked("samples", config.samples, 1, 8, 4)
  property real uAnisoBlur: checked("anisotropicBlur", config.anisotropicBlur, 0, 1, 0)
  property bool uGridOverlay: root.gridOverlay
  property real uGlint: root.glint
  property vector2d uGlintDirection: root.glintDirection
  property vector2d uScreenSize: root.screenSize
  property vector2d uUvScale: root.uvScale
  property vector2d uUvOffset: root.uvOffset
}
```

Replace the existing inline `CustomMaterial` in `shell.qml` with `GlassMaterial`, passing the same values. Do not move geometry, spring, jelly, shadow, or focus-glint behavior.

- [x] **Step 5: Add the fixed diagnostic texture and bounded preview surface**

Create `assets/diagnostic-grid.svg` as this 200×200 neutral-slate tile:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#263238"/>
  <g fill="none" stroke="#fff" stroke-width="1" opacity="0.18">
    <path d="M40 0V200M80 0V200M120 0V200M160 0V200"/>
    <path d="M0 40H200M0 80H200M0 120H200M0 160H200"/>
  </g>
  <path d="M.5 0V200M199.5 0V200M0 .5H200M0 199.5H200"
        fill="none" stroke="#fff" stroke-width="1" opacity="0.34"/>
  <path d="M0 7V0H7M193 0H200V7M0 193V200H7M193 200H200V193"
        fill="none" stroke="#fff" stroke-width="1" opacity="0.60"/>
</svg>
```

This keeps the fixed color and 40/200 px grid in one reusable file; add no
runtime color settings.

Create `PreviewSurface.qml` with this public surface:

```qml
required property var config
required property var previewState
required property string outputName
required property string wallpaperPath
property bool selected: previewState.visible && previewState.output === outputName
visible: selected
width: Math.min(1200, screen.width * 0.42)
height: Math.min(900, screen.height * 0.70)
```

Use `WlrLayer.Overlay`, `WlrKeyboardFocus.None`, `ExclusionMode.Ignore`, namespace `glasspanes-preview`, and `mask: Region {}`. Anchor to `previewState.side`, anchor top, set the selected edge margin to 32, and set the top margin to `Math.round((screen.height - height) / 2)`.

Display either the crop-filled wallpaper or a tiled `diagnostic-grid.svg`. Feed the same chosen source into a mipmapped Qt Quick 3D `Texture`. For diagnostic mode use texture repeat with UV scale `width / 200` and `-height / 200`; for wallpaper mode reuse `WallMap.cropFillUv`. Render one centered slab at 75% of the preview width/height using `SlabMesh.buildSlabMesh`, the existing shaders through `GlassMaterial`, and no spring, shadow, or focus glint.

Use the production lighting environment in the preview `View3D`:

```qml
environment: SceneEnvironment {
  backgroundMode: SceneEnvironment.Transparent
  antialiasingMode: SceneEnvironment.MSAA
  lightProbe: Texture {
    source: Qt.resolvedUrl("assets/studio_small_09_1k.hdr")
  }
  probeExposure: config.probeExposure
}
```

This is load-bearing for the neutral sweep: preview and normal panes must see
the same probe contribution.

- [x] **Step 6: Wire one global IPC state to per-output preview variants**

Import `preview.mjs` in `shell.qml`, give `ShellRoot` the id `root`, and add
root state for preview and the already-fetched per-output wallpaper paths:

```qml
property var previewState: Preview.hidden()
property var wallpaperPaths: ({})

function setWallpaperPath(output, path) {
  var next = {};
  var keys = Object.keys(wallpaperPaths);
  for (var i = 0; i < keys.length; i++) next[keys[i]] = wallpaperPaths[keys[i]];
  next[output] = path;
  wallpaperPaths = next;
}

function outputNames() {
  var names = [];
  for (var i = 0; i < Quickshell.screens.length; i++) names.push(Quickshell.screens[i].name);
  return names;
}

IpcHandler {
  target: "prismGlass"

  function showPreview(output: string, side: string, diagnosticBackground: bool): void {
    previewState = Preview.show(outputNames(), output, side, diagnosticBackground);
  }

  function hidePreview(): void {
    previewState = Preview.hide();
  }
}
```

In each normal window, add:

```qml
onWallpaperPathChanged: root.setWallpaperPath(modelData.name, wallpaperPath)
```

Add a second `Variants { model: Quickshell.screens }` whose delegate is `PreviewSurface` with `screen: modelData`, `outputName: modelData.name`, the shared `conf`, root preview state, and the same wallpaper path for that output. Keep the normal and preview windows separate.

Bind the preview wallpaper explicitly:

```qml
wallpaperPath: root.wallpaperPaths[modelData.name] || ""
```

- [x] **Step 7: Document, verify, and commit**

Update `README.md` with:

- `enabled` is a watched persistent config key;
- preview is transient IPC state and starts hidden;
- exact `qs -c niri-glass ipc call prismGlass showPreview <output> <left|right> <true|false>` and `hidePreview` commands;
- the material samples wallpaper/diagnostic texture, not compositor window pixels;
- transmission below 1 retains a white diffuse contribution before specular/emissive terms.

Run:

```bash
node --test test/*.test.mjs
/usr/lib/qt6/bin/qmllint shell.qml GlassMaterial.qml PreviewSurface.qml
git diff --check
```

Expected: all niri-glass tests pass and Qt 6 lint exits 0.

Stage exactly:

```bash
git add GlassMaterial.qml PreviewSurface.qml assets/diagnostic-grid.svg preview.mjs test/preview.test.mjs test/shell-contract.test.mjs shell.qml README.md
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: add isolated glass material preview"
```

---

### Task 5 `[prism]`: Route preview IPC through the existing FIFO

**Files:**
- Modify: `integrations/noctalia-plugin/queue.mjs`
- Modify: `integrations/noctalia-plugin/PrismClient.qml`
- Modify: `integrations/noctalia-plugin/Panel.qml`
- Modify: `integrations/noctalia-plugin/presentation.mjs`
- Modify: `test/plugin-queue.test.js`
- Modify: `test/plugin-client.test.js`
- Modify: `test/plugin-presentation.test.js`

**Interfaces:**
- Consumes: Task 4's `prismGlass` IPC and Task 3's compact Diagnostics section.
- Produces: FIFO verbs `preview-show`/`preview-hide`; `Queue.affectsParams(item)`; `Queue.shouldRefresh(batchAffectsParams, lastItem)`; panel-local Preview and Diagnostic-background toggles.

- [x] **Step 1: Add failing queue command and refresh truth-table tests**

In `test/plugin-queue.test.js`, add:

```js
const previewShow = (output, side, diagnosticBackground) => ({
  verb: 'preview-show', output, side, diagnosticBackground,
});
const previewHide = () => ({ verb: 'preview-hide' });

test('preview verbs have explicit path-free Quickshell argv', () => {
  assert.deepEqual(argvFor(previewShow('DP-1', 'right', true)), [
    'qs', '-c', 'niri-glass', 'ipc', 'call', 'prismGlass',
    'showPreview', 'DP-1', 'right', 'true',
  ]);
  assert.deepEqual(argvFor(previewHide()), [
    'qs', '-c', 'niri-glass', 'ipc', 'call', 'prismGlass', 'hidePreview',
  ]);
});

test('only set and unset items affect persistent parameter state', () => {
  assert.equal(Queue.affectsParams(sample('a.x', 1)), true);
  assert.equal(Queue.affectsParams(release('a.x', 1)), true);
  assert.equal(Queue.affectsParams(unset('a.x')), true);
  assert.equal(Queue.affectsParams(previewShow('DP-1', 'right', false)), false);
  assert.equal(Queue.affectsParams(previewHide()), false);
});

test('drain refresh requires a parameter write and a non-sample tail', () => {
  assert.equal(Queue.shouldRefresh(false, previewHide()), false);
  assert.equal(Queue.shouldRefresh(true, release('a.x', 1)), true);
  assert.equal(Queue.shouldRefresh(true, previewHide()), true);
  assert.equal(Queue.shouldRefresh(true, sample('a.x', 1)), false);
});
```

Add a FIFO assertion that enqueues `release`, `previewHide`, and another `sample` and confirms all three remain ordered; preview verbs are discrete and never coalesce.

- [x] **Step 2: Add failing client/panel source contracts**

In `test/plugin-client.test.js`, add assertions for:

```js
assert.match(source, /property bool batchAffectsParams: false/);
assert.match(source, /batchAffectsParams = batchAffectsParams \|\| Queue\.affectsParams\(item\)/);
assert.match(source, /var shouldRefresh = Queue\.shouldRefresh\(batchAffectsParams, queue\.inFlight\)/);
assert.match(source, /batchAffectsParams = false/);
assert.match(source, /function showPreview\(output, side, diagnosticBackground\)/);
assert.match(source, /function hidePreview\(\)/);
assert.match(panel, /property bool previewVisible: false/);
assert.match(panel, /property bool diagnosticBackground: false/);
assert.match(panel, /Component\.onDestruction: if \(root\.client\) root\.client\.hidePreview\(\)/);
assert.doesNotMatch(panel, /glass\.enabled/);
```

Replace the old sample-only refresh source assertion with the new conjunction. Include the reachable regression explicitly:

```js
test('a final write followed by a new drag sample defers refresh', () => {
  assert.equal(Queue.shouldRefresh(true, { verb: 'set', key: 'a.x', value: 2, sample: true }), false);
});
```

- [x] **Step 3: Run focused tests and verify RED**

Run:

```bash
node --test test/plugin-queue.test.js test/plugin-client.test.js
```

Expected: failures for missing preview argv, parameter classification, refresh conjunction, client methods, and panel-local toggles.

- [x] **Step 4: Implement queue classification and exact argv**

Add to `queue.mjs`:

```js
export function affectsParams(item) {
  return item.verb === 'set' || item.verb === 'unset';
}

export function shouldRefresh(batchAffectsParams, lastItem) {
  return batchAffectsParams && !isSample(lastItem);
}
```

Make `argvFor` explicit for every supported verb and fail early on unknown verbs:

```js
export function argvFor(item) {
  if (item.verb === 'set') return ['prism', 'set', item.key, String(item.value)];
  if (item.verb === 'unset') return ['prism', 'unset', item.key];
  if (item.verb === 'preview-show') return [
    'qs', '-c', 'niri-glass', 'ipc', 'call', 'prismGlass',
    'showPreview', item.output, item.side, String(item.diagnosticBackground),
  ];
  if (item.verb === 'preview-hide') return [
    'qs', '-c', 'niri-glass', 'ipc', 'call', 'prismGlass', 'hidePreview',
  ];
  throw new Error('unknown queue verb: ' + item.verb);
}
```

- [x] **Step 5: Apply the drain conjunction in `PrismClient`**

Add:

```qml
property bool batchAffectsParams: false

function showPreview(output, side, diagnosticBackground) {
  push({ verb: "preview-show", output: output, side: side,
         diagnosticBackground: diagnosticBackground });
}

function hidePreview() {
  push({ verb: "preview-hide" });
}
```

At the start of `push(item)`, accumulate:

```qml
batchAffectsParams = batchAffectsParams || Queue.affectsParams(item);
```

In `writeDone`, calculate against the item that just finished before calling `Queue.finish`:

```qml
var shouldRefresh = Queue.shouldRefresh(batchAffectsParams, queue.inFlight);
var result = Queue.finish(queue);
```

At drain, reset the batch flag before signals or refresh can enqueue more work:

```qml
} else if (result.drained) {
  batchAffectsParams = false;
  drained();
  if (shouldRefresh) refresh();
}
```

Remove `completedSample`; the new predicate subsumes it.

- [x] **Step 6: Add panel-local preview controls**

Add root properties and side calculation to `Panel.qml`:

```qml
property bool previewVisible: false
property bool diagnosticBackground: false

function previewSide() {
  var screen = root.pluginApi ? root.pluginApi.panelOpenScreen : null;
  if (!screen) return "right";
  var panelCenter = root.mapToGlobal(root.width / 2, root.height / 2).x;
  return Presentation.oppositeSide(panelCenter, screen.x + screen.width / 2);
}

function updatePreview() {
  var screen = root.pluginApi ? root.pluginApi.panelOpenScreen : null;
  if (root.previewVisible && screen) {
    root.client.showPreview(screen.name, root.previewSide(), root.diagnosticBackground);
  }
}

Component.onDestruction: if (root.client) root.client.hidePreview()
```

Add to `presentation.mjs`:

```js
export function oppositeSide(panelCenterX, screenCenterX) {
  return panelCenterX <= screenCenterX ? 'right' : 'left';
}
```

Import it in `test/plugin-presentation.test.js` and add:

```js
test('preview opens opposite the panel', () => {
  assert.equal(oppositeSide(300, 1000), 'right');
  assert.equal(oppositeSide(1700, 1000), 'left');
});
```

Inside the expanded Diagnostics content, before its parameter `Repeater`, add one compact row visible only for that group:

`Diagnostics` is the third and final presentation convention alongside
`Title` and `Quick`. It remains a normal body group; QML uses its conventional
name only to insert these transient controls before its parameter repeater.

```qml
RowLayout {
  visible: groupSurface.modelData.name === "Diagnostics"
  Layout.fillWidth: true

  NToggle {
    label: "Preview"
    description: "Show an isolated glass sample"
    checked: root.previewVisible
    onToggled: function(checked) {
      root.previewVisible = checked;
      if (checked) root.updatePreview();
      else root.client.hidePreview();
    }
  }

  NToggle {
    visible: root.previewVisible
    enabled: root.previewVisible
    label: "Diagnostic background"
    description: "Use a neutral grid instead of wallpaper"
    checked: root.diagnosticBackground
    onToggled: function(checked) {
      root.diagnosticBackground = checked;
      root.updatePreview();
    }
  }
}
```

Preview toggles never enter modified counts or Reset lists because they are not definition parameters.

Extend the panel source-contract test to assert the declared convention:

```js
assert.match(panel, /modelData\.name === "Diagnostics"/);
```

- [x] **Step 7: Verify and commit**

Run:

```bash
node --test test/plugin-queue.test.js test/plugin-client.test.js test/plugin-presentation.test.js
npm test
/usr/lib/qt6/bin/qmllint integrations/noctalia-plugin/Main.qml integrations/noctalia-plugin/PrismClient.qml integrations/noctalia-plugin/Panel.qml integrations/noctalia-plugin/ParamControl.qml integrations/noctalia-plugin/BarWidget.qml
git diff --check
```

Stage exactly:

```bash
git add integrations/noctalia-plugin/queue.mjs integrations/noctalia-plugin/PrismClient.qml integrations/noctalia-plugin/Panel.qml integrations/noctalia-plugin/presentation.mjs test/plugin-queue.test.js test/plugin-client.test.js test/plugin-presentation.test.js
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: control isolated glass preview"
```

---

### Task 6 `[dotfiles]`: Install and health-check the niri-glass consumers

**Files:**
- Modify: `setup.sh`
- Modify: `bin/dotfiles-health`
- Modify: `niri/config.kdl`
- Modify: `tests/setup_and_health.zsh`

**Interfaces:**
- Consumes: Task 4's named Quickshell config and the existing Prism-generated `niri-glass.json`.
- Produces: `$XDG_CONFIG_HOME/quickshell/niri-glass` -> `${HOME}/d/niri-glass`; niri launch via `qs -c niri-glass`; exact health checks for both consumer links and the root-config exclusion.

- [x] **Step 1: Extend the test fixture and add failing dry-run setup assertions**

In `run_setup`, create a real fixture source before invoking setup:

```zsh
mkdir -p "${tmp}/home/d/niri-glass" "${tmp}/home/d/prism/integrations/noctalia-plugin" "${tmp}/bin"
touch "${tmp}/home/d/niri-glass/shell.qml"
```

Also add `PATH="${tmp}/bin:$PATH"` to the environment passed to `setup.sh`, so
the existing hostname fixture selects `prism/titan` during graphical dry
runs.

Add `test_setup_graphical_config_plans_niri_glass`:

```zsh
test_setup_graphical_config_plans_niri_glass() {
  local tmp output
  tmp=$(make_tmpdir)
  register_tmp_cleanup "$tmp"
  mkdir -p "${tmp}/home" "${tmp}/config" "${tmp}/data"

  output=$(PRISM_TEST_HOSTNAME=titan \
    run_setup "$tmp" --dry-run --link-only --only graphical-config)

  [[ "$output" == *"${tmp}/home/d/niri-glass"* ]] || \
    fail "graphical setup did not plan the niri-glass source"
  [[ "$output" == *"${tmp}/config/quickshell/niri-glass"* ]] || \
    fail "graphical setup did not plan the named Quickshell config"
  [[ "$output" == *"niri-glass.json"* ]] || \
    fail "graphical setup did not plan the generated config consumer"
  rg -q -F 'spawn-at-startup "qs" "-c" "niri-glass"' \
    "${repo_root}/niri/config.kdl" || \
    fail "niri does not launch the named niri-glass config"
}
```

Register the test at the bottom of the file. Keep it dry-run: a real
`graphical-config` invocation writes managed links under `${DOTS_HOME}/niri`,
which belongs only in Task 7's live acceptance, not a temp-HOME test.

- [x] **Step 2: Add failing health cases with one healthy fixture helper**

Add a helper that configures only the Prism-owned runtime seam:

```zsh
configure_prism_glass_runtime() {
  local tmp="$1"
  mkdir -p "${tmp}/config/quickshell" "${tmp}/config/niri" \
    "${tmp}/home/d/niri-glass" "${tmp}/home/.local/state/prism/generated"
  touch "${tmp}/home/d/niri-glass/shell.qml"
  print -- '{}' > "${tmp}/home/.local/state/prism/generated/niri-glass.json"
  ln -s "${repo_root}/prism/titan" "${tmp}/config/prism"
  ln -s "${tmp}/home/d/niri-glass" "${tmp}/config/quickshell/niri-glass"
  ln -s "${tmp}/home/.local/state/prism/generated/niri-glass.json" \
    "${tmp}/config/niri/niri-glass.json"
}
```

Add these four complete tests, each using the healthy seam as its baseline:

```zsh
test_dotfiles_health_accepts_prism_glass_runtime() {
  local tmp
  tmp=$(make_tmpdir)
  register_tmp_cleanup "$tmp"
  mkdir -p "${tmp}/home" "${tmp}/config" "${tmp}/data"
  run_setup "$tmp" --link-only --headless >/dev/null
  configure_prism_glass_runtime "$tmp"

  PRISM_TEST_HOSTNAME=titan run_health "$tmp" --skip-systemd >/dev/null
}

test_dotfiles_health_fails_wrong_niri_glass_consumer() {
  local tmp output exit_status
  tmp=$(make_tmpdir)
  register_tmp_cleanup "$tmp"
  mkdir -p "${tmp}/home" "${tmp}/config" "${tmp}/data"
  run_setup "$tmp" --link-only --headless >/dev/null
  configure_prism_glass_runtime "$tmp"
  print -- '{}' > "${tmp}/wrong.json"
  rm "${tmp}/config/niri/niri-glass.json"
  ln -s "${tmp}/wrong.json" "${tmp}/config/niri/niri-glass.json"

  set +e
  output=$(PRISM_TEST_HOSTNAME=titan run_health "$tmp" --skip-systemd 2>&1)
  exit_status=$?
  set -e
  [[ "$exit_status" -ne 0 ]] || fail "health accepted wrong niri-glass consumer"
  [[ "$output" == *"wrong link target"* ]] || \
    fail "health did not explain wrong niri-glass consumer"
}

test_dotfiles_health_fails_wrong_named_niri_glass_config() {
  local tmp output exit_status
  tmp=$(make_tmpdir)
  register_tmp_cleanup "$tmp"
  mkdir -p "${tmp}/home" "${tmp}/config" "${tmp}/data"
  run_setup "$tmp" --link-only --headless >/dev/null
  configure_prism_glass_runtime "$tmp"
  mkdir "${tmp}/wrong-niri-glass"
  rm "${tmp}/config/quickshell/niri-glass"
  ln -s "${tmp}/wrong-niri-glass" "${tmp}/config/quickshell/niri-glass"

  set +e
  output=$(PRISM_TEST_HOSTNAME=titan run_health "$tmp" --skip-systemd 2>&1)
  exit_status=$?
  set -e
  [[ "$exit_status" -ne 0 ]] || fail "health accepted wrong named niri-glass config"
  [[ "$output" == *"wrong link target"* ]] || \
    fail "health did not explain wrong named niri-glass config"
}

test_dotfiles_health_rejects_root_quickshell_config() {
  local tmp output exit_status
  tmp=$(make_tmpdir)
  register_tmp_cleanup "$tmp"
  mkdir -p "${tmp}/home" "${tmp}/config" "${tmp}/data"
  run_setup "$tmp" --link-only --headless >/dev/null
  configure_prism_glass_runtime "$tmp"
  touch "${tmp}/config/quickshell/shell.qml"

  set +e
  output=$(PRISM_TEST_HOSTNAME=titan run_health "$tmp" --skip-systemd 2>&1)
  exit_status=$?
  set -e
  [[ "$exit_status" -ne 0 ]] || fail "health accepted a root Quickshell config"
  [[ "$output" == *"disables named Quickshell configs"* ]] || \
    fail "health did not explain the named-config shadow"
}
```

Register the healthy test and all three failure tests at the bottom of the
file.

- [x] **Step 3: Run the focused dotfiles suite and verify RED**

Run:

```bash
zsh tests/setup_and_health.zsh
```

Expected: failures for the absent named setup link and absent health checks.

- [x] **Step 4: Implement setup ordering and stable launch**

In `setup_graphical_config_links`, before exposing the niri config:

```bash
ensure_dir "${XDG_CONFIG_HOME}/quickshell"
if [[ -e "${XDG_CONFIG_HOME}/quickshell/shell.qml" || \
      -L "${XDG_CONFIG_HOME}/quickshell/shell.qml" ]]; then
    echo "Refusing niri-glass named config: ${XDG_CONFIG_HOME}/quickshell/shell.qml disables named Quickshell configs"
    return 1
fi
ln_s "${HOME}/d/niri-glass" "${XDG_CONFIG_HOME}/quickshell/niri-glass"
```

Keep the existing generated-file creation before the consumer link and niri validation. In `niri/config.kdl`, replace only:

```kdl
spawn-sh-at-startup "qs -p ~/d/niri-glass/shell.qml"
```

with:

```kdl
spawn-at-startup "qs" "-c" "niri-glass"
```

- [x] **Step 5: Implement exact health boundaries**

Inside the existing configured-Prism health block, before `prism doctor`, add:

```bash
check_link_target \
    "${XDG_CONFIG_HOME}/niri/niri-glass.json" \
    "${XDG_STATE_HOME:-${HOME}/.local/state}/prism/generated/niri-glass.json"
check_link \
    "${XDG_CONFIG_HOME}/quickshell/niri-glass" \
    "${HOME}/d/niri-glass"
if [[ -e "${XDG_CONFIG_HOME}/quickshell/shell.qml" || \
      -L "${XDG_CONFIG_HOME}/quickshell/shell.qml" ]]; then
    fail "${XDG_CONFIG_HOME}/quickshell/shell.qml disables named Quickshell configs"
else
    pass "named Quickshell config discovery is enabled"
fi
```

Initialize `XDG_STATE_HOME` at the top of `bin/dotfiles-health` beside `XDG_CONFIG_HOME`:

```bash
XDG_STATE_HOME="${XDG_STATE_HOME:-${HOME}/.local/state}"
```

Run `prism doctor` only when the config link and both niri-glass links have added no failures. Keep this external wiring out of Prism doctor.

- [x] **Step 6: Verify and commit with an exact dotfiles gate**

Run:

```bash
bash -n setup.sh bin/dotfiles-health
zsh tests/setup_and_health.zsh
niri validate -c niri/config.kdl
git diff --check
```

Expected: shell syntax, setup/health tests, and niri validation pass.

Stage exactly:

```bash
git add setup.sh bin/dotfiles-health niri/config.kdl tests/setup_and_health.zsh
git diff --cached --name-only
git diff --cached --check
git commit -m "fix(prism): install niri-glass consumers"
```

The cached path list must contain exactly those four paths. The existing modified host `values.yaml` must remain unstaged.

---

### Task 7: Repair the live seam and perform visual acceptance

**Files:**
- No planned source edits.
- If a post-restart runtime link still fails, stop and report that first broken link before editing any repository.

**Interfaces:**
- Consumes: Tasks 1–6 and the live Noctalia/niri/niri-glass installation.
- Produces: restored user values, permanent consumer wiring, and recorded evidence for transport, panel behavior, preview behavior, and milkiness attribution.

- [x] **Step 1: Run static gates before changing live state**

In Prism:

```bash
bin/prism describe --json | jq -e '
  (.params | length) == 34 and
  ([.params[] | select(.ui.control != "none")] | length) == 33 and
  ([.params[] | select(.ui.group == "Title")] | length) == 1 and
  ([.params[] | select(.ui.group == "Quick")] | length) == 6'
npm test
/usr/lib/qt6/bin/qmllint integrations/noctalia-plugin/Main.qml integrations/noctalia-plugin/PrismClient.qml integrations/noctalia-plugin/Panel.qml integrations/noctalia-plugin/ParamControl.qml integrations/noctalia-plugin/BarWidget.qml
```

In niri-glass:

```bash
node --test test/*.test.mjs
/usr/lib/qt6/bin/qmllint shell.qml GlassMaterial.qml PreviewSurface.qml
```

In dotfiles:

```bash
zsh tests/setup_and_health.zsh
niri validate -c niri/config.kdl
```

- [x] **Step 2: Snapshot values and redirect only the unmerged Prism plugin/CLI**

Use one shell for Steps 2–7. From the Prism worktree:

```bash
prism_plugin_link="$HOME/.config/noctalia/plugins/prism"
prism_plugin_target=$(readlink "$prism_plugin_link")
prism_test_bin=$(mktemp -d)
ln -s "$PWD/bin/prism" "$prism_test_bin/prism"
ln -sfn "$PWD/integrations/noctalia-plugin" "$prism_plugin_link"
prism_values_path=$(node --input-type=module -e 'import { valuesPath } from "./src/paths.js"; process.stdout.write(valuesPath())')
prism_values_existed=false
prism_values_backup=""
if [[ -e "$prism_values_path" ]]; then
  prism_values_backup=$(mktemp)
  cp "$prism_values_path" "$prism_values_backup"
  prism_values_existed=true
fi
```

Do not reset any current geometry values.

- [x] **Step 3: Materialize permanent consumer links, then restart both shells**

Run the committed dotfiles graphical phase, then verify before restart:

```bash
"$HOME/d/dotfiles/setup.sh" --link-only --only graphical-config
test "$HOME/.config/niri/niri-glass.json" -ef "${XDG_STATE_HOME:-$HOME/.local/state}/prism/generated/niri-glass.json"
test "$HOME/.config/quickshell/niri-glass" -ef "$HOME/d/niri-glass"
test ! -e "$HOME/.config/quickshell/shell.qml"
test ! -L "$HOME/.config/quickshell/shell.qml"
```

Restart niri-glass by its new stable name and Noctalia with the worktree CLI on `PATH`:

```bash
qs kill -p "$HOME/d/niri-glass/shell.qml" --any-display
qs -d -c niri-glass
qs kill -c noctalia-shell --any-display
PATH="$prism_test_bin:$PATH" qs -d -c noctalia-shell
```

If either shell fails to restart, restore Step 7 immediately before diagnosis.

- [x] **Step 4: Prove the repaired transport before tuning material**

Verify:

```bash
qs list --all
qs log -c niri-glass
bin/prism apply niri-glass
bin/prism doctor
PATH="$prism_test_bin:$PATH" "$HOME/d/dotfiles/bin/dotfiles-health" --skip-systemd
```

Required evidence:

1. `qs list --all` shows exactly one niri-glass instance, running from the
   named config, and its log has no missing `niri-glass.json` warning after
   restart.
2. The consumer and generated path resolve to the same device/inode.
3. The event stream populates panes on a workspace containing a configured terminal.
4. Wallpaper IPC returns a non-empty current path.
5. Changing one conspicuous glass value changes generated JSON and the live preview, then restoring it changes both back.

If any item fails, stop at that first broken link, add one focused regression in the owning repository, and request review before continuing.

- [x] **Step 5: Perform panel and preview acceptance**

Evidence to date: item 1 passed from the captured live panel. Manual Pass 1
accepted item 2's slider/color paths and all of item 3; Pass 2 accepted toggle
reconciliation and all of item 4. Glass remained false through panel reopen
and a controlled Noctalia stop/start, a fresh panel showed off, enable restored
the layer immediately, and a second off/on repeated the result without a
`prism exited 255` banner. The earlier anomalous first restart was not
reproducible with before/stopped/after value checks, so it produced no guessed
fix. A first Preview attempt showed the bounded surface, but clicking outside
the panel triggered Noctalia's expected SmartPanel dismissal and enqueued
Preview hide. That old show/hide transition then crashed niri-glass PID
2860003 in `QQuick3DSceneManager::setWindow`. Reviewed fix `bdb83e8` keeps the
transparent, input-empty preview `PanelWindow` alive and gates its `Image` and
`View3D`; 57/57 tests, Qt 6 lint, and a live same-PID show/hide check passed.
Because clicking outside closes the SmartPanel and hides Preview by contract,
item 5's pass-through/focus check must use direct IPC with the settings panel
closed. Diagnostics overflow also exposed Reset clipping under the scrollbar;
reviewed Prism fix `eb3a865` restored native `NScrollView` scrollbar
reservation and passed 132/132 tests plus Qt 6 lint. Retest then accepted
Preview show, the Diagnostic-background grid/wallpaper switch, and
panel-close hide/reopen-off behavior without errors. It also found that the
conditional Diagnostic toggle shifted Preview and the native gutter remained
too tight. Reviewed Prism fix `dc8ef4b` stacks those controls in a
`ColumnLayout` and adds native `NScrollView` `userRightPadding: Style.marginS`;
133/133 tests, Qt 6 lint, diff check, and independent review passed. Visual
retest accepted the stable Preview position, separate Diagnostic row, and
scrollbar gutter. Direct IPC then kept Preview visible while niri focus moved
from kitty window 308 to Brave window 625; its layer reported keyboard
interactivity `None`, and hide succeeded. Preview/diagnostic IPC left Prism
values semantically unchanged—the temporary YAML hash difference was only the
user's `glass.gridOverlay: false` key changing order. A live Glass blur drag
updated both its number and Preview before release; roughness was restored from
the observed `0.07` to the original `0.02`. The immediate second press could
still stick when a prior release drained before the new drag's first sample.
Fix `93790d9` defers reconciliation for the full pressed lifetime;
`c783d13` additionally discards an in-flight result while pressed. Final
`13ce02c` invalidates that result at press time and discards it even when press
and release finish before the process exits, then permits a fresh replay;
`c3a0a32` preserves invalidation when that refresh/replay starts during the
press. 134/134 tests, Qt 6 lint, diff check, and independent review pass; the
series is merged and loaded. The user then repeated release followed by an
immediate re-click/drag and reported, “Nope; sticking resolved - nice work!”
Item 8 is accepted. For item 10, Noctalia first opened and populated through a
temporary shim proxying the real CLI; switching that same shim to exit 255 made
a Glass blur write show the persistent banner while controls, section collapse/
expand, scrolling, and movement stayed usable, and the failed value did not
apply. After restoring the proxy, a panel reopen showed no error and a Glass
clarity write succeeded. Launching with the shim already broken had instead
failed the initial `describe` and supplied no controls; that was corrected test
setup, not a product defect. Cleanup restarted ordinary Noctalia, removed the
temporary directory, and restored transmission to `0.95` and roughness to
`0.02`. Item 10 and this combined step are accepted.

Record pass/fail for each item:

1. **Accepted.** The title shows a compact definition-driven Glass switch; no Quick heading is visible; all six basic controls fit comfortably.
2. **Accepted.** Every shipped control type (slider, toggle, and color) changes locally
   without waiting for `describe`, then reconciles to the stored value.
3. **Accepted.** Reset icons align with the control/value line; hints sit immediately before Reset; modified indicators clear after reset.
4. **Accepted.** Disable Glass, close/reopen the panel, and restart Noctalia: the normal layer stays disabled. Re-enable it and confirm immediate return.
5. **Accepted.** Expanding Diagnostics and enabling Preview shows one bounded surface opposite the panel on the same output. Under direct IPC it remains visible and click-through while niri focus moves from kitty to Brave, and it reports no keyboard interactivity.
6. **Accepted.** Diagnostic background switches the preview between wallpaper and the fixed neutral grid without errors or persistent-value changes.
7. **Accepted.** Dragging Glass blur updates the local number and Preview before release; the observed roughness value stored correctly and was restored from `0.07` to `0.02`.
8. **Accepted.** After reviewed, merged series `93790d9`, `c783d13`, `13ce02c`, and final `c3a0a32`, release followed by immediate re-click/drag retains the grab without sticking in the restarted live shell.
9. **Accepted.** Preview show/hide is stable; closing the panel hides it, reopening starts off, and the post-`bdb83e8` transitions show no errors.
10. **Accepted.** Breaking subsequent writes after the panel populated keeps the exit-255 banner visible and the panel usable; the failed value does not apply. Restoring the shim clears the error after reopen and a Glass clarity write succeeds.

- [x] **Step 6: Run the ordered neutral-material sweep**

With Diagnostic background visible, apply these cumulative values one at a time and record the visible delta after each:

```text
glass.transmission = 1
glass.probeExposure = 0
glass.attenuationColor = #ffffff
glass.roughness = 0
```

The first step must remove the white diffuse term exactly. The following steps isolate HDR probe contribution, volume tint, and mip blur. Do not commit these values.

If the final flat face is clear, leave shader code and defaults unchanged. If it remains milky, capture the evidence and stop: the responsible shader term requires a focused follow-up design and regression rather than a guessed change in this plan.

> **Completion note (2026-08-17):** This historical sweep stopped at its
> opaque/milky neutral face rather than guessing a shader change. Focused
> niri-glass fix `af7b05f` found that encoded `#263238` entered linear shader
> math and Qt encoded it again as `#6c7a81`; `tap()` now composites the
> procedural grid in encoded space and decodes the completed sample once
> before attenuation and lighting. Accepted runtime evidence reproduced
> `#263238` on the isolated neutral face and normal procedural-grid parity.

- [x] **Step 7: Restore user values and temporary live redirects atomically**

From the Prism worktree:

```bash
if [[ "$prism_values_existed" == true ]]; then
  prism_values_restore=$(mktemp "$(dirname "$prism_values_path")/.values.restore.XXXXXX")
  cp "$prism_values_backup" "$prism_values_restore"
  mv "$prism_values_restore" "$prism_values_path"
else
  rm -f "$prism_values_path"
fi
bin/prism apply
ln -sfn "$prism_plugin_target" "$prism_plugin_link"
qs kill -c noctalia-shell --any-display
qs -d -c noctalia-shell
if [[ -n "$prism_values_backup" ]]; then
  rm "$prism_values_backup"
fi
rm "$prism_test_bin/prism"
rmdir "$prism_test_bin"
```

Keep the repaired consumer links and named niri-glass launch; they are the intended permanent result. Verify:

```bash
bin/prism doctor
"$HOME/d/dotfiles/bin/dotfiles-health" --skip-systemd
readlink "$prism_plugin_link"
command -v prism
```

---

### Task 8 `[prism]`: True up documentation, statuses, and final gates

**Files:**
- Modify: `docs/notes/noctalia-plugin-contract.md`
- Modify: `docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md`
- Modify: `docs/superpowers/plans/2026-08-15-prism-v1.md`
- Modify: `docs/superpowers/specs/2026-08-16-prism-noctalia-panel-design.md`
- Modify: `docs/superpowers/plans/2026-08-16-prism-noctalia-panel.md`
- Modify: `docs/superpowers/specs/2026-08-16-prism-panel-repair-glass-preview-design.md`
- Modify: `docs/superpowers/plans/2026-08-16-prism-panel-repair-glass-preview.md`

**Interfaces:**
- Consumes: committed implementation in all three repositories and Task 7's live evidence.
- Produces: accurate historical statuses/checklists, updated public contracts/counts, and a final verified branch.

- [x] **Step 1: Update concrete contracts and counts**

In `docs/notes/noctalia-plugin-contract.md`, record:

- `Title` is extracted by convention while QML never names `glass.enabled`;
- control values are locally optimistic and authoritative `describe` reconciles them;
- preview verbs share the FIFO but are explicit `qs -c niri-glass` commands;
- the exact drain-refresh conjunction and why `[final, sample]` suppresses refresh;
- panel destruction can safely enqueue hide because `Main.qml` owns the persistent client.

Update the visual-bus design and v1 plan wherever they state generated-file health or visible counts. Retain the boundary: `prism doctor` checks generated targets/status snapshots; `dotfiles-health` checks consumer wiring.

In the prior panel plan's Task 6 predicate, set exactly:

```jq
(.params | length) == 34 and
([.params[] | select(.ui.control != "none")] | length) == 33 and
([.params[] | select(.ui.group == "Title")] | length) == 1 and
([.params[] | select(.ui.group == "Quick")] | length) == 6
```

- [x] **Step 2: Correct historical status and checkbox claims from evidence**

Verify relevant commits are ancestors before changing status text:

```bash
git log --oneline --decorate -30
git merge-base --is-ancestor 97cd04c HEAD
git merge-base --is-ancestor be02040 HEAD
```

Then:

- mark Tasks 1–5 of the prior panel plan complete;
- leave its failed/superseded live-acceptance task described historically rather than claiming it passed;
- record the repair as implemented and interaction-accepted on `main` while
  recording the historical shader stop and completed focused correction;
- mark this plan's completed boxes from actual evidence, not from agent reports;
- include the exact implementation commits from each repository.

- [x] **Step 3: Grep propagated claims**

Run:

```bash
rg -n 'live path already exists|one conventional group|params \| length|32 visible|33 visible|niri-glass\.json|qs -p .*niri-glass|qs -c niri-glass|prism doctor|dotfiles-health|preview' docs README.md
```

Read every hit. Update stale user-facing claims and current plan contracts; preserve historical rationale that is explicitly labeled superseded.

- [x] **Step 4: Run final verification across all repositories**

Prism:

```bash
npm test
/usr/lib/qt6/bin/qmllint integrations/noctalia-plugin/Main.qml integrations/noctalia-plugin/PrismClient.qml integrations/noctalia-plugin/Panel.qml integrations/noctalia-plugin/ParamControl.qml integrations/noctalia-plugin/BarWidget.qml
bin/prism describe --json | jq -e '(.params | length) == 34 and ([.params[] | select(.ui.control != "none")] | length) == 33'
bin/prism doctor
git diff --check
```

niri-glass:

```bash
node --test test/*.test.mjs
/usr/lib/qt6/bin/qmllint shell.qml GlassMaterial.qml PreviewSurface.qml
git diff --check
```

Dotfiles:

```bash
bash -n setup.sh bin/dotfiles-health
zsh tests/setup_and_health.zsh
niri validate -c niri/config.kdl
bin/dotfiles-health --skip-systemd
git diff --check
```

- [x] **Step 5: Commit only the documentation paths**

In Prism, stage exactly:

```bash
git add docs/notes/noctalia-plugin-contract.md docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md docs/superpowers/plans/2026-08-15-prism-v1.md docs/superpowers/specs/2026-08-16-prism-noctalia-panel-design.md docs/superpowers/plans/2026-08-16-prism-noctalia-panel.md docs/superpowers/specs/2026-08-16-prism-panel-repair-glass-preview-design.md docs/superpowers/plans/2026-08-16-prism-panel-repair-glass-preview.md
git diff --cached --name-only
git diff --cached --check
git commit -m "docs: record prism panel repair and glass preview"
```

Confirm all three repositories have only known user changes remaining. Do not clean, stash, or stage unrelated work.
