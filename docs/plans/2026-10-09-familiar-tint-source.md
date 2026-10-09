# Familiar Glass Tint Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add `familiar` to `glass.tintSource`, so each terminal's glass body takes its agent session's hue through niri-material's `accent-tint` response, with a focused/unfocused weight pair.

**Architecture:** The defs gain the enum value and a `glass.accentTint` / `glass.inactive.accentTint` matrix row. That row is gated to the familiar source and sits in the rack's Tint card. The niri renderer keeps the stored manual tints as `attenuation-color` under familiar. Each material's response block gains an `accent-tint` line carrying its own weight. `sourceColors` reports those resting tints for the panel's read-only swatches. The capability probe renders familiar so the new field is probed.

**Tech Stack:** Node.js 20 (ES modules, `node:test`), YAML defs, Luau panel tested under `lua`, `just` front door.

**Spec:** `docs/specs/2026-10-09-familiar-tint-source-design.md` (accepted, spec review round 2).

## Global Constraints

- `glass.tintSource` values `[familiar, noctalia, manual]`; default `noctalia`, neutral `manual`, both unchanged.
- `glass.accentTint` / `glass.inactive.accentTint`: float 0–1, step 0.01, `display: percent`, default 1, neutral 0, Focus group, row `Session hue`, orders 245 / 246, `when: {param: glass.tintSource, in: [familiar], otherwise: hidden}`.
- The tint pickers keep `when: {param: glass.tintSource, in: [manual], otherwise: effective}`.
- `accent-tint` is emitted only when the tint source is familiar and `glass.bypass.tint` is not true; it is placed directly after the `accent` line. Under noctalia and manual every output is byte-identical to today's.
- Familiar `from` text, verbatim: `the resting tint; each agent session's hue tints it on its window`.
- The probe renders with `glass.tintSource: familiar`. The README states that a niri-material build without the response field `accent-tint` fails every glass apply, whatever the tint source.
- Tests run only through the front door: `just test-fast` (the suite is one command, `npm test`; there is no `test-one`). `just check` before each commit.

## Review Focus

1. **Unsplit glass under familiar.** It must carry the focused weight, never the unfocused one. Pinned in Task 2's split/unsplit test.
2. **A saved look from before this change.** It has no `glass.accentTint`, and the resolver fills the default of 1. Under manual or noctalia it must render exactly as before. Pinned by the unchanged `EXPECTED` golden and the independence test in Task 2.
3. **Switching to familiar with a broken or missing Noctalia palette.** Apply must succeed while the ring is not noctalia. Pinned in Task 3's source matrix.
4. **Weight 0 under familiar.** It must still be emitted (`accent-tint 0`), not dropped, and leave the tints unchanged. Pinned in Task 2.
5. **The starter profiles' full-snapshot rule.** Every visible key must come from the profile layer, so both profiles must carry the new keys. Pinned by the existing `starter-profiles` test in Task 1.

**Spec deviation, recorded:** the spec's "Out of scope" line says the starter profiles do not set the new keys. `test/starter-profiles.test.js` requires every key to resolve from the profile layer ("full snapshot"), so Task 1 adds both keys at their defaults to `Aurora.yaml` and `Rainbow.yaml`. Task 1 also corrects that spec line. The spec's "Prism-only key whitelist" placement also changes: the new keys are niri response fields, so they join the defs test's `NATIVE` table, with a Prism default override, as the ring keys do. The spec's probe check ("the rendered probe fragment contains `accent-tint` in both materials") is covered by two tests together: the `accent-tint` rejected-property test proves the probe emits the field, and Task 2's split test proves a familiar render puts it in both materials. The probe script renders at import and exposes no fragment to test directly.

**Setup:** in a fresh worktree, if `node_modules/` is missing, run `npm ci` in the worktree (the command `bin/prism` prints when dependencies are absent) before the first test run. Then run `just test-fast` for the baseline; it must pass before Task 1.

---

### Task 1: Familiar tint parameters, rack row and panel gating

**Files:**
- Modify: `defs/glass.yaml` (tint block, lines ~101–126)
- Modify: `defs/rack/devices.yaml` (tint device, line ~66)
- Modify: `integrations/niri/manifest.yaml` (after the `glass.tintAccentMix` bind, line ~22)
- Modify: `resources/profiles/Aurora.yaml`, `resources/profiles/Rainbow.yaml` (after `glass.tintAccentMix`)
- Modify: `docs/specs/2026-10-09-familiar-tint-source-design.md` (Out of scope: starter profiles line)
- Test: `test/glass-defs.test.js`, `test/rack.test.js`, `test/plugin-presentation.test.js`, `test/starter-profiles.test.js`, `integrations/noctalia-plugin/contract.test.mjs`, `integrations/noctalia-plugin/plugin_test.lua`

**Interfaces:**
- Produces: def keys `glass.accentTint` and `glass.inactive.accentTint` (float 0–1). Every resolved param set now carries them, which Task 2's renderer reads as `params[`${prefix}accentTint`]`. It also produces the enum value `familiar` on `glass.tintSource`.

- [x] **Step 1: Write the failing defs tests**

In `test/glass-defs.test.js`:

Add to the `NATIVE` table, after `'glass.inactive.edgeHighlight'`. The upstream field is `accent-tint`, 0–1, default 0:

```js
  'glass.accentTint': { range: [0, 1], default: 0 },
  'glass.inactive.accentTint': { range: [0, 1], default: 0 },
```

In the test `'every glass definition matches the native range and default'`, add the Prism defaults to the default-override object, after `'glass.ring.glow': 1.2, 'glass.lightIor': 4.5`. The Prism default is upstream's dark-glass recommendation, not niri's 0:

```js
      'glass.ring.glow': 1.2, 'glass.lightIor': 4.5,
      'glass.accentTint': 1, 'glass.inactive.accentTint': 1 })[key] ?? native.default, `${key} default`);
```

Add a row to `MATRIX`, after `['Tint', …]`:

```js
  ['Session hue', 'glass.accentTint', 'glass.inactive.accentTint'],
```

Add to `NEUTRAL`, after `'glass.tintAccentMix': 0,`:

```js
  'glass.accentTint': 0,
  'glass.inactive.accentTint': 0,
```

In `'palette tint controls are shared with explicit source and mix contracts'`, change the values assertion and add the session-hue contract before the closing `});`:

```js
  assert.deepEqual(source.values, ['familiar', 'noctalia', 'manual']);
```

```js
  for (const [key, label, order, state] of [
    ['glass.accentTint', 'Session hue', 245, 'focused'],
    ['glass.inactive.accentTint', 'Unfocused session hue', 246, 'unfocused'],
  ]) {
    const hue = defs.get(key);
    assert.equal(hue.type, 'float', key);
    assert.deepEqual(hue.range, [0, 1], key);
    assert.equal(hue.default, 1, key);
    assert.equal(hue.neutral, 0, key);
    assert.deepEqual(hue.ui, { group: 'Focus', control: 'slider', step: 0.01, label, order,
      display: 'percent', state, row: 'Session hue',
      when: { param: 'glass.tintSource', in: ['familiar'], otherwise: 'hidden' } }, key);
    assert.match(hue.description, /session's hue/, key);
  }
  assert.match(defs.get('glass.tintSource').description, /familiar/);
  for (const prefix of ['glass.', 'glass.inactive.']) {
    assert.match(defs.get(`${prefix}attenuationColor`).description, /resting tint/);
  }
```

`'exactly the receding optics ship with a divergent unfocused default'` needs no edit: the pair defaults level (1 and 1), and it is not in `RECEDED`.

- [x] **Step 2: Write the failing rack, presentation, profile and panel tests**

`test/rack.test.js`, after the tint `shared` assertion (line ~114):

```js
  assert.deepEqual(rack.devices.find((d) => d.device === 'tint').rows, ['Session hue', 'Tint distance']);
```

`test/plugin-presentation.test.js`, the Focus row order: insert `'Session hue'` between `'Palette accent mix'` and `'Tint distance'`:

```js
    'Frosted backdrop', 'Blur', 'Tint', 'Tint source', 'Palette accent mix', 'Session hue', 'Tint distance', 'Refraction',
```

`test/starter-profiles.test.js`, after `assert.equal(params['glass.tintAccentMix'], 0.1);`:

```js
    assert.equal(params['glass.accentTint'], 1);
    assert.equal(params['glass.inactive.accentTint'], 1);
```

`integrations/noctalia-plugin/contract.test.mjs`: replace the test `'tint pickers are editable only under manual, and the mix shows only under noctalia'` with:

```js
test('each tint source shows its own controls: pickers under manual, mix under noctalia, session hue under familiar', () => {
  for (const source of ['familiar', 'noctalia', 'manual']) {
    const model = describeStore({ base: { 'glass.tintSource': source } });
    const [report] = inspectModels([model]);
    assert.equal(report.error, undefined);
    assert.equal(report.cells['glass.tintSource'].kind, 'select');
    if (source === 'noctalia') assert.equal(report.cells['glass.tintAccentMix'].kind, 'slider');
    else assert.equal(report.cells['glass.tintAccentMix'], undefined, `the mix hides under ${source}`);
    for (const key of ['glass.accentTint', 'glass.inactive.accentTint']) {
      if (source === 'familiar') assert.equal(report.cells[key].kind, 'slider', key);
      else assert.equal(report.cells[key], undefined, `${key} hides under ${source}`);
    }
    for (const key of ['glass.attenuationColor', 'glass.inactive.attenuationColor']) {
      assert.equal(report.cells[key].glyph, source === 'manual' ? 'palette' : 'lock', `${key} under ${source}`);
      assert.equal(model.params.find((param) => param.key === key).value, '#dfe8ff', 'the stored tint is untouched');
    }
  }
});
```

`integrations/noctalia-plugin/plugin_test.lua`: in `tintRack`, give the source three values and add the Session hue pair as a card row. Replace the `glass.tintSource` add and the `shared` line, and add the pair:

```lua
  add({ key = "glass.tintSource", value = source, default = "noctalia", layer = "default", fallback = "noctalia",
    held = {}, neutral = "manual", effectiveDrag = "release", values = { "familiar", "noctalia", "manual" },
    ui = { control = "select", group = "Focus", order = 242, label = "Tint source" } })
```

```lua
  for _, half in ipairs({ { "glass.accentTint", 245, "focused", "Session hue" },
                          { "glass.inactive.accentTint", 246, "unfocused", "Unfocused session hue" } }) do
    add({ key = half[1], value = 1, default = 1, layer = "default", fallback = 1,
      held = {}, neutral = 0, effectiveDrag = "release", range = { 0, 1 },
      ui = { control = "slider", group = "Focus", order = half[2], step = 0.01, label = half[4],
        state = half[3], row = "Session hue",
        when = { param = "glass.tintSource", ["in"] = { "familiar" }, otherwise = "hidden" } } })
  end
  m.rack.devices[1].rows = { "Session hue" }
  m.rack.devices[1].shared = { "glass.tintSource", "glass.tintAccentMix" }
```

After the existing `manualRack` assertions (`"the mix hides under manual"`), add:

```lua
equal(byKey(noctaliaRack, "Session hue:row")[1], nil, "session hue hides under noctalia")
equal(byKey(manualRack, "Session hue:row")[1], nil, "session hue hides under manual")
local familiarRack = expandBackdrop(renderModel(tintRack("familiar")))
assert(byKey(familiarRack, "Session hue:row")[1], "session hue shows under familiar")
equal(byKey(familiarRack, "glass.tintAccentMix:row")[1], nil, "the mix hides under familiar")
```

The pair sits at the default layer, so the existing `"Revert section (1)"` assertion still counts only the edited mix.

- [x] **Step 3: Run the suite to verify the new tests fail**

Run: `just test-fast`
Expected: FAIL. `glass-defs` reports a missing def `glass.accentTint` and values `['noctalia','manual']`. The rack and presentation tests fail on the missing `Session hue` row, and starter-profiles on `undefined !== 1`. The contract test fails on `cells['glass.accentTint']`. The Lua assertions run on a synthetic model and exercise panel code that already exists (`panel.luau` drops a card's matrix row whose focused half is gated `hidden`). They are expected to pass at once: they pin behaviour this change relies on, and are not RED for new code. If one fails, stop: the spec's claim that the panel needs no code change is wrong.

- [x] **Step 4: Implement the defs**

`defs/glass.yaml`: replace the tint color descriptions, the source, and add the pair after `glass.tintAccentMix`:

```yaml
- key: glass.attenuationColor
  type: color
  default: '#dfe8ff'
  neutral: '#ffffff'
  ui: {group: Focus, control: color, label: Tint, order: 240, state: focused, row: Tint, when: {param: glass.tintSource, in: [manual], otherwise: effective}}
  description: Focused tint, editable under the manual source; under familiar it is the resting tint of windows without a session, and under Noctalia the panel shows the palette tint the last apply installed
- key: glass.inactive.attenuationColor
  type: color
  default: '#dfe8ff'
  neutral: '#ffffff'
  ui: {group: Focus, control: color, label: Unfocused tint, order: 241, state: unfocused, row: Tint, when: {param: glass.tintSource, in: [manual], otherwise: effective}}
  description: Unfocused tint, editable under the manual source; under familiar it is the resting tint of windows without a session, and under Noctalia the panel shows the palette tint the last apply installed
- key: glass.tintSource
  type: enum
  values: [familiar, noctalia, manual]
  default: noctalia
  neutral: manual
  ui: {group: Focus, control: select, label: Tint source, order: 242}
  description: "Who drives the glass tint: the Noctalia surface and palette-accent mix, the stored focused and unfocused manual tints, or familiar, which tints each terminal toward its agent session's hue and rests windows without a session on the manual tints"
```

(`glass.tintAccentMix` unchanged.) Then:

```yaml
# niri's accent-tint: a per-material response weight, so it splits by focus like
# the optics. It moves hue and saturation toward the window's signal accent and
# keeps the face's darkness over a neutral backdrop. The sink emits it only under
# the familiar source.
- key: glass.accentTint
  type: float
  range: [0, 1]
  default: 1
  neutral: 0
  ui: {group: Focus, control: slider, step: 0.01, label: Session hue, order: 245, display: percent, state: focused, row: Session hue, when: {param: glass.tintSource, in: [familiar], otherwise: hidden}}
  description: Under the familiar source, how far the focused terminal's glass moves toward its agent session's hue; it changes hue and saturation and keeps the glass's darkness over a neutral backdrop, barely shows on light glass, and 0 leaves the manual tint
- key: glass.inactive.accentTint
  type: float
  range: [0, 1]
  default: 1
  neutral: 0
  ui: {group: Focus, control: slider, step: 0.01, label: Unfocused session hue, order: 246, display: percent, state: unfocused, row: Session hue, when: {param: glass.tintSource, in: [familiar], otherwise: hidden}}
  description: Under the familiar source, how far unfocused terminals' glass moves toward their agent session's hue; it changes hue and saturation and keeps the glass's darkness over a neutral backdrop, barely shows on light glass, and 0 leaves the manual tint
```

- [x] **Step 5: Implement rack, manifest and profiles**

`defs/rack/devices.yaml`, tint device:

```yaml
    rows: [Session hue, Tint distance]
```

`integrations/niri/manifest.yaml`, after `- {param: glass.tintAccentMix, liveness: reload}`. They have no `node`: like the ring keys, they write a response field:

```yaml
  - {param: glass.accentTint, liveness: reload}
  - {param: glass.inactive.accentTint, liveness: reload}
```

`resources/profiles/Aurora.yaml` and `resources/profiles/Rainbow.yaml`, after `glass.tintAccentMix: 0.1`:

```yaml
glass.accentTint: 1
glass.inactive.accentTint: 1
```

`docs/specs/2026-10-09-familiar-tint-source-design.md`, Out of scope: replace the starter-profiles bullet with:

```markdown
- Starter profile looks. They select manual tint; as full snapshots they carry
  the new keys at their defaults, which do nothing under manual.
```

- [x] **Step 6: Run the suite to verify it passes**

Run: `just test-fast`
Expected: PASS, with no other test changed. If `'the resolved shipped defaults reach both material response blocks'` or any render golden changes, stop. Task 1 must not change render output, because the default source is still noctalia.

- [x] **Step 7: Commit**

```bash
just check
git add defs/glass.yaml defs/rack/devices.yaml integrations/niri/manifest.yaml resources/profiles/Aurora.yaml resources/profiles/Rainbow.yaml docs/specs/2026-10-09-familiar-tint-source-design.md test/glass-defs.test.js test/rack.test.js test/plugin-presentation.test.js test/starter-profiles.test.js integrations/noctalia-plugin/contract.test.mjs integrations/noctalia-plugin/plugin_test.lua
git commit -m "feat(defs): familiar tint source and session hue weights"
```

---

### Task 2: Render familiar tint and the per-material accent-tint

**Files:**
- Modify: `integrations/niri/render.js` (`responseBlock`, `definition`, `sourceColors`, `renderNiriFragment`)
- Test: `test/niri-render.test.js`

**Interfaces:**
- Consumes: `params['glass.accentTint']`, `params['glass.inactive.accentTint']`, and `params['glass.tintSource'] === 'familiar'` from Task 1.
- Produces: `sourceColors(params, sources)` returns, under familiar with glass on and tint not bypassed, `{'glass.attenuationColor': {value, from}, 'glass.inactive.attenuationColor': {value, from}}`. Each value is its own stored color and `from` is the familiar text. Task 3's apply writes this to the effective report unchanged. Rendered KDL gains `        accent-tint <weight>` after `accent` under familiar.

- [x] **Step 1: Add the weights to the fixture and write the failing tests**

In `test/niri-render.test.js`, add to the `resolved` fixture after `'glass.tintAccentMix': 0.1,`:

```js
  'glass.accentTint': 1,
  'glass.inactive.accentTint': 1,
```

After the test `'the manual source ignores a palette accent'`, add:

```js
test('the familiar tint keeps each stored tint and hands each material its own session-hue weight', () => {
  const familiar = { 'glass.tintSource': 'familiar', 'glass.accentTint': 0.9, 'glass.inactive.accentTint': 0.3 };
  const [active, inactive] = renderNiriFragment(with_(familiar)).match(/^material [^]*?^\}/gm);
  assert.match(active, /attenuation-color "#bbc7db"/);
  assert.match(active, /\n        accent "none"\n        accent-tint 0\.9\n        focus /);
  assert.match(inactive, /attenuation-color "#2a2f3a"/);
  assert.match(inactive, /\n        accent "none"\n        accent-tint 0\.3\n        focus /);

  const unsplit = renderNiriFragment(with_({ ...familiar, 'glass.focusSplit': false }));
  assert.equal(count(unsplit, 'accent-tint 0.9\n'), 1, 'unsplit glass carries the focused weight');
  assert.equal(count(unsplit, 'accent-tint 0.3'), 0, 'and never the unfocused one');
  assert.equal(count(unsplit, 'attenuation-color "#bbc7db"'), 1);
});

test('the tint and ring sources drive accent-tint and the accent band independently', () => {
  const palette = { noctaliaSurface: '#101010', noctaliaAccent: '#202020' };
  for (const [tint, ring, accent, tinted] of [
    ['familiar', 'manual', 'none', true],
    ['manual', 'familiar', 'ring', false],
    ['familiar', 'familiar', 'ring', true],
    ['noctalia', 'familiar', 'ring', false],
    ['manual', 'manual', 'none', false],
  ]) {
    const kdl = renderNiriFragment(with_({ 'glass.tintSource': tint, 'glass.ring.colorSource': ring }), palette);
    const label = `${tint} tint, ${ring} ring`;
    assert.equal(count(kdl, `accent "${accent}"`), 2, label);
    assert.equal(count(kdl, 'accent-tint'), tinted ? 2 : 0, label);
  }
});

test('a zero session-hue weight is written as given and leaves the stored tints alone', () => {
  const kdl = renderNiriFragment(with_({ 'glass.tintSource': 'familiar',
    'glass.accentTint': 0, 'glass.inactive.accentTint': 0 }));
  assert.equal(count(kdl, 'accent-tint 0\n'), 2);
  assert.equal(count(kdl, 'attenuation-color "#bbc7db"'), 1);
  assert.equal(count(kdl, 'attenuation-color "#2a2f3a"'), 1);
});

test('a bypassed familiar tint is no tint at all: white glass and no session hue', () => {
  const kdl = renderNiriFragment(with_({ 'glass.tintSource': 'familiar', 'glass.bypass.tint': true }));
  assert.equal(count(kdl, 'attenuation-color "#ffffff"'), 2);
  assert.equal(count(kdl, 'accent-tint'), 0);
});
```

In `'sourceColors names exactly the colors a source resolved'`, before its closing `});`, add:

```js
  const resting = "the resting tint; each agent session's hue tints it on its window";
  assert.deepEqual(sourceColors(params({ 'glass.tintSource': 'familiar', 'glass.ring.colorSource': 'manual' }), {}), {
    'glass.attenuationColor': { value: '#bbc7db', from: resting },
    'glass.inactive.attenuationColor': { value: '#2a2f3a', from: resting },
  }, 'each state reports its own stored tint and reads no palette');
  assert.deepEqual(sourceColors(params({ 'glass.tintSource': 'familiar', 'glass.bypass.tint': true,
    'glass.ring.colorSource': 'manual' }), {}), {}, 'a bypassed familiar tint reports nothing');
  assert.deepEqual(sourceColors(params({ 'glass.enabled': false, 'glass.tintSource': 'familiar',
    'glass.ring.colorSource': 'manual' }), {}), {}, 'glass off reports nothing');
```

- [x] **Step 2: Run the suite to verify the new tests fail**

Run: `just test-fast`
Expected: FAIL on the four new tests (no `accent-tint` line) and on the `sourceColors` familiar assertion (`{}` returned). `EXPECTED`, `'fragment is stable'` and every noctalia/manual test still pass.

- [x] **Step 3: Implement the renderer**

In `integrations/niri/render.js`:

Above `responseBlock`, add:

```js
// familiar hands the glass body to niri's per-window accent: the stored manual
// tint stays the attenuation color and accent-tint moves each window toward its
// session's hue, so a window without a session keeps the manual tint. A bypassed
// tint is no tint at all, and noctalia and manual leave the line out, which is
// niri's own 0, so their output is unchanged.
const familiarTint = (params) => params['glass.tintSource'] === 'familiar'
  && params['glass.bypass.tint'] !== true;
```

Change `responseBlock` to take the material's key prefix and emit the line after `accent`:

```js
function responseBlock(params, sources, prefix) {
  const source = params['glass.ring.colorSource'];
  const color = sourceColors(params, sources)['glass.ring.color']?.value ?? params['glass.ring.color'];
  return [
    '    response "default" {',
    `        accent ${JSON.stringify(source === 'familiar' ? 'ring' : 'none')}`,
    ...(familiarTint(params) ? [`        accent-tint ${params[`${prefix}accentTint`]}`] : []),
    `        focus ${JSON.stringify(params['glass.ring.focus'] ? 'ring-light' : 'none')}`,
```

(the remaining lines unchanged). Change `definition`'s signature and its `responseBlock` call:

```js
function definition(name, params, glass, sources, prefix) {
```

```js
    ...responseBlock(params, sources, prefix),
```

Below `const NOCTALIA = 'the Noctalia palette';`, add the module constant:

```js
const FAMILIAR_TINT = "the resting tint; each agent session's hue tints it on its window";
```

In `sourceColors`, the existing tint block
`if (params['glass.tintSource'] === 'noctalia' && params['glass.bypass.tint'] !== true) { … }`
gains an `else if` branch, so the block reads:

```js
  if (params['glass.tintSource'] === 'noctalia' && params['glass.bypass.tint'] !== true) {
    if (!sources.noctaliaSurface) throw new Error('noctalia tint rendered without a validated surface');
    const tint = { value: paletteTint(sources.noctaliaSurface, sources.noctaliaAccent,
      params['glass.tintAccentMix']), from: NOCTALIA };
    colors['glass.attenuationColor'] = tint;
    colors['glass.inactive.attenuationColor'] = tint;
  } else if (familiarTint(params)) {
    for (const key of ['glass.attenuationColor', 'glass.inactive.attenuationColor']) {
      colors[key] = { value: params[key], from: FAMILIAR_TINT };
    }
  }
```

`familiarTint` is a `const` arrow function. Define it above `responseBlock`, which precedes `sourceColors` in the file, so both see it.

In `renderNiriFragment`, pass the prefixes:

```js
    ...(glass ? [definition(MATERIAL, params, activeGlass(params, sources), sources, 'glass.')] : []),
    ...(split ? [definition(INACTIVE_MATERIAL, params, inactiveGlass(params, sources), sources, 'glass.inactive.')] : []),
```

Update the comment above `responseBlock` to say that the tint source, not the ring source, decides `accent-tint`.

- [x] **Step 4: Run the suite to verify it passes**

Run: `just test-fast`
Expected: PASS, including the unchanged `EXPECTED` golden.

- [x] **Step 5: Commit**

```bash
just check
git add integrations/niri/render.js test/niri-render.test.js
git commit -m "feat(niri): render the familiar tint as a per-material accent-tint"
```

---

### Task 3: Apply, probe, remedy texts and README

**Files:**
- Modify: `integrations/niri/probe-material` (the `PROBE` render, line ~30)
- Modify: `integrations/niri/palette.js` (tint remedy, line ~15)
- Modify: `integrations/niri/apply` (missing-palette error, line ~37)
- Modify: `README.md` (Requirements, lines ~11–13; Noctalia palette section, lines ~228–275)
- Test: `test/niri-apply.test.js`, `test/niri-render.test.js` (palette remedy test)

**Interfaces:**
- Consumes: Task 2's `renderNiriFragment` (familiar emits `accent-tint`) and `sourceColors` (familiar reports both resting tints).
- Produces: nothing later tasks use.

- [x] **Step 1: Write the failing tests**

`test/niri-apply.test.js`, `PARAMS`: after `'glass.tintAccentMix': 0.1,` add the following. `PARAMS` is written as `resolved.json` verbatim, with no defaults filled, so every key a familiar render reads must be present:

```js
  'glass.accentTint': 0.8,
  'glass.inactive.accentTint': 0.4,
  'glass.inactive.attenuationColor': '#2a2f3a',
```

Add `accent-tint` to the probe's rejected-property list:

```js
for (const property of ['type=', 'iridescence', 'aurora', 'bevel-profile', 'reflection', 'edge-highlight', 'accent-tint']) test(`probe-material rejects a build too old for ${property}`, (t) => {
```

In `'apply reads only the palette fields its enabled consumers need'`, add cases after `'manual/noctalia'`:

```js
    ['familiar/familiar', { 'glass.tintSource': 'familiar' }, '{ broken', null],
    ['familiar/manual', { 'glass.tintSource': 'familiar', 'glass.ring.colorSource': 'manual' }, null, null],
    ['familiar/noctalia', { 'glass.tintSource': 'familiar', 'glass.ring.colorSource': 'noctalia' }, primaryOnly, null],
    ['familiar tint, noctalia ring still needs primary', { 'glass.tintSource': 'familiar',
      'glass.ring.colorSource': 'noctalia' }, surfaceOnly, /primary missing/],
```

and change the absent-palette case so it pins the new remedy:

```js
    ['absent tint palette', {}, null, /palette missing.*select manual or familiar tint/],
```

After `'the familiar ring reports its stored resting Color'`, add:

```js
test('the familiar tint reports each stored resting tint and installs the session-hue weight', (t) => {
  const { target, report, run, writeParams } = fixture(t);
  writeParams({ 'glass.tintSource': 'familiar', 'glass.ring.colorSource': 'manual' });
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const kdl = fs.readFileSync(target, 'utf8');
  assert.match(kdl, /attenuation-color "#bbc7db"/);
  assert.match(kdl, /accent "none"\n        accent-tint 0\.8\n/);
  const resting = "the resting tint; each agent session's hue tints it on its window";
  assert.deepEqual(readReport(report), {
    'glass.attenuationColor': { value: '#bbc7db', from: resting },
    'glass.inactive.attenuationColor': { value: '#2a2f3a', from: resting },
  });
});
```

`test/niri-render.test.js`, in `'palette validation only inspects required fields and names the consumer'`, before its closing `});`:

```js
  assert.throws(() => readNoctaliaPalette(file, ['surface'], 'tint'), /select manual or familiar tint/);
```

(`file` still holds `'{ broken'` at that point.)

- [x] **Step 2: Run the suite to verify the new tests fail**

Run: `just test-fast`
Expected: FAIL in four places:
- `probe-material rejects a build too old for accent-tint` (status 0: the manual probe emits no `accent-tint`);
- `absent tint palette`, which does not match the new remedy;
- the render remedy assertion;
- the four new source-matrix cases and the familiar report test, unless Task 2's render already makes them pass. Those may already pass, which is fine: they pin the apply path. Record which.

- [x] **Step 3: Implement probe and remedy texts**

`integrations/niri/probe-material`: render familiar, and update the comment:

```js
// Both states, whatever the defaults say: the inactive material is emitted only
// under focusSplit, and it carries the same properties. Familiar tint makes
// this synthetic capability check independent of the host palette and is the
// source that emits every response field (accent-tint), so a build without one
// fails here, for every glass apply, rather than at apply time.
const PROBE = renderNiriFragment({
  params: { ...defaults, 'glass.enabled': true, 'glass.focusSplit': true, 'glass.tintSource': 'familiar' },
});
```

`integrations/niri/palette.js`, tint remedy:

```js
    ? "run 'noctalia msg templates-apply', verify primary and surface, then rerun 'prism apply niri'; see the README for direct wallpaper refresh or select manual or familiar tint"
```

`integrations/niri/apply`, the missing-palette error, with the same ending:

```js
      throw new Error(`${file}: palette missing — run 'noctalia msg templates-apply', verify primary and surface, then rerun 'prism apply niri'; see the README for direct wallpaper refresh or select manual or familiar tint`);
```

- [x] **Step 4: Run the suite to verify it passes**

Run: `just test-fast`
Expected: PASS.

- [x] **Step 5: Update the README**

Requirements, replace the niri bullet:

```markdown
- niri built with the native glass material (`niri-material`), recent enough to
  accept the response field `accent-tint`. Stock niri does not accept the
  material config, and an older niri-material fails the capability probe for
  every glass apply, whatever the tint source; `prism requirements` and the
  probe say so before glass is applied. Selecting manual tint does not restore
  apply on such a build; updating niri-material does.
```

Noctalia palette section: change its first sentence so it no longer claims the section covers the tint sources:

```markdown
The Noctalia glass tint (`glass.tintSource: noctalia`, the default) and the ring's optional
```

Replace the paragraph beginning "The Tint device's details provide …" through the `prism set` block and the "Tint bypass emits white …" paragraph with:

````markdown
### Glass tint

The Tint device's details provide **Tint source** with three values:

- `noctalia` (the default): the palette surface mixed with its primary by
  **Palette accent mix** (0–100%, default 10%). Both focus states share it.
- `manual`: the stored focused and unfocused tints.
- `familiar`: the stored tints, moved per window toward that terminal's agent
  session's hue by **Session hue** (focused and unfocused, 0–100%, default
  100%). A window without a session keeps its manual tint. Session hue changes
  hue and saturation and keeps the glass's darkness over a neutral backdrop. A
  saturated backdrop shifts brighter in the channels the hue opens and darker in
  the others. It barely shows on light glass such as the default `#dfe8ff`, and
  reads best on dark glass. Familiar needs no Noctalia palette.

The tint pickers, like the ring's Color picker, appear only under the manual
source. Under any other source the cell shows the color from the last apply as a
read-only swatch behind a lock; its tooltip reads "From <source>, as of the last
apply. Select the manual source to edit." Palette accent mix is shown only under
noctalia and Session hue only under familiar. Choosing manual makes the stored
colors take effect on the next successful apply:

```sh
prism set glass.tintSource manual
prism set glass.tintSource noctalia
prism set glass.tintAccentMix 0.1
prism set glass.tintSource familiar
prism set glass.accentTint 1
```

Tint bypass emits white under every source, needs no tint palette, and removes
the session hue too. Neutral reset selects manual white tint with zero mix and
zero session hue.
````

Keep the paragraph that follows ("The ring keeps its own Color source; …") as it is.

- [x] **Step 6: Commit**

```bash
just check
git add integrations/niri/probe-material integrations/niri/palette.js integrations/niri/apply README.md test/niri-apply.test.js test/niri-render.test.js
git commit -m "feat(niri): probe accent-tint and document the familiar tint source"
```

---

## After the tasks

- **Live check, owner-judged.** It takes the live desktop, so ask at that moment and name what changes: niri reloads its config, and terminals with agent sessions take their session's hue for a few minutes.
  - **Which prism.** Every agent command uses the worktree's binary by explicit path, `.worktrees/prism-1bb833/bin/prism`. The panel and host hooks call plain `prism`, which resolves to the main checkout. Before an owner check that needs panel controls, integrate the reviewed code locally so main understands `familiar`; never repoint a shared launcher at the worktree. The first live attempt exposed this schema mismatch and was restored without a visual verdict; the reviewed code is now merged locally and main describe lists all three sources.
  - **Host-state note.** Before the first command, record the change on the task. Notes are append-only, so a second note records the restore:
    `tasks note prism-1bb833 "live check: store glass.tintSource set to familiar in scratch via .worktrees/prism-1bb833/bin/prism; restore with the restore script below"`.
  - **Set and apply.** Run from the main checkout. Restoration runs on any failure, through the `ERR` trap:

    ```bash
    P=.worktrees/prism-1bb833/bin/prism
    STATE=<scratchpad>/familiar-live-check.prev   # outside the repo
    "$P" --json describe | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).params.find(p=>p.key==="glass.tintSource");console.log(p.layer+" "+p.value)})' > "$STATE"
    restore() {
      trap - ERR; set +e   # a failing restore step must not re-enter the trap
      read -r layer value < "$STATE"
      if [ "$layer" = scratch ]; then "$P" set glass.tintSource "$value"; else "$P" unset glass.tintSource; fi
      "$P" apply niri
    }
    set -eE; trap 'restore' ERR
    "$P" set glass.tintSource familiar
    "$P" apply niri
    trap - ERR; set +eE
    ```

    `$STATE` records the source's layer and value as they were. Restoring drops the scratch edit, or puts the earlier scratch value back if there was one. Either way the store returns to exactly the state it had before.
  - **Judge.** On a dark look, each terminal with an agent session should show its hue in the glass body. A terminal without a session should keep its manual tint.
  - **Restore, always.** Do this after the owner's verdict, after any failure, and before the turn ends, whatever the outcome. Define `P`, `STATE` and `restore` exactly as above, then run `restore`. Confirm the main checkout reads the store again: `bin/prism get glass.tintSource` from the main checkout prints the earlier value. Then note `live check restored` on the task.
- Close `prism-1bb833` with a one-line result in the final commit. Then the parent goal `prism-980a29` has `prism-1b7231` and `prism-2bfc35` still open.
