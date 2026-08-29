# Debug Backdrop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a verified Prism debug-backdrop sink and restore its persisted value safely at niri session startup.

**Architecture:** Prism owns the definition, Quickshell surface, convergence commands, and sink status. Dotfiles owns only session ordering: it waits for a Background wallpaper surface on every enabled output before asking Prism to restore a true value.

**Tech Stack:** Node.js 20, node:test, YAML, Quickshell/QML, Python 3.11, pytest, niri JSON IPC, jq.

**Spec:** `docs/superpowers/specs/2026-08-29-prism-debug-backdrop-design.md`

## Global Constraints

- Composition over inheritance; explicit failures; no silent fallbacks.
- No compatibility layer and no `Unified` prefix.
- `glass.*` remains exactly the native niri material grammar.
- `fanOut` kills an apply process after five seconds; no sink polling.
- Quickshell 0.3.1 empty `-p --json` output is accepted only in its measured two-line form.
- Dotfiles lands only after Prism and `prism apply debug-backdrop` succeed.

---

### Task 1: Canonical debug definition and manifest

**Files:**
- Create: `defs/debug.yaml`
- Create: `integrations/debug-backdrop/manifest.yaml`
- Create: `test/debug-defs.test.js`

**Interfaces:**
- Produces: `debug.backdrop: bool`, default `false`, bound only to sink `debug-backdrop` with `liveness: live`.

- [x] **Step 1: Write the failing definition test**

```js
test('debug.backdrop is one live toggle outside the native glass grammar', () => {
  const defs = loadDefs(defsDir());
  const manifests = loadManifests(integrationsDir(), defs);
  const def = defs.get('debug.backdrop');
  assert.deepEqual(
    { type: def.type, default: def.default, ui: def.ui },
    { type: 'bool', default: false,
      ui: { group: 'Debug', control: 'toggle', label: 'Debug backdrop', order: 500 } },
  );
  assert.deepEqual(manifests.filter((m) => m.binds.some((b) => b.param === 'debug.backdrop'))
    .map((m) => m.sink), ['debug-backdrop']);
});
```

- [x] **Step 2: Run the test and verify it fails because the definition is absent**

Run: `node --test test/debug-defs.test.js`

- [x] **Step 3: Add the minimal YAML definition and manifest from the spec**

```yaml
- key: debug.backdrop
  type: bool
  default: false
  ui: {group: Debug, control: toggle, label: Debug backdrop, order: 500}
  description: Cover the wallpaper with a checkerboard so refraction is visible
```

```yaml
sink: debug-backdrop
generates: []
binds:
  - {param: debug.backdrop, liveness: live}
```

- [x] **Step 4: Run the focused test, `test/glass-defs.test.js`, and `test/manifest.test.js`**

- [x] **Step 5: Commit**

```bash
git add defs/debug.yaml integrations/debug-backdrop/manifest.yaml test/debug-defs.test.js
git commit -m "feat(prism): define the debug backdrop sink"
```

### Task 2: Background checkerboard surface

**Files:**
- Create: `integrations/debug-backdrop/shell.qml`

**Interfaces:**
- Produces: one click-through `Background` `PanelWindow` per `Quickshell.screens` entry with namespace `prism-debug-backdrop`.

- [x] **Step 1: Add the minimal QML surface**

Use the existing Quickshell `Variants`/`PanelWindow` pattern, an empty `Region`, a static 64 px Canvas checkerboard, and two centered red rectangles. No material code, settings, IPC, or assets.

```qml
import QtQuick
import Quickshell
import Quickshell.Wayland

ShellRoot {
    Variants {
        model: Quickshell.screens
        PanelWindow {
            required property var modelData
            screen: modelData
            WlrLayershell.layer: WlrLayer.Background
            WlrLayershell.namespace: "prism-debug-backdrop"
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
            exclusionMode: ExclusionMode.Ignore
            anchors { top: true; bottom: true; left: true; right: true }
            mask: Region {}
            color: "#101014"
            Canvas {
                anchors.fill: parent
                property int cellSize: 64
                onPaint: {
                    const context = getContext("2d")
                    context.clearRect(0, 0, width, height)
                    context.fillStyle = "#f4f4f5"
                    for (let y = 0; y < height; y += cellSize)
                        for (let x = 0; x < width; x += cellSize)
                            if ((x / cellSize + y / cellSize) % 2 === 0)
                                context.fillRect(x, y, cellSize, cellSize)
                }
                onWidthChanged: requestPaint()
                onHeightChanged: requestPaint()
            }
            Rectangle {
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width
                height: 4
                color: "#ff2d55"
            }
            Rectangle {
                anchors.horizontalCenter: parent.horizontalCenter
                width: 4
                height: parent.height
                color: "#ff2d55"
            }
        }
    }
}
```

- [x] **Step 2: Validate the configuration**

Run: `qmllint integrations/debug-backdrop/shell.qml`

- [x] **Step 3: Commit**

```bash
git add integrations/debug-backdrop/shell.qml
git commit -m "feat(prism): render the debug backdrop"
```

### Task 3: Verified Quickshell convergence

**Files:**
- Create: `integrations/debug-backdrop/apply`
- Create: `test/debug-backdrop-sink.test.js`

**Interfaces:**
- Consumes: resolved JSON path in `process.argv[2]`, reading `params['debug.backdrop']`.
- Produces: exit 0 only when the selected config path's running-instance state equals the requested boolean.

- [x] **Step 1: Write a fake-`qs` fixture and failing behavior tests**

The fixture copies the real integration into a temporary directory, writes a resolved JSON file, and puts this behavior-controlled executable first on `PATH`:

```sh
#!/bin/sh
printf '%s\n' "$*" >> "$QS_FAKE_LOG"
if [ "$1" = list ]; then
  printf '%s' "$QS_FAKE_LIST_STDOUT"
  exit "${QS_FAKE_LIST_STATUS:-0}"
fi
exit "${QS_FAKE_ACTION_STATUS:-0}"
```

Use table-driven cases with literal expected status for start 0/present, start 0/absent, start nonzero, stop 0/absent, stop 255/absent, stop 255/present, and list nonzero. Separate tests remove the copied `shell.qml`, feed the exact measured two-line empty output, and feed unrelated malformed output.

```js
const present = JSON.stringify([{ config_path: shell }]);
const empty = `No running instances for "${shell}"\nUse --all to list all instances.\n`;
for (const c of [
  { value: true, action: 0, listing: present, want: 0 },
  { value: true, action: 0, listing: empty, want: 1 },
  { value: true, action: 1, listing: present, want: 1 },
  { value: false, action: 0, listing: empty, want: 0 },
  { value: false, action: 255, listing: empty, want: 0 },
  { value: false, action: 255, listing: present, want: 1 },
]) {
  const result = run(c);
  assert.equal(result.status === 0 ? 0 : 1, c.want);
}
```

- [x] **Step 2: Run `node --test test/debug-backdrop-sink.test.js` and verify the missing apply executable is the failure**

- [x] **Step 3: Implement the minimum apply script**

Use `spawnSync` so stdout, stderr, and exit status are available even when start exits 0 after a QML failure. Resolve `shell.qml` with `fileURLToPath(new URL('./shell.qml', import.meta.url))`, require readable access, run the selected start/stop command, then run `qs list -p <path> --json`. Parse either a JSON array or the exact measured empty response; reject everything else. Throw with the captured Quickshell diagnostic when the postcondition fails.

- [x] **Step 4: Run the focused test and `test/fanout.test.js`**

- [x] **Step 5: Commit**

```bash
git add integrations/debug-backdrop/apply test/debug-backdrop-sink.test.js
git commit -m "feat(prism): converge the debug backdrop process"
```

### Task 4: Dotfiles session owner

**Files (dotfiles repository):**
- Create: `niri/scripts/prism-debug-backdrop-startup`
- Create: `tests/niri/test_debug_backdrop_startup.py`
- Modify: `niri/config.kdl`
- Modify: `setup.sh`
- Modify: `tests/setup_and_health.zsh`

**Interfaces:**
- Consumes: `prism get debug.backdrop`, `niri msg -j outputs`, and `niri msg -j layers`.
- Produces: one `prism apply debug-backdrop` after false immediately or true after all enabled outputs are ready; exits nonzero without applying after thirty seconds.

- [x] **Step 1: Write failing pytest subprocess tests with fake `prism`, `niri`, and `sleep` executables**

The fixture runs the real script with a temporary `PATH`. Fake `prism` prints `PRISM_FAKE_VALUE` for `get` and records `apply`; fake `niri` prints complete literal outputs JSON or successive literal layer arrays from an environment-supplied JSON sequence; fake `sleep` exits immediately. Assert the real script's status and apply log:

```python
def test_true_waits_for_wallpaper_on_every_enabled_output(rig):
    result = rig.run(
        value="true",
        outputs={"DP-1": {"logical": {}}, "DP-2": {"logical": {}}},
        layers=[
            [{"namespace": "noctalia-wallpaper", "output": "DP-1", "layer": "Background"}],
            [
                {"namespace": "noctalia-wallpaper", "output": "DP-1", "layer": "Background"},
                {"namespace": "noctalia-wallpaper", "output": "DP-2", "layer": "Background"},
            ],
        ],
    )
    assert result.returncode == 0
    assert rig.apply_calls() == ["apply debug-backdrop"]
    assert rig.layer_calls() == 2
```

Add literal cases for false-immediate/no-layers, disabled-output exclusion, and thirty empty layer results producing timeout/no-apply.

- [x] **Step 2: Run the focused pytest file and verify the script is absent**

Run: `uv run --frozen pytest -q tests/niri/test_debug_backdrop_startup.py`

- [x] **Step 3: Implement the minimal executable startup script**

Use Bash with `set -euo pipefail`, jq set subtraction over enabled output names and ready Background wallpaper output names, a one-second interval, and thirty attempts. Print one actionable timeout line to stderr; emit no success noise.

- [x] **Step 4: Run the focused pytest file and verify it passes**

- [x] **Step 5: Add `spawn-at-startup "~/.config/niri/scripts/prism-debug-backdrop-startup"` and graphical setup apply**

Place the spawn beside Noctalia. Run `prism apply debug-backdrop` after the existing niri apply handling; unlike niri, any failure is fatal.

- [x] **Step 6: Extend setup tests for the new apply and startup entry, then run them**

Run: `zsh tests/setup_and_health.zsh`

- [x] **Step 7: Commit**

```bash
git add niri/config.kdl niri/scripts/prism-debug-backdrop-startup setup.sh \
  tests/niri/test_debug_backdrop_startup.py tests/setup_and_health.zsh
git commit -m "feat(niri): restore the Prism debug backdrop"
```

### Task 5: Verification and handoff documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-08-29-prism-debug-backdrop-design.md`
- Modify: `docs/superpowers/plans/2026-08-29-prism-debug-backdrop.md`

**Interfaces:**
- Produces: verified branch state and an ordered Prism-first rollout.

- [x] **Step 1: Run the full Prism suite and QML lint**

Run: `npm test && qmllint integrations/debug-backdrop/shell.qml`

- [x] **Step 2: Run the full dotfiles suite**

Run: `just test`

- [x] **Step 3: Review both diffs and run whitespace checks**

Run in each repository: `git diff --check` and `git status --short --branch`

- [x] **Step 4: Record implementation commits without claiming deployment**

Change the design status to `Implemented on feature branches; ordered handoff pending`, naming both commits. Keep the live manual checks and final merged-status update unchecked in prose rather than claiming they happened.

- [x] **Step 5: Commit Prism documentation**

```bash
git add docs/superpowers/specs/2026-08-29-prism-debug-backdrop-design.md \
  docs/superpowers/plans/2026-08-29-prism-debug-backdrop.md
git commit -m "docs(prism): prepare the debug backdrop handoff"
```
