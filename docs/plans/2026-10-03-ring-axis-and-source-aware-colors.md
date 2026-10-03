# Ring focus axis and source-aware colors implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** lay the Ring group out on the Unfocused/Focused axis, and make every color control editable only under the manual source while other sources show the color the niri sink installed.

**Architecture:** three new `ui` def keys (`subgroup`, `column`, `when`) carry the layout and the gate from the defs through `prism describe` to the panel unchanged. The niri sink writes a per-sink report of the colors it resolved from a source, published together with `prism.kdl`; `describe` joins it onto the params as `effective`. The panel computes one gate per param per render and draws a picker, a read-only swatch, or nothing.

**Tech stack:** Node ESM with `yaml`, the Node test runner, Luau panel code tested under `lua`; no new dependencies.

**Spec:** [Ring on the focus axis, and color controls that follow their source](../specs/2026-10-03-ring-axis-and-source-aware-colors-design.md).

## Global constraints

- Work in `.worktrees/prism-4f8bab` on branch `prism-4f8bab`. File lists below are relative to the worktree root; tell the owner paths prefixed `.worktrees/prism-4f8bab/`.
- Tests run only through the front door: `just test-fast` (the suite is one `npm test`; this repo has no `test-one`). Never call `node --test` or `lua` directly.
- `tasks check` must be clean before every commit; mutate task records only through the `tasks` CLI.
- The store keys do not change. No migration, no compatibility layer.
- Only `manual` makes a color editable: tint pickers `in: [manual]`, ring Color `in: [manual]`.
- The report lives at `<stateDir>/effective/niri.json`, shape `{"<key>": {"value": "#rrggbb", "from": "<phrase>"}}`.
- Report `from` phrases, verbatim: `the Noctalia palette`; `the stored Color; no Noctalia palette was found`; `the resting color; each agent session's hue replaces it on its window`.
- Read-only tooltip, verbatim: `From <from>, as of the last apply. Select the manual source to edit.` Missing-report tooltip, verbatim: `No rendered color: the tint is bypassed, glass is off, or prism has not applied this source yet.`
- A bypassed tint reads no palette and reports no tint keys; a missing or malformed palette must still apply.
- Report publication: temp file written before the KDL is installed, renamed only after `niri validate` passes and before the reload request; a rename failure rolls the KDL back (restore previous, or remove on first apply), removes the temp file, keeps the old report, requests no reload, and fails the sink.
- Gating is presentation only: hidden or read-only params still count in edits, neutral counts and every reset.
- Each `### Task N` has a step task: 1 `prism-d114c1`, 2 `prism-b255ac`, 3 `prism-3b7c81`, 4 `prism-366763`, 5 `prism-71233b`, 6 `prism-c6a154`, 7 `prism-600128`. `tasks start` it before the work and `tasks done` it in the task's own commit (stage `tasks/<id>.md` with the code); a parent closes only after its step tasks.
- `prism-84d308` also edits `integrations/noctalia-plugin/panel.luau` in its own worktree; whichever branch lands second rebases.

## Review focus

1. **A source switch the write later rejects.** The gate flips on the optimistic value, then describe reconciles; the controls must follow the reconciled value, not stick. Pinned in Task 6 (switch test re-renders from the reconciled model).
2. **A hand-edited or half-written report.** `describe` must fail naming the file, not draw a wrong swatch. Pinned in Task 5.
3. **A source switched away from Noctalia leaves an old report.** The next apply must drop the key, so a later switch back never shows a color from two palettes ago. Pinned in Task 4 (manual and glass-off reports carry no tint keys).
4. **Resetting a section whose edited control is hidden.** The section reset must still count and revert it. Pinned in Task 6.
5. **A palette or render failure before anything is installed.** No report directory or temp file may be left behind. Pinned in Task 4 (the unparseable-palette test asserts no `effective/` directory).

---

## Part 1 — Ring layout (`prism-4f8bab`)

### Task 1: Validate `ui.subgroup` and `ui.column`

**Files:**
- Modify: `src/defs.js` (`validateDef`, `loadDefs`)
- Test: `test/defs.test.js`

**Interfaces:**
- Produces: defs may carry `ui.subgroup: string` and `ui.column: 'focused'`; `loadDefs` enforces subgroup completeness and contiguity per group.

- [ ] **Step 1: Write the failing tests** — append to `test/defs.test.js`:

```js
test('ui.column places a single row in the focused column only', () => {
  const ok = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: A, control: slider, step: 0.1, label: B, order: 1, column: focused}, description: d}\n');
  assert.equal(loadDefs(ok).get('a.b').ui.column, 'focused');
  const unfocused = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: A, control: slider, step: 0.1, label: B, order: 1, column: unfocused}, description: d}\n');
  assert.throws(() => loadDefs(unfocused), /ui\.column must be focused/);
  const withState = dirWith('- {key: a.b, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: A, control: slider, step: 0.1, label: B, order: 1, column: focused, state: focused, row: B}, description: d}\n');
  assert.throws(() => loadDefs(withState), /ui\.column and ui\.state are exclusive/);
  const onHeader = dirWith('- {key: a.b, type: bool, default: true, neutral: true, ui: {group: A, control: toggle, label: B, order: 1, header: true, column: focused}, description: d}\n');
  assert.throws(() => loadDefs(onHeader), /ui\.column is not valid on a header toggle/);
});

test('ui.subgroup is a non-empty name, never on a header or a hidden def', () => {
  const blank = dirWith('- {key: a.b, type: bool, default: true, neutral: true, ui: {group: A, control: toggle, label: B, order: 1, subgroup: " "}, description: d}\n');
  assert.throws(() => loadDefs(blank), /ui\.subgroup must be a non-empty string/);
  const onHeader = dirWith('- {key: a.b, type: bool, default: true, neutral: true, ui: {group: A, control: toggle, label: B, order: 1, header: true, subgroup: S}, description: d}\n');
  assert.throws(() => loadDefs(onHeader), /header toggle takes no ui\.subgroup/);
  const hidden = dirWith('- {key: a.b, type: list, items: string, default: [], ui: {group: A, control: none, subgroup: S}, description: d}\n');
  assert.throws(() => loadDefs(hidden), /control: none takes no ui\.subgroup, ui\.column or ui\.when/);
});

test('a group names a subgroup on every row or on none, and each subgroup is contiguous', () => {
  const row = (key, order, subgroup) => `- {key: ${key}, type: bool, default: true, neutral: true, ui: {group: A, control: toggle, label: ${key}, order: ${order}${subgroup ? `, subgroup: ${subgroup}` : ''}}, description: d}\n`;
  const header = '- {key: a.h, type: bool, default: true, neutral: true, ui: {group: A, control: toggle, label: H, order: 0, header: true}, description: d}\n';
  assert.doesNotThrow(() => loadDefs(dirWith(header + row('a.one', 1, 'S') + row('a.two', 2, 'S') + row('a.three', 3, 'T'))));
  assert.throws(() => loadDefs(dirWith(row('a.one', 1, 'S') + row('a.two', 2))),
    /group A: a\.two has no ui\.subgroup; either every row of a group names one or none does/);
  assert.throws(() => loadDefs(dirWith(row('a.one', 1, 'S') + row('a.two', 2, 'T') + row('a.three', 3, 'S'))),
    /group A: a\.three splits subgroup S; its rows must be contiguous in ui\.order/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: the three new tests FAIL (no `ui.column`/`ui.subgroup` checks exist); every other test passes.

- [ ] **Step 3: Implement** — in `src/defs.js`, after the `if (has('header')) { … }` block in `validateDef`, add:

```js
  if (def.ui.control === 'none' && ['subgroup', 'column', 'when'].some(has)) {
    fail('control: none takes no ui.subgroup, ui.column or ui.when');
  }
  if (has('subgroup')) {
    if (typeof def.ui.subgroup !== 'string' || def.ui.subgroup.trim() === '') fail('ui.subgroup must be a non-empty string');
    if (has('header')) fail('a header toggle takes no ui.subgroup');
  }
  // A single row drawn under the Focused column alone, with a dash under
  // Unfocused: the focus light shows only on the focused window.
  if (has('column')) {
    if (def.ui.column !== 'focused') fail('ui.column must be focused');
    if (has('state')) fail('ui.column and ui.state are exclusive');
    if (has('header')) fail('ui.column is not valid on a header toggle');
  }
```

Note the `control: none` check must sit before the existing `if (def.ui.control === 'none') { … neutral … }` block at the end; place it directly after the `has('header')` block as written. In `loadDefs`, before the `// A replacement is a rename across a release` comment, add `checkSubgroups(defs);`, and add this function below `loadDefs`:

```js
// A subgroup is one run of rows under one heading: every visible non-header
// row of a group names one or none does, and each name's rows are contiguous
// in ui.order, or the panel would draw the same heading twice.
function checkSubgroups(defs) {
  const groups = new Map();
  for (const def of defs.values()) {
    if (def.ui.control === 'none' || def.ui.header === true) continue;
    if (!groups.has(def.ui.group)) groups.set(def.ui.group, []);
    groups.get(def.ui.group).push(def);
  }
  for (const [group, list] of groups) {
    if (!list.some((def) => def.ui.subgroup !== undefined)) continue;
    const bare = list.find((def) => def.ui.subgroup === undefined);
    if (bare) {
      throw new Error(`group ${group}: ${bare.key} has no ui.subgroup; either every row of a group names one or none does`);
    }
    list.sort((a, b) => a.ui.order - b.ui.order);
    const closed = new Set();
    list.forEach((def, index) => {
      const name = def.ui.subgroup;
      if (closed.has(name)) {
        throw new Error(`group ${group}: ${def.key} splits subgroup ${name}; its rows must be contiguous in ui.order`);
      }
      if (list[index + 1]?.ui.subgroup !== name) closed.add(name);
    });
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
tasks check
git add src/defs.js test/defs.test.js
git commit -m "feat(defs): ui.subgroup and ui.column for sectioned focus rows"
```

### Task 2: Lay the Ring out by subgroup and focus column

**Files:**
- Modify: `defs/glass.yaml` (Ring section, `glass.lightIor`)
- Modify: `integrations/noctalia-plugin/panel.luau` (`singleRow`, `appendSection`, two new helpers)
- Test: `integrations/noctalia-plugin/plugin_test.lua`, `test/plugin-presentation.test.js`, `test/defs.test.js`

**Interfaces:**
- Consumes: `ui.subgroup`, `ui.column` from Task 1.
- Produces: `absentCell()` and `subgroupHeading(group, name)` in `panel.luau`; row keys `"<group>:<subgroup>:subgroup"` for headings.

- [ ] **Step 1: Write the failing tests**

In `test/plugin-presentation.test.js`, replace the `ring` expectation in the first test with the new order:

```js
  assert.deepEqual(ring, [
    'glass.ring.focus',
    'glass.ring.colorSource',
    'glass.ring.color',
    'glass.ring.gap',
    'glass.ring.width',
    'glass.lightIor',
    'glass.ring.beamSpeed',
    'glass.ring.beamNoise',
    'glass.ring.beamNoiseHz',
    'glass.ring.decay',
    'glass.ring.glow',
    'glass.ring.rest',
    'glass.ring.accent',
    'glass.ring.edgeTint',
  ]);
```

and append a test:

```js
test('the Ring reads band, focus light, then signal accent, with the focus light focused-only', () => {
  const defs = [...loadDefs(defsDir()).values()]
    .filter((def) => def.ui.group === 'Ring' && def.ui.header !== true)
    .sort((a, b) => a.ui.order - b.ui.order);
  assert.deepEqual(defs.map((def) => [def.key, def.ui.subgroup, def.ui.column ?? 'spans']), [
    ['glass.ring.colorSource', 'Band', 'spans'],
    ['glass.ring.color', 'Band', 'spans'],
    ['glass.ring.gap', 'Band', 'spans'],
    ['glass.ring.width', 'Band', 'spans'],
    ['glass.lightIor', 'Band', 'spans'],
    ['glass.ring.beamSpeed', 'Focus light', 'focused'],
    ['glass.ring.beamNoise', 'Focus light', 'focused'],
    ['glass.ring.beamNoiseHz', 'Focus light', 'focused'],
    ['glass.ring.decay', 'Focus light', 'focused'],
    ['glass.ring.glow', 'Focus light', 'focused'],
    ['glass.ring.rest', 'Focus light', 'focused'],
    ['glass.ring.accent', 'Signal accent', 'spans'],
    ['glass.ring.edgeTint', 'Signal accent', 'spans'],
  ]);
});
```

In `test/defs.test.js`, in `'the ring beam speed replaces the ring sweep'`, change `['Ring', 530, 'px/s']` to `['Ring', 550, 'px/s']`.

Append to `integrations/noctalia-plugin/plugin_test.lua`, immediately before the final `(function() … end)()` block that ends the file. The chunk is at Lua's limit of 200 active locals (`luac -p` rejects one more), so this block, and Task 6's after it, live in one function scope; the file's earlier helpers (`layeredModel`, `renderModel`, `byKey`, `collect`, `equal`, `buttonsByGlyph`, `panelError`, `host`) reach it as upvalues:

```lua
-- Ring layout and gate tests share one function scope: the chunk is at Lua's
-- 200-local limit, and these helpers are used by both.
(function()
-- The Ring: a heading per subgroup, the column header although no row is a
-- matrix row, and the focus light in the Focused column over a dash.
local function ringParam(key, control, value, order, extra)
  local ui = { control = control, group = "Ring", order = order, label = key }
  for name, field in pairs(extra or {}) do ui[name] = field end
  local param = { key = key, value = value, default = value, layer = "default", fallback = value, held = {},
    neutral = value, effectiveDrag = "release", ui = ui }
  if control == "slider" then param.range, ui.step = { 0, 3000 }, 1 end
  if control == "select" then param.values = { "familiar", "noctalia", "manual" } end
  return param
end
local function ringModel(params)
  local m = layeredModel()
  for _, param in ipairs(params) do m.params[#m.params + 1] = param end
  return m
end
local ringParams = {
  ringParam("glass.ring.focus", "toggle", true, 500, { header = true }),
  ringParam("glass.ring.colorSource", "select", "manual", 510, { subgroup = "Band" }),
  ringParam("glass.ring.color", "color", "#ccccff", 520, { subgroup = "Band" }),
  ringParam("glass.ring.beamSpeed", "slider", 300, 550, { subgroup = "Focus light", column = "focused" }),
  ringParam("glass.ring.accent", "slider", 1, 570, { subgroup = "Signal accent" }),
}
local ringTree = renderModel(ringModel(ringParams))
local order = {}
for index, node in ipairs(ringTree.children) do
  if node.props.key then order[node.props.key] = index end
end
assert(order["Ring:columns"], "the Ring draws the column header for its focused-only rows")
for _, key in ipairs({ "Ring:Band:subgroup", "glass.ring.colorSource:row", "Ring:Focus light:subgroup",
  "glass.ring.beamSpeed:row", "Ring:Signal accent:subgroup", "glass.ring.accent:row" }) do
  assert(order[key], "missing " .. key)
end
assert(order["Ring:columns"] < order["Ring:Band:subgroup"]
  and order["Ring:Band:subgroup"] < order["glass.ring.colorSource:row"]
  and order["glass.ring.color:row"] < order["Ring:Focus light:subgroup"]
  and order["Ring:Focus light:subgroup"] < order["glass.ring.beamSpeed:row"]
  and order["glass.ring.beamSpeed:row"] < order["Ring:Signal accent:subgroup"]
  and order["Ring:Signal accent:subgroup"] < order["glass.ring.accent:row"], "headings lead their rows")
equal(collect(ringTree.children[order["Ring:Band:subgroup"]], "label")[1].props.text, "Band")
local beamCells = byKey(ringTree, "glass.ring.beamSpeed:row")[1].children[1]
equal(#beamCells.children, 4, "a focused-only row has head, dash, separator and control")
equal(collect(beamCells.children[2], "label")[1].props.text, "—", "the unfocused cell is a dash")
equal(beamCells.children[4].props.key, "glass.ring.beamSpeed", "the control sits in the focused column")
local accentCells = byKey(ringTree, "glass.ring.accent:row")[1].children[1]
equal(#accentCells.children, 2, "a spanning row is head and one control")
-- Task 6's gate tests go here, inside this function.
end)()
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: FAIL — the Ring order and placement tests in `plugin-presentation.test.js`, the beam speed order in `defs.test.js`, and the Lua assertions (no `Ring:columns` row).

- [ ] **Step 3: Implement**

In `defs/glass.yaml`, change only these `ui:` lines (descriptions and everything else stay):

```yaml
# glass.ring.colorSource
  ui: {group: Ring, control: select, label: Color source, order: 510, subgroup: Band}
# glass.ring.color
  ui: {group: Ring, control: color, label: Color, order: 520, subgroup: Band}
# glass.ring.gap
  ui: {group: Ring, control: slider, step: 1, label: Gap, order: 530, unit: px, subgroup: Band}
# glass.ring.width
  ui: {group: Ring, control: slider, step: 0.1, label: Width, order: 535, unit: px, subgroup: Band}
# glass.lightIor
  ui: {group: Ring, control: slider, step: 0.5, label: Light bending, order: 540, subgroup: Band}
# glass.ring.beamSpeed
  ui: {group: Ring, control: slider, step: 50, label: Beam speed, order: 550, unit: px/s, subgroup: Focus light, column: focused}
# glass.ring.beamNoise
  ui: {group: Ring, control: slider, step: 0.05, label: Head wander, order: 552, subgroup: Focus light, column: focused}
# glass.ring.beamNoiseHz
  ui: {group: Ring, control: slider, step: 0.5, label: Wander rate, order: 554, unit: Hz, subgroup: Focus light, column: focused}
# glass.ring.decay
  ui: {group: Ring, control: slider, step: 50, label: Decay distance, order: 556, unit: px, subgroup: Focus light, column: focused}
# glass.ring.glow
  ui: {group: Ring, control: slider, step: 0.1, label: Glow, order: 560, subgroup: Focus light, column: focused}
# glass.ring.rest
  ui: {group: Ring, control: slider, step: 0.1, label: Resting ring, order: 562, subgroup: Focus light, column: focused}
# glass.ring.accent
  ui: {group: Ring, control: slider, step: 0.1, label: Accent strength, order: 570, subgroup: Signal accent}
# glass.ring.edgeTint
  ui: {group: Ring, control: toggle, label: Edge tint, order: 572, subgroup: Signal accent}
```

Move the `glass.lightIor` def block (with its comment) up to sit after `glass.ring.width`, so file order follows `ui.order`. Extend the Ring section comment above `glass.ring.focus` with: `Its rows fall in three subgroups: the band every window shares, the focus light only the focused window shows (drawn in the Focused column), and the signal accent on any window.`

In `integrations/noctalia-plugin/panel.luau`, add above `singleRow`:

```lua
-- The cell a focused-only row leaves under Unfocused: a dash, so the row reads
-- as a matrix row whose unfocused half does not exist.
local function absentCell()
  return ui.row({flexGrow = 1, justify = "center", align = "center"}, {
    ui.label({text = "—", fontSize = 12, color = "on_surface_variant"}),
  })
end

local function subgroupHeading(group, name)
  return ui.row({key = group .. ":" .. name .. ":subgroup", paddingV = 2}, {
    ui.label({text = name, fontSize = 12, fontWeight = "bold", color = "on_surface_variant"}),
  })
end
```

Replace `singleRow` with:

```lua
local function singleRow(param, indent)
  if param.ui.column == "focused" then
    return paramRow(param.key .. ":row", {
      headCell(param.ui.label or param.key, param, indent),
      absentCell(),
      ui.separator({orientation = "vertical", spacing = 4}),
      controlCell(param, 1),
    }, rowHint({param}))
  end
  return paramRow(param.key .. ":row", {
    headCell(param.ui.label or param.key, param, indent),
    controlCell(param, 1),
  }, rowHint({param}))
end
```

Replace `appendSection` with:

```lua
local function appendSection(children, section, color)
  local sectionParams = Presentation.sectionParams(section)
  children[#children + 1] = ui.separator({spacing = 6, color = color})
  children[#children + 1] = sectionHeader(section.name, section.toggle, sectionParams, color)
  local hasMatrix = false
  for _, row in ipairs(section.rows) do
    if row.param == nil or row.param.ui.column ~= nil then hasMatrix = true end
  end
  if hasMatrix then children[#children + 1] = matrixHeader(section.name) end
  local subgroup = nil
  for _, row in ipairs(section.rows) do
    local first = row.param or row.focused
    if first.ui.subgroup ~= nil and first.ui.subgroup ~= subgroup then
      subgroup = first.ui.subgroup
      children[#children + 1] = subgroupHeading(section.name, subgroup)
    end
    children[#children + 1] = row.param and singleRow(row.param) or matrixRow(row)
  end
end
```

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: PASS, 0 failures.

- [ ] **Step 5: Close `prism-4f8bab` and commit**

```bash
tasks done prism-b255ac "Ring laid out by subgroup and focus column"
tasks note prism-4f8bab "Ring laid out in Band / Focus light / Signal accent subgroups; focus light in the Focused column; owner acceptance with Part 2 (Task 7)."
tasks done prism-4f8bab "Ring group on the Unfocused/Focused axis: ui.subgroup and ui.column, Band, Focus light (focused-only) and Signal accent"
tasks check
git add defs/glass.yaml integrations/noctalia-plugin/panel.luau integrations/noctalia-plugin/plugin_test.lua test/plugin-presentation.test.js test/defs.test.js tasks/prism-4f8bab.md tasks/prism-b255ac.md
git commit -m "feat(ring): lay the Ring out by subgroup on the focus axis"
```

---

## Part 2 — Source-aware color controls (`prism-b4d118`)

Before Task 3: `tasks start prism-b4d118` in the worktree (its dependency `prism-4f8bab` closed in Task 2), and commit the record with Task 3.

### Task 3: Validate `ui.when` and refuse a hidden mix row

**Files:**
- Modify: `src/defs.js` (`validateDef`, `loadDefs`)
- Modify: `src/rack.js` (`validateRack`)
- Test: `test/defs.test.js`, `test/rack.test.js`

**Interfaces:**
- Produces: defs may carry `ui.when: {param, in, otherwise}` with `otherwise ∈ ['effective', 'hidden']`, exported as `WHEN_OTHERWISE`. `loadDefs` checks `param` is an enum def, `in` ⊆ its values, and twin rows share one `when`.

- [ ] **Step 1: Write the failing tests** — append to `test/defs.test.js`:

```js
test('ui.when gates a control on an enum and says what shows otherwise', () => {
  const src = '- {key: a.src, type: enum, values: [noctalia, manual], default: noctalia, neutral: manual, ui: {group: A, control: select, label: Source, order: 1}, description: d}\n';
  const color = (when) => `- {key: a.tint, type: color, default: '#ffffff', neutral: '#ffffff', ui: {group: A, control: color, label: Tint, order: 2, when: ${when}}, description: d}\n`;
  assert.deepEqual(loadDefs(dirWith(src + color('{param: a.src, in: [manual], otherwise: effective}'))).get('a.tint').ui.when,
    { param: 'a.src', in: ['manual'], otherwise: 'effective' });
  assert.throws(() => loadDefs(dirWith(src + color('{param: a.src, in: [], otherwise: effective}'))), /ui\.when\.in must be a non-empty list/);
  assert.throws(() => loadDefs(dirWith(src + color('{param: a.src, in: [manual], otherwise: grey}'))), /ui\.when\.otherwise must be one of effective\|hidden/);
  assert.throws(() => loadDefs(dirWith(src + color('{param: a.src, in: [manual], otherwise: effective, extra: 1}'))), /ui\.when has unknown field extra/);
  assert.throws(() => loadDefs(dirWith(src + color('{param: a.src, in: [familiar], otherwise: effective}'))), /ui\.when\.in names familiar, not values of a\.src/);
  assert.throws(() => loadDefs(dirWith(color('{param: a.gone, in: [manual], otherwise: effective}'))), /ui\.when\.param a\.gone is not an enum def/);
  const slider = '- {key: a.mix, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: A, control: slider, step: 0.1, label: Mix, order: 3, when: {param: a.src, in: [noctalia], otherwise: effective}}, description: d}\n';
  assert.throws(() => loadDefs(dirWith(src + slider)), /otherwise: effective is color-only/);
  const hiddenSlider = slider.replace('otherwise: effective', 'otherwise: hidden');
  assert.equal(loadDefs(dirWith(src + hiddenSlider)).get('a.mix').ui.when.otherwise, 'hidden');
});

test('both halves of a matrix row share one gate', () => {
  const src = '- {key: a.src, type: enum, values: [noctalia, manual], default: noctalia, neutral: manual, ui: {group: A, control: select, label: Source, order: 1}, description: d}\n';
  const half = (key, state, order, when) => `- {key: ${key}, type: color, default: '#ffffff', neutral: '#ffffff', ui: {group: A, control: color, label: ${key}, order: ${order}, state: ${state}, row: Tint${when ? `, when: ${when}` : ''}}, description: d}\n`;
  const gate = '{param: a.src, in: [manual], otherwise: effective}';
  assert.doesNotThrow(() => loadDefs(dirWith(src + half('a.tint', 'focused', 2, gate) + half('a.inactive.tint', 'unfocused', 3, gate))));
  assert.throws(() => loadDefs(dirWith(src + half('a.tint', 'focused', 2, gate) + half('a.inactive.tint', 'unfocused', 3))),
    /a\.tint and a\.inactive\.tint declare different ui\.when; a row's halves share one gate/);
});
```

Append to `test/rack.test.js`:

```js
test('a card keeps its head: ui.when may hide a shared key but never the mix row', () => {
  const gate = ', when: {param: r.kind, in: [a], otherwise: hidden}';
  const hiddenShared = defsFrom(DEFS.replace('label: Amount, order: 9}', `label: Amount, order: 9${gate}}`));
  assert.doesNotThrow(() => validateRack(complete, hiddenShared));
  const hiddenMix = defsFrom(DEFS
    .replace('order: 2, state: focused, row: Blur}', `order: 2, state: focused, row: Blur${gate}}`)
    .replace('order: 3, state: unfocused, row: Blur}', `order: 3, state: unfocused, row: Blur${gate}}`));
  assert.throws(() => validateRack(complete, hiddenMix),
    /device one: mix row Blur cannot be hidden by ui\.when; a card has no head without it/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: the three new tests FAIL; `control: none takes no … ui.when` from Task 1 already covers hidden defs.

- [ ] **Step 3: Implement** — in `src/defs.js`, export the vocabulary under `MATRIX_CONTROLS`:

```js
// What a gated control shows while its source holds none of the listed values:
// the color the sink reported, or nothing.
export const WHEN_OTHERWISE = ['effective', 'hidden'];
```

In `validateDef`, after the `has('column')` block from Task 1:

```js
  if (has('when')) {
    const when = def.ui.when;
    if (typeof when !== 'object' || when === null || Array.isArray(when)) fail('ui.when must be a mapping');
    for (const field of Object.keys(when)) {
      if (!['param', 'in', 'otherwise'].includes(field)) fail(`ui.when has unknown field ${field}`);
    }
    if (typeof when.param !== 'string' || !KEY_RE.test(when.param)) fail('ui.when.param must name a key');
    if (!Array.isArray(when.in) || when.in.length === 0 || !when.in.every((value) => typeof value === 'string')) {
      fail('ui.when.in must be a non-empty list of values');
    }
    if (!WHEN_OTHERWISE.includes(when.otherwise)) fail(`ui.when.otherwise must be one of ${WHEN_OTHERWISE.join('|')}`);
    if (when.otherwise === 'effective' && def.ui.control !== 'color') fail('ui.when otherwise: effective is color-only');
    if (has('header')) fail('a header toggle takes no ui.when');
  }
```

In `loadDefs`, extend the twin check inside the `if (def.ui.state !== undefined)` block:

```js
        if (twin === undefined) rows.set(id, def);
        else if (!isDeepStrictEqual(twin.neutral, def.neutral)) {
          throw new Error(`group ${def.ui.group} row ${def.ui.row}: ${twin.key} and ${def.key} `
            + 'declare different neutrals; a row\'s halves must neutralize alike');
        } else if (!isDeepStrictEqual(twin.ui.when, def.ui.when)) {
          throw new Error(`group ${def.ui.group} row ${def.ui.row}: ${twin.key} and ${def.key} `
            + 'declare different ui.when; a row\'s halves share one gate');
        }
```

and next to `checkSubgroups(defs);` add `checkWhens(defs);` with:

```js
// A gate reads an enum the panel holds, under values that enum can take.
function checkWhens(defs) {
  for (const def of defs.values()) {
    const when = def.ui.when;
    if (when === undefined) continue;
    const source = defs.get(when.param);
    if (source?.type !== 'enum') {
      throw new Error(`invalid def ${def.key}: ui.when.param ${when.param} is not an enum def`);
    }
    const unknown = when.in.filter((value) => !source.values.includes(value));
    if (unknown.length > 0) {
      throw new Error(`invalid def ${def.key}: ui.when.in names ${unknown.join(', ')}, not values of ${when.param}`);
    }
  }
}
```

In `src/rack.js`, change the row map to keep both halves' keys (it already does: `row[def.ui.state] = def.key`) and, in the device loop right after the `for (const label of [device.mix, ...device.rows])` loop, add:

```js
    if (defs.get(rows.get(device.mix).focused).ui.when?.otherwise === 'hidden') {
      fail(`${where}: mix row ${device.mix} cannot be hidden by ui.when; a card has no head without it`);
    }
```

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
tasks check
git add src/defs.js src/rack.js test/defs.test.js test/rack.test.js tasks/prism-b4d118.md
git commit -m "feat(defs): ui.when gates a control on an enum source"
```

### Task 4: The niri sink reports the colors it installed

**Files:**
- Modify: `integrations/niri/render.js` (export `sourceColors`; `glassFor` and `responseBlock` consume it)
- Modify: `integrations/niri/apply`
- Modify: `src/paths.js` (add `effectiveDir`, `effectivePath`)
- Test: `test/niri-render.test.js`, `test/niri-apply.test.js`

**Interfaces:**
- Produces: `sourceColors(params, sources) → { [key]: { value: '#rrggbb', from: string } }` from `integrations/niri/render.js`; `effectiveDir() → string`, `effectivePath(sink) → string` from `src/paths.js`.

- [ ] **Step 1: Write the failing tests**

In `test/niri-render.test.js`, change the render import to `import { renderNiriFragment, DRY, sourceColors } from '../integrations/niri/render.js';` and append (`with_(overrides)` returns `{ params }` over the shipped defaults, which have glass enabled):

```js
test('sourceColors names exactly the colors a source resolved', () => {
  const palette = { noctaliaSurface: '#101010', noctaliaAccent: '#202020' };
  const params = (overrides) => with_(overrides).params;
  const tint = { value: '#121212', from: 'the Noctalia palette' };
  assert.deepEqual(sourceColors(params({ 'glass.tintSource': 'manual', 'glass.ring.colorSource': 'manual' }), palette), {});
  assert.deepEqual(sourceColors(params({ 'glass.enabled': false, 'glass.tintSource': 'noctalia',
    'glass.ring.colorSource': 'noctalia' }), palette), {});
  assert.deepEqual(sourceColors(params({ 'glass.tintSource': 'noctalia', 'glass.tintAccentMix': 0.1,
    'glass.ring.colorSource': 'manual' }), palette),
  { 'glass.attenuationColor': tint, 'glass.inactive.attenuationColor': tint });
  assert.deepEqual(sourceColors(params({ 'glass.tintSource': 'noctalia', 'glass.bypass.tint': true,
    'glass.ring.colorSource': 'manual' }), {}), {}, 'a bypassed tint needs and reports no palette');
  assert.deepEqual(sourceColors(params({ 'glass.tintSource': 'manual', 'glass.ring.colorSource': 'noctalia' }), palette),
    { 'glass.ring.color': { value: '#202020', from: 'the Noctalia palette' } });
  const stored = params({ 'glass.tintSource': 'manual', 'glass.ring.colorSource': 'noctalia' })['glass.ring.color'];
  assert.deepEqual(sourceColors(params({ 'glass.tintSource': 'manual', 'glass.ring.colorSource': 'noctalia' }),
    { noctaliaAccent: null }),
  { 'glass.ring.color': { value: stored, from: 'the stored Color; no Noctalia palette was found' } });
  assert.deepEqual(sourceColors(params({ 'glass.tintSource': 'manual', 'glass.ring.colorSource': 'familiar' }), {}),
    { 'glass.ring.color': { value: stored, from: "the resting color; each agent session's hue replaces it on its window" } });
});
```

In `test/niri-apply.test.js`, extend `fixture` to return the report path — add `const report = path.join(state, 'effective', 'niri.json');` beside `target` and include `report` in the returned object — then append:

```js
const readReport = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('the report names the colors the installed config carries', (t) => {
  const { dir, target, report, run, writeParams } = fixture(t);
  writeParams({ 'glass.ring.colorSource': 'noctalia' });
  const colors = path.join(dir, 'colors.json');
  fs.writeFileSync(colors, JSON.stringify({ primary: '#a1b2c3' }));

  const result = run({ PRISM_NOCTALIA_COLORS: colors });

  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(target, 'utf8'), /ring-color "#a1b2c3"/);
  assert.deepEqual(readReport(report), { 'glass.ring.color': { value: '#a1b2c3', from: 'the Noctalia palette' } });
});

test('manual sources and glass off report nothing for their keys', (t) => {
  for (const overrides of [{}, { 'glass.enabled': false, 'glass.ring.colorSource': 'noctalia', 'glass.tintSource': 'noctalia' }]) {
    const { report, run, writeParams } = fixture(t);
    writeParams(overrides);
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readReport(report), {}, JSON.stringify(overrides));
  }
});

test('the familiar ring reports its stored resting Color', (t) => {
  const { report, run, writeParams } = fixture(t);
  writeParams({ 'glass.ring.colorSource': 'familiar' });
  assert.equal(run().status, 0);
  assert.deepEqual(readReport(report), { 'glass.ring.color':
    { value: '#f2c14e', from: "the resting color; each agent session's hue replaces it on its window" } });
});

test('a bypassed noctalia tint applies over a missing or malformed palette and reports no tint', (t) => {
  for (const contents of [null, '{ broken']) {
    const { dir, report, run, writeParams } = fixture(t);
    writeParams({ 'glass.tintSource': 'noctalia', 'glass.bypass.tint': true });
    const palette = path.join(dir, 'palette.json');
    if (contents !== null) fs.writeFileSync(palette, contents);
    const result = run({ PRISM_NOCTALIA_COLORS: palette });
    assert.equal(result.status, 0, `${contents}: ${result.stderr}`);
    assert.deepEqual(readReport(report), {}, String(contents));
  }
});

test('a rejected config keeps the previous report and leaves no temp file', (t) => {
  const { state, report, run } = fixture(t);
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(report, '{"glass.ring.color":{"value":"#000000","from":"the Noctalia palette"}}\n');
  const before = fs.readFileSync(report, 'utf8');

  const result = run({ NIRI_FAKE_VALIDATE_FAILS: '1' });

  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(report, 'utf8'), before);
  assert.deepEqual(fs.readdirSync(path.join(state, 'effective')), ['niri.json']);
});

test('a failed reload request keeps the new config and the new report together', (t) => {
  const { report, run, calls, writeParams } = fixture(t);
  writeParams({ 'glass.ring.colorSource': 'familiar' });
  const result = run({ NIRI_FAKE_RELOAD_FAILS: '1' });
  assert.notEqual(result.status, 0);
  assert.equal(readReport(report)['glass.ring.color'].value, '#f2c14e');
  assert.deepEqual(calls(), ['validate', 'msg action load-config-file']);
});

// A directory where the report goes makes the publishing rename fail after a
// passing validate, with no hook in the sink.
test('a report that cannot be published rolls the config back and skips the reload', (t) => {
  for (const previous of ['// previous accepted generation\n', null]) {
    const { state, target, report, run, calls } = fixture(t);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (previous !== null) fs.writeFileSync(target, previous);
    fs.mkdirSync(report, { recursive: true });
    fs.writeFileSync(path.join(report, 'keep'), 'old report stand-in');

    const result = run();

    assert.notEqual(result.status, 0, 'an unpublished report fails the sink');
    if (previous === null) assert.equal(fs.existsSync(target), false, 'a first apply leaves no config');
    else assert.equal(fs.readFileSync(target, 'utf8'), previous);
    assert.deepEqual(fs.readdirSync(path.join(report)), ['keep'], 'the old report is untouched');
    assert.deepEqual(fs.readdirSync(path.join(state, 'effective')), ['niri.json'], 'no temp file is left');
    assert.deepEqual(fs.readdirSync(path.join(state, 'generated')).filter((name) => name.endsWith('.tmp')), []);
    assert.deepEqual(calls(), ['validate'], 'no reload is requested');
  }
});
```

Also, in the existing test `'a palette that does not parse fails the apply before anything is written'`, add after its last assertion:

```js
  assert.equal(fs.existsSync(path.join(path.dirname(path.dirname(target)), 'effective')), false,
    'a render that throws leaves no report and no temp file');
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: FAIL — `sourceColors` is not exported; no report is written.

- [ ] **Step 3: Implement**

`src/paths.js`, beside `generatedPath`:

```js
// One report per sink of the values it resolved from outside the store and
// installed; describe joins them onto the params.
export const effectiveDir = () => path.join(stateDir(), 'effective');
export const effectivePath = (sink) => path.join(effectiveDir(), `${sink}.json`);
```

`integrations/niri/render.js` — add after `paletteTint`:

```js
const NOCTALIA = 'the Noctalia palette';

// The colors a source resolves, keyed as the store names them. The render
// emits these and the apply reports them, so the KDL and the report cannot
// disagree. A key is present only when a source, not the store, decided it.
export function sourceColors(params, sources) {
  const colors = {};
  if (params['glass.enabled'] !== true) return colors;
  if (params['glass.tintSource'] === 'noctalia' && params['glass.bypass.tint'] !== true) {
    if (!sources.noctaliaSurface) throw new Error('noctalia tint rendered without a validated surface');
    const tint = { value: paletteTint(sources.noctaliaSurface, sources.noctaliaAccent,
      params['glass.tintAccentMix']), from: NOCTALIA };
    colors['glass.attenuationColor'] = tint;
    colors['glass.inactive.attenuationColor'] = tint;
  }
  const ring = params['glass.ring.colorSource'];
  if (ring === 'noctalia') {
    colors['glass.ring.color'] = typeof sources.noctaliaAccent === 'string'
      ? { value: sources.noctaliaAccent, from: NOCTALIA }
      : { value: params['glass.ring.color'], from: 'the stored Color; no Noctalia palette was found' };
  } else if (ring === 'familiar') {
    colors['glass.ring.color'] = { value: params['glass.ring.color'],
      from: "the resting color; each agent session's hue replaces it on its window" };
  }
  return colors;
}
```

Replace `glassFor`'s Noctalia block:

```js
const glassFor = (params, prefix, sources) => {
  const glass = Object.fromEntries(OPTICS.map((optic) => [optic, params[`${prefix}${optic}`]]));
  const tint = sourceColors(params, sources)[`${prefix}attenuationColor`];
  if (tint) glass.attenuationColor = tint.value;
  for (const [key, dry] of Object.entries(DRY)) {
    if (params[key] === true) Object.assign(glass, dry);
  }
  return glass;
};
```

`sourceColors` is defined below `responseBlock` in file order, which is fine for function declarations; `glassFor` is an arrow const defined after `paletteTint`, so place `sourceColors` between `paletteTint` and `glassFor`. In `responseBlock`, replace the `color` computation:

```js
  const color = sourceColors(params, sources)['glass.ring.color']?.value ?? params['glass.ring.color'];
```

`responseBlock` is only reached with glass enabled, so the fallback to the stored Color covers manual alone. Update the comment above `responseBlock` to say the color comes from `sourceColors`.

`integrations/niri/apply` — change the imports and replace everything from `const tmp = …` to the end of the callback:

```js
import { effectivePath, generatedPath } from '../../src/paths.js';
import { renderNiriFragment, sourceColors } from './render.js';
```

```js
  const kdl = renderNiriFragment(resolved, sources);
  const report = sourceColors(params, sources);

  // The report travels with the KDL: written beside it, published only once
  // niri accepts the KDL, and abandoned with it. niri runs this KDL after the
  // reload, or loads it at its next start, so the pair always agrees.
  const reportTarget = effectivePath('niri');
  fs.mkdirSync(path.dirname(reportTarget), { recursive: true });
  const reportTmp = `${reportTarget}.${process.pid}.tmp`;
  const tmp = `${target}.${process.pid}.tmp`;
  const rollback = () => {
    if (previous === null) {
      fs.rmSync(target, { force: true });
    } else {
      fs.writeFileSync(tmp, previous);
      fs.renameSync(tmp, target);
    }
    fs.rmSync(reportTmp, { force: true });
  };

  fs.writeFileSync(reportTmp, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(tmp, kdl);
  fs.renameSync(tmp, target);

  // The candidate has to be in place for niri to compose it with the surrounding
  // config, so validation happens after the rename and rolls back on rejection.
  try {
    execFileSync('niri', ['validate'], { stdio: 'pipe' });
  } catch (error) {
    rollback();
    throw error;
  }
  try {
    fs.renameSync(reportTmp, reportTarget);
  } catch (error) {
    rollback();
    throw error;
  }

  // Deliberately unwrapped: a reload that cannot be requested — because niri is
  // not running — must fail the sink while leaving the validated file to load on
  // cold start.
  execFileSync('niri', ['msg', 'action', 'load-config-file'], { stdio: 'pipe' });
});
```

`renderNiriFragment` and `sourceColors` both run before any write, so a render that throws (a broken palette, a missing surface) leaves neither temp file.

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: PASS, 0 failures, including every existing apply and render test.

- [ ] **Step 5: Commit**

```bash
tasks check
git add src/paths.js integrations/niri/render.js integrations/niri/apply test/niri-render.test.js test/niri-apply.test.js
git commit -m "feat(niri): report the source-resolved colors with the installed config"
```

### Task 5: `describe` joins the reports onto the params

**Files:**
- Create: `src/effective.js`
- Modify: `src/cli.js` (`describe`)
- Test: `test/effective.test.js` (new), `test/cli.test.js`

**Interfaces:**
- Consumes: `effectiveDir()` from Task 4.
- Produces: `readEffective(defs, dir = effectiveDir()) → Map<key, {value, from}>`, which validates each reported value with the reported key's own def (`validateValue` from `src/values.js`); `describe --json` params gain `effective: {value, from}` only for reported keys, placed last.

- [ ] **Step 1: Write the failing tests** — create `test/effective.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readEffective } from '../src/effective.js';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

const defs = loadDefs(defsDir());

const dirWith = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-effective-'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
};
const entry = (value) => ({ value, from: 'the Noctalia palette' });

test('no report directory is no reports', () => {
  assert.deepEqual(readEffective(defs, path.join(os.tmpdir(), 'prism-effective-absent', 'x')), new Map());
});

test('reports from every sink join by key, ignoring temp files', () => {
  const dir = dirWith({
    'niri.json': JSON.stringify({ 'glass.ring.color': entry('#a1b2c3') }),
    'other.json': JSON.stringify({ 'glass.attenuationColor': entry('#000000') }),
    'niri.json.123.tmp': '{ half written',
  });
  assert.deepEqual(readEffective(defs, dir), new Map([
    ['glass.ring.color', entry('#a1b2c3')],
    ['glass.attenuationColor', entry('#000000')],
  ]));
});

test('a malformed report fails naming its file', () => {
  for (const [text, pattern] of [
    ['{ broken', /niri\.json: not valid JSON/],
    ['[]', /niri\.json: expected an object of reported values/],
    [JSON.stringify({ 'glass.ring.color': { value: 7, from: 'x' } }), /niri\.json: glass\.ring\.color needs a string value and from/],
    [JSON.stringify({ 'glass.ring.color': { value: '#000000' } }), /niri\.json: glass\.ring\.color needs a string value and from/],
    [JSON.stringify({ 'glass.ring.color': entry('garbage') }), /niri\.json: glass\.ring\.color: not a #rrggbb\[aa\] color/],
    [JSON.stringify({ 'glass.ring.color': entry('#zzzzzz') }), /niri\.json: glass\.ring\.color: not a #rrggbb\[aa\] color/],
    [JSON.stringify({ 'other.color': entry('#000000') }), /niri\.json: reports other\.color, which no def declares/],
  ]) {
    assert.throws(() => readEffective(defs, dirWith({ 'niri.json': text })), pattern);
  }
});

test('two sinks reporting one key is an error naming both', () => {
  const dir = dirWith({
    'a.json': JSON.stringify({ 'glass.ring.color': entry('#000000') }),
    'b.json': JSON.stringify({ 'glass.ring.color': entry('#ffffff') }),
  });
  assert.throws(() => readEffective(defs, dir), /glass\.ring\.color is reported by both a\.json and b\.json/);
});
```

Append to `test/cli.test.js` (it imports `fs`, `path` and the CLI as `cli`; add `stateDir` to its `../src/paths.js` import):

```js
test('describe carries a sink-reported color as effective on that param only', async () => {
  fs.mkdirSync(path.join(stateDir(), 'effective'), { recursive: true });
  fs.writeFileSync(path.join(stateDir(), 'effective', 'niri.json'),
    JSON.stringify({ 'glass.ring.color': { value: '#a1b2c3', from: 'the Noctalia palette' } }));
  try {
    let out = '';
    await cli.run(['describe', '--json'], { print: (s) => { out += s; } });
    const params = JSON.parse(out).params;
    assert.deepEqual(params.find((p) => p.key === 'glass.ring.color').effective,
      { value: '#a1b2c3', from: 'the Noctalia palette' });
    assert.equal(Object.hasOwn(params.find((p) => p.key === 'glass.attenuationColor'), 'effective'), false);
  } finally {
    fs.rmSync(path.join(stateDir(), 'effective'), { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: FAIL — `src/effective.js` does not exist.

- [ ] **Step 3: Implement** — create `src/effective.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { effectiveDir } from './paths.js';
import { validateValue } from './values.js';

// A sink that resolves a value from outside the store (a palette, a session
// hue) reports what it installed, one file per sink. describe joins them onto
// the params so the panel can show the color in force where the stored one is
// not. A report that cannot be read fails describe: a wrong swatch is worse
// than an error naming the file. Each value is checked by the def of the key it
// reports, with the store's own validator.
export function readEffective(defs, dir = effectiveDir()) {
  let names;
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
  const byKey = new Map();
  const owner = new Map();
  for (const name of names) {
    const file = path.join(dir, name);
    let report;
    try {
      report = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      throw new Error(`${file}: not valid JSON`);
    }
    if (typeof report !== 'object' || report === null || Array.isArray(report)) {
      throw new Error(`${file}: expected an object of reported values`);
    }
    for (const [key, entry] of Object.entries(report)) {
      if (typeof entry?.value !== 'string' || typeof entry?.from !== 'string') {
        throw new Error(`${file}: ${key} needs a string value and from`);
      }
      const def = defs.get(key);
      if (def === undefined) throw new Error(`${file}: reports ${key}, which no def declares`);
      try {
        validateValue(def, entry.value);
      } catch (error) {
        throw new Error(`${file}: ${error.message}`);
      }
      if (owner.has(key)) throw new Error(`${key} is reported by both ${owner.get(key)} and ${name}`);
      owner.set(key, name);
      byKey.set(key, { value: entry.value, from: entry.from });
    }
  }
  return byKey;
}
```

In `src/cli.js`, import `readEffective` from `./effective.js`; in `case 'describe':` after `const rack = loadRack(defsDir(), defs);` add `const effective = readEffective(defs);`, and change the push to end with:

```js
            effectiveLiveness,
            effectiveDrag,
            ...(effective.has(key) ? { effective: effective.get(key) } : {}),
          });
```

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: PASS, 0 failures; `'describe emits only the public counter-free JSON shape'` still passes because `glass.ior` carries no report.

- [ ] **Step 5: Commit**

```bash
tasks check
git add src/effective.js src/cli.js test/effective.test.js test/cli.test.js
git commit -m "feat(describe): join sink-reported colors onto params as effective"
```

### Task 6: The panel gates its controls; ship the gates

**Files:**
- Modify: `integrations/noctalia-plugin/presentation.luau` (`M.gates`, `M.rack` mix refusal)
- Modify: `integrations/noctalia-plugin/panel.luau` (gate table, `readOnlyCell`, `controlCell`, `appendSection`, `deviceCard`, `visibleParamError`, `validateModel`, `render`)
- Modify: `defs/glass.yaml` (four `when`s, three descriptions)
- Test: `integrations/noctalia-plugin/plugin_test.lua`, `integrations/noctalia-plugin/contract.test.mjs`, `test/glass-defs.test.js`

**Interfaces:**
- Consumes: `ui.when` (Task 3), `effective` in the describe model (Task 5), `subgroupHeading`/`appendSection` (Task 2).
- Produces: `Presentation.gates(params) → { [key] = "control" | "effective" | "hidden" }` (keys without a `when` absent).

- [ ] **Step 1: Write the failing tests**

In `plugin_test.lua`, insert inside the Task 2 function scope, replacing its `-- Task 6's gate tests go here, inside this function.` line and keeping the closing `end)()` after it (the block reuses `ringParam`, `ringModel`, and must not add top-level locals):

```lua
-- Gates: only manual edits the ring Color; otherwise the cell is the reported
-- color behind a lock that says where it came from.
local function gatedRing(source, effective)
  local color = ringParam("glass.ring.color", "color", "#ccccff", 520,
    { subgroup = "Band", when = { param = "glass.ring.colorSource", ["in"] = { "manual" }, otherwise = "effective" } })
  color.effective = effective
  return ringModel({
    ringParam("glass.ring.focus", "toggle", true, 500, { header = true }),
    ringParam("glass.ring.colorSource", "select", source, 510, { subgroup = "Band" }),
    color,
  })
end
local function colorCell(tree) return byKey(tree, "glass.ring.color")[1] end

local manualCell = colorCell(renderModel(gatedRing("manual")))
equal(manualCell.children[2].props.glyph, "palette", "manual keeps the picker")

local reportedCell = colorCell(renderModel(gatedRing("noctalia", { value = "#a1b2c3", from = "the Noctalia palette" })))
equal(reportedCell.children[1].children[1].props.fill, "#a1b2c3", "the swatch shows the reported color")
equal(reportedCell.children[2].props.glyph, "lock")
equal(reportedCell.children[2].props.tooltip,
  "From the Noctalia palette, as of the last apply. Select the manual source to edit.")
equal(#buttonsByGlyph(reportedCell, "restore"), 0, "a read-only cell offers no reset")

local unreportedCell = colorCell(renderModel(gatedRing("familiar")))
equal(unreportedCell.children[1].children[1].props.fill, nil, "no report draws a hollow swatch")
equal(unreportedCell.children[2].props.tooltip,
  "No rendered color: the tint is bypassed, glass is off, or prism has not applied this source yet.")

-- Switching the source flips the gate on the optimistic value, and the
-- reconciled model decides the next render.
local switchModel = gatedRing("noctalia", { value = "#a1b2c3", from = "the Noctalia palette" })
local switchTree = renderModel(switchModel)
byKey(switchTree, "glass.ring.colorSource")[1].children[2].props.onChange(2)
equal(colorCell(rendered).children[2].props.glyph, "palette", "manual opens the picker at once")
writeCallback({ exitCode = 1, stdout = "", stderr = "rejected" })
switchModel.params[#switchModel.params - 1].value = "noctalia"
described(host.describeOk())
equal(colorCell(rendered).children[2].props.glyph, "lock", "a rejected switch closes it again")

-- A hidden shared key leaves the expanded card but still counts in its reset.
local function tintRack(source)
  local m = layeredModel()
  local function add(param) m.params[#m.params + 1] = param end
  add({ key = "glass.tintSource", value = source, default = "noctalia", layer = "default", fallback = "noctalia",
    held = {}, neutral = "manual", effectiveDrag = "release", values = { "noctalia", "manual" },
    ui = { control = "select", group = "Focus", order = 242, label = "Tint source" } })
  add({ key = "glass.tintAccentMix", value = 0.3, default = 0.1, layer = "scratch", fallback = 0.1,
    held = { "scratch" }, neutral = 0, effectiveDrag = "release", range = { 0, 1 },
    ui = { control = "slider", group = "Focus", order = 244, step = 0.01, label = "Palette accent mix",
      when = { param = "glass.tintSource", ["in"] = { "noctalia" }, otherwise = "hidden" } } })
  m.rack.devices[1].shared = { "glass.tintSource", "glass.tintAccentMix" }
  return m
end
local function expandBackdrop(tree)
  for _, button in ipairs(collect(tree, "button")) do
    if button.props.tooltip == "Show details" then button.props.onClick(); return rendered end
  end
  error("no collapsed card")
end
local noctaliaRack = expandBackdrop(renderModel(tintRack("noctalia")))
assert(byKey(noctaliaRack, "glass.tintAccentMix:row")[1], "the mix shows under noctalia")
local manualRack = expandBackdrop(renderModel(tintRack("manual")))
equal(byKey(manualRack, "glass.tintAccentMix:row")[1], nil, "the mix hides under manual")
local revertsHidden = false
for _, button in ipairs(collect(manualRack, "button")) do
  if button.props.tooltip == "Revert section (1)" and button.props.opacity == 1.0 then revertsHidden = true end
end
assert(revertsHidden, "the hidden edited mix still counts in the section reset")

-- A gate that hides a card's mix row has no head to draw.
local headless = layeredModel()
for _, param in ipairs(headless.params) do
  if param.key == "glass.roughness" or param.key == "glass.inactive.roughness" then
    param.ui.when = { param = "glass.focusSplit", ["in"] = { true }, otherwise = "hidden" }
  end
end
local ok, message = pcall(Presentation.rack, headless)
assert(not ok and tostring(message):find("mix row Blur cannot be hidden", 1, true), tostring(message))

-- A malformed report is a broken contract, not a swatch.
local badReport = gatedRing("noctalia", { value = 7, from = "x" })
equal(panelError(badReport), "glass.ring.color has a malformed effective color")
```

`panelError` is a top-level local defined earlier in the file, so it reaches this function as an upvalue. Confirm the scope with `luac -p integrations/noctalia-plugin/plugin_test.lua` before running the suite; it must print nothing.

In `contract.test.mjs`, replace the whole test `'tint source and mix draw while both manual pickers stay visible'` (it pins the old behaviour: pickers under both sources and the mix under manual) with:

```js
test('tint pickers are editable only under manual, and the mix shows only under noctalia', () => {
  for (const source of ['noctalia', 'manual']) {
    const model = describeStore({ base: { 'glass.tintSource': source } });
    const [report] = inspectModels([model]);
    assert.equal(report.error, undefined);
    assert.equal(report.cells['glass.tintSource'].kind, 'select');
    if (source === 'noctalia') assert.equal(report.cells['glass.tintAccentMix'].kind, 'slider');
    else assert.equal(report.cells['glass.tintAccentMix'], undefined, 'the mix hides under manual');
    for (const key of ['glass.attenuationColor', 'glass.inactive.attenuationColor']) {
      assert.equal(report.cells[key].glyph, source === 'manual' ? 'palette' : 'lock', `${key} under ${source}`);
      assert.equal(model.params.find((param) => param.key === key).value, '#dfe8ff', 'the stored tint is untouched');
    }
  }
});
```

Then replace the `if (param.ui.control === 'color') { … }` assertion in `'real describe output satisfies the panel model validator'` with:

```js
      if (param.ui.control === 'color') {
        const when = param.ui.when;
        const open = when === undefined
          || when.in.includes(model.params.find((other) => other.key === when.param).value);
        assert.equal(cell.glyph, open ? 'palette' : 'lock',
          `${param.key} drew ${cell.glyph}, not the ${open ? 'picker' : 'read-only lock'}`);
      }
```

In `test/glass-defs.test.js`, in `'palette tint controls are shared with explicit source and mix contracts'`, change the mix `ui` expectation and the description loop to:

```js
  assert.deepEqual(mix.ui, { group: 'Focus', control: 'slider', step: 0.01,
    label: 'Palette accent mix', order: 244, display: 'percent',
    when: { param: 'glass.tintSource', in: ['noctalia'], otherwise: 'hidden' } });
  for (const prefix of ['glass.', 'glass.inactive.']) {
    assert.deepEqual(defs.get(`${prefix}attenuationColor`).ui.when,
      { param: 'glass.tintSource', in: ['manual'], otherwise: 'effective' });
    assert.doesNotMatch(defs.get(`${prefix}attenuationColor`).description, /stored manual/);
    assert.match(defs.get(`${prefix}attenuationColor`).description, /editable under the manual source/);
    assert.match(defs.get(`${prefix}attenuationDistance`).description, /20 px depth/);
  }
  assert.deepEqual(defs.get('glass.ring.color').ui.when,
    { param: 'glass.ring.colorSource', in: ['manual'], otherwise: 'effective' });
  assert.match(defs.get('glass.ring.color').description, /editable under the manual source/);
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: FAIL — no gates in the panel, no `when` in the shipped defs, and the contract still expects every color to draw the picker.

- [ ] **Step 3: Implement**

`presentation.luau` — add after `M.sectionParams`:

```lua
-- A def's ui.when names an enum and the values under which its own control is
-- live. Otherwise the cell is the sink-reported color ("effective") or is not
-- drawn ("hidden"). Gates are presentation only: the param still counts in
-- every edit, neutral count and reset.
function M.gates(params)
  local byKey = {}
  for _, param in ipairs(params) do byKey[param.key] = param end
  local gates = {}
  for _, param in ipairs(params) do
    local when = param.ui.when
    if param.ui.control ~= "none" and when ~= nil then
      local source = byKey[when.param]
      if source == nil then error(param.key .. " is gated on unknown parameter " .. tostring(when.param), 0) end
      local open = false
      for _, value in ipairs(when["in"]) do
        if source.value == value then open = true end
      end
      gates[param.key] = open and "control" or when.otherwise
    end
  end
  return gates
end
```

In `M.rack`, right after `card.mix = takeRow(device.mix, id)`:

```lua
    local mixWhen = card.mix.focused.ui.when
    if mixWhen ~= nil and mixWhen.otherwise == "hidden" then
      error("device " .. id .. ": mix row " .. device.mix .. " cannot be hidden by ui.when; a card has no head without it")
    end
```

`panel.luau`:

1. Near the other module locals (after `local launch`): `local gates = {}` and

```lua
local function gateOf(param) return gates[param.key] or "control" end
```

2. In `visibleParamError`, before `if param.ui.control == "slider" then`:

```lua
  if param.effective ~= nil and (type(param.effective) ~= "table"
    or type(param.effective.value) ~= "string" or type(param.effective.from) ~= "string") then
    return param.key .. " has a malformed effective color"
  end
```

3. In `validateModel`, before the `titleOk` line:

```lua
  local gatesOk, gatesError = pcall(Presentation.gates, model.params)
  if not gatesOk then return tostring(gatesError) end
```

4. Above `controlCell`, add:

```lua
-- A color its source supplies: the swatch shows what the sink installed, and a
-- lock stands where the picker would. Only buttons carry a tooltip, so the
-- lock is an enabled button whose click does nothing.
local function readOnlyCell(param, grow)
  local effective = param.effective
  local tooltip = effective ~= nil
    and ("From " .. effective.from .. ", as of the last apply. Select the manual source to edit.")
    or "No rendered color: the tint is bypassed, glass is off, or prism has not applied this source yet."
  return ui.row({key = param.key, gap = 6, align = "center", flexGrow = grow, opacity = 1.0}, {
    ui.row({width = valueColumnWidth, justify = "end", align = "center"}, {
      ui.box({
        width = 28, height = 16, radius = 4,
        fill = effective ~= nil and effective.value or nil,
        border = "on_surface_variant/0.4",
        borderWidth = 1,
      }),
    }),
    ui.button({glyph = "lock", variant = "ghost", controlSize = "sm", tooltip = tooltip, onClick = function() end}),
    ui.spacer({flexGrow = 1}),
  })
end
```

and make the first line of `controlCell`:

```lua
  if gateOf(param) == "effective" then return readOnlyCell(param, grow) end
```

5. In `appendSection`'s row loop, wrap the body so a hidden row draws nothing:

```lua
  for _, row in ipairs(section.rows) do
    local first = row.param or row.focused
    if gateOf(first) ~= "hidden" then
      if first.ui.subgroup ~= nil and first.ui.subgroup ~= subgroup then
        subgroup = first.ui.subgroup
        children[#children + 1] = subgroupHeading(section.name, subgroup)
      end
      children[#children + 1] = row.param and singleRow(row.param) or matrixRow(row)
    end
  end
```

6. In `deviceCard`'s expanded branch:

```lua
    for _, row in ipairs(card.rows) do
      if gateOf(row.focused) ~= "hidden" then children[#children + 1] = matrixRow(row, detailIndent) end
    end
    for _, param in ipairs(card.shared) do
      if gateOf(param) ~= "hidden" then children[#children + 1] = singleRow(param, detailIndent) end
    end
```

7. In `render`, immediately before `local rack = Presentation.rack(state.model)`: `gates = Presentation.gates(state.model.params)`.

`defs/glass.yaml`:

```yaml
- key: glass.attenuationColor
  ...
  ui: {group: Focus, control: color, label: Tint, order: 240, state: focused, row: Tint, when: {param: glass.tintSource, in: [manual], otherwise: effective}}
  description: Focused tint, editable under the manual source; under Noctalia the panel shows the palette tint the last apply installed
- key: glass.inactive.attenuationColor
  ...
  ui: {group: Focus, control: color, label: Unfocused tint, order: 241, state: unfocused, row: Tint, when: {param: glass.tintSource, in: [manual], otherwise: effective}}
  description: Unfocused tint, editable under the manual source; under Noctalia the panel shows the palette tint the last apply installed
- key: glass.tintAccentMix
  ...
  ui: {group: Focus, control: slider, step: 0.01, label: Palette accent mix, order: 244, display: percent, when: {param: glass.tintSource, in: [noctalia], otherwise: hidden}}
- key: glass.ring.color
  ...
  ui: {group: Ring, control: color, label: Color, order: 520, subgroup: Band, when: {param: glass.ring.colorSource, in: [manual], otherwise: effective}}
  description: Ring color, editable under the manual source; under familiar it is the resting color of windows without a session, and under noctalia the fallback until a colorscheme exists, both shown read-only
```

(`...` marks the unchanged lines of each def; edit only the `ui:` and `description:` lines shown.)

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: PASS, 0 failures, including the contract test over real `describe` output.

- [ ] **Step 5: Commit**

```bash
tasks note prism-b4d118 "gates shipped: tint pickers and ring Color manual-only with sink-reported read-only swatches; Palette accent mix hidden outside noctalia; owner acceptance next (Task 7)."
tasks check
git add integrations/noctalia-plugin/presentation.luau integrations/noctalia-plugin/panel.luau integrations/noctalia-plugin/plugin_test.lua integrations/noctalia-plugin/contract.test.mjs defs/glass.yaml test/glass-defs.test.js tasks/prism-b4d118.md
git commit -m "feat(panel): color pickers only under manual, reported swatches otherwise"
```

### Task 7: Gate, merge and owner acceptance

**Files:**
- Modify: `docs/specs/2026-10-03-ring-axis-and-source-aware-colors-design.md` (status line)
- Task records: `prism-b4d118`, `prism-980a29`

- [ ] **Step 1: Run the pre-push gate in the worktree**

Run: `(cd .worktrees/prism-4f8bab && just gate)`
Expected: `ops-check` and `tasks check` clean, `npm test` 0 failures.

- [ ] **Step 2: Whole-branch review** by a fresh reviewer against the spec; record it with `tasks note prism-b4d118 "review: impl round <n> — …"` and run corrective rounds per the global rules.

- [ ] **Step 3: Verify where the live surfaces resolve** (read-only). Merging to main is a deploy: the launcher and the panel both run the main checkout.

```bash
readlink -f "$(command -v prism)"                      # a dotfiles wrapper; it must exec ~/d/prism/bin/prism
grep -n 'exec' "$(readlink -f "$(command -v prism)")"
readlink -f ~/.local/share/noctalia/plugins/prism      # must be the main checkout's integrations/noctalia-plugin
```

If either resolves anywhere else, stop and report it; do not repoint anything.

- [ ] **Step 4: Ask the owner before touching the host.** One question, naming every host action and its effect: merge `prism-4f8bab` into main (the next palette change or apply then runs the new sink); `prism apply niri` (validates and reloads the niri config, writing the first report); `noctalia msg plugins disable khughitt/prism && noctalia msg plugins enable khughitt/prism` (the panel restarts); then the owner opens the panel to look. Proceed only on a yes; otherwise `tasks park prism-600128 "<the question>" --waiting-on user --reason approval`.

- [ ] **Step 5: Merge and install** (only after Step 4's yes). If `prism-84d308` landed first, the rebase picks it up; rerun Step 1 after a non-trivial rebase.

```bash
git -C .worktrees/prism-4f8bab rebase main
git merge --ff-only prism-4f8bab
prism apply niri
noctalia msg plugins disable khughitt/prism && noctalia msg plugins enable khughitt/prism
```

- [ ] **Step 6: Owner acceptance.** The owner opens the panel and confirms: the Ring's three subgroups with the focus light under Focused; under Noctalia tint, the Tint row shows the palette swatches behind locks and Palette accent mix shows; under manual tint, pickers return and Palette accent mix hides; the ring Color behaves the same across its three sources.

- [ ] **Step 7: Close**

```bash
tasks done prism-600128 "Gate, merge and owner acceptance passed"
tasks done prism-b4d118 "Color pickers only under manual; other sources show the sink-reported color read-only; Palette accent mix hidden outside noctalia"
```

Update the spec's status line to `implemented; owner acceptance passed <date>`, run `tasks check`, and commit both with `docs(spec): ring axis and source-aware colors implemented`. `prism-980a29` closes after `prism-1bb833`.
