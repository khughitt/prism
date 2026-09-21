# Glass noise and saturation per focus state: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Noctalia Focus matrix gains Noise and Saturation rows, and the niri sink writes both values into `terminal-glass` and `terminal-glass-inactive`.

**Architecture:** Four definitions in `defs/glass.yaml` drive everything the panel shows; the Lua presentation already pairs `ui.row`/`ui.state` into matrix rows. The niri sink's `definition()` writes two more glass lines from the focused or unfocused parameter set. Nothing else in Prism learns about the new keys.

**Tech Stack:** Node.js 20 (`node --test`), YAML definitions, Luau panel with a plain-Lua test, generated KDL validated by `niri validate`.

**Spec:** `docs/specs/2026-09-05-glass-noise-saturation-focus-state-design.md`

**Tasks:** `prism-d0d4cb` (piece), `prism-63dd45` (hub goal)

## Global Constraints

- Keys are exactly `glass.noise`, `glass.inactive.noise`, `glass.saturation`, `glass.inactive.saturation`. The retired `terminal.noise.*` and `terminal.saturation.*` keys stay retired.
- Ranges and defaults: noise 0–1 step 0.01 default 0 (focused) / 0.02 (unfocused), percent display; saturation 0–3 step 0.05 default 1 (focused) / 0.85 (unfocused), raw display.
- Orders: 270/271 (Noise), 280/281 (Saturation). `ui.order` must be unique across all definitions.
- The sink writes `noise` and `saturation` into every material definition unconditionally, after `roughness`.
- The generated fragment fails `niri validate` on a niri without `material-1293e8`. Task 4 must not run `prism apply` until the installed `niri --version` is a build containing that piece.
- Work happens in `.worktrees/glass-noise-saturation` on branch `glass-noise-saturation`; `npm test` is the suite.
- Never edit `tasks/*.md` by hand; `tasks check` must pass before every commit.
- Each `### Task N` heading has a child task under `prism-d0d4cb`. Its first step is `tasks start <child>`; its commit step runs `tasks done <child>` and stages `tasks/` alongside the code. Task 4 closes its own child before it closes `prism-d0d4cb`.
- Commit messages are conventional commits. No attribution trailer of any kind.

| Task | Child |
| --- | --- |
| 1 | `prism-232f9b` |
| 2 | `prism-9406fb` |
| 3 | `prism-4e2511` |
| 4 | `prism-608787` |

---

### Task 1: Definitions

**Files:**
- Modify: `defs/glass.yaml` (append after `glass.inactive.anisotropicBlur`)
- Test: `test/glass-defs.test.js`, `test/plugin-presentation.test.js:39-41`, `test/niri-apply.test.js:18-35`

**Interfaces:**
- Produces: resolved params `glass.noise`, `glass.inactive.noise`, `glass.saturation`, `glass.inactive.saturation` (numbers). Task 2 reads them.

- [ ] **Step 0: Start the child task**

Run: `tasks start prism-232f9b`

- [ ] **Step 1: Write the failing tests**

In `test/glass-defs.test.js`:

Add to `NATIVE`:

```javascript
  'glass.noise': { range: [0, 1], default: 0 },
  'glass.inactive.noise': { range: [0, 1], default: 0.02 },
  'glass.saturation': { range: [0, 3], default: 1 },
  'glass.inactive.saturation': { range: [0, 3], default: 0.85 },
```

Add to `MATRIX` after the `Directional blur` row:

```javascript
  ['Noise', 'glass.noise', 'glass.inactive.noise'],
  ['Saturation', 'glass.saturation', 'glass.inactive.saturation'],
```

Replace the test `backdrop blur documents inherited global effects` with:

```javascript
test('backdrop blur no longer claims to supply noise or saturation', () => {
  const description = loadDefs(defsDir()).get('glass.backdropBlur').description;

  assert.match(description, /global blur block/);
  assert.doesNotMatch(description, /saturation/);
  assert.doesNotMatch(description, /noise/);
});

test('noise and saturation are focus-matrix optics, not blur inheritance', () => {
  const defs = loadDefs(defsDir());
  for (const key of ['glass.noise', 'glass.inactive.noise']) {
    assert.equal(defs.get(key).ui.display, 'percent', key);
  }
  for (const key of ['glass.saturation', 'glass.inactive.saturation']) {
    assert.notEqual(defs.get(key).ui.display, 'percent', key);
    assert.doesNotMatch(defs.get(key).description, /blur block/, key);
  }
});
```

In `test/plugin-presentation.test.js`, extend the expected row order:

```javascript
  assert.deepEqual(rows.map((row) => row.row), [
    'Terminal opacity', 'Blur', 'Tint distance', 'Fringing', 'Distortion', 'Directional blur',
    'Noise', 'Saturation',
  ]);
```

In `test/niri-apply.test.js`, add to the fixture params after `'glass.jellyRipple': 0.15,`:

```javascript
  'glass.noise': 0,
  'glass.saturation': 1,
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/glass-defs.test.js test/plugin-presentation.test.js`
Expected: `the glass surface is exactly the parameters native niri consumes` fails (four keys missing), the matrix test fails, the description test fails on `/saturation/`, the row-order test fails.

- [ ] **Step 3: Add the definitions**

Append to `defs/glass.yaml`:

```yaml
- key: glass.noise
  type: float
  range: [0, 1]
  default: 0
  ui: {group: Focus, control: slider, step: 0.01, label: Noise, order: 270, display: percent, state: focused, row: Noise}
  description: Film grain added to the glass after its optics
- key: glass.inactive.noise
  type: float
  range: [0, 1]
  default: 0.02
  ui: {group: Focus, control: slider, step: 0.01, label: Unfocused noise, order: 271, display: percent, state: unfocused, row: Noise}
  description: Film grain added to the glass of unfocused terminals
- key: glass.saturation
  type: float
  range: [0, 3]
  default: 1
  ui: {group: Focus, control: slider, step: 0.05, label: Saturation, order: 280, state: focused, row: Saturation}
  description: Color saturation of what shows through the glass; 1 leaves it unchanged
- key: glass.inactive.saturation
  type: float
  range: [0, 3]
  default: 0.85
  ui: {group: Focus, control: slider, step: 0.05, label: Unfocused saturation, order: 281, state: unfocused, row: Saturation}
  description: Color saturation through the glass of unfocused terminals; below 1 lets the pane recede
```

Change the `glass.backdropBlur` description to:

```yaml
  description: Refract the blurred backdrop for a frosted look; niri's global blur block supplies the blur strength
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS for the whole suite, including `visible numeric defaults lie on their slider grids` (0.85 / 0.05 = 17, 0.02 / 0.01 = 2) and `every shipped slider maps one host step to one canonical grid step`.

- [ ] **Step 5: Commit**

```bash
tasks done prism-232f9b "four Focus-matrix definitions and their tests"
git add defs/glass.yaml test/glass-defs.test.js test/plugin-presentation.test.js test/niri-apply.test.js tasks/
git commit -m "feat(defs): noise and saturation rows on the focus matrix"
```

---

### Task 2: Sink

**Files:**
- Modify: `integrations/niri/render.js:21-70`
- Modify: `integrations/niri/manifest.yaml`
- Test: `test/niri-render.test.js`

**Interfaces:**
- Consumes: the four params from Task 1.
- Produces: `noise <v>` and `saturation <v>` lines inside every `glass { }` block of `prism.kdl`.

- [ ] **Step 0: Start the child task**

Run: `tasks start prism-9406fb`

- [ ] **Step 1: Write the failing tests**

In `test/niri-render.test.js`, add to the `resolved.params` fixture after `'glass.inactive.anisotropicBlur': 0.02,`:

```javascript
  'glass.noise': 0,
  'glass.saturation': 1,
  'glass.inactive.noise': 0.02,
  'glass.inactive.saturation': 0.85,
```

In `EXPECTED`, insert after the focused material's `roughness 0.08` line:

```
        noise 0
        saturation 1
```

and after the inactive material's `roughness 0.5` line:

```
        noise 0.02
        saturation 0.85
```

In `UNSPLIT`, insert after `roughness 0.08`:

```
        noise 0
        saturation 1
```

Extend the override list in `the focus split renders an inactive material that inherits every other glass parameter`:

```javascript
  for (const line of [
    'attenuation-distance 70', 'chromatic-aberration 0.08', 'distortion 0.1 scale=0.05',
    'anisotropic-blur 0.02', 'roughness 0.5', 'noise 0.02', 'saturation 0.85',
  ]) assert.ok(inactive.includes(`        ${line}\n`), `override missing: ${line}`);
```

Extend the line list in `the material definition carries every supported native parameter` with `'noise 0', 'saturation 1',` after `'roughness 0.08',`.

Add a new test:

```javascript
test('noise and saturation are written even when they are neutral', () => {
  const kdl = renderNiriFragment(with_({ 'glass.noise': 0, 'glass.saturation': 1, 'glass.focusSplit': false }));

  // Prism owns both values; it never relies on niri's inheritance from the
  // global blur block, so the neutral pair is written, not omitted.
  assert.match(kdl, /        roughness 0.08\n        noise 0\n        saturation 1\n        backdrop-blur true\n/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/niri-render.test.js`
Expected: `the accepted material renders as exact native KDL` and the new tests FAIL; the fragment has no `noise` line.

- [ ] **Step 3: Implement**

In `integrations/niri/render.js`, `definition()`: insert after the `roughness` line:

```javascript
    `        noise ${glass.noise}`,
    `        saturation ${glass.saturation}`,
```

`activeGlass()`:

```javascript
function activeGlass(params) {
  return {
    attenuationDistance: params['glass.attenuationDistance'],
    chromaticAberration: params['glass.chromaticAberration'],
    distortion: params['glass.distortion'],
    anisotropicBlur: params['glass.anisotropicBlur'],
    roughness: params['glass.roughness'],
    noise: params['glass.noise'],
    saturation: params['glass.saturation'],
  };
}
```

`inactiveGlass()`:

```javascript
function inactiveGlass(params) {
  return {
    attenuationDistance: params['glass.inactive.attenuationDistance'],
    chromaticAberration: params['glass.inactive.chromaticAberration'],
    distortion: params['glass.inactive.distortion'],
    anisotropicBlur: params['glass.inactive.anisotropicBlur'],
    roughness: params['glass.inactive.roughness'],
    noise: params['glass.inactive.noise'],
    saturation: params['glass.inactive.saturation'],
  };
}
```

Append to `integrations/niri/manifest.yaml` binds:

```yaml
  - {param: glass.noise, liveness: reload}
  - {param: glass.saturation, liveness: reload}
  - {param: glass.inactive.noise, liveness: reload}
  - {param: glass.inactive.saturation, liveness: reload}
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: all JS tests and the Lua test PASS. `test/niri-apply.test.js` passes because its fixture gained the two focused keys in Task 1 (with the split unset it renders one material).

- [ ] **Step 5: Commit**

```bash
tasks done prism-9406fb "niri sink writes noise and saturation into both materials; npm test passes"
git add integrations/niri/render.js integrations/niri/manifest.yaml test/niri-render.test.js tasks/
git commit -m "feat(niri): write glass noise and saturation per focus state"
```

---

### Task 3: Panel test and documentation

**Files:**
- Modify: `integrations/noctalia-plugin/plugin_test.lua:108-118` (panel fixture) and `:155-162` (assertions)
- Modify: `README.md:8-10`
- Modify: `docs/notes/noctalia-plugin-contract.md:96-99`

- [ ] **Step 0: Start the child task**

Run: `tasks start prism-4e2511`

- [ ] **Step 1: Extend the panel fixture with a Saturation row**

In `plugin_test.lua`, after the `glass.inactive.roughness` entry of the panel `model.params` list, add:

```lua
  {
    key = "glass.saturation", value = 1, default = 1, modified = false,
    effectiveDrag = "release", range = { 0, 3 },
    ui = { control = "slider", group = "Focus", order = 280, step = 0.05, label = "Saturation", state = "focused", row = "Saturation" },
  },
  {
    key = "glass.inactive.saturation", value = 0.85, default = 0.85, modified = false,
    effectiveDrag = "release", range = { 0, 3 },
    ui = { control = "slider", group = "Focus", order = 281, step = 0.05, label = "Unfocused saturation", state = "unfocused", row = "Saturation" },
  },
```

Extend the assertions after `assert(labels["Blur"] and labels["Gaps"], "row labels missing")`:

```lua
assert(labels["Saturation"], "second matrix row label missing")
```

and after the matrix sliders assertion:

```lua
assert(sliderKeys["glass.saturation:slider"] and sliderKeys["glass.inactive.saturation:slider"], "saturation matrix sliders missing")
```

- [ ] **Step 2: Run the Lua test**

Run: `npm run test:plugin-lua`
Expected: exit 0. (This test exercises the presentation logic against a fixture; it proves a second raw-display row renders beside a percent row.)

- [ ] **Step 3: Documentation**

`README.md`: change "unfocused terminals get a second material whose roughness, tint distance, fringing, distortion, and directional blur are the `glass.inactive.*` overrides" to:

```markdown
unfocused terminals get a second material whose roughness, tint distance,
fringing, distortion, directional blur, noise, and saturation are the
`glass.inactive.*` overrides.
```

`docs/notes/noctalia-plugin-contract.md`: change "the matrix of terminal opacity, blur, tint distance, fringing, distortion, and directional blur" to:

```markdown
the matrix of terminal opacity, blur, tint distance, fringing, distortion,
directional blur, noise, and saturation.
```

Then: `rg -n 'supplies blur strength, saturation, and noise|inherit' README.md docs defs` and remove any other claim that noise or saturation are inherited from the blur block.

- [ ] **Step 4: Commit**

```bash
tasks done prism-4e2511 "panel fixture covers a second matrix row; README and contract note list the new optics"
git add integrations/noctalia-plugin/plugin_test.lua README.md docs/notes/noctalia-plugin-contract.md tasks/
git commit -m "docs: list noise and saturation among the focus-matrix optics"
```

---

### Task 4: Rollout and close out

**Files:**
- Modify: `docs/specs/2026-09-05-glass-noise-saturation-focus-state-design.md:3-7`
- Modify: `tasks/prism-d0d4cb.md`, `tasks/prism-63dd45.md` via the CLI only

- [ ] **Step 0: Start the child task**

Run: `tasks start prism-608787`

- [ ] **Step 1: Confirm the native build is installed**

Run: `tasks show material-1293e8 --pretty | head -8` and `niri --version`
Expected: the material task is `done` and the installed version string names a commit at or after the merge of `material-1293e8` into `materials-26.04` (compare with `git -C <the niri-material checkout> log --oneline -3 materials-26.04`). If not, stop here and report; the remaining steps would roll back on `niri validate`.

- [ ] **Step 2: Validate the generated fragment against the installed niri**

```bash
prism apply
rg -n '^\s*(noise|saturation) ' "${XDG_STATE_HOME:-$HOME/.local/state}/prism/generated/prism.kdl"
niri validate
```

Expected: `prism apply` exits 0 with no rollback message; the grep shows four lines, two per material; `niri validate` exits 0.

- [ ] **Step 3: Manual acceptance in the Noctalia panel**

Open the Prism panel. In the Focus section, drag Unfocused noise to 0.5: the unfocused terminal grains, the focused one does not. Drag Unfocused saturation to 0: the unfocused terminal goes grayscale. Swap focus between two terminals and confirm the treatment follows the unfocused window. Return both sliders to their defaults. Record PASS or the observed defect in the spec's status.

- [ ] **Step 4: Spec status, then close the child and the piece in one commit**

Replace the `**Status:**` paragraph of `docs/specs/2026-09-05-glass-noise-saturation-focus-state-design.md` with:

```markdown
**Status:** implemented on `glass-noise-saturation`; `npm test` passing;
manual panel acceptance PASS on <date> against niri-material <version>.
Hub goal `prism-63dd45`; Prism piece `prism-d0d4cb`; native piece
`material-1293e8`.
```

```bash
tasks done prism-608787 "installed niri validates the fragment; panel acceptance passed"
tasks done prism-d0d4cb "Noise and Saturation rows on the focus matrix; niri sink writes both values into both materials; panel acceptance passed"
tasks check
git add docs/specs/2026-09-05-glass-noise-saturation-focus-state-design.md tasks/
git commit -m "chore: land glass noise and saturation per focus state"
```

- [ ] **Step 5: Close the hub goal**

`tasks prime` lists `prism-63dd45` under closeout once both pieces are done. Confirm the goal body is met (two rows, two materials carry the values, mechanism as decided) and:

```bash
tasks done prism-63dd45 "Both pieces landed: native glass { noise; saturation } and the Prism Focus rows"
git add tasks/prism-63dd45.md
git commit -m "chore: close the glass noise and saturation goal"
```

Then use superpowers:finishing-a-development-branch to merge into `main`.
