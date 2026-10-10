# Panel Render Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every Prism panel callback well inside Noctalia's 25 ms CPU budget by
rebuilding only the parts of the panel tree whose inputs changed, and by rendering a
changed describe in its own callback.

**Architecture:** A memo (`retain.luau`) keeps each control cell, row, card and section
header under a signature: the describe digest of its entries plus the few fields the
panel changes between describes. An accepted describe is turned once into a structure
(layout, lookups, digests) that renders and handlers read. Handlers resolve their target
by key when they run. `described` defers its render to the next `onFrameTick`.

**Tech Stack:** Luau panel code (`integrations/noctalia-plugin/*.luau`), tested with plain
Lua 5.4 (`plugin_test.lua`) and node:test (`contract.test.mjs`), run through
`just test-fast` (`npm test`).

**Spec:** `docs/specs/2026-10-10-panel-render-budget-design.md` (approved 2026-10-10,
review round 2: accept).

## Global Constraints

- Host budget: 25 ms of thread CPU per callback. 3 consecutive overruns, or 5 within
  60 s, disable the panel until reload. Nothing here changes the host or its API.
- In-host targets, with every rack card expanded: drag frame-tick render, `onDragEnd`,
  changed describe, and the deferred render that follows each ≤ 12 ms. A full rebuild
  (first describe after load, profile switch) < 15 ms.
- In-host figures are `os.clock()` elapsed time, an upper bound on the thread CPU the
  host meters. The targets apply to the median of at least five samples per callback
  class, and the session must add no "exceeded its CPU budget" lines to the log.
- If a full expanded rebuild's median is over 15 ms in-host, stop: the work returns to
  design and the spec is revised before more code lands. That gate (Task 6) runs before
  the offline ceilings are recorded (Task 7).
- Every retained render is deeply equal, ignoring function identity, to the tree a
  render from an empty memo produces.
- Offline cost ceilings sit at about 1.25× the measured Lua call count. A ceiling is
  raised only in the test, with the in-host figure beside it.
- Tree shape, keys, props, the queue, the refresh cadence, the unchanged-describe
  shortcut and the one-render-per-frame drag throttle stay as they are.
- Tests run only through `just test-fast`, which is how a run is recorded. Never call
  `lua`, `npm test` or `node --test` directly. `plugin_test.lua`'s failures appear in
  its output.
- Commits use conventional commit messages and carry no AI attribution.

## Review Focus

1. A gesture on a tree drawn before an accepted describe, landing before that
   describe's deferred render, acts on the new model or on nothing. This covers a
   removed control, a removed section's reset, a keyboard nudge and Keep, and none of
   them raises (tests in Task 4).
2. Closing the panel while a describe's render is pending leaves no frame tick running,
   and reopening renders once (test in Task 4).
3. A describe that lands mid-drag, then the release: the release renders once and the
   tick stops (test in Task 4).
4. The keyboard walk after a render where every unit was a cache hit still visits the
   sliders in order (test in Task 5).
5. Two values that differ only past the fifteenth significant digit never share a
   signature (test in Task 5).

---

## File structure

- Create `integrations/noctalia-plugin/retain.luau`. This is the memo: get-or-build by
  id and signature, eviction against a set of ids, and an opt-in trace for tests.
- Modify `integrations/noctalia-plugin/presentation.luau`:
  - derive slider metadata once per describe entry;
  - split the value-dependent rack state (`rackState`) out of `rack`.
- Modify `integrations/noctalia-plugin/panel.luau`:
  - build the structure once per accepted describe;
  - handlers act by key;
  - defer the describe's render to the next frame tick;
  - retain subtrees under their signatures;
  - collect the keyboard walk during the render walk.
- Modify `integrations/noctalia-plugin/plugin_test.lua`: fakes (encode, fresh copies,
  frame tick) and the new test blocks.
- Modify `integrations/noctalia-plugin/contract.test.mjs`: the harness fakes, and the
  cost-ceiling test on real describe output.
- Modify `docs/notes/noctalia-plugin-contract.md` (budget paragraph) and the spec status.

`plugin_test.lua`'s main chunk is long. Add new test code inside
`;(function() … end)()` blocks, as the later sections of that file already do, so the
chunk gains no top-level locals.

---

### Task 1: Presentation derives slider metadata once and recomputes rack state on demand

**Files:**
- Modify: `integrations/noctalia-plugin/presentation.luau:1-24` (precision and display helpers), `:334-418` (`rack`)
- Test: `integrations/noctalia-plugin/plugin_test.lua`, directly after the existing rack assertions (after `equal(Presentation.familyColors.source, "#5b9cf6")`, about line 118)

**Interfaces:**
- Produces: `Presentation.rackState(rack)`. It sets `card.bypassed`, `card.silenced` and
  `card.attenuatedBy` on every card from the current values of the param tables the
  cards reference, and returns nothing. `Presentation.rack(model)` still returns a rack
  with that state filled in, because it calls `rackState` before returning.
- All existing `Presentation` signatures are unchanged.

- [ ] **Step 1: Write the failing test**

Insert after the rack assertions near line 118 of `plugin_test.lua`:

```lua
;(function()
  -- A card's light follows its bypass value between describes: rackState
  -- recomputes it from the param tables the structure holds.
  rackParams[7].value = true -- r.bypass.one
  Presentation.rackState(rack)
  equal(rack.cards[1].bypassed, true)
  equal(rack.cards[2].silenced, true, "a card whose required device is bypassed is silenced")
  equal(#rack.cards[2].attenuatedBy, 1)
  equal(rack.cards[2].attenuatedBy[1].card == rack.cards[1], true)
  rackParams[7].value = false
  Presentation.rackState(rack)
  equal(rack.cards[1].bypassed, false)
  equal(rack.cards[2].silenced, false)
  equal(#rack.cards[2].attenuatedBy, 0)

  -- Slider metadata is worked out once per describe entry. A fresh entry with
  -- other metadata is a fresh derivation, never the earlier one's.
  equal(Presentation.formatValue(0.5, slider({ 0, 1 }, 0.01, { display = "percent" })), "50%")
  equal(Presentation.formatValue(0.5, slider({ 0, 1 }, 0.01)), "0.5")
  equal(Presentation.sliderTo(slider({ 0.1, 10 }, 0.01, { scale = "logarithmic" })), 1)
  equal(Presentation.sliderTo(slider({ 0.1, 10 }, 0.01)), 10)
end)()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `just test-fast`
Expected: FAIL with `attempt to call a nil value (field 'rackState')`.

- [ ] **Step 3: Implement**

In `presentation.luau`, replace lines 3-24 (`stepPrecision` through `percentPrecision`)
with:

```lua
-- A step's precision depends on the number alone; the same few steps recur on
-- every render.
local precisionByStep = {}

function M.stepPrecision(step)
  local cached = precisionByStep[step]
  if cached ~= nil then return cached end
  local text = tostring(step):lower()
  local result
  local exponentAt = text:find("e-", 1, true)
  if exponentAt then
    local coefficient = text:sub(1, exponentAt - 1)
    local decimalAt = coefficient:find(".", 1, true)
    local fractional = decimalAt and #coefficient - decimalAt or 0
    result = tonumber(text:sub(exponentAt + 2)) + fractional
  else
    local decimalAt = text:find(".", 1, true)
    result = decimalAt and #text - decimalAt or 0
  end
  precisionByStep[step] = result
  return result
end

-- Describe entries are never edited in place apart from value and edited, so
-- what a slider's range and ui imply is derived once per entry table. A new
-- describe decodes new tables, and the weak keys let the old ones go.
local metaByParam = setmetatable({}, { __mode = "k" })

local function meta(param)
  local found = metaByParam[param]
  if found ~= nil then return found end
  local display = param.ui.display or "raw"
  local scale = param.ui.scale or "linear"
  found = { display = display, scale = scale, normalizedTrack = scale ~= "linear" or display == "normalized" }
  if param.range ~= nil and param.ui.step ~= nil then
    found.percentPrecision = math.max(0, math.max(M.stepPrecision(param.ui.step),
      M.stepPrecision(param.range[1]), M.stepPrecision(param.range[2])) - 2)
  end
  metaByParam[param] = found
  return found
end

local function display(param) return meta(param).display end
local function scale(param) return meta(param).scale end

local function percentPrecision(param) return meta(param).percentPrecision end
```

Then replace `normalizedTrack` (currently lines 77-79) with:

```lua
local function normalizedTrack(param)
  return meta(param).normalizedTrack
end
```

Delete the now-unused `curved` helper and its comment (lines 18-19). Keep the comment's
point on `meta`'s `normalizedTrack` line:
`-- A curved track runs in normalized space whatever its label reads.`

In `M.rack`, move the value-dependent tail into `M.rackState`. Keep the unknown-device
validation in `rack`, where it already raises. Replace lines 401-417 with:

```lua
  for _, card in ipairs(cards) do
    for _, interaction in ipairs(card.interactions) do
      if interaction.kind == "attenuates" and byId[interaction.device] == nil then
        error("device " .. card.device .. " names unknown device " .. tostring(interaction.device))
      end
    end
  end
  local result = { group = rack.group, header = header, cards = cards, byId = byId }
  M.rackState(result)
  return result
end

-- What a rack's values make of it: which cards are bypassed, silenced by a
-- bypassed requirement, or attenuated by a bypassed source. The structure holds
-- the param tables, so a render recomputes this after every optimistic write.
function M.rackState(rack)
  for _, card in ipairs(rack.cards) do
    card.bypassed = card.bypass.value == true
    card.silenced = card.requires ~= nil and card.requires.bypass.value == true
  end
  for _, card in ipairs(rack.cards) do
    card.attenuatedBy = {}
    for _, interaction in ipairs(card.interactions) do
      local source = rack.byId[interaction.device]
      if interaction.kind == "attenuates" and source.bypassed then
        card.attenuatedBy[#card.attenuatedBy + 1] = { card = source, why = interaction.why }
      end
    end
  end
end
```

`byId` is added to the returned rack. Check that no existing `equal(rack, …)` in
`plugin_test.lua` compares a whole rack table. If one does, add `byId` to its
expected value.

- [ ] **Step 4: Run tests to verify they pass**

Run: `just test-fast`
Expected: PASS (all node tests and `plugin_test.lua`).

- [ ] **Step 5: Commit**

```bash
git add integrations/noctalia-plugin/presentation.luau integrations/noctalia-plugin/plugin_test.lua
git commit -m "perf(noctalia): derive slider metadata once and split rack state"
```

---

### Task 2: The retain memo

**Files:**
- Create: `integrations/noctalia-plugin/retain.luau`
- Test: `integrations/noctalia-plugin/plugin_test.lua`, beside the `package.loaded[...]` lines (about 376-378) and directly after them

**Interfaces:**
- Produces, as module `./retain.luau`:
  - `Retain.new() -> memo`: `memo.entries` is `{[id] = {signature, node}}`, and
    `memo.trace` is nil by default.
  - `Retain.get(memo, id, signature, build) -> node`: returns the stored node when the
    signature is equal. Otherwise it calls `build()`, stores the result, and appends
    `id` to `memo.trace` when `memo.trace` is a table.
  - `Retain.keep(memo, ids)`: drops every entry whose id is not a key of `ids`.
  - `Retain.clear(memo)`: drops every entry.

- [ ] **Step 1: Write the failing test**

Add next to the existing `package.loaded` lines:

```lua
package.loaded["./retain.luau"] = dofile(here .. "retain.luau")
```

Directly after those lines, add:

```lua
;(function()
  -- Retain hands back the stored node while the signature holds, rebuilds when
  -- it changes, and drops only the ids the structure no longer names.
  local Retain = package.loaded["./retain.luau"]
  local memo = Retain.new()
  local builds = 0
  local function build() builds = builds + 1; return { built = builds } end
  local first = Retain.get(memo, "a", "s1", build)
  equal(Retain.get(memo, "a", "s1", build) == first, true, "an unchanged signature returns the stored node")
  equal(builds, 1)
  equal(Retain.get(memo, "a", "s2", build) == first, false, "a changed signature rebuilds")
  equal(builds, 2)
  Retain.get(memo, "b", "s1", build)
  memo.trace = {}
  Retain.get(memo, "b", "s1", build)
  Retain.get(memo, "b", "s9", build)
  equal(memo.trace, { "b" }, "the trace names what was built, not what was reused")
  Retain.keep(memo, { a = true })
  equal(memo.entries.b, nil, "an id the structure dropped goes")
  equal(memo.entries.a ~= nil, true, "an id the structure keeps stays")
  Retain.clear(memo)
  equal(next(memo.entries), nil)
end)()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `just test-fast`
Expected: FAIL with `cannot open .../retain.luau`.

- [ ] **Step 3: Write the module**

`integrations/noctalia-plugin/retain.luau`:

```lua
-- Subtrees the panel built on an earlier render, each under the signature of
-- the inputs that shaped it. A unit whose signature is unchanged is handed back
-- whole; see docs/specs/2026-10-10-panel-render-budget-design.md.
local M = {}

function M.new()
  return { entries = {}, trace = nil }
end

function M.get(memo, id, signature, build)
  local entry = memo.entries[id]
  if entry ~= nil and entry.signature == signature then return entry.node end
  local node = build()
  memo.entries[id] = { signature = signature, node = node }
  if memo.trace ~= nil then memo.trace[#memo.trace + 1] = id end
  return node
end

-- Eviction follows the model's structure, not a render: a parent's hit skips
-- its children's lookups, so "unused this render" would drop nodes on screen.
function M.keep(memo, ids)
  for id in pairs(memo.entries) do
    if not ids[id] then memo.entries[id] = nil end
  end
end

function M.clear(memo)
  memo.entries = {}
end

return M
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `just test-fast`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add integrations/noctalia-plugin/retain.luau integrations/noctalia-plugin/plugin_test.lua
git commit -m "feat(noctalia): add a signature-keyed memo for panel subtrees"
```

---

### Task 3: One structure per accepted describe, and handlers that act by key

**Files:**
- Modify: `integrations/noctalia-plugin/panel.luau` (state, `validateModel`, `described`, every handler, `render`)
- Modify: `integrations/noctalia-plugin/plugin_test.lua` (fakes near line 355-378; new block at the end of the file)
- Modify: `integrations/noctalia-plugin/contract.test.mjs` (harness `noctalia` fake)
- Modify: `test/plugin-panel-lifecycle.test.js` (its `noctalia` fake)

**Interfaces:**
- Consumes: `Presentation.rackState(rack)` (Task 1).
- Produces:
  - **`state.structure`**, set together with `state.model` whenever a describe is
    accepted:

    ```
    {
      title = <title param>,
      rack = <Presentation.rack result>,
      sections = <Presentation.sections result>,
      byKey = {[key] = param},
      cardById = {[device] = card},
      paramsOf = {[group name] = {param...}},   -- every section, and the rack group
      digest = {[key] = string, ["device:" .. id] = string},
      ids = {[memo id] = true},  -- "c:"/"r:" .. key, "m:" .. group .. "\0" .. row,
                                 -- "h:"/"d:" .. device, "s:" .. group
    }
    ```
  - **Handlers** take keys:
    - `writeParam(key, value)` and `unsetParam(key)`;
    - `beginDrag(key, sliderValue)` and `endDrag(key)`;
    - `resetAction(mode, group)`, where a nil `group` means every visible param.
  - **Test fakes**:
    - `host.encode(value) -> string`, a deterministic stand-in for
      `noctalia.json.encode`;
    - `host.copy(value) -> table`, a deep copy;
    - `host.copies`: when true, `json.decode` returns `host.copy(model)` and records it
      in `host.lastDecoded`.

- [ ] **Step 1: Give the test host an encoder and fresh decodes**

In `plugin_test.lua`, directly after `function host.describeOk() … end` (about
line 360), add:

```lua
-- Stands in for the host's json.encode: the panel digests each entry, which
-- only needs a stable text of it, so keys are sorted.
function host.encode(value)
  if type(value) == "number" then return string.format("%.17g", value) end
  if type(value) ~= "table" then return type(value) == "string" and string.format("%q", value) or tostring(value) end
  local keys = {}
  for key in pairs(value) do keys[#keys + 1] = key end
  table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
  local parts = {}
  for _, key in ipairs(keys) do parts[#parts + 1] = tostring(key) .. "=" .. host.encode(value[key]) end
  return "{" .. table.concat(parts, ",") .. "}"
end

-- The host decodes fresh tables on every describe; most tests hand back the one
-- model they mutate, and the ones that need the host's behaviour set copies.
function host.copy(value)
  if type(value) ~= "table" then return value end
  local copied = {}
  for key, held in pairs(value) do copied[key] = host.copy(held) end
  return copied
end
```

Replace the fake's `json` line (about 374) with:

```lua
  json = {
    decode = function()
      host.decodes = host.decodes + 1
      if not host.copies then return model end
      host.lastDecoded = host.copy(model)
      return host.lastDecoded
    end,
    encode = function(value) return host.encode(value) end,
  },
```

In `contract.test.mjs`, inside the `harness` string, add this function above
`local function inspect(model)`:

```lua
-- Stands in for the host's json.encode: a stable text of each entry.
local function canonical(value)
  if type(value) == "number" then return string.format("%.17g", value) end
  if type(value) ~= "table" then return type(value) == "string" and string.format("%q", value) or tostring(value) end
  local keys = {}
  for key in pairs(value) do keys[#keys + 1] = key end
  table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
  local parts = {}
  for _, key in ipairs(keys) do parts[#parts + 1] = tostring(key) .. "=" .. canonical(value[key]) end
  return "{" .. table.concat(parts, ",") .. "}"
end
```

In the same file, change the harness fake's `json = {decode = function() return model end},` to
`json = {decode = function() return model end, encode = canonical},`.

`test/plugin-panel-lifecycle.test.js` loads the panel against its own fake host. Add the
same `canonical` function at the top of its Lua script, above `local function newHost()`.
Then change its fake's `json = {decode = function() return model end},` to
`json = {decode = function() return model end, encode = canonical},`.

- [ ] **Step 2: Write the failing tests**

Append to the end of `plugin_test.lua`:

```lua
;(function()
  -- A render reads the structure the accepted describe built; it does not
  -- rebuild the rack or the sections.
  renderModel(layeredModel())
  local realRack, realSections = Presentation.rack, Presentation.sections
  local rackCalls, sectionCalls = 0, 0
  Presentation.rack = function(...) rackCalls = rackCalls + 1; return realRack(...) end
  Presentation.sections = function(...) sectionCalls = sectionCalls + 1; return realSections(...) end
  onKey("F1", true)
  onKey("F1", true)
  Presentation.rack, Presentation.sections = realRack, realSections
  equal(rackCalls, 0, "a render reuses the accepted rack")
  equal(sectionCalls, 0, "a render reuses the accepted sections")

  -- Handlers in a tree drawn before a describe act on the model that describe
  -- brought, never on the tables they were built with.
  host.copies = true
  local oldTree = renderModel(twoEdits())
  local old = host.lastDecoded
  described(host.describeOk())
  local new = host.lastDecoded
  assert(old ~= new, "fixture: the second describe decoded fresh tables")
  local function param(m, key)
    for _, candidate in ipairs(m.params) do if candidate.key == key then return candidate end end
  end

  local iorReset
  for _, button in ipairs(collect(cellFor(oldTree, "glass.ior"), "button")) do
    if button.props.glyph == "restore" then iorReset = button end
  end
  iorReset.props.onClick()
  equal(commands[#commands], Shell.command({ "prism", "unset", "glass.ior" }))
  equal(param(new, "glass.ior").edited, false, "the reset reverts the current model")
  equal(param(old, "glass.ior").edited, true, "and leaves the drawn-from tables alone")

  byKey(oldTree, "backdrop:light")[1].props.onClick()
  equal(param(new, "glass.bypass.backdrop").value, true, "the light writes the current bypass")
  equal(param(old, "glass.bypass.backdrop").value, false)

  collect(oldTree, "toggle")[2].props.onChange(false) -- the Focus header toggle
  equal(param(new, "glass.focusSplit").value, false, "a section toggle writes the current param")
  equal(param(old, "glass.focusSplit").value, true)

  -- Glass and Focus each hold one edit; the Focus rack comes after Glass, so
  -- the last match is its revert.
  local sectionRevert
  for _, button in ipairs(collect(oldTree, "button")) do
    if button.props.tooltip == "Revert section (1)" then sectionRevert = button end
  end
  sectionRevert.props.onClick()
  equal(param(new, "glass.roughness").edited, false, "a section reset reverts the current params")
  equal(param(old, "glass.roughness").edited, true)
  host.copies = false
end)()
```

`commands[#commands]` is checked only for the first handler. The stub host never
completes a write, so later writes wait behind it in the queue and are checked through
the tables instead.

- [ ] **Step 3: Run tests to verify they fail**

Run: `just test-fast`
Expected: FAIL. Either `a render reuses the accepted rack` fails (rack calls > 0), or
the reset leaves the new model edited.

- [ ] **Step 4: Implement the structure**

In `panel.luau`:

1. Add `structure = nil,` to the `state` table under `model = nil,`, with the comment
   `-- What the accepted describe fixes until the next one; see buildStructure.`

2. Above `validateModel`, add:

```lua
-- What one accepted describe fixes until the next: the layout, the lookups
-- handlers resolve through when they run, every memo id the layout can use,
-- and the digest of each entry, which is what a retained subtree's signature
-- says describe reported. Digests are taken before markEdits adds the
-- panel's own fields.
local function buildStructure(model, title, rack, sections)
  local structure = {
    title = title, rack = rack, sections = sections,
    byKey = {}, cardById = {}, paramsOf = {}, digest = {}, ids = {},
  }
  local ids = structure.ids
  for _, param in ipairs(model.params) do
    structure.byKey[param.key] = param
    structure.digest[param.key] = noctalia.json.encode(param)
    ids["c:" .. param.key], ids["r:" .. param.key] = true, true
  end
  for index, device in ipairs(model.rack.devices) do
    local card = rack.cards[index]
    structure.cardById[card.device] = card
    structure.digest["device:" .. card.device] = noctalia.json.encode(device)
    ids["h:" .. card.device], ids["d:" .. card.device] = true, true
    for _, row in ipairs(card.rows) do ids["m:" .. rack.group .. "\0" .. row.row] = true end
  end
  structure.paramsOf[rack.group] = Presentation.rackParams(rack)
  ids["s:" .. rack.group] = true
  for _, section in ipairs(sections) do
    structure.paramsOf[section.name] = Presentation.sectionParams(section)
    ids["s:" .. section.name] = true
    for _, row in ipairs(section.rows) do
      if row.param == nil then ids["m:" .. section.name .. "\0" .. row.row] = true end
    end
  end
  return structure
end
```

3. Replace the tail of `validateModel` (lines 189-197) with:

```lua
  local gatesOk, gatesError = pcall(Presentation.gates, model.params)
  if not gatesOk then return tostring(gatesError) end
  local titleOk, title = pcall(Presentation.titleParam, model.params)
  if not titleOk then return tostring(title) end
  local rackOk, rack = pcall(Presentation.rack, model)
  if not rackOk then return tostring(rack) end
  local sectionsOk, sections = pcall(Presentation.sections, model.params, model.rack.group)
  if not sectionsOk then return tostring(sections) end
  return nil, buildStructure(model, title, rack, sections)
end
```

4. In `described`, declare `local model, structure` in place of `local model`, change
   `if not message then message = validateModel(model) end` to
   `if not message then message, structure = validateModel(model) end`, and under
   `state.model = model` add `state.structure = structure`.

5. Below `local function rowHidden(param) …`, add:

```lua
-- Handlers name what they act on by key and look it up when they run: a
-- retained subtree can outlive the model its closures were built against. A
-- key the last describe removed has no control left to act on.
local function current(key)
  return state.structure.byKey[key]
end
```

6. Replace `writeParam` and `unsetParam` with:

```lua
local function writeParam(key, value)
  local param = current(key)
  if param == nil then return end
  updateParam(param, value)
  enqueue({verb = "set", key = key, value = value, sample = false})
  render()
end

local function unsetParam(key)
  local param = current(key)
  if param == nil then return end
  param.value = param.fallback
  param.edited = false
  enqueue({verb = "unset", key = key})
  render()
end
```

7. Replace `resetAction` with:

```lua
-- What a reset covers, as the model now holds it: a section's or the rack's
-- params by group name, every visible param without one.
local function resetScope(group)
  if group == nil then return Presentation.visibleParams(state.model) end
  return state.structure.paramsOf[group]
end

local function resetAction(mode, group)
  return function()
    local params = resetScope(group)
    for _, param in ipairs(params) do
      if mode == "revert" then
        if param.edited then param.value, param.edited = param.fallback, false end
      elseif mode == "neutral" and param.neutralize ~= false and param.value ~= param.neutral then
        updateParam(param, param.neutral)
      end
    end
    if mode == "symmetric" then
      for _, row in ipairs(Presentation.pairsOf(params)) do
        if row.focused.value ~= row.unfocused.value then updateParam(row.unfocused, row.focused.value) end
      end
    end
    enqueue({verb = "reset", mode = mode, group = group})
    render()
  end
end
```

   In `resetModeButtons`, change each `act = resetAction(<mode>, group, params)` to
   `act = resetAction(<mode>, group)`. Keep the `params` argument for the counts.

8. In `beginDrag`, replace the signature and the resolving loop:

```lua
local function beginDrag(key, sliderValue)
  local param = current(key)
  if param == nil then return end
  sliderValue = tonumber(sliderValue)
```

   (Delete the `-- Synchronous reconciliation…` comment and its `for` loop.) In
   `endDrag`, change the signature to `endDrag(key)`, make its first lines
   `local drag = state.drag` then `if not drag or drag.key ~= key then return end` then
   `local param = current(key)`, and leave the rest of the body unchanged.

9. In `resetButton`, set `local key = param.key` at the top, and use
   `onClick = function() local now = current(key); if now ~= nil and now.edited then unsetParam(key) end end`.

10. In `nativeControl`, set `local key = param.key` at the top. Then:
    - toggle: `onChange = function(value) writeParam(key, value == true or value == "true") end`
    - select:

      ```lua
      onChange = function(index)
        local now = current(key)
        if now == nil then return end
        local value = now.values[(tonumber(index) or -1) + 1]
        if value == nil then
          state.errorText = "Prism returned an invalid selection index"
          render()
          return
        end
        writeParam(key, value)
      end,
      ```
    - slider: `onChange = function(value) beginDrag(key, value) end,` and `onDragEnd = function() endDrag(key) end,`
    - color:

      ```lua
      onClick = function()
        local now = current(key)
        if now == nil then return end
        if not noctalia.openColorPicker(tostring(now.value), function(color)
          if color ~= nil then writeParam(key, color) end
        end) then
          state.errorText = "Failed to open the color picker"
          render()
        end
      end,
      ```

11. In `lightRow`, set `local device = card.device` and use:

```lua
    onClick = available and function()
      local now = state.structure.cardById[device]
      if now == nil then return end
      writeParam(now.bypass.key, not (now.bypass.value == true))
    end or nil,
```

12. In `cardHead`, replace `toggleExpanded` with:

```lua
  local device = card.device
  local function toggleExpanded()
    state.expanded[device] = not (state.expanded[device] == true)
    render()
  end
```

13. In `sectionHeader`, set `local toggleKey = toggle and toggle.key` at the top. Use
    `onChange = function(value) writeParam(toggleKey, value == true or value == "true") end`.
14. In `render`'s title row, use
    `onChange = function(value) writeParam(title.key, value == true or value == "true") end`.
15. In `nudgeFocused`, use `writeParam(param.key, value)`.
16. In `render`, replace the four derivations with reads of the structure:

```lua
    local structure = state.structure
    local title = structure.title
```

(at the top of the `else` branch, replacing `local title = Presentation.titleParam(...)`) and

```lua
    gates = Presentation.gates(state.model.params)
    attached = Presentation.attachedSwatches(state.model.params, gates)
    local rack = structure.rack
    Presentation.rackState(rack)
    local sections = structure.sections
```

(replacing the `gates`/`attached`/`rack`/`sections` lines).

Search the file for any remaining `writeParam(` or `unsetParam(` call that passes a
table, and convert it to a key: `grep -n "writeParam(\|unsetParam(" integrations/noctalia-plugin/panel.luau`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `just test-fast`
Expected: PASS, including the new block and the `contract.test.mjs` cases.

- [ ] **Step 6: Commit**

```bash
git add integrations/noctalia-plugin/panel.luau integrations/noctalia-plugin/plugin_test.lua integrations/noctalia-plugin/contract.test.mjs test/plugin-panel-lifecycle.test.js
git commit -m "refactor(noctalia): build the panel structure once per describe and resolve handlers by key"
```

---

### Task 4: A changed describe renders in the next frame tick

**Files:**
- Modify: `integrations/noctalia-plugin/panel.luau` (`state`, `described`, `beginDrag`, `endDrag`, `render`, `onClose`, `onFrameTick`)
- Modify: `integrations/noctalia-plugin/plugin_test.lua` (panel fake, both `runAsync` fakes at about lines 369 and 941, new block at the end)
- Modify: `integrations/noctalia-plugin/contract.test.mjs` (harness: tick after describe)
- Modify: `test/plugin-panel-lifecycle.test.js` (`host.complete`: tick after a callback)

**Interfaces:**
- Consumes: Task 3's structure, `current(key)`, `resetScope(group)`.
- Produces:
  - `state.renderPending` (boolean) and a local `syncFrameTick()`.
  - In the tests:
    - `host.frameTick` is the last value the panel passed to `setNeedsFrameTick`.
    - `rawDescribed` is the most recent describe callback, with no tick.
    - `described` stays the name most tests use: it runs the callback, then one
      `onFrameTick(16)` whenever the panel asked for a tick.

- [ ] **Step 1: Make the test host tick after a describe**

In `plugin_test.lua`, change the panel fake's `setNeedsFrameTick = function() end,` to
`setNeedsFrameTick = function(on) host.frameTick = on end,`. Directly above the
`noctalia = {` fake (about line 367), add:

```lua
-- The panel renders an accepted describe in the next frame tick, not in the
-- describe's own callback. Most tests only care that the render lands, so the
-- recorded callback runs that tick too; rawDescribed is the callback alone.
function host.describeThenTick(callback)
  rawDescribed = callback
  return function(result)
    callback(result)
    if host.frameTick then onFrameTick(16) end
  end
end
```

In both `runAsync` fakes (about lines 371 and 943), change `described = callback` to
`described = host.describeThenTick(callback)`.

In `contract.test.mjs`'s harness, directly after the
`described({timedOut = false, …})` call in `inspect`, add `env.onFrameTick(16)`.

In `test/plugin-panel-lifecycle.test.js`, end `host.complete` with the frame tick that
the real host runs right after an accepted describe:

```lua
  function host.complete(index, failure)
    local call = assert(host.calls[index], "missing host call " .. index)
    call.callback({
      timedOut = false, exitCode = failure and 1 or 0, stdout = "{}", stderr = failure or "",
      stdoutTruncated = false, stderrTruncated = false,
    })
    -- An accepted describe renders in the next frame tick, which the host runs
    -- next; the reconciliation checks below read the tree that tick draws.
    if host.frameTicks then env.onFrameTick(16) end
  end
```

This keeps both native callback schedules intact. With `deferReconcileCallbacks`
false, the tick's render reconciles synchronously, as `complete` did before. With it
true, the callbacks still wait for `flushReconcile`. Do not change any assertion in
that file. If one fails, the deferral has changed reconciliation behaviour, and that
is a defect to fix in `panel.luau`.

- [ ] **Step 2: Write the failing tests**

Append to `plugin_test.lua`:

```lua
;(function()
  -- The decode and validation spend much of the describe's callback, so its
  -- render waits for the next frame tick and that tick's own budget.
  renderModel(layeredModel())
  host.renders = 0
  update(); update()
  rawDescribed(host.describeOk())
  equal(host.renders, 0, "a changed describe does not render in its own callback")
  equal(host.frameTick, true, "it asks for the next frame tick instead")
  onFrameTick(16)
  equal(host.renders, 1, "the next frame tick renders it once")
  equal(host.frameTick, false, "with no drag and nothing pending the tick stops")
  onFrameTick(16)
  equal(host.renders, 1, "a tick with nothing pending renders nothing")

  update(); update()
  rawDescribed({ exitCode = 1, stdout = "", stderr = "boom" })
  equal(host.renders, 1, "an error describe also waits for the tick")
  onFrameTick(16)
  equal(collect(rendered, "label")[1].props.text, "boom")

  -- Closing with a render pending leaves no tick behind; reopening renders once.
  renderModel(layeredModel())
  update(); update()
  rawDescribed(host.describeOk())
  equal(host.frameTick, true)
  onClose()
  equal(host.frameTick, false, "a closed panel keeps no tick for a pending render")
  host.renders = 0
  onOpen({})
  equal(host.renders, 1, "reopening renders the accepted model once")

  -- A describe that lands mid-drag is stale and held back; the release renders
  -- once and nothing is left ticking.
  renderModel(layeredModel())
  local gaps = byKey(rendered, "compositor.gaps:slider")[1]
  gaps.props.onChange(gaps.props.value + 5)
  equal(host.frameTick, true, "a drag ticks")
  rawDescribed(host.describeOk())
  host.renders = 0
  gaps.props.onDragEnd()
  equal(host.renders, 1, "the release renders once")
  equal(host.frameTick, false, "and nothing is left pending")

  -- A control the last describe removed acts on nothing, even before that
  -- describe's render replaces it.
  local staleTree = renderModel(layeredModel())
  local staleGaps = byKey(staleTree, "compositor.gaps:slider")[1]
  local without = layeredModel()
  table.remove(without.params, 2) -- compositor.gaps
  model = without
  update(); update()
  rawDescribed(host.describeOk())
  local before = #commands
  staleGaps.props.onChange(staleGaps.props.value + 5)
  staleGaps.props.onDragEnd()
  equal(#commands, before, "a removed control writes nothing")
  equal(host.frameTick, true, "only the describe's own render is waiting")

  -- So does the reset of a section the last describe removed.
  local sectionTree = renderModel(twoEdits())
  local glassRevert
  for _, button in ipairs(collect(sectionTree, "button")) do
    if button.props.tooltip == "Revert section (1)" then glassRevert = button; break end
  end
  local withoutGlass = twoEdits()
  for index = #withoutGlass.params, 1, -1 do
    if withoutGlass.params[index].ui.group == "Glass" then table.remove(withoutGlass.params, index) end
  end
  model = withoutGlass
  update(); update()
  rawDescribed(host.describeOk())
  local beforeReset = #commands
  glassRevert.props.onClick()
  equal(#commands, beforeReset, "a removed section's reset writes nothing")

  -- The keyboard walk holds the last render's tables. A nudge between a describe
  -- and its render steps from the value that describe brought.
  renderModel(layeredModel())
  onKey("j", true); onKey("j", true) -- glass.ior, drawn at 1.5
  local moved = layeredModel()
  moved.params[3].value = 1.8
  model = moved
  update(); update()
  rawDescribed(host.describeOk())
  onKey("l", true)
  equal(commands[#commands], Shell.command(Queue.argvFor({ verb = "set", key = "glass.ior", value = 1.81 })),
    "the nudge steps from the accepted 1.8, not the drawn 1.5")

  -- Keep from a tree drawn before a describe clears the edits the model now holds.
  local keepTree = renderModel(twoEdits())
  local oldKeep = glyphButton(keepTree, "bookmark")
  model = twoEdits()
  update(); update()
  rawDescribed(host.describeOk())
  oldKeep.props.onClick()
  assert(labelSet(rendered)["No edits"], "Keep clears the edits of the model now held")
end)()
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `just test-fast`
Expected: FAIL at `a changed describe does not render in its own callback` (renders 1).

- [ ] **Step 4: Implement**

In `panel.luau`:

1. Add `renderPending = false,` to `state` with
   `-- An accepted describe's render, waiting for the next frame tick.`
2. Above `described`, add:

```lua
-- Frame ticks run while a drag needs its throttled render or a describe's
-- render waits for its own callback.
local function syncFrameTick()
  panel.setNeedsFrameTick(state.drag ~= nil or state.renderPending)
end
```

3. At the end of `described`, replace `render()` (the line before the final
   `finishRefresh()`) with:

```lua
  -- The decode and validation above already spent much of this callback's
  -- budget, so the render waits for the next frame tick and its own budget.
  state.renderPending = true
  syncFrameTick()
```

4. First line of `render`: `state.renderPending = false`.
5. In `beginDrag`, replace `panel.setNeedsFrameTick(true)` with `syncFrameTick()`.
   Keep the comment above it.
6. In `endDrag`, delete `panel.setNeedsFrameTick(false)`. After
   `state.renderedSliderCorrection = nil` at the end, add `syncFrameTick()`. The release
   has just rendered whatever was pending.
7. In `onClose`, add `state.renderPending = false` above
   `panel.setNeedsFrameTick(false)`.
8. Replace `onFrameTick` with:

```lua
function onFrameTick(deltaMs)
  local dragDirty = state.drag ~= nil and state.drag.dirty
  if state.renderPending or dragDirty then
    if dragDirty then state.drag.dirty = false end
    render()
  end
  if not state.drag then
    syncFrameTick()
    return
  end
  if not state.drag.pendingSample then return end
  state.sampleElapsedMs = state.sampleElapsedMs + deltaMs
  if state.sampleElapsedMs < 100 then return end
  state.sampleElapsedMs = 0
  enqueue(state.drag.pendingSample)
  state.drag.pendingSample = nil
end
```

9. Make `nudgeFocused` step from the current model. Until the deferred render runs,
   `state.focusOrder` holds the previous render's tables:

```lua
local function nudgeFocused(direction)
  if state.naming ~= nil then return end
  local index = focusIndex()
  if index == nil then return end
  -- The walk holds the last render's tables; the model may already be newer.
  local param = current(state.focusOrder[index].key)
  if param == nil or param.effectiveDrag == nil then return end
  local value = Presentation.stepCanonicalValue(param.value, direction, param)
  if value == param.value then return end
  writeParam(param.key, value)
end
```

10. In `resetAction`'s returned function, directly after
    `local params = resetScope(group)`, add:

```lua
    -- The section left with the last describe; its button is still on screen.
    if params == nil then return end
```

11. Make `commitAction` clear the edits of the model it acts on. Drop its `params`
    argument:

```lua
local function commitAction(item)
  item.expected = item.expected or Queue.captureSlots(state.model)
  return function()
    if state.selectionPending then return end
    for _, param in ipairs(Presentation.visibleParams(state.model)) do param.edited = false end
```

    Leave the rest of its body unchanged. Then remove the second argument from each of
    its callers: the two in `editsRow`, and one each in `commitName`, `confirmRow` and
    `saveShortcut`. Each of those passed the visible params of the model at the time.
    `item.expected` stays captured at build time on purpose: it is the guard that
    refuses a stale commit.

- [ ] **Step 5: Run tests to verify they pass**

Run: `just test-fast`
Expected: PASS. If an older test now fails, check whether it calls a stored describe
callback directly rather than through `described`. If it does, add an `onFrameTick(16)`
after that call. Do not change any assertion's meaning.

- [ ] **Step 6: Commit**

```bash
git add integrations/noctalia-plugin/panel.luau integrations/noctalia-plugin/plugin_test.lua integrations/noctalia-plugin/contract.test.mjs test/plugin-panel-lifecycle.test.js
git commit -m "perf(noctalia): render a changed describe in the next frame tick"
```

---

### Task 5: Retained subtrees

**Files:**
- Modify: `integrations/noctalia-plugin/panel.luau` (require, memo, signatures, retained wrappers, `controlCell`, `singleRow`, `matrixRow`, `deviceCard`, `appendSection`, `appendRack`, `render`, `described`)
- Test: `integrations/noctalia-plugin/plugin_test.lua` (new block at the end)

**Interfaces:**
- Consumes: `Retain` (Task 2), `state.structure` with `digest` and `ids` (Task 3),
  deferred describe (Task 4).
- Produces: a global `retainedMemo() -> memo`, exposed to the tests like `keyTable`.
  The tests clear it to compare a retained render with a fresh one, and set
  `memo.trace` to see what a render rebuilt.
- The memo ids are the ones `buildStructure` lists:
  - `"c:" .. key` for a cell, `"r:" .. key` for a single row;
  - `"m:" .. group .. "\0" .. row` for a matrix row;
  - `"h:" .. device` for a card head, `"d:" .. device` for a card;
  - `"s:" .. group` for a section header.

- [ ] **Step 1: Write the failing tests**

`tintRack`, `gatedRing` and `expandBackdrop` are locals of the block that ends near
line 1859 (`end)()` after the malformed-report check). The new block needs them. The
main chunk is close to Lua's 200-local limit, so they are not hoisted. Instead, add this
line just above that block's closing `end)()`:

```lua
host.tintRack, host.gatedRing, host.expandBackdrop = tintRack, gatedRing, expandBackdrop
```

Then append to `plugin_test.lua`:

```lua
;(function()
  local Retain = package.loaded["./retain.luau"]

  -- Deep equality, ignoring which function a handler is: a retained node's
  -- closures come from the render that built it.
  local function sameTree(a, b, path)
    if type(a) == "function" or type(b) == "function" then
      assert(type(a) == type(b), path .. ": a handler on one side only")
      return
    end
    if type(a) ~= "table" or type(b) ~= "table" then
      assert(a == b, path .. ": retained " .. tostring(a) .. ", fresh " .. tostring(b))
      return
    end
    for key, value in pairs(a) do sameTree(value, b[key], path .. "." .. tostring(key)) end
    for key in pairs(b) do assert(a[key] ~= nil, path .. "." .. tostring(key) .. " only in the fresh tree") end
  end

  -- The tree on screen must equal what an empty memo would draw. Help on and
  -- off is a plain re-render.
  local function retainedMatchesFresh(label)
    local retainedTree = rendered
    Retain.clear(retainedMemo())
    onKey("F1", true)
    onKey("F1", true)
    sameTree(retainedTree, rendered, label)
  end

  local function param(m, key)
    for _, candidate in ipairs(m.params) do if candidate.key == key then return candidate end end
  end
  local function expandAll()
    for _, button in ipairs(collect(rendered, "button")) do
      if button.props.tooltip == "Show details" then button.props.onClick() end
    end
  end

  -- The first button a predicate picks, clicked, then the check.
  local function clickFirst(predicate, label)
    for _, button in ipairs(collect(rendered, "button")) do
      if predicate(button.props) then
        button.props.onClick()
        retainedMatchesFresh(label)
        return
      end
    end
    error("fixture: no button for " .. label)
  end

  -- Gestures, each followed by the check.
  host.copies = true
  renderModel(host.tintRack("noctalia"))
  expandAll()
  retainedMatchesFresh("expanded rack")
  local mix = byKey(rendered, "glass.inactive.roughness:slider")[1]
  mix.props.onChange(mix.props.value + 0.1)
  onFrameTick(16)
  retainedMatchesFresh("a drag's frame render")
  mix.props.onDragEnd()
  retainedMatchesFresh("a release")
  collect(cellFor(rendered, "glass.inactive.roughness"), "button")[1].props.onClick() -- its reset
  retainedMatchesFresh("a revert")
  collect(rendered, "toggle")[2].props.onChange(false) -- the Focus header toggle
  retainedMatchesFresh("a section toggle")
  collect(cellFor(rendered, "glass.tintSource"), "select")[1].props.onChange(0)
  retainedMatchesFresh("a select that closes one gate and opens another")
  clickFirst(function(p) return tostring(p.tooltip):find("^Revert section") ~= nil end, "a section revert")
  clickFirst(function(p) return p.glyph == "equal" and p.opacity == 1.0 end, "a mirror")
  clickFirst(function(p) return tostring(p.tooltip):find("^Neutralize") ~= nil end, "a neutralize")
  onKey("j", true); onKey("j", true)
  retainedMatchesFresh("focus moving")
  for _, button in ipairs(collect(rendered, "button")) do
    if button.props.tooltip == "Hide details" then button.props.onClick(); break end
  end
  retainedMatchesFresh("a collapsed card")

  -- A color write, through the host's picker.
  model = host.gatedRing("manual", nil)
  described(host.describeOk())
  local realPicker = noctalia.openColorPicker
  noctalia.openColorPicker = function(_, done) done("#123456"); return true end
  glyphButton(rendered, "palette").props.onClick()
  noctalia.openColorPicker = realPicker
  retainedMatchesFresh("a color write")

  -- Describes: one value, then a different structure.
  param(model, "glass.ior").value = 1.7
  described(host.describeOk())
  retainedMatchesFresh("a describe that changes one value")
  model = layeredModel()
  described(host.describeOk())
  retainedMatchesFresh("a describe with another structure")

  -- Describes that change only metadata, every value unchanged.
  model = host.tintRack("noctalia")
  described(host.describeOk())
  expandAll()
  local metadata = {
    { "a slider's range", function(m) param(m, "glass.ior").range = { 1, 3 } end },
    { "a slider's step", function(m) param(m, "glass.ior").ui.step = 0.1 end },
    { "a slider's display", function(m) param(m, "glass.ior").ui.display = "percent" end },
    { "a slider's scale", function(m) param(m, "glass.ior").ui.scale = "logarithmic" end },
    { "a slider's unit", function(m) param(m, "compositor.gaps").ui.unit = "px" end },
    { "a select's values", function(m) param(m, "glass.tintSource").values = { "familiar", "noctalia", "manual", "mood" } end },
    { "a label", function(m) param(m, "glass.ior").ui.label = "Index" end },
    { "a description", function(m) param(m, "glass.ior").description = "How far light bends" end },
    { "a device's label", function(m) m.rack.devices[1].label = "Back" end },
    { "a device's family", function(m) m.rack.devices[1].family = "transmission" end },
  }
  for _, case in ipairs(metadata) do
    case[2](model)
    described(host.describeOk())
    retainedMatchesFresh(case[1])
  end

  -- An effective color's source shows in the lock beside its select.
  model = host.gatedRing("noctalia", { value = "#112233", from = "noctalia" })
  described(host.describeOk())
  model = host.gatedRing("noctalia", { value = "#112233", from = "familiar" })
  described(host.describeOk())
  retainedMatchesFresh("an effective color's from")

  -- A device's interactions name the card that flattens it. The fixture rack
  -- has one device, so it names itself.
  model = layeredModel()
  param(model, "glass.bypass.backdrop").value = true
  described(host.describeOk())
  model.rack.devices[1].interactions = { { kind = "attenuates", device = "backdrop", why = "self" } }
  described(host.describeOk())
  retainedMatchesFresh("a device's interactions")

  -- A commit and a profile pick.
  renderModel(twoEdits())
  glyphButton(rendered, "bookmark").props.onClick()
  retainedMatchesFresh("a commit")
  collect(rendered, "select")[1].props.onChange(1) -- the profile selector: dawn
  retainedMatchesFresh("a profile pick")

  -- Two values that differ only past the fifteenth digit never share a signature.
  param(model, "glass.roughness").value = 0.1 + 0.2
  described(host.describeOk())
  param(model, "glass.roughness").value = 0.3
  described(host.describeOk())
  retainedMatchesFresh("a value that differs past the fifteenth digit")
  host.copies = false

  -- Retention reach: an unchanged render builds nothing; a drag builds only its
  -- path; a parent's rebuild keeps every sibling it reused.
  renderModel(layeredModel())
  expandAll()
  local memo = retainedMemo()
  memo.trace = {}
  onKey("F1", true); onKey("F1", true)
  equal(memo.trace, {}, "an unchanged render builds nothing")
  local unfocused = byKey(rendered, "glass.inactive.roughness:slider")[1]
  unfocused.props.onChange(unfocused.props.value + 0.1)
  onFrameTick(16)
  local built = {}
  for _, id in ipairs(memo.trace) do built[id] = true end
  equal(built, { ["c:glass.inactive.roughness"] = true, ["h:backdrop"] = true, ["d:backdrop"] = true, ["s:Focus"] = true },
    "a drag rebuilds its cell, its card head, its card, and the header whose edit count moved")
  memo.trace = {}
  onKey("F1", true); onKey("F1", true)
  equal(memo.trace, {}, "the render after the drag reuses every sibling the card kept")
  equal(memo.entries["r:glass.bypass.backdrop"] ~= nil, true, "the bypass row inside the card is still cached")
  memo.trace = nil
  unfocused.props.onDragEnd()

  -- The keyboard walk survives a render where every unit was a hit.
  renderModel(layeredModel())
  onKey("F1", true); onKey("F1", true)
  onKey("j", true)
  equal(cellFor(rendered, "compositor.gaps").props.fill, "primary/0.12", "j focuses the first slider")
  onKey("j", true)
  equal(cellFor(rendered, "glass.ior").props.fill, "primary/0.12", "and the next")
end)()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `just test-fast`
Expected: FAIL with `attempt to call a nil value (global 'retainedMemo')`.

- [ ] **Step 3: Implement**

In `panel.luau`:

1. Under the existing `require` lines, add `local Retain = require("./retain.luau")`.
2. After `local attached = {}`, add:

```lua
-- Subtrees from earlier renders, each under the signature of what shaped it
-- (docs/specs/2026-10-10-panel-render-budget-design.md). A full tree costs
-- more of the host's budget than one callback can spare, so a render rebuilds
-- only the units whose inputs changed.
local memo = Retain.new()
-- This render's signatures by memo id: a row, card, or header reuses its
-- cells' signatures instead of recomputing them.
local signatures = {}

-- Exposed to the tests, like keyTable: they clear it to compare a retained
-- render with a fresh one, and trace it to see what a render rebuilt.
function retainedMemo()
  return memo
end
```

3. After `current` (Task 3), add the signature helpers and the focus walk:

```lua
-- Numbers print with every digit, so two values that differ never share a
-- signature.
local function sig(value)
  if type(value) == "number" then return string.format("%.17g", value) end
  return tostring(value)
end

-- A cell is what describe said of its param (the digest) and what the panel
-- changed since: the optimistic value and edit, the gate, keyboard focus, and
-- the read-only color drawn beside a gating select. A builder reads nothing
-- else; a new panel-side input goes here in the same change.
local function cellSignature(param)
  local id = "c:" .. param.key
  local found = signatures[id]
  if found ~= nil then return found end
  local color = attached[param.key]
  found = table.concat({
    state.structure.digest[param.key], sig(param.value), sig(param.edited), gateOf(param),
    sig(state.focus == param.key),
    color ~= nil and state.structure.digest[color.key] or "", color ~= nil and sig(color.value) or "",
  }, "\1")
  signatures[id] = found
  return found
end

-- The keyboard walks the sliders in the order the render lays them out. A
-- reused cell runs no builder, so the walk is collected by the render's own
-- traversal, never inside a builder.
local function noteFocus(param)
  if param.ui.control == "slider" and gateOf(param) ~= "effective" then
    state.focusOrder[#state.focusOrder + 1] = param
  end
end

local function noteCardFocus(card)
  noteFocus(card.mix.unfocused)
  noteFocus(card.mix.focused)
  if state.expanded[card.device] ~= true then return end
  noteFocus(card.bypass)
  for _, row in ipairs(card.rows) do
    if not rowHidden(row.focused) then
      noteFocus(row.unfocused)
      noteFocus(row.focused)
    end
  end
  for _, param in ipairs(card.shared) do
    if not rowHidden(param) then noteFocus(param) end
  end
end
```

4. In `controlCell`, replace the focus block:

```lua
  local focused = false
  if param.ui.control == "slider" then
    state.focusOrder[#state.focusOrder + 1] = param
    focused = state.focus == param.key
  end
```

with `local focused = param.ui.control == "slider" and state.focus == param.key`.

5. Directly after `controlCell`, add:

```lua
local function retainedCell(param, grow)
  return Retain.get(memo, "c:" .. param.key, cellSignature(param) .. "\1" .. grow,
    function() return controlCell(param, grow) end)
end
```

   In `singleRow` and `matrixRow`, change every `controlCell(` call to `retainedCell(`.

6. Directly after `matrixRow`, add:

```lua
local function retainedSingleRow(param, indent)
  return Retain.get(memo, "r:" .. param.key, sig(indent or 0) .. "\2" .. cellSignature(param),
    function() return singleRow(param, indent) end)
end

-- A matrix row's label is its focused half's ui.row, which that half's digest
-- covers.
local function retainedMatrixRow(row, indent)
  return Retain.get(memo, "m:" .. row.focused.ui.group .. "\0" .. row.row,
    sig(indent or 0) .. "\2" .. cellSignature(row.unfocused) .. "\2" .. cellSignature(row.focused),
    function() return matrixRow(row, indent) end)
end
```

7. After `cardHead`, add the card signatures and the retained head, and rewrite
   `deviceCard`:

```lua
local function deviceDigest(card)
  return state.structure.digest["device:" .. card.device]
end

local function cardHeadSignature(card, expanded)
  return table.concat({
    deviceDigest(card), sig(expanded), sig(card.bypassed), sig(card.silenced),
    cellSignature(card.bypass), cellSignature(card.mix.unfocused), cellSignature(card.mix.focused),
  }, "\2")
end

-- The light, chevron and name, and the mix cells beside them.
local function retainedCardHead(card, expanded)
  return Retain.get(memo, "h:" .. card.device, cardHeadSignature(card, expanded), function()
    return ui.row({gap = 8, align = "center"}, {
      cardHead(card, expanded),
      retainedCell(card.mix.unfocused, 1),
      ui.separator({orientation = "vertical", spacing = 4}),
      retainedCell(card.mix.focused, 1),
    })
  end)
end

-- A card prints the labels of the devices that flatten it, so their digests
-- belong to its signature; the "|" part keeps that list apart from the rows.
local function cardSignature(card, expanded)
  local parts = { cardHeadSignature(card, expanded) }
  for _, entry in ipairs(card.attenuatedBy) do parts[#parts + 1] = deviceDigest(entry.card) end
  parts[#parts + 1] = "|"
  if expanded then
    for _, row in ipairs(card.rows) do
      parts[#parts + 1] = cellSignature(row.unfocused) .. "\2" .. cellSignature(row.focused)
    end
    for _, param in ipairs(card.shared) do parts[#parts + 1] = cellSignature(param) end
  end
  return table.concat(parts, "\3")
end

local function deviceCard(card)
  local expanded = state.expanded[card.device] == true
  local mix = card.mix
  local children = { retainedCardHead(card, expanded) }
  local hint = rowHint({card.bypass, mix.focused, mix.unfocused})
  if hint then children[#children + 1] = ui.row({gap = 8, align = "center", justify = "end"}, {hint}) end
  for _, entry in ipairs(card.attenuatedBy) do
    children[#children + 1] = ui.row({gap = 8, align = "center", justify = "end"}, {
      ui.label({
        text = mix.focused.ui.row .. " is flattened while " .. entry.card.label .. " is bypassed",
        fontSize = 11, color = "on_surface_variant",
      }),
    })
  end
  if expanded then
    children[#children + 1] = retainedSingleRow(card.bypass, detailIndent)
    for _, row in ipairs(card.rows) do
      if not rowHidden(row.focused) then children[#children + 1] = retainedMatrixRow(row, detailIndent) end
    end
    for _, param in ipairs(card.shared) do
      if not rowHidden(param) then children[#children + 1] = retainedSingleRow(param, detailIndent) end
    end
  end
  return ui.column({
    key = card.device .. ":card", gap = 2, paddingV = 4, paddingH = cardPadding, radius = 8,
    fill = Presentation.familyColors[card.family] .. "1f",
    opacity = card.bypassed and dimOpacity or 1.0,
  }, children)
end

local function retainedCard(card)
  local expanded = state.expanded[card.device] == true
  return Retain.get(memo, "d:" .. card.device, cardSignature(card, expanded),
    function() return deviceCard(card) end)
end
```

8. After `sectionHeader`, add:

```lua
-- A header draws its name, color, toggle, and the three counts its reset
-- buttons report; whether the mirror button shows is whether pairs exist.
local function sectionHeaderSignature(name, toggle, params, color)
  local pairsShown = #Presentation.pairsOf(params) > 0
  return table.concat({
    name, color,
    toggle ~= nil and state.structure.digest[toggle.key] or "", toggle ~= nil and sig(toggle.value) or "",
    Presentation.editedCount(params), pairsShown and Presentation.symmetricCount(params) or -1,
    Presentation.neutralCount(params),
  }, "\1")
end

local function retainedSectionHeader(name, toggle, params, color)
  return Retain.get(memo, "s:" .. name, sectionHeaderSignature(name, toggle, params, color),
    function() return sectionHeader(name, toggle, params, color) end)
end
```

9. Replace `appendSection` and `appendRack` with:

```lua
local function appendSection(children, section, color)
  local sectionParams = state.structure.paramsOf[section.name]
  children[#children + 1] = ui.separator({spacing = 6, color = color})
  children[#children + 1] = retainedSectionHeader(section.name, section.toggle, sectionParams, color)
  local hasMatrix = false
  for _, row in ipairs(section.rows) do
    if row.param == nil then hasMatrix = true end
  end
  if hasMatrix then children[#children + 1] = matrixHeader(section.name) end
  local subgroup = nil
  for _, row in ipairs(section.rows) do
    local first = row.param or row.focused
    if not rowHidden(first) then
      if first.ui.subgroup ~= nil and first.ui.subgroup ~= subgroup then
        subgroup = first.ui.subgroup
        children[#children + 1] = subgroupHeading(section.name, subgroup)
      end
      if row.param then
        noteFocus(row.param)
        children[#children + 1] = retainedSingleRow(row.param)
      else
        noteFocus(row.unfocused)
        noteFocus(row.focused)
        children[#children + 1] = retainedMatrixRow(row)
      end
    end
  end
end

local function appendRack(children, rack, color)
  children[#children + 1] = ui.separator({spacing = 6, color = color})
  children[#children + 1] = retainedSectionHeader(rack.group, rack.header, state.structure.paramsOf[rack.group], color)
  children[#children + 1] = matrixHeader(rack.group, cardPadding)
  for _, card in ipairs(rack.cards) do
    noteCardFocus(card)
    children[#children + 1] = retainedCard(card)
  end
end
```

10. In `render`, directly after `state.renderPending = false` (Task 4), add
    `signatures = {}`.
11. In `described`, directly under `state.structure = structure`, add
    `Retain.keep(memo, structure.ids)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `just test-fast`
Expected: PASS.

If an equivalence check fails, it names the gesture and the path of the differing
prop. That means a builder reads an input its signature lacks. Add that input to the
signature in `cellSignature`, `cardHeadSignature`, `cardSignature` or
`sectionHeaderSignature`. Never clear the memo to make the check pass.

- [ ] **Step 5: Commit**

```bash
git add integrations/noctalia-plugin/panel.luau integrations/noctalia-plugin/plugin_test.lua
git commit -m "perf(noctalia): retain unchanged panel subtrees between renders"
```

---

### Task 6: In-host measurement and the 15 ms gate

This runs after Task 5 and before Task 7. The ceilings Task 7 records only mean
something once this gate has passed.

This step uses the live desktop. It reloads the Prism plugin twice and opens the panel,
and it needs the user's hands, because there is no pointer automation on this host.
**Ask the user first**, naming what will happen, that it takes about fifteen minutes,
and that it switches their profile away and back. Do not proceed on an earlier yes. If
the user declines, park:
`tasks park prism-dac509 "Run Task 6 of docs/plans/2026-10-10-panel-render-budget.md (in-host probe)" --reason quiet --waiting-on user --minutes 15`.

**What the probe measures.** In Luau, `os.clock()` is elapsed monotonic time, not the
thread CPU time (`CLOCK_THREAD_CPUTIME_ID`) the host meters. A probe figure is
therefore an upper bound: descheduling inflates it, and nothing deflates it. The gate
reads the **median** of at least five samples per callback class, and records the
maximum beside it. The host's own meter is authoritative, so the session must also add
**no** "exceeded its CPU budget" lines to the log.

**Files:**
- No repository files. The probe is a scratch copy under the session scratchpad
  (`$SCRATCH` below).

- [ ] **Step 1: Make the probe copy**

```bash
SCRATCH=<session scratchpad>/probe-plugin
rm -rf "$SCRATCH" && cp -r .worktrees/panel-budget/integrations/noctalia-plugin "$SCRATCH"
```

In `$SCRATCH/plugin.toml`, add `"x"` to the end of `capture_keys`.

In `$SCRATCH/panel.luau`, append at the very end:

```lua
-- Probe only. Each line is elapsed time (os.clock is monotonic in Luau), an
-- upper bound on the thread CPU the host meters. The run marker tells this
-- load's lines from any earlier probe's.
local probeRun = string.format("%d", os.time())
noctalia.log("prism-probe-run " .. probeRun)
local function timed(name, fn, ...)
  local started = os.clock()
  local a, b = fn(...)
  noctalia.log(string.format("prism-probe %s %s %.2f ms", probeRun, name, (os.clock() - started) * 1000))
  return a, b
end

local coldPending = false
local plainDescribed, plainEndDrag, plainTick = described, endDrag, onFrameTick
described = function(result) return timed("describe", plainDescribed, result) end
endDrag = function(key) return timed("dragEnd", plainEndDrag, key) end
-- A tick that renders nothing logs near zero; the analysis keeps ticks over 0.5 ms.
getfenv(1).onFrameTick = function(deltaMs)
  local label = coldPending and "coldRender" or (state.drag ~= nil and "dragTick" or "describeRender")
  coldPending = false
  return timed(label, plainTick, deltaMs)
end

-- x: the describe on screen again, through a fresh decode and an empty memo.
-- Every entry table is new, so slider metadata is cold too, and the next tick is a
-- cold full rebuild of whatever is expanded. Nothing reaches the store.
keyActions.x = {action = "probeCold"}
handlers.probeCold = function()
  local stdout = state.shownStdout
  state.shownStdout = nil
  Retain.clear(memo)
  coldPending = true
  described({timedOut = false, exitCode = 0, stdout = stdout, stderr = "",
    stdoutTruncated = false, stderrTruncated = false})
end
```

`described` and `endDrag` are `local function`s, which are ordinary locals, so
assigning to them at the end of the chunk swaps them for every caller and closure that
names them. `onFrameTick` is a global, which Luau caches on import, so it is replaced
through `getfenv(1)`.

Check it offline: `noctalia plugins lint "$SCRATCH"`.

- [ ] **Step 2: Point the shell at the probe, recording the pointer**

```bash
tasks note prism-dac509 "host pointer: ~/.local/share/noctalia/plugins/prism repointed from <main>/integrations/noctalia-plugin to the scratchpad probe copy; restore with ln -sfn <main>/integrations/noctalia-plugin ~/.local/share/noctalia/plugins/prism then noctalia msg plugins disable/enable khughitt/prism"
readlink ~/.local/share/noctalia/plugins/prism   # confirm the current target before changing it
LOG=~/.cache/noctalia/noctalia.log
START=$(wc -l < "$LOG")   # this run reads only the lines after this offset
ln -sfn "$SCRATCH" ~/.local/share/noctalia/plugins/prism
noctalia msg plugins disable khughitt/prism && noctalia msg plugins enable khughitt/prism
```

- [ ] **Step 3: Have the user exercise the panel**

Ask the user to do the following, in order:
1. Open the Prism panel and expand every rack card.
2. Press `x` five times, about a second apart. Each press is a cold full rebuild with
   every card expanded.
3. Drag five sliders inside expanded cards for a couple of seconds each, releasing
   each one. Each release writes, and once the write lands the panel re-reads describe,
   which is the changed-describe case.
4. Revert those edits with the edits row's revert button, so the profile switch below
   has no scratch to carry.
5. If at least two profiles exist, switch to another profile in the selector and back
   again, three times. Each switch is a describe in which most values change, with
   fresh entries. The figures for this go under `switch` below. If fewer than two
   profiles exist, say so in the record: the cold `x` rebuild then stands as the
   full-rebuild figure.

Then collect:

```bash
RUN=$(tail -n +"$((START + 1))" "$LOG" | grep -o "prism-probe-run [0-9]*" | tail -1 | cut -d' ' -f2)
test -n "$RUN" || echo "no probe run marker after the offset: the probe copy did not load"
PROBE=<session scratchpad>/probe-$RUN.log
tail -n +"$((START + 1))" "$LOG" | grep "prism-probe $RUN " > "$PROBE"
wc -l "$PROBE"
tail -n +"$((START + 1))" "$LOG" | grep -c "exceeded its CPU budget"   # must be 0
```

The file holds every probe line of this run, and only those: a drag ticks about 60
times a second, so a fixed-length `tail` would drop the cold rebuilds that came first.
If the log rotated during the run (`wc -l < "$LOG"` now smaller than `START`), the
offset is void. Repeat Step 3 with a fresh `START`.

Read `$PROBE` and sort its lines into these classes:
- `coldRender`: the `x` presses;
- `dragTick`;
- `dragEnd`;
- `describe` and `describeRender` (over 0.5 ms) from the releases' re-reads;
- the same two from the profile switches, as `switch`.

The order of the log lines follows the user's steps.

- [ ] **Step 4: Restore the pointer**

```bash
MAIN=$(git rev-parse --path-format=absolute --git-common-dir | sed 's#/\.git$##')
ln -sfn "$MAIN/integrations/noctalia-plugin" ~/.local/share/noctalia/plugins/prism
noctalia msg plugins disable khughitt/prism && noctalia msg plugins enable khughitt/prism
readlink ~/.local/share/noctalia/plugins/prism
tasks note prism-dac509 "host pointer restored: ~/.local/share/noctalia/plugins/prism -> main checkout, plugin reloaded"
```

- [ ] **Step 5: Record and gate**

Record one note with the median, the maximum and the sample count per class:
`tasks note prism-dac509 "in-host (os.clock elapsed, an upper bound on thread CPU; every card expanded): coldRender med/max/n …; switch describe …, render …; dragTick …; dragEnd …; describe …; describeRender …; new budget errors: <n>"`.

Then apply the gate:
- **Fewer than five usable samples in any required class.** Acceptance is refused, not
  passed. The classes are `coldRender`, `dragTick`, `dragEnd`, `describe`,
  `describeRender`, and `switch` when at least two profiles exist. Repeat the missing
  steps of Step 3, collecting with a fresh `START`, or park with
  `--reason quiet --waiting-on user` naming the missing classes.
- **New budget errors in the log.** Stop: the host's own meter has refused a callback.
  Note which one and park as below.
- **Median `coldRender` or `switch` render over 15 ms.** Stop. Park with
  `tasks park prism-dac509 "Full rebuild measured <median> ms (median, elapsed) in-host, over the spec's 15 ms gate: revise the spec's part 5 with this figure before more code lands" --waiting-on user --reason decision`.
- **Median of any other class over 12 ms.** Treat it the same way, naming the class.
- **Every median within target and no new budget errors.** Continue to Task 7.
  A sample over target with its class's median within target passes the gate, but its
  cause is recorded as **unknown**: a 20 ms sample can be real CPU work that the median
  hides. Call it scheduling noise only on separate evidence, such as `host-load` output
  taken during the run showing contention. Name each such sample in the note, so a
  later regression has a baseline to compare with.

---

### Task 7: Cost ceilings on real describe output

**Files:**
- Modify: `integrations/noctalia-plugin/contract.test.mjs` (new harness and test at the end)

**Interfaces:**
- Consumes: `retainedMemo()` (Task 5), deferred describe (Task 4), `describeStore`,
  `luaLiteral` (existing in this file).
- Produces: `renderCostCeilings`, with ceilings for `fullRender`, `dragTick`, `dragEnd`,
  `describeChanged`, `describeRender` and `switchRender`.

- [ ] **Step 1: Write the test with a provisional ceiling of 0**

Append to `contract.test.mjs`:

```js
// Render cost in Lua calls, on real describe output with every card expanded.
// In the shell each call also pays the budget interrupt's clock read, so calls
// are the unit the 25 ms budget is spent in
// (docs/specs/2026-10-10-panel-render-budget-design.md). The host's decode and
// encode are single C calls, so their stand-ins run unhooked.
const costHarness = String.raw`
local pluginDir, model = arg[1], MODEL

local function canonical(value)
  if type(value) == "number" then return string.format("%.17g", value) end
  if type(value) ~= "table" then return type(value) == "string" and string.format("%q", value) or tostring(value) end
  local keys = {}
  for key in pairs(value) do keys[#keys + 1] = key end
  table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
  local parts = {}
  for _, key in ipairs(keys) do parts[#parts + 1] = tostring(key) .. "=" .. canonical(value[key]) end
  return "{" .. table.concat(parts, ",") .. "}"
end
local function copyOf(value)
  if type(value) ~= "table" then return value end
  local copied = {}
  for key, held in pairs(value) do copied[key] = copyOf(held) end
  return copied
end
local function unhooked(fn, value)
  local hook, mask, count = debug.gethook()
  debug.sethook()
  local result = fn(value)
  if hook then debug.sethook(hook, mask, count) end
  return result
end

local calls = 0
local function measure(action)
  calls = 0
  debug.sethook(function() calls = calls + 1 end, "c")
  action()
  debug.sethook()
  return calls
end

local function collect(tree, found)
  found = found or {}
  if type(tree) ~= "table" then return found end
  if tree.kind ~= nil then found[#found + 1] = tree end
  for _, child in ipairs(tree.children or {}) do collect(child, found) end
  return found
end

local rendered, described
local ui = setmetatable({}, {__index = function(_, kind)
  return function(props, children) return {kind = kind, props = props or {}, children = children or {}} end
end})
local panel = {render = function(tree) rendered = tree end, setNeedsFrameTick = function() end, setWantsSecondTicks = function() end}
local noctalia = {
  json = {
    decode = function() return unhooked(copyOf, model) end,
    encode = function(value) return unhooked(canonical, value) end,
  },
  runAsync = function(command, callback)
    if command:find("describe", 1, true) then described = callback end
    return true
  end,
}
local env = {noctalia = noctalia, panel = panel, ui = ui}
setmetatable(env, {__index = _G})
env.require = function(name)
  return assert(loadfile(pluginDir .. name:gsub("^%./", ""), "t", env))()
end
assert(loadfile(pluginDir .. "panel.luau", "t", env))()
local Retain = env.require("./retain.luau")

local serial = 0
local function answer()
  serial = serial + 1
  return {timedOut = false, exitCode = 0, stdout = tostring(serial), stderr = "",
    stdoutTruncated = false, stderrTruncated = false}
end

env.onOpen({})
described(answer())
env.onFrameTick(16)
for _, node in ipairs(collect(rendered)) do
  if node.kind == "button" and node.props.tooltip == "Show details" then node.props.onClick() end
end

local counts = {}
Retain.clear(env.retainedMemo())
env.onKey("F1", true)
counts.fullRender = measure(function() env.onKey("F1", true) end)

local sliders = {}
for _, node in ipairs(collect(rendered)) do
  if node.kind == "slider" then sliders[#sliders + 1] = node end
end
local dragged = sliders[#sliders]
dragged.props.onChange(dragged.props.min + (dragged.props.max - dragged.props.min) * 0.37)
counts.dragTick = measure(function() env.onFrameTick(16) end)
counts.dragEnd = measure(function() dragged.props.onDragEnd() end)

local function sliderParams()
  local list = {}
  for _, param in ipairs(model.params) do
    if param.ui.control == "slider" then list[#list + 1] = param end
  end
  return list
end
local one = sliderParams()[1]
one.value = one.value == one.range[2] and one.range[1] or one.range[2]
counts.describeChanged = measure(function() described(answer()) end)
counts.describeRender = measure(function() env.onFrameTick(16) end)

for _, param in ipairs(sliderParams()) do
  param.value = param.value == param.range[1] and param.range[2] or param.range[1]
end
described(answer())
counts.switchRender = measure(function() env.onFrameTick(16) end)

local parts = {}
for name, count in pairs(counts) do parts[#parts + 1] = string.format('"%s":%d', name, count) end
io.write("{" .. table.concat(parts, ",") .. "}")
`;

// Measured on 2026-10-10 at <commit>; each ceiling is about 1.25x the
// measurement. Raise one only with the in-host figure for it beside the new
// number.
const renderCostCeilings = {
  fullRender: 0,
  dragTick: 0,
  dragEnd: 0,
  describeChanged: 0,
  describeRender: 0,
  switchRender: 0,
};

test('panel render cost on real describe output stays under its recorded ceilings', () => {
  const model = describeStore({});
  const script = costHarness.replace('MODEL', () => luaLiteral(model));
  const result = spawnSync('lua', ['-', fileURLToPath(pluginDir)], { input: script, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const counts = JSON.parse(result.stdout);
  console.log('panel render cost (Lua calls):', counts);
  for (const [name, ceiling] of Object.entries(renderCostCeilings)) {
    assert.ok(counts[name] <= ceiling, `${name}: ${counts[name]} calls is over its ceiling of ${ceiling}`);
  }
  // The design's claim: a drag's render costs a small part of a full rebuild.
  assert.ok(counts.dragTick * 3 < counts.fullRender,
    `a drag tick (${counts.dragTick}) should cost under a third of a full render (${counts.fullRender})`);
});
```

- [ ] **Step 2: Run to see it fail and read the measurements**

Run: `just test-fast`
Expected: FAIL with `fullRender: <n> calls is over its ceiling of 0`. The
`panel render cost` line in the output prints all six counts. If the
`dragTick * 3 < fullRender` assertion fails instead, stop. Retention is not working on
real describe output, so debug Task 5 before going on.

- [ ] **Step 3: Record the ceilings**

Set each ceiling to `Math.ceil(measured * 1.25)`, rounded up to the next 100. Replace
`<commit>` in the comment with `git rev-parse --short HEAD`. For a sanity check,
`fullRender` should be well under the 8.5k calls measured before this work.

- [ ] **Step 4: Run tests to verify they pass**

Run: `just test-fast`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add integrations/noctalia-plugin/contract.test.mjs
git commit -m "test(noctalia): pin panel render cost on real describe output"
```

---

### Task 8: Documentation, follow-ups, and closing

**Files:**
- Modify: `docs/notes/noctalia-plugin-contract.md:72-79` (budget paragraph)
- Modify: `docs/specs/2026-10-10-panel-render-budget-design.md:4` (status)

- [ ] **Step 1: Update the contract note**

In `docs/notes/noctalia-plugin-contract.md`, replace the sentences from
`A full render costs 10-14 ms` through `which keeps the idle re-read free.` with:

```markdown
The host meters 25 ms of thread CPU per callback, reading the thread clock on
every Luau call and loop back-edge, and three overruns in a row (or five in a
minute) disable the panel until reload. So the panel never rebuilds what has
not changed: each control cell, row, card, and section header is retained
under a signature made of describe's digest of its entries (the entry as
decoded, re-encoded) and the few fields the panel changes between describes
(value, edited, gate, keyboard focus, expansion, bypass state, counts). A
builder reads nothing outside its signature. Handlers capture keys and device
ids, never model tables, and look up the current object when they run.
Retained entries are dropped only when a describe drops their ids. An accepted
describe is decoded and validated in its own callback and rendered in the next
frame tick; `refresh` never renders. A describe whose output is byte-identical
to the one on screen, with no write enqueued since and no error showing, is not
decoded or rendered, which keeps the idle re-read free. `contract.test.mjs`
pins the render cost in Lua calls on real describe output, with every card
expanded.
```

- [ ] **Step 2: Mark the spec implemented**

Change the spec's status line to
`**Status:** implemented 2026-10-10; in-host figures recorded on prism-dac509`.

- [ ] **Step 3: File the follow-ups the spec names**

First, search the upstream Noctalia issues and PRs for interrupt-metering cost and for
a plugin-disabled signal. Use `gh search issues --repo <upstream noctalia repo> "CPU budget"`
and similar queries; `git -C ~/software/noctalia remote -v` names the upstream repo.
Note what turns up. Then file:

```bash
tasks add "Prepare an upstream Noctalia issue: per-safepoint clock_gettime metering, and no plugin-visible disabled state" -p 3 --size s --complexity mid --process direct --tag noctalia --tag performance -b "From prism-dac509's spec, Follow-ups. Search upstream first; prepare the issue to the project's templates; the owner approves posting."
tasks add "Panel notice when the host has disabled it" --status idea -b "From prism-dac509's spec, Follow-ups: the host's one-time notification is easy to miss; a panel-side heartbeat cannot run while the runtime is disabled."
```

Record what the upstream search found in a note on the first task.

- [ ] **Step 4: Gate and close**

```bash
just check
just test-fast
tasks done prism-dac509 "Retained subtrees and a deferred describe render: in-host <figures from Task 6>; cost ceilings pinned in contract.test.mjs"
tasks check
git add docs/notes/noctalia-plugin-contract.md docs/specs/2026-10-10-panel-render-budget-design.md tasks/
git commit -m "docs(noctalia): record the retained render and close prism-dac509"
```
