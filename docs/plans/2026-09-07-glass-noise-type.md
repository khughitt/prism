# Glass noise type implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for the implementation tasks; the controller coordinates live desktop checks with the user. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** implemented on `glass-noise-types` 2026-09-07 in `2166d35` and
`aa80290`; automated acceptance passes. Installed and running niri
`26.04 (f0370f52)` descends from `098bcdca`, all six generated parser cases
pass, and `just gate` passes 206 tests. Desktop panel interaction, visible
grain comparison, and the `lightness` retention decision remain pending.

**Goal:** Expose one shared white/fine/lightness selector below the Focus Noise row and emit its quoted value into every glass material.

**Architecture:** Reuse the enum value pipeline and the existing single-row select renderer. Fix the panel validator, then add one definition, one reload binding, and one string serialization in the shared material renderer. Noise amplitudes remain per-state.

**Tech Stack:** Node.js 20+, existing `yaml` dependency, Lua/Luau, Noctalia API 22, niri-material KDL.

**Spec:** `docs/specs/2026-09-06-glass-noise-type-design.md`

**Task:** Prism piece `prism-51f23b`, under hub `prism-d6b600`; native dependency `material-6e7352`.

## Global constraints

- Prism's default is `fine`; the native omitted default stays `white`.
- Both materials get the same type; the two Noise amplitudes stay the only per-state controls.
- The new key carries no `state` and no `row`: group Focus, control select, label Noise type, order 275.
- Emit `noise <amount> type="<type>"`, including zero amounts and the single-material path. Leave `background-effect` noise syntax unchanged.
- No additional dependency, compatibility layer, per-state type, or presentation abstraction.
- The Prism piece lands only after the native build is installed on the machine that runs `prism apply`.
- Desktop acceptance decides whether `lightness` stays before Prism exposes it. A completed native task or successful config parse does not prove this visual acceptance.
- Use `tasks` for all task mutations. Start each child before implementation, note evidence as it changes, and close it in its implementation commit. Run `tasks check` before completion; report environmental warnings and resolve other warnings.

## Working tree and prerequisites

Continue in `.worktrees/glass-noise-types` on branch `glass-noise-types`. This is already an isolated worktree; this plan continues the approved design session. Read the spec and `AGENTS.md`, run `tasks prime` and `tasks ready`, and inspect `git status --short` before editing.

Native code is available in the project returned by `tasks root material-6e7352`. Verify implementation commit `098bcdca` is an ancestor of that project's current branch; read its noise-type spec and evidence. Repository ancestry proves source availability, not installation: Task 3 Step 2 checks the installed and running hashes. The review on 2026-09-07 verified installed `niri validate` accepts `type="fine"` and rejects `type=fine`; repeat the acceptance checks at execution time.

## Files and responsibilities

| Files | Responsibility |
| --- | --- |
| `integrations/noctalia-plugin/panel.luau`, `plugin_test.lua` | Accept valid select metadata; exercise rendering, selected index, writes, and missing-values rejection |
| `defs/glass.yaml`, `test/glass-defs.test.js` | Define the shared enum and pin its intentional default |
| `test/plugin-presentation.test.js` | Pin the mixed single/matrix row order |
| `integrations/niri/render.js`, `manifest.yaml`, `test/niri-render.test.js`, `test/niri-apply.test.js` | Emit quoted type in all glass paths and bind it for reload |
| `README.md`, `docs/notes/noctalia-plugin-contract.md` | Describe the shared control |
| Design spec, this plan, task records via CLI | Record verified implementation and acceptance status |

### Task 1: Accept select models and pin panel behavior

**Tracker:** `prism-2cdad7`. Run `tasks start prism-2cdad7` before editing.

**Files:** Modify `integrations/noctalia-plugin/panel.luau` and `integrations/noctalia-plugin/plugin_test.lua`.

**Interfaces:** Consumes the existing describe parameter fields `values`, `value`, `default`, `layer`, `fallback`, `effectiveDrag`, and `ui`. Produces a rendered select with zero-based `selectedIndex`; changes enqueue the existing `prism set <key> <string>` command. No API change.

- [x] **Step 1: Add the regression to the existing Lua harness.** Append this entry to the panel `model.params`, preserving the existing roughness index used by reset assertions:

```lua
  {
    key = "glass.noiseType", value = "fine", default = "fine", layer = "default", fallback = "fine",
    effectiveDrag = "release", values = { "white", "fine", "lightness" },
    ui = { control = "select", group = "Focus", order = 275, label = "Noise type" },
  },
```

Change the existing `#resetCandidates` expectation from 5 to 6. After `collect` and `labels` have been built, assert:

```lua
assert(labels["Noise type"], "shared select row missing")
local selects = collect(rendered, "select")
equal(#selects, 1)
equal(selects[1].props.options, { "white", "fine", "lightness" })
equal(selects[1].props.selectedIndex, 1)
```

After the existing panel reset assertions and before the pure presentation checks, add isolated reloads of the panel module. Each reload starts a fresh queue, so the earlier reset's in-flight command cannot hide the selected write:

```lua
local noise = model.params[#model.params]
for index, value in ipairs(noise.values) do
  noise.value, noise.layer = "fine", "default"
  dofile(here .. "panel.luau")
  onOpen({})
  described({ exitCode = 0, stdout = "{}" })
  collect(rendered, "select")[1].props.onChange(index - 1)
  equal(noise.value, value)
  equal(collect(rendered, "select")[1].props.selectedIndex, index - 1)
  equal(commands[#commands], Shell.command({ "prism", "set", "glass.noiseType", value }))
end

noise.values = nil
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })
local missingValuesError = false
for _, label in ipairs(collect(rendered, "label")) do
  if label.props.text == "glass.noiseType has no select values" then missingValuesError = true end
end
assert(missingValuesError, "select without values was accepted")
noise.values = { "white", "fine", "lightness" }
```

- [x] **Step 2: Run `npm run test:plugin-lua`.** Expect failure because the valid select rejects the model and section labels do not render. The review reproduced the visible error `glass.noiseType has unsupported control select`.

- [x] **Step 3: Fix only the select branch of `visibleParamError`.** Replace the combined select/missing-values condition with:

```lua
  elseif param.ui.control == "select" then
    if type(param.values) ~= "table" then return param.key .. " has no select values" end
```

Keep the following unsupported-control branch. Reuse `nativeControl`, `selectOptions`, `selectIndex`, and the existing queue unchanged unless the live check later proves a host API mismatch.

- [x] **Step 4: Run `npm run test:plugin-lua`, then `just test`.** Require the valid model, all three string writes, missing-values error, and existing reset/slider checks to pass.

- [x] **Step 5: Close this task with the test result, run `just check`, and commit the two Lua files and its task record.** Commit message: `fix(panel): accept valid select controls`.

### Task 2: Add the shared enum and quoted material output

**Tracker:** `prism-049c8c`; depends on `prism-2cdad7` and `material-6e7352`. Run `tasks start prism-049c8c` before editing.

**Files:** Modify `defs/glass.yaml`, `integrations/niri/render.js`, `integrations/niri/manifest.yaml`, `test/glass-defs.test.js`, `test/plugin-presentation.test.js`, `test/niri-render.test.js`, `test/niri-apply.test.js`, `README.md`, and `docs/notes/noctalia-plugin-contract.md`.

**Interfaces:** Consumes Task 1's working select and existing `renderNiriFragment({params})`. Produces `params['glass.noiseType']` with values `white`, `fine`, `lightness`, default `fine`; each glass block writes the same JSON-quoted type beside its own noise amount.

- [x] **Step 1: Pin the definition and ordering.** In `test/glass-defs.test.js`, extend the exact glass-key expectation with `glass.noiseType` separately from `NATIVE`. Keep the native default table truthful: niri defaults to white; Prism intentionally defaults to fine. Add:

```javascript
test('noise type is a shared Focus select with an explicit Prism default', () => {
  const defs = loadDefs(defsDir());
  const def = defs.get('glass.noiseType');
  assert.equal(def.type, 'enum');
  assert.deepEqual(def.values, ['white', 'fine', 'lightness']);
  assert.equal(def.default, 'fine');
  assert.deepEqual(def.ui, { group: 'Focus', control: 'select', label: 'Noise type', order: 275 });
  assert.ok(defs.get('glass.inactive.noise').ui.order < def.ui.order);
  assert.ok(def.ui.order < defs.get('glass.saturation').ui.order);
});
```

The updated exact-key expectation is:

```javascript
assert.deepEqual(glass.slice().sort(), [...Object.keys(NATIVE), 'glass.noiseType'].sort());
```

In `test/plugin-presentation.test.js`, replace the row-building loop with support for single rows:

```javascript
for (const def of focus.slice(1)) {
  if (!def.ui.state) rows.push({ row: def.ui.label, single: def.key });
  else if (def.ui.state === 'focused') rows.push({ row: def.ui.row, focused: def.key });
  else {
    assert.equal(rows.at(-1).row, def.ui.row, `${def.key} follows its focused twin`);
    rows.at(-1).unfocused = def.key;
  }
}
assert.deepEqual(rows.map((row) => row.row), [
  'Terminal opacity', 'Blur', 'Tint distance', 'Fringing', 'Distortion', 'Directional blur',
  'Noise', 'Noise type', 'Saturation',
]);
assert.deepEqual(rows.filter((row) => row.single), [{ row: 'Noise type', single: 'glass.noiseType' }]);
assert.ok(rows.filter((row) => !row.single).every((row) => row.focused && row.unfocused));
assert.equal(visible.length, 1 + glass.length + 1 + rows.reduce((n, row) => n + (row.single ? 1 : 2), 0));
```

Replace the old row-order, all-paired, and visible-count assertions with these, rather than leaving the old matrix-only assertions in place.

- [x] **Step 2: Pin quoted output for every type and both material paths.** Add `'glass.noiseType': 'fine'` to the explicit fixtures in `test/niri-render.test.js` and `test/niri-apply.test.js`. In renderer `EXPECTED` and `UNSPLIT`, append `type="fine"` to the material noise lines only. Update the material-line lists and neutral-values regex with the same literal quotes. The background-effect assertions keep `noise 0` without a property. Add:

```javascript
test('every noise type is quoted and shared across glass materials', () => {
  for (const type of ['white', 'fine', 'lightness']) {
    for (const split of [true, false]) {
      const kdl = renderNiriFragment(with_({
        'glass.noiseType': type, 'glass.focusSplit': split,
        'glass.noise': 0.1, 'glass.inactive.noise': 0.02,
      }));
      const materials = kdl.match(/^material [^]*?^\}/gm);
      assert.equal(materials.length, split ? 2 : 1);
      assert.ok(materials[0].includes(`        noise 0.1 type="${type}"\n`));
      if (split) assert.ok(materials[1].includes(`        noise 0.02 type="${type}"\n`));
    }
  }
});
```

- [x] **Step 3: Run the targeted tests before implementation.** Run `node --test test/glass-defs.test.js test/plugin-presentation.test.js test/niri-render.test.js test/niri-apply.test.js`. Expect failures for the missing enum and missing quoted properties.

- [x] **Step 4: Add the definition, binding, and renderer expression.** Insert between the Noise and Saturation definitions:

```yaml
- key: glass.noiseType
  type: enum
  values: [white, fine, lightness]
  default: fine
  ui: {group: Focus, control: select, label: Noise type, order: 275}
  description: "Grain pattern shared by both focus states: white is coarse uniform grain, fine removes the clumps, lightness keeps the backdrop's colour and grains only its brightness"
```

Add to `integrations/niri/manifest.yaml` binds:

```yaml
  - {param: glass.noiseType, liveness: reload}
```

Replace the one noise line in `definition` in `integrations/niri/render.js`:

```javascript
    `        noise ${glass.noise} type=${JSON.stringify(params['glass.noiseType'])}`,
```

Do not add a fallback or put the type into `activeGlass`/`inactiveGlass`. Resolution already supplies and validates the enum. Search other explicit renderer/sink fixtures with `rg -n 'glass\.noise|renderNiriFragment' test` and add the new value anywhere a fixture bypasses default resolution.

- [x] **Step 5: Update user-facing copy.** In `README.md`, after the sentence about `glass.inactive.*` overrides, add: “Both materials share `glass.noiseType`: `white`, `fine` (the Prism default), or `lightness`.” Change the panel description to “a `Focus` matrix with a focused and an unfocused slider per optic and one shared Noise type select.” In `docs/notes/noctalia-plugin-contract.md`, append to the shipped section description: “A single Noise type select sits between the Noise and Saturation matrix rows and applies to both states.”

- [x] **Step 6: Run `just test` and verify the describe binding using an isolated store.** This command must leave existing user values untouched:

```bash
prism_check_dir=$(mktemp -d)
PRISM_CONFIG_DIR="$prism_check_dir/config" PRISM_STATE_DIR="$prism_check_dir/state" ./bin/prism describe --json > "$prism_check_dir/describe.json"
node --input-type=module - "$prism_check_dir/describe.json" <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const model = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const noise = model.params.find((param) => param.key === 'glass.noiseType');
assert.equal(noise.value, 'fine');
assert.deepEqual(noise.values, ['white', 'fine', 'lightness']);
assert.equal(noise.effectiveDrag, 'release');
JS
```

- [x] **Step 7: Close this task with the verified result, run `just check`, and commit its files and task record.** Commit message: `feat(glass): add shared noise type selector`. Keep the branch unmerged until Task 3 passes.

### Task 3: Verify the native and desktop contract before landing

**Tracker:** `prism-014c34`; depends on `prism-049c8c`. Run `tasks start prism-014c34` before acceptance work.

**Files:** Update `docs/specs/2026-09-06-glass-noise-type-design.md`, this plan, and task records through the CLI. Any select host API correction belongs in `panel.luau` with the corresponding Lua regression.

**Interfaces:** Consumes Task 2's enum and generated KDL plus an installed niri-material with native noise types. Produces evidence that the deployed CLI and panel agree, all retained types render, and the native lightness gate has a recorded decision.

- [x] **Step 1: Validate all generated types with the installed parser.** Use the existing resolver and renderer, without applying or changing the user's store:

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadDefs } from './src/defs.js';
import { defsDir } from './src/paths.js';
import { resolveParams } from './src/resolve.js';
import { renderNiriFragment } from './integrations/niri/render.js';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-noise-native-'));
try {
  const defs = loadDefs(defsDir());
  for (const type of defs.get('glass.noiseType').values) {
    for (const split of [true, false]) {
      const file = path.join(dir, `${type}-${split}.kdl`);
      const params = resolveParams(defs, { 'glass.noiseType': type, 'glass.focusSplit': split });
      fs.writeFileSync(file, renderNiriFragment({ params }));
      const result = spawnSync('niri', ['validate', '-c', file], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
JS
```

Require all six configs to parse. If the native build is missing, leave rollout open and report the blocker; do not remove type output to hide the mismatch.

- [ ] **Step 2: Check the running compositor and existing native acceptance evidence.** Record `niri --version` and `niri msg version`. The installed hash must equal or descend from implementation commit `098bcdca`; verify with `git merge-base --is-ancestor 098bcdca "$installed_hash"` in the native repository, using the hash actually printed by the installed binary. Check the running compositor hash the same way. Read the native spec's desktop acceptance result, not just task status. If still pending, compare the three grains with the user as described below before deciding the shipped enum. If lightness is indistinguishable, record that result and remove it consistently from both specs, Prism's enum, tests, and copy before landing; the native project owner handles its spec update.

- [ ] **Step 3: Connect the worktree CLI and panel for the live check.** The active shell plugin is `~/.local/share/noctalia/plugins/prism`, plugin id `khughitt/prism`, panel id `khughitt/prism:panel`. The similarly named entry under `~/.config/noctalia/plugins/prism` is a decoy: changing it does not change the loaded plugin. On 2026-09-07 both entries and the `prism` on PATH pointed at the main checkout. Record the symlink targets before changing the active plugin and PATH executable, then point them at this worktree:

```bash
prism_worktree=$(pwd -P)
prism_plugin="$HOME/.local/share/noctalia/plugins/prism"
prism_cli=$(command -v prism)
readlink "$prism_plugin"
readlink "$prism_cli"
ln -sfn "$prism_worktree/integrations/noctalia-plugin" "$prism_plugin"
ln -sfn "$prism_worktree/bin/prism" "$prism_cli"
noctalia msg plugins disable khughitt/prism
noctalia msg plugins enable khughitt/prism
```

`enable` completes asynchronously. Do not open the panel immediately: retry the open command with a short delay until the entry is registered, with a bounded timeout and the final error retained:

```bash
prism_reload_log=$(mktemp)
prism_panel_ready=false
for attempt in $(seq 1 20); do
  sleep 0.5
  if noctalia msg panel-open khughitt/prism:panel >"$prism_reload_log" 2>&1; then
    prism_panel_ready=true
    break
  fi
done
if [ "$prism_panel_ready" != true ]; then
  cat "$prism_reload_log"
  exit 1
fi
```

A plugin-only symlink change does not select the new CLI definitions. Leave the decoy entry alone. If filesystem restrictions prevent changing the real links, provide the user these exact commands after the worktree implementation is ready. Preserve the user's current values, target layer, and whether overrides existed, using `prism describe --json`, before changing controls.

- [ ] **Step 4: Exercise the installed panel and composed config with the user.** This machine has no scripted pointer control; the executor cannot click the select. Split the evidence:

  - Executor: verify the panel renders Noise type between Noise and Saturation, showing `fine` when there is no override. Drive values with `prism set glass.noiseType white`, `prism set glass.noiseType fine`, and `prism set glass.noiseType lightness`; inspect the generated fragment for quoted properties in both materials. Use `prism set glass.focusSplit false` to verify the single material carries the same type, then restore the previous split setting. `prism set` applies the changed sink; confirm successful command results and run `niri validate`. Reopen the panel to refresh after external CLI writes.
  - User: at unfocused noise amount 0.02, click through the three select options and confirm selection interaction, displayed labels, and visible grain changes. Swap focus between terminals and compare fine with lightness; record whether lightness is worth retaining. CLI writes and a rendered screenshot do not prove select interaction or visual acceptance. If the user is unavailable, finish all automated checks and leave desktop acceptance open.

Record the native lightness decision and any API 22 fixes in task notes. Restore prior values using `unset` when no override originally existed, apply the restored values, and restore the original CLI/plugin targets after the worktree check. Reload the original plugin with the same disable/enable/readiness sequence.

- [ ] **Step 5: Record evidence and close the piece.** Run `just gate` and `tasks check`; record test results, niri versions, the retained types, and desktop observations in the design status. Until merged, say “implemented on `glass-noise-types`; acceptance passed” with the actual date, never “merged.” Close this task, then `prism-51f23b` with a one-line result. Close hub `prism-d6b600` only after verifying both native and Prism deliverables satisfy its goal. Stage the status docs and task records and commit with `chore(glass): record noise type acceptance`.

- [ ] **Step 6: Correct status when the branch lands.** At integration, update this plan and the design status to the actual merged state in the landing change. Search `README.md` and `docs/notes` for the same claims, especially the retained enum values and shared-control description. Do not infer incomplete work from unchecked boxes; verify the tree and evidence.
