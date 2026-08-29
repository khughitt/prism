# Native niri Material Sink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Prism and its Noctalia plugin control the installed native niri material directly, remove the inactive legacy glass path, and resume the paused daily-driver rollout without an untreated transition.

**Architecture:** Prism's existing `niri` sink generates the sole compositor fragment: layout, exact terminal opacity rules, `terminal-glass`, and its assignment. The sink validates the whole composed config before requesting reload and restores only invalid output; dotfiles migrates values before Prism drops old definitions, then removes static ownership in a second commit.

**Tech Stack:** Node.js 20, standard Lua, YAML, KDL, zsh/Bash, niri CLI/IPC, Git worktrees.

**Spec:** `docs/superpowers/specs/2026-08-28-niri-native-material-sink-design.md`

**Status:** Tasks 1-4 implemented on feature branches; Task 5 revised
2026-08-29 and not yet run; Task 6 not started.

## Global Constraints

- Use Prism worktree `.worktrees/niri-native-material` on branch `feat/niri-native-material`.
- Create dotfiles worktree `.worktrees/prism-native-material`; do not modify unrelated dirty paths in dotfiles `main`.
- Do not change niri production code or rebuild/reinstall the accepted package.
- Keep generated material name exactly `terminal-glass`.
- Treat `terminal.apps` as literal exact app IDs; empty means no terminal rules.
- Do not retain aliases, hidden definitions, a compatibility sink, or preview IPC.
- Preserve the accepted Titan material values; one sub-second flicker at the
  ownership switch is accepted, and nothing else changes appearance.
- Use conventional commits with no attribution trailers. Stage named paths only.
- Require explicit approval before live repository merges, Noctalia restart, legacy-link deletion, pushes, rollback deletion, or external build-tree cleanup.

## File Structure

| Repository/file | Responsibility | Task |
| --- | --- | --- |
| Prism `defs/{glass,terminal}.yaml` | Native parameter surface and exact terminal IDs | 1 |
| Prism `integrations/niri/{manifest.yaml,render.js}` | Sole native compositor renderer | 1 |
| Prism `integrations/niri/apply` | Atomic generation, validation, restore, reload | 2 |
| Prism `integrations/noctalia-plugin/{panel,queue}.luau` | Live-terminal controls without preview IPC | 3 |
| Prism `docs/notes/noctalia-plugin-contract.md` | Current plugin contract | 3 |
| Dotfiles `prism/titan/values.yaml` | Accepted native values; first rollout commit | 4 |
| Dotfiles `niri/{config.kdl,materials.kdl}` | Remove static material ownership | 4 |
| Dotfiles `setup.sh`, `bin/dotfiles-health`, `.gitignore`, tests | Generated KDL validation and legacy-link cleanup | 4 |
| niri-material rollout docs | Final deployment evidence and resumed burn-in | 6 |

---

### Task 1: Replace the legacy glass sink with native KDL generation

**Files:**
- Modify: `defs/glass.yaml`
- Modify: `defs/terminal.yaml`
- Modify: `integrations/niri/manifest.yaml`
- Modify: `integrations/niri/render.js`
- Modify: `test/niri-render.test.js`
- Modify: `test/glass-defs.test.js`
- Modify: `test/cli.test.js`
- Delete: `integrations/niri-glass/apply`
- Delete: `integrations/niri-glass/manifest.yaml`
- Delete: `integrations/niri-glass/render.js`
- Delete: `test/niri-glass-render.test.js`
- Delete: `test/niri-glass-preview-contract.mjs`
- Delete: `test/fixtures/niri-glass-seed.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: resolved Prism params and the native grammar pinned by the accepted niri package.
- Produces: `renderNiriFragment(resolved) -> string`, the complete deterministic `prism.kdl` body.

- [ ] **Step 1: Write failing native-renderer tests**

Replace the `test/niri-render.test.js` fixture with all supported values and assert:

```js
const resolved = { params: {
  'compositor.gaps': 54,
  'terminal.apps': ['kitty', 'com.mitchellh.ghostty'],
  'terminal.window.opacity.active': 0.93,
  'terminal.window.opacity.inactive': 0.76,
  'glass.enabled': true,
  'glass.paneLip': 5,
  'glass.paneShiftX': 4,
  'glass.paneShiftY': 4,
  'glass.ior': 1.38,
  'glass.thickness': 32,
  'glass.attenuationColor': '#bbc7db',
  'glass.attenuationDistance': 178,
  'glass.chromaticAberration': 0.68,
  'glass.distortion': 0.32,
  'glass.distortionScale': 0.05,
  'glass.anisotropicBlur': 0,
  'glass.jellyFlex': 0.0038,
  'glass.jellyRipple': 0.15,
} };
```

Require the output to contain:

```kdl
material "terminal-glass" {
    glass {
        ior 1.38
        thickness 32
        attenuation-color "#bbc7db"
        attenuation-distance 178
        chromatic-aberration 0.68
        distortion 0.32 scale=0.05
        anisotropic-blur 0
        jelly-flex 0.0038
        jelly-ripple 0.15
        bevel 9
        offset-x 4
        offset-y 4
    }
}
```

Also assert the exact raw matcher
`r#"^(kitty|com\.mitchellh\.ghostty)$"#`, two opacity rules, the later inert
background-effect rule, disabled glass omitting only its `material` field,
empty apps emitting no `window-rule`, regex metacharacters being escaped, a
literal containing `"#` selecting a longer raw-string delimiter, and stable
byte output.

- [ ] **Step 2: Run the renderer tests and verify the old renderer fails them**

Run:

```bash
node --test test/niri-render.test.js
```

Expected: FAIL because the current renderer has no material definition, uses
unanchored per-app matchers, and emits four background-effect rules.

- [ ] **Step 3: Write failing native-definition tests**

Rewrite `test/glass-defs.test.js` to assert the exact supported glass key set,
native ranges, defaults, and UI units. Assert absence of every removed key and
that no shipped definition contains `ui.affectsPreview`. Require native-unit
display for `glass.thickness`, `glass.attenuationDistance`,
`glass.chromaticAberration`, `glass.distortion`, and `glass.distortionScale`;
leave the motion controls' existing `display: normalized` metadata unchanged.

Update every `test/cli.test.js` fixture that names a deleted definition. Two
parameters are load-bearing there:

- `glass.roughness` in the `draglive` manifest and its two `effectiveDrag` /
  `effectiveLiveness` assertions. Replace it with a retained live-bound
  parameter and keep the existing assertion that a parameter with any `reload`
  binding has `effectiveDrag === 'release'`.
- `terminal.blur` at seven sites. One is fatal at import: it is the `gensink`
  fixture's only bind, so `loadManifests` throws `binds undefined param
  terminal.blur` before any test in the file runs. The rest are a `values.yaml`
  fixture written twice and four `set`/`unset`/`get` argument fixtures.

`gensink`'s replacement must preserve that fixture's stated property of binding
a parameter no other test touches: use `terminal.window.opacity.active`,
`terminal.window.opacity.inactive`, or `terminal.apps`. Do not use
`compositor.gaps` — the doctor staleness test deliberately sets it as the
untouched parameter, and reusing it would invert what that test proves.

This file points `PRISM_INTEGRATIONS_DIR` at a fixtures-only directory, so no
shipped definition is bound inside it. `glass.thickness` therefore stays
unbound and its existing null `effectiveDrag` / `effectiveLiveness` assertions
— the only coverage for the panel's `effectiveDrag == nil` / `Unavailable`
path — keep passing unchanged. Do not add a definition-directory override or a
synthetic definition.

Update `test/plugin-presentation.test.js` only as needed for the new visible
definition set: 19 visible parameters total, 18 in body groups, one Title
toggle, no Diagnostics group, and Quick containing the two Kitty background
opacity controls, gaps, and attenuation color.

- [ ] **Step 4: Run the definition tests and verify they fail**

Run:

```bash
node --test test/glass-defs.test.js test/cli.test.js test/plugin-presentation.test.js
```

Expected: FAIL on legacy-only definitions, old ranges, old terminal IDs, and
preview metadata.

- [ ] **Step 5: Implement the minimum native definitions and renderer**

In `defs/glass.yaml`, retain only the 14 keys in the spec. Tighten ranges to:

```yaml
glass.paneLip: [0, 64]
glass.paneShiftX: [-64, 64]
glass.paneShiftY: [-64, 64]
glass.thickness: [0, 200]
glass.attenuationDistance: [1, 65535]
glass.chromaticAberration: [0, 1]
glass.distortion: [0, 1]
glass.distortionScale: [0.01, 2]
```

Use native units/descriptions and remove every `affectsPreview` field and the
five obsolete `display: normalized` fields named in Step 3. Preserve that
metadata on `glass.jellyFlex` and `glass.jellyRipple`. In
`defs/terminal.yaml`, remove blur, saturation, and noise definitions and set:

```yaml
default: [kitty, com.mitchellh.ghostty]
```

In `integrations/niri/manifest.yaml`, remove the deleted terminal bindings and
add each retained `glass.*` key with plain `liveness: reload`. Do not add a
`drag` property.

Implement only three renderer helpers:

```js
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rawKdl(value) {
  let hashes = '#';
  while (value.includes(`"${hashes}`)) hashes += '#';
  return `r${hashes}"${value}"${hashes}`;
}

function appMatcher(apps) {
  return apps.length === 0
    ? null
    : rawKdl(`^(${apps.map(escapeRegex).join('|')})$`);
}
```

Render two combined opacity rules using that matcher, the fixed
`terminal-glass` definition, and one later assignment/inert-effect rule.
Calculate bevel inline as:

```js
params['glass.paneLip'] + Math.max(
  Math.abs(params['glass.paneShiftX']),
  Math.abs(params['glass.paneShiftY']),
)
```

- [ ] **Step 6: Delete the legacy sink and its closed-schema fixtures**

Delete `integrations/niri-glass/`, its two tests, and its JSON fixture. Remove
`test:niri-glass-contract` from `package.json`. Update remaining tests that
count sinks or definitions; do not introduce a replacement sink name.

- [ ] **Step 7: Run the focused and full Prism suites**

Run:

```bash
node --test test/niri-render.test.js test/glass-defs.test.js \
  test/cli.test.js test/plugin-presentation.test.js test/manifest.test.js
npm test
git diff --check
```

Expected: all tests pass and no source/test references require
`integrations/niri-glass`.

- [ ] **Step 8: Commit the native sink**

```bash
git add defs/glass.yaml defs/terminal.yaml integrations/niri/manifest.yaml \
  integrations/niri/render.js test/niri-render.test.js test/glass-defs.test.js \
  test/cli.test.js test/plugin-presentation.test.js package.json
git add -u integrations/niri-glass test
git commit -m "feat(niri): generate native terminal material"
```

---

### Task 2: Validate generated KDL and preserve cold-start output

**Files:**
- Modify: `integrations/niri/apply`
- Create: `test/niri-apply.test.js`

**Interfaces:**
- Consumes: the complete resolved JSON path supplied by Prism fan-out.
- Produces: a validated atomic `prism.kdl`; nonzero on invalid config or reload transport failure, with different target-retention behavior.

- [ ] **Step 1: Write the failing apply-process test**

Create `test/niri-apply.test.js` using `fs.mkdtempSync`, `spawnSync`, and a fake
`niri` executable placed first on `PATH`. Its log distinguishes `validate`
from `msg action load-config-file`; environment variables select each exit
status.

Cover four cases:

1. validation failure with an existing target restores its exact bytes;
2. validation failure without an existing target removes the candidate;
3. successful validation plus failed reload keeps the nonempty new target,
   changes its inode, and exits nonzero; and
4. both commands succeeding keeps the target and exits zero.

Also drive the first case once through `fanOut`/`runApply`: make the fake
validator name a deliberately offending KDL key and assert `sink-status.json`
preserves that key in its recorded failure reason. Retain niri's diagnostic
text; do not add a second formatting layer.

The reload-failure test must run with `NIRI_SOCKET` unset and assert the three
facts dotfiles setup consumes: nonempty target, changed inode, and nonzero
apply status.

- [ ] **Step 2: Run the apply test and verify it fails**

```bash
node --test test/niri-apply.test.js
```

Expected: FAIL because the current script never invokes `niri validate` and
never restores invalid output.

- [ ] **Step 3: Add validate-and-restore to the existing apply script**

Keep the existing renderer and target path. Before replacing the target,
capture either its bytes or absence. After candidate rename:

```js
try {
  execFileSync('niri', ['validate'], { stdio: 'pipe' });
} catch (error) {
  if (previous === null) {
    fs.rmSync(target);
  } else {
    fs.writeFileSync(tmp, previous);
    fs.renameSync(tmp, target);
  }
  throw error;
}
execFileSync('niri', ['msg', 'action', 'load-config-file'], { stdio: 'pipe' });
```

Do not wrap the final reload call: its failure must propagate while leaving
the validated target in place.

- [ ] **Step 4: Run focused and full tests**

```bash
node --test test/niri-apply.test.js test/fanout.test.js test/cli.test.js
npm test
git diff --check
```

Expected: restore, keep-on-transport-failure, fan-out status, and the full
suite pass.

- [ ] **Step 5: Commit validation behavior**

```bash
git add integrations/niri/apply test/niri-apply.test.js
git commit -m "fix(niri): validate generated config before reload"
```

---

### Task 3: Remove the isolated-preview UI and document live terminals

**Files:**
- Modify: `src/defs.js`
- Modify: `test/defs.test.js`
- Modify: `integrations/noctalia-plugin/panel.luau`
- Modify: `integrations/noctalia-plugin/queue.luau`
- Modify: `integrations/noctalia-plugin/plugin_test.lua`
- Modify: `integrations/noctalia-plugin/plugin.toml`
- Modify: `test/plugin-client.test.js`
- Modify: `test/plugin-panel-lifecycle.test.js`
- Modify: `test/plugin-presentation.test.js`
- Modify: `docs/notes/noctalia-plugin-contract.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `prism set`, `unset`, and `describe --json` only.
- Produces: a Noctalia panel whose supported controls update live terminals and has no preview transport.

- [ ] **Step 1: Write failing absence tests**

Update Node and Lua contract tests to require:

- `Queue.argvFor` accepts only `set` and `unset`;
- queue refresh decisions depend only on parameter writes;
- panel source contains no `previewVisible`, `diagnosticBackground`,
  `preview-show`, `preview-hide`, `Not in preview`, or `qs` command;
- `onClose` clears drag state/frame ticks without enqueueing work;
- shipped definitions and the definition validator contain no
  `affectsPreview`; and
- the plugin description says it controls native niri material on live
  terminals.

- [ ] **Step 2: Run focused tests and verify they fail**

```bash
node --test test/defs.test.js test/plugin-client.test.js \
  test/plugin-panel-lifecycle.test.js test/plugin-presentation.test.js
npm run test:plugin-lua
```

Expected: FAIL on the existing preview state, queue verbs, UI, and metadata.

- [ ] **Step 3: Delete only preview-specific behavior**

Remove preview fields/functions from `panel.luau`, the Diagnostics special
rows, preview dimming from normal/title rows, and the preview cleanup enqueue
from `onClose`. Keep the existing optimistic local state, one FIFO, live
sample coalescing for genuinely live sinks, release writes, error banner, and
describe replay.

Remove preview verbs from `queue.luau`. Remove `affectsPreview` validation from
`src/defs.js`; do not change any other UI metadata contract.

Rewrite `docs/notes/noctalia-plugin-contract.md` so its only backend transport
is `prism`, live Kitty/Ghostty windows are the feedback surface, reload-bound
sliders write on release through the existing `effectiveDrag` rule, and panel
close performs no backend action. Update the README with one sentence naming
the native niri sink.

- [ ] **Step 4: Run the full suite and drift grep**

```bash
set -euo pipefail
npm test
if rg -n 'qs -c niri-glass|preview-show|preview-hide|affectsPreview' \
  src defs integrations test docs/notes README.md; then
    echo 'preview IPC or preview metadata still present'; exit 1
fi
git diff --check
```

Expected: full suite passes and current product/docs contain no preview IPC or
preview metadata. Historical specs/plans are intentionally outside this grep.

- [ ] **Step 5: Commit the plugin cleanup**

```bash
git add src/defs.js test/defs.test.js integrations/noctalia-plugin \
  test/plugin-client.test.js test/plugin-panel-lifecycle.test.js \
  test/plugin-presentation.test.js docs/notes/noctalia-plugin-contract.md README.md
git commit -m "refactor(noctalia): remove legacy glass preview"
```

---

### Task 4: Prepare two ordered dotfiles commits

**Files:**
- Modify first commit: `prism/titan/values.yaml`
- Modify second commit: `.gitignore`
- Modify second commit: `setup.sh`
- Modify second commit: `bin/dotfiles-health`
- Modify second commit: `tests/setup_and_health.zsh`
- Modify second commit: `niri/config.kdl`
- Delete second commit: `niri/materials.kdl`
- Modify second commit: `noctalia/noctalia.md`

**Interfaces:**
- Consumes: current dotfiles `main` with the accepted static material.
- Produces: first a value-only commit accepted by old and new Prism, then a cleanup commit that hands ownership to generated `prism.kdl`.

- [ ] **Step 1: Create and baseline the isolated dotfiles worktree**

```bash
set -euo pipefail
dotfiles_repo="$HOME/d/dotfiles"
dotfiles_wt="$dotfiles_repo/.worktrees/prism-native-material"
test ! -e "$dotfiles_wt"
git -C "$dotfiles_repo" worktree add "$dotfiles_wt" -b feat/prism-native-material main
zsh "$dotfiles_wt/tests/setup_and_health.zsh"
```

Expected: clean worktree and existing complete suite passes.

- [ ] **Step 2: Replace Titan values with the accepted native set**

Make `prism/titan/values.yaml` exactly:

```yaml
compositor.gaps: 54
terminal.apps:
  - kitty
  - com.mitchellh.ghostty
terminal.background.opacity.active: 0.91
terminal.background.opacity.inactive: 0.52
terminal.window.opacity.active: 0.93
terminal.window.opacity.inactive: 0.76
glass.ior: 1.38
glass.thickness: 32
glass.attenuationColor: "#bbc7db"
glass.attenuationDistance: 178
glass.chromaticAberration: 0.68
glass.distortion: 0.32
glass.distortionScale: 0.05
glass.jellyFlex: 0.0038
glass.jellyRipple: 0.15
glass.paneLip: 5
glass.paneShiftX: 4
glass.paneShiftY: 4
```

Do not add an anisotropic override; its native default is `0` and the renderer
still emits it.

- [ ] **Step 3: Prove the value commit is accepted by current Prism and commit it**

```bash
PRISM_CONFIG_DIR="$dotfiles_wt/prism/titan" \
  "$HOME/d/prism/bin/prism" describe --json >/dev/null
git -C "$dotfiles_wt" diff --check
git -C "$dotfiles_wt" add prism/titan/values.yaml
git -C "$dotfiles_wt" commit -m "feat(prism): migrate titan native material values"
values_commit=$(git -C "$dotfiles_wt" rev-parse HEAD)
```

Expected: old Prism resolves the migrated file; commit changes only values.

- [ ] **Step 4: Write failing setup/health ownership tests**

Replace `test_setup_graphical_config_retains_glass_evidence_without_autostart`
with a generated-native-material contract. It must reject static
`materials.kdl`, its include, legacy JSON planning, and the named Quickshell
link while requiring `prism.kdl` and `NIRI_CONFIG` on pre-link apply.

Reduce `configure_prism_glass_runtime` to the one surviving prerequisite and
rename it accordingly: it must still link
`"${repo_root}/prism/titan"` to `"${tmp}/config/prism"`, otherwise the healthy
and doctor-failure tests never enter the Prism health block. Delete
`test_dotfiles_health_fails_wrong_niri_glass_consumer`,
`test_dotfiles_health_fails_wrong_named_niri_glass_config`, and
`test_dotfiles_health_rejects_root_quickshell_config`, including their calls at
the bottom of the test file. Keep
`test_dotfiles_health_fails_when_prism_doctor_fails` and
`test_dotfiles_health_accepts_prism_glass_runtime` using the reduced helper, so
`prism doctor` remains the runtime health check; rename the latter to drop its
now-inaccurate glass-runtime name, updating its call at the bottom of the file.
Add an assertion that `.gitignore` no longer names `niri/niri-glass.json`.

- [ ] **Step 5: Run the focused dotfiles test and verify it fails**

```bash
zsh "$dotfiles_wt/tests/setup_and_health.zsh"
```

Expected: FAIL because setup, health, config, and ignore rules still own the
legacy paths and static material.

- [ ] **Step 6: Implement the ownership cleanup**

In `setup.sh`, delete the legacy JSON link, named-config guard, and Quickshell
link. Keep the existing deferred-reload branch and change only its `if ! run`
condition to:

```bash
if ! run env NIRI_CONFIG="${DOTS_HOME}/niri/config.kdl" \
  "${DOTS_HOME}/bin/prism" apply niri
then
    local niri_generated_after
    niri_generated_after="$(stat -Lc '%d:%i' "$niri_generated" 2>/dev/null || true)"
    if [[ -n "${NIRI_SOCKET:-}" || ! -s "$niri_generated" ||
          -z "$niri_generated_after" || "$niri_generated_after" == "$niri_generated_before" ]]; then
        return 1
    fi
    echo "Niri is not running; prism.kdl was generated and reload is deferred."
fi
```

Keep the current deferred-reload inode/nonempty checks and the subsequent
explicit `niri validate -c` check unchanged.

In `bin/dotfiles-health`, remove both legacy link checks and the root
Quickshell guard; keep `prism doctor`. Remove `niri/niri-glass.json` from
`.gitignore`, remove `include "./materials.kdl"` from `niri/config.kdl`, and
delete `niri/materials.kdl`. Update `noctalia/noctalia.md` to describe Prism's
native niri sink and live terminal feedback.

- [ ] **Step 7: Validate the cleanup commit against staged new Prism output**

Generate native KDL with a fake successful niri transport, then compose the
three ignored host/generated includes explicitly:

```bash
set -euo pipefail
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT HUP INT TERM
mkdir -p "$stage/bin" "$stage/state" "$stage/config"
ln -s /usr/bin/true "$stage/bin/niri"
PATH="$stage/bin:$PATH" \
  PRISM_CONFIG_DIR="$dotfiles_wt/prism/titan" \
  PRISM_STATE_DIR="$stage/state" \
  "$HOME/d/prism/.worktrees/niri-native-material/bin/prism" apply niri
cp "$dotfiles_wt/niri/config.kdl" "$dotfiles_wt/niri/host-titan.kdl" \
  "$stage/config/"
cp "$HOME/.config/niri/noctalia.kdl" "$stage/config/noctalia.kdl"
cp "$stage/state/generated/prism.kdl" "$stage/config/prism.kdl"
ln -s host-titan.kdl "$stage/config/host.kdl"
zsh "$dotfiles_wt/tests/setup_and_health.zsh"
/usr/bin/niri validate -c "$stage/config/config.kdl"
git -C "$dotfiles_wt" diff --check
trap - EXIT HUP INT TERM
rm -rf -- "$stage"
```

Expected: complete suite and native composed config pass without changing the
live generated file or the dotfiles worktree's ignored includes.

- [ ] **Step 8: Commit cleanup separately and record both boundaries**

```bash
set -euo pipefail
git -C "$dotfiles_wt" add .gitignore setup.sh bin/dotfiles-health \
  tests/setup_and_health.zsh niri/config.kdl noctalia/noctalia.md
git -C "$dotfiles_wt" add -u niri/materials.kdl
git -C "$dotfiles_wt" commit -m "refactor(niri): hand native material ownership to prism"
cleanup_commit=$(git -C "$dotfiles_wt" rev-parse HEAD)
test "$(git -C "$dotfiles_wt" rev-parse HEAD^)" = "$values_commit"
git -C "$dotfiles_wt" status --short
```

Expected: clean worktree with exactly two ordered commits.

---

### Task 5: Perform the live ownership handoff

**Files:**
- Merge: Prism `feat/niri-native-material`
- Merge in two stages: dotfiles `feat/prism-native-material`
- Delete after explicit approval: exact obsolete live links/artifact

**Interfaces:**
- Consumes: reviewed green Prism branch and two reviewed dotfiles commits.
- Produces: generated native material controlled by Prism, reproducing the
  accepted appearance after one sub-second flicker at the ownership switch.

**Prerequisite:** Step 4 deletes the static `terminal-glass` while terminals
resolve it. That panicked the compositor before niri-material `7f6e69c3`, so
confirm the installed package first:

```bash
set -euo pipefail
pacman -Q niri-material
niri --version
test "$(pgrep -xo niri | xargs -I{} readlink /proc/{}/exe)" = /usr/bin/niri
```

Expected: `26.04.r106.g7f6e69c3-1` or later, and the running process is that
binary. A renamed material takes the identical path, so no reordering avoids
this requirement.

- [ ] **Step 1: Review commit boundaries and obtain merge approval**

Show:

```bash
git -C "$HOME/d/prism/.worktrees/niri-native-material" log --oneline main..HEAD
git -C "$dotfiles_wt" log --oneline main..HEAD
git -C "$HOME/d/prism/.worktrees/niri-native-material" status --short
git -C "$dotfiles_wt" status --short
git -C "$HOME/d/dotfiles" diff -- prism/titan/values.yaml
```

Pause for explicit approval of the two live merges and of discarding exactly
the displayed live `prism/titan/values.yaml` drift before the first merge. The
accepted values commit replaces that file with the pinned set. Stop if either
feature worktree is dirty or commit order is not value migration then cleanup;
unrelated dirty paths in dotfiles `main` remain untouched.

- [ ] **Step 2: Discard approved live value drift and fast-forward only the value migration**

```bash
set -euo pipefail
test "$(git -C "$dotfiles_repo" branch --show-current)" = main
git -C "$dotfiles_repo" diff --quiet -- niri/materials.kdl niri/config.kdl
git -C "$dotfiles_repo" restore --source=HEAD --staged --worktree -- prism/titan/values.yaml
git -C "$dotfiles_repo" diff --quiet -- prism/titan/values.yaml
git -C "$dotfiles_repo" diff --cached --quiet -- prism/titan/values.yaml
git -C "$dotfiles_repo" merge --ff-only "$values_commit"
test "$(git -C "$dotfiles_repo" rev-parse HEAD)" = "$values_commit"
PRISM_CONFIG_DIR="$dotfiles_repo/prism/titan" "$HOME/d/prism/bin/prism" describe --json >/dev/null
```

Expected: current Prism still resolves and static `terminal-glass` remains
active.

- [ ] **Step 3: Merge Prism and prove the sink refuses the duplicate**

```bash
set -euo pipefail
prism_repo="$HOME/d/prism"
test "$(git -C "$prism_repo" branch --show-current)" = main
test -z "$(git -C "$prism_repo" status --short)"
git -C "$prism_repo" merge --ff-only feat/niri-native-material
generated="$HOME/.local/state/prism/generated/prism.kdl"
before=$(sha256sum "$generated" | cut -d" " -f1)
if prism apply niri; then
    echo 'apply unexpectedly succeeded: the static material is not where this handoff assumes'
    exit 1
fi
test "$(sha256sum "$generated" | cut -d" " -f1)" = "$before"
prism doctor || true
```

Expected: the apply fails, `prism doctor` reports the niri sink failed and
quotes niri's `duplicate material: terminal-glass`, the generated target is
byte-identical to before, and the accepted appearance is unchanged. This is the
live exercise of the sink's validate-and-restore path; the guard above stops
the handoff if the duplicate does not materialize.

- [ ] **Step 4: Hand over ownership in one chained command**

```bash
set -euo pipefail
git -C "$dotfiles_repo" merge --ff-only "$cleanup_commit" && prism apply niri
test "$(git -C "$dotfiles_repo" rev-parse HEAD)" = "$cleanup_commit"
```

The merge deletes the static material and its include; the apply supplies the
replacement. Between them terminals briefly show the superseded blur pass the
old generated file still carries — normally shorter than niri's 500 ms
configuration poll, and accepted deliberately.

If the apply fails here, terminals keep that superseded pass and `prism doctor`
reports the failed sink. The composed config stays valid; correct the cause and
rerun `prism apply niri` rather than reverting the merge.

- [ ] **Step 5: Confirm the accepted appearance is reproduced**

```bash
set -euo pipefail
diff -u -B <(sed -n '/^material /,$p' "$HOME/.local/state/prism/generated/prism.kdl") \
  /mnt/ssd3/niri-material/v1-daily-driver-138697be/materials.kdl.accepted
echo "generated material reproduces the accepted baseline"
```

`-B` is required, not cosmetic: the generated file separates the definition
from the assignment rule with a blank line and the accepted baseline does not,
so a plain `diff` exits nonzero and `set -e` would abort the step.

The baseline is the file the daily-driver rollout signed off. Reproducing it is
the whole point of the value migration in step 2, and it is what makes the
flicker in step 4 the only visible change of the handoff.

- [ ] **Step 6: Validate final generated ownership**

```bash
set -euo pipefail
niri validate -c "$dotfiles_repo/niri/config.kdl"
prism doctor
zsh "$dotfiles_repo/tests/setup_and_health.zsh"
test ! -e "$dotfiles_repo/niri/materials.kdl"
if rg -n -F 'include "./materials.kdl"' "$dotfiles_repo/niri/config.kdl"; then
    echo 'static material include survived the cleanup merge'; exit 1
fi
rg -n -F 'material "terminal-glass"' "$HOME/.local/state/prism/generated/prism.kdl"
```

Expected: all checks pass and the live material is generated by Prism.

- [ ] **Step 7: Obtain approval, restart Noctalia, and remove exact legacy live artifacts**

Before deletion show and verify:

```bash
set -euo pipefail
legacy_json_link="$HOME/.config/niri/niri-glass.json"
legacy_qs_link="$HOME/.config/quickshell/niri-glass"
legacy_generated="$HOME/.local/state/prism/generated/niri-glass.json"
test -L "$legacy_json_link"
test "$(readlink -f "$legacy_json_link")" = "$(readlink -f "$legacy_generated")"
test -L "$legacy_qs_link"
test "$(readlink -f "$legacy_qs_link")" = "$(readlink -f "$HOME/d/niri-glass")"
test -f "$legacy_generated"
```

After explicit approval:

```bash
set -euo pipefail
rm -- "$legacy_json_link" "$legacy_qs_link" "$legacy_generated"
old_noctalia=$(pgrep -xo noctalia)
test "$old_noctalia" -gt 0
kill -TERM "$old_noctalia"
for _ in {1..50}; do pgrep -x noctalia >/dev/null || break; sleep 0.1; done
if pgrep -x noctalia >/dev/null; then echo 'noctalia did not exit'; exit 1; fi
noctalia -d
new_noctalia=""
for _ in {1..50}; do
  new_noctalia=$(pgrep -xo noctalia || true)
  if [[ -n "$new_noctalia" && "$new_noctalia" != "$old_noctalia" ]]; then break; fi
  sleep 0.1
done
test -n "$new_noctalia"
test "$new_noctalia" != "$old_noctalia"
```

Do not touch the `niri-glass` source repository or frozen evidence.

- [ ] **Step 8: Obtain manual Noctalia acceptance**

Open Prism and verify:

1. no Preview or diagnostic-background controls exist;
2. every visible control has a consumer;
3. moving a material slider updates its local value immediately and changes
   Kitty and Ghostty only on release;
4. toggle and color changes apply once per discrete action;
5. reset restores the accepted value; and
6. no error banner, legacy process, or `glasspanes*` layer appears.

Restore every changed value and require `git -C "$dotfiles_repo" diff --quiet -- prism/titan/values.yaml`.

---

### Task 6: Resume burn-in, record deployment, and publish

**Files:**
- Modify: Prism native-sink design and this plan status
- Modify: niri-material daily-driver design, README, and rollout plan
- Create/append outside Git: burn-in journal evidence
- Delete after approval: exact old rollback binary and heavy rollout build directories

**Interfaces:**
- Consumes: accepted live Prism controls and the existing package/dotfiles rollback evidence.
- Produces: truthful deployed status, normal-session plus cold-start PASS, published branches, and retained package archive only.

- [ ] **Step 1: Reset the daily-driver journal boundary**

Append the Prism integration PASS to
`/mnt/ssd3/niri-material/v1-daily-driver-138697be/burn-in.txt`, then record a new
`acceptance_since=$(date --iso-8601=seconds)`. Use the system normally for the
rest of the session.

- [ ] **Step 2: Capture and scan the normal-session journal**

```bash
acceptance_since=$(sed -n 's/^acceptance_since=//p' "$rollout_root/burn-in.txt" | tail -n 1)
journalctl --user -u niri.service --since "$acceptance_since" --no-pager > "$rollout_root/niri-normal-session.log"
scan_status=0
rg -ni '(warn|error).*(material|shader|render|config)|(material|shader|render|config).*(warn|error)' \
  "$rollout_root/niri-normal-session.log" || scan_status=$?
test "$scan_status" = 1
```

Expected: no relevant warning/error and no observed defect.

- [ ] **Step 3: Perform one full cold start and repeat essentials**

After full shutdown/start, verify package-owned `/usr/bin/niri`, commit
`138697be`, no legacy process/layer/artifact, `prism doctor`, composed config,
and fresh Kitty/Ghostty material. Repeat focus, movement, overview, workspace
switching, close/remap, and one Noctalia slider set/reset. Capture
`journalctl --user -u niri.service -b` and require the same clean scan.

- [ ] **Step 4: Obtain explicit burn-in PASS**

Show `burn-in.txt`, both journal scans, package identity, Prism commit,
dotfiles commit, and absence checks. Continue only after explicit operator
PASS; otherwise use the recorded compositor rollback and preserve artifacts.

- [ ] **Step 5: Update truthful status docs and commit**

In Prism, change the native-sink design and this plan to implemented/accepted
with exact Prism and dotfiles commits plus live-control PASS. Commit:

```bash
git commit -m "docs(prism): record native material deployment"
```

In the existing niri-material rollout worktree, update the daily-driver design,
README, and rollout plan with package SHA, Prism/dotfiles commits,
normal-session PASS, and cold-start PASS. Commit:

```bash
git commit -m "docs(materials): record prism-controlled deployment"
```

- [ ] **Step 6: Run final cross-repository checks**

```bash
npm test
zsh "$dotfiles_repo/tests/setup_and_health.zsh"
niri validate -c "$dotfiles_repo/niri/config.kdl"
prism doctor
pacman -Q niri-material
git -C "$prism_repo" diff --check
git -C "$dotfiles_repo" diff --check
git -C "$HOME/d/niri-material" diff --check
```

Also grep current docs/config for active legacy sink, JSON consumer, named
Quickshell config, isolated preview, static materials include, or undeployed
daily-driver claims. Exclude explicitly historical specs/plans from current
state assertions.

- [ ] **Step 7: Review and approve fast-forward pushes**

Fetch each existing remote branch, prove it is an ancestor of the local branch,
and show the exact pending commit lists for Prism `main`, dotfiles `main`, and
niri-material `materials-26.04`. After explicit approval, push only those
fast-forward updates and verify local tips equal remote tips. Do not use `gh`.

- [ ] **Step 8: Approve and perform exact cleanup**

Retain the inspected package archive and final evidence. Show sizes and exact
paths for rollout `build`, `sources`, `logs`, `stage`, temporary config, the
old `/usr/local/bin/niri-v26.04-2-g5e53b949.rollback`, and all three feature
worktrees. After explicit approval, remove only those targets, prune
worktrees, and delete fully merged local feature branches. Report what was
removed and that the rollback binary is no longer recoverable except by
rebuild/history.
