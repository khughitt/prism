local here = (arg[0]:match("(.*/)") or "")
local Presentation = dofile(here .. "presentation.luau")
local Queue = dofile(here .. "queue.luau")
local Shell = dofile(here .. "shell.luau")

local function equal(actual, expected, message)
  if type(actual) ~= type(expected) then
    error(message or ("expected " .. type(expected) .. ", got " .. type(actual)))
  end
  if type(actual) ~= "table" then
    assert(actual == expected, message or ("expected " .. tostring(expected) .. ", got " .. tostring(actual)))
    return
  end
  for key, value in pairs(expected) do equal(actual[key], value, message) end
  for key in pairs(actual) do assert(expected[key] ~= nil, message or "unexpected key") end
end

local function slider(range, step, ui)
  ui = ui or {}
  ui.control = "slider"
  ui.step = step
  return { range = range, ui = ui }
end

local function sample(key, value) return { verb = "set", key = key, value = value, sample = true } end
local function release(key, value) return { verb = "set", key = key, value = value, sample = false } end
local function unset(key) return { verb = "unset", key = key } end

local function drain(state)
  local ran = {}
  while true do
    local result = Queue.finish(state)
    state = result.state
    if result.drained then return ran end
    ran[#ran + 1] = result.launch
  end
end

-- Presentation golden vectors: sections in order of first appearance, one
-- optional header toggle per section, and paired matrix rows.
local params = {
  { key = "title.enabled", ui = { control = "toggle", group = "Title", order = 0 } },
  { key = "f.split", ui = { control = "toggle", group = "Focus", order = 200, header = true } },
  { key = "g.one", ui = { control = "slider", group = "Glass", order = 10 } },
  { key = "f.blur.unfocused", ui = { control = "slider", group = "Focus", order = 221, state = "unfocused", row = "Blur" } },
  { key = "hidden.one", ui = { control = "none", group = "CLI" } },
  { key = "f.blur.focused", ui = { control = "slider", group = "Focus", order = 220, state = "focused", row = "Blur" } },
  { key = "g.two", ui = { control = "toggle", group = "Glass", order = 5 } },
  { key = "f.tint.focused", ui = { control = "slider", group = "Focus", order = 230, state = "focused", row = "Tint" } },
  { key = "f.tint.unfocused", ui = { control = "slider", group = "Focus", order = 231, state = "unfocused", row = "Tint" } },
}
equal(Presentation.titleParam(params).key, "title.enabled")
local sections = Presentation.sections(params)
equal(#sections, 2)
equal(sections[1].name, "Glass")
equal(sections[1].toggle, nil)
equal(sections[1].rows, { { param = params[7] }, { param = params[3] } })
equal(sections[2].name, "Focus")
equal(sections[2].toggle, params[2])
equal(sections[2].rows, {
  { row = "Blur", focused = params[6], unfocused = params[4] },
  { row = "Tint", focused = params[8], unfocused = params[9] },
})
equal(Presentation.sectionParams(sections[2]), { params[2], params[6], params[4], params[8], params[9] })

-- A focus row pairs on ui.state alone, so the frosted-backdrop toggles and the
-- tint colors pair exactly like the slider rows do.
local mixed = {
  { key = "f.frost.focused", ui = { control = "toggle", group = "Focus", order = 220, state = "focused", row = "Frosted backdrop" } },
  { key = "f.frost.unfocused", ui = { control = "toggle", group = "Focus", order = 221, state = "unfocused", row = "Frosted backdrop" } },
  { key = "f.tint.focused", ui = { control = "color", group = "Focus", order = 240, state = "focused", row = "Tint" } },
  { key = "f.tint.unfocused", ui = { control = "color", group = "Focus", order = 241, state = "unfocused", row = "Tint" } },
}
equal(Presentation.sections(mixed)[1].rows, {
  { row = "Frosted backdrop", focused = mixed[1], unfocused = mixed[2] },
  { row = "Tint", focused = mixed[3], unfocused = mixed[4] },
})
equal(Presentation.overriddenCount({ { overridden = true }, { overridden = false }, { overridden = true } }), 2)

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

local function fails(candidate, pattern)
  local ok, err = pcall(Presentation.sections, candidate)
  assert(not ok and tostring(err):find(pattern, 1, true), "expected failure containing " .. pattern .. ", got " .. tostring(err))
end
fails({
  { key = "t", ui = { control = "toggle", group = "Title", order = 0 } },
  { key = "a", ui = { control = "slider", group = "Focus", order = 1, state = "focused", row = "Blur" } },
}, "Blur has no unfocused")
fails({
  { key = "a", ui = { control = "slider", group = "Focus", order = 1, state = "focused", row = "Blur" } },
  { key = "b", ui = { control = "slider", group = "Focus", order = 2, state = "focused", row = "Blur" } },
}, "Blur has two focused")
fails({
  { key = "a", ui = { control = "slider", group = "Focus", order = 1, state = "focused", row = "Blur" } },
  { key = "b", ui = { control = "slider", group = "Glass", order = 2, state = "unfocused", row = "Blur" } },
}, "Blur spans sections")
fails({
  { key = "a", ui = { control = "toggle", group = "Focus", order = 1, header = true } },
  { key = "b", ui = { control = "toggle", group = "Focus", order = 2, header = true } },
}, "Focus has two header toggles")

-- The panel must give its scroll root the host-owned viewport height both
-- before and after the asynchronous model arrives.
local rendered
local described
-- The store's resolution order, low to high, as describe states it.
local resolutionOrder = { "default", "base", "wallpaper", "state", "profile" }
local model = { active = {}, profiles = {}, layers = resolutionOrder, target = "base", params = {
  {
    key = "glass.enabled", value = true, default = true, layer = "default", fallback = true,
    effectiveDrag = "release",
    ui = { control = "toggle", group = "Title", order = 0, label = "Glass" },
  },
  {
    key = "compositor.gaps", value = 24, default = 24, layer = "default", fallback = 24,
    effectiveDrag = "release", range = { 0, 128 },
    ui = { control = "slider", group = "Glass", order = 10, step = 1, label = "Gaps" },
  },
  {
    key = "glass.focusSplit", value = true, default = true, layer = "default", fallback = true,
    effectiveDrag = "release",
    ui = { control = "toggle", group = "Focus", order = 200, label = "Focus-state glass", header = true },
  },
  {
    key = "glass.roughness", value = 0.2, default = 0.08, layer = "base", fallback = 0.1,
    description = "Backdrop test description",
    effectiveDrag = "release", range = { 0, 1 },
    ui = { control = "slider", group = "Focus", order = 220, step = 0.01, label = "Blur", display = "percent", state = "focused", row = "Blur" },
  },
  {
    key = "glass.inactive.roughness", value = 0.5, default = 0.5, layer = "default", fallback = 0.5,
    effectiveDrag = "release", range = { 0, 1 },
    ui = { control = "slider", group = "Focus", order = 221, step = 0.01, label = "Unfocused blur", display = "percent", state = "unfocused", row = "Blur" },
  },
  {
    key = "glass.saturation", value = 1, default = 1, layer = "default", fallback = 1,
    effectiveDrag = "release", range = { 0, 3 },
    ui = { control = "slider", group = "Focus", order = 280, step = 0.05, label = "Saturation", state = "focused", row = "Saturation" },
  },
  {
    key = "glass.inactive.saturation", value = 0.85, default = 0.85, layer = "default", fallback = 0.85,
    effectiveDrag = "release", range = { 0, 3 },
    ui = { control = "slider", group = "Focus", order = 281, step = 0.05, label = "Unfocused saturation", state = "unfocused", row = "Saturation" },
  },
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

ui = setmetatable({}, { __index = function(_, kind)
  return function(props, children) return { kind = kind, props = props or {}, children = children or {} } end
end })
panel = {
  render = function(tree) rendered = tree end,
  setNeedsFrameTick = function() end,
}
local commands = {}
noctalia = {
  runAsync = function(cmd, callback)
    commands[#commands + 1] = cmd
    if cmd:find("describe", 1, true) then described = callback end
    return true
  end,
  json = { decode = function() return model end },
}
package.loaded["./presentation.luau"] = Presentation
package.loaded["./queue.luau"] = Queue
package.loaded["./shell.luau"] = Shell
dofile(here .. "panel.luau")

onOpen({})
equal(rendered.kind, "scroll")
equal(rendered.props.flexGrow, 1, "loading scroll must fill the panel viewport")
described({ exitCode = 0, stdout = "{}" })
equal(rendered.props.flexGrow, 1, "populated scroll must fill the panel viewport")

-- The populated tree carries both sections, the Focus header toggle, the
-- matrix column labels, and one slider per matrix cell.
local function collect(tree, kind, found)
  found = found or {}
  if type(tree) ~= "table" then return found end
  if tree.kind == kind then found[#found + 1] = tree end
  for _, child in ipairs(tree.children or {}) do collect(child, kind, found) end
  return found
end
local labels = {}
for _, kind in ipairs({"label", "button"}) do
  for _, label in ipairs(collect(rendered, kind)) do labels[label.props.text or ""] = true end
end
assert(labels["Glass"] and labels["Focus"], "section headers missing")
assert(labels["Focused"] and labels["Unfocused"], "matrix column labels missing")
assert(labels["Backdrop"] and labels["Gaps"], "row labels missing")
assert(labels["Saturation"], "second matrix row label missing")
assert(labels["Noise type"] == nil, "details stay hidden until a card is expanded")
-- Once the Noise card expands there are two selects. Find its parameter select
-- by options rather than by position.
local function paramSelect(tree)
  for _, node in ipairs(collect(tree, "select")) do
    if (node.props.options or {})[1] ~= "No profile" then return node end
  end
  return nil
end
equal(#collect(rendered, "select"), 1, "only the profile selector while every card is collapsed")
local sliderKeys = {}
for _, slider in ipairs(collect(rendered, "slider")) do sliderKeys[slider.props.key] = true end
assert(sliderKeys["glass.roughness:slider"] and sliderKeys["glass.inactive.roughness:slider"], "matrix sliders missing")
assert(sliderKeys["glass.saturation:slider"] and sliderKeys["glass.inactive.saturation:slider"], "saturation matrix sliders missing")
equal(#collect(rendered, "toggle"), 2, "title and Focus header toggles")

-- Reset means "remove the override in the write target": present on every
-- row, opacity and tooltip carry the state, and it optimistically shows the
-- fallback value.
local resetCandidates = {}
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Remove override" or button.props.tooltip == "No override to remove" then
    resetCandidates[#resetCandidates + 1] = button
  end
end
equal(#resetCandidates, 9, "a reset renders for every visible cell: gaps, three mix pairs, and the terminal pair")
local overriddenResets = {}
for _, button in ipairs(resetCandidates) do
  if button.props.tooltip == "Remove override" and button.props.opacity == 1.0 then
    overriddenResets[#overriddenResets + 1] = button
  end
end
equal(#overriddenResets, 1, "exactly the base-overridden roughness row offers a full-strength reset")
for _, button in ipairs(resetCandidates) do
  if button ~= overriddenResets[1] then
    assert(button.props.opacity < 1.0, "resets without an override to remove stay dim")
  end
end
local sectionResets = 0
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Reset section (2)" and button.props.opacity == 1.0 then sectionResets = sectionResets + 1 end
end
equal(sectionResets, 1, "the Focus rack counts its two overrides")
assert(labels["Terminal"], "terminal section header missing")

-- Cards: one per device in rack order, each with a light whose glyph and color
-- say active, bypassed, or silenced by an upstream bypass.
local function byKey(tree, key, found)
  found = found or {}
  if type(tree) ~= "table" then return found end
  if tree.props and tree.props.key == key then found[#found + 1] = tree end
  for _, child in ipairs(tree.children or {}) do byKey(child, key, found) end
  return found
end
-- Labels do not honour width in the native host. Value columns must reserve
-- their space with a layout container, including non-slider and empty values.
local valueWidth
for _, key in ipairs({"compositor.gaps", "glass.roughness", "glass.saturation", "terminal.background.opacity.active"}) do
  local cell = byKey(rendered, key)[1]
  assert(cell, "missing control cell " .. key)
  local column = cell.children[1]
  assert(column.kind == "row" or column.kind == "column", "value width must be enforced by a layout container")
  assert(column.props.width and column.props.width > 0, "value column needs a reserved width")
  valueWidth = valueWidth or column.props.width
  equal(column.props.width, valueWidth, "formatted values must reserve the same width")
end

-- The rack header includes the same horizontal inset as its cards.
local rackHeader
for _, row in ipairs(collect(rendered, "row")) do
  if row.props.key == "Focus:columns" then rackHeader = row end
end
assert(rackHeader, "rack column header missing")
equal(rackHeader.props.paddingH, byKey(rendered, "backdrop:card")[1].props.paddingH,
  "rack header and card control columns must share their inset")

-- Names expose hover help without adding a second, expandable help surface.
local nameButton = byKey(rendered, "glass.roughness:name")[1]
assert(nameButton and nameButton.kind == "button", "effect name must be an interactive tooltip target")
equal(nameButton.props.text, "Backdrop")
equal(nameButton.props.tooltip, "Backdrop test description")
equal(nameButton.props.glyph, nil, "effect help needs no separate info glyph")
for _, button in ipairs(collect(rendered, "button")) do
  assert(button.props.glyph ~= "info-circle", "row help lives on names rather than info icons")
end
local commandsBeforeHelp, treeBeforeHelp = #commands, rendered
nameButton.props.onClick()
assert(rendered == treeBeforeHelp, "name clicks must not expand help")
equal(#commands, commandsBeforeHelp, "reading help must not write parameters")

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

-- The collapsed light is the bypass control: it must stay inert when the
-- bypass has no consumer, even while both mix cells remain available.
local noiseBypass = model.params[13]
noiseBypass.effectiveDrag = nil
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })
local unavailableLight = light("noise")
equal(unavailableLight.props.onClick, nil, "an unavailable bypass light has no write handler")
assert(unavailableLight.props.opacity < 1.0, "an unavailable bypass light dims")
local unavailableLabels = {}
for _, label in ipairs(collect(rendered, "label")) do unavailableLabels[label.props.text or ""] = true end
assert(unavailableLabels["Unavailable"], "a collapsed card reports its unavailable bypass")

-- A wallpaper can shadow only the bypass. The light and hint say so, while
-- the unshadowed mix cells stay full-strength and the ordinary write remains.
noiseBypass.effectiveDrag, noiseBypass.layer = "release", "wallpaper"
model.active = { wallpaper = { id = "f8eb0556", path = "/pics/Deep Field.jpg", pinned = false } }
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })
local shadowedLight = light("noise")
assert(shadowedLight.props.opacity < 1.0, "a shadowed bypass light dims")
equal(byKey(rendered, "glass.noise")[1].props.opacity, 1.0, "the focused mix cell stays unshadowed")
equal(byKey(rendered, "glass.inactive.noise")[1].props.opacity, 1.0, "the unfocused mix cell stays unshadowed")
local shadowedLabels = {}
for _, label in ipairs(collect(rendered, "label")) do shadowedLabels[label.props.text or ""] = true end
assert(shadowedLabels["Overridden by wallpaper; pin to edit"], "a collapsed card reports its shadowed bypass")
local commandsBeforeShadowedLight = #commands
shadowedLight.props.onClick()
equal(#commands, commandsBeforeShadowedLight + 1, "a shadowed bypass light still writes")
noiseBypass.layer = "default"
model.active = {}

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
local selectValueColumn = byKey(noiseCard, "glass.noiseType")[1].children[1]
equal(selectValueColumn.props.width, valueWidth, "non-slider controls reserve the value column too")
equal(collect(selectValueColumn, "label")[1].props.text, "")
local selectName = byKey(noiseCard, "glass.noiseType:name")[1]
equal(selectName.props.tooltip, "glass.noiseType", "missing descriptions fall back to the parameter key")
-- A width alone does not make a native spacer fixed: Spacer defaults to grow=1.
-- Fixed indentation must leave the rest of the head available for long names.
for _, spacer in ipairs(collect(rendered, "spacer")) do
  if spacer.props.width ~= nil then
    equal(spacer.props.flexGrow, 0, "sized spacers must not compete with names or column titles")
  end
end

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

-- Clicking a reset with nothing to remove must do nothing: the onClick guard
-- checks the live param, not just whether the button is drawn dim.
local nonOverriddenReset
for _, button in ipairs(resetCandidates) do
  if button ~= overriddenResets[1] then nonOverriddenReset = button break end
end
local commandCountBeforeGuard = #commands
nonOverriddenReset.props.onClick()
equal(#commands, commandCountBeforeGuard, "clicking a non-overridden reset enqueues nothing")

overriddenResets[1].props.onClick()
equal(model.params[4].value, 0.1, "reset shows the fallback, not the default, before describe reconciles")
equal(model.params[4].overridden, false)
assert(commands[#commands]:find("unset", 1, true) and commands[#commands]:find("glass.roughness", 1, true),
  "reset enqueues prism unset for the row")

local noise
for _, param in ipairs(model.params) do
  if param.key == "glass.noiseType" then noise = param end
end
for index, value in ipairs(noise.values) do
  noise.value, noise.layer = "fine", "default"
  dofile(here .. "panel.luau")
  onOpen({})
  described({ exitCode = 0, stdout = "{}" })
  chevron("noise").props.onClick()
  paramSelect(rendered).props.onChange(index - 1)
  equal(noise.value, value)
  equal(paramSelect(rendered).props.selectedIndex, index - 1)
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
noise.values = { "white", "fine" }

equal(Presentation.stepPrecision(0.000001), 6)
equal(Presentation.snapValue(100.04, { 0.1, 200 }, 0.1), 100)
equal(Presentation.snapValue(100.06, { 0.1, 200 }, 0.1), 100.1)
equal(Presentation.snapValue(-1, { 0.1, 200 }, 0.1), 0.1)
equal(Presentation.snapValue(201, { 0.1, 200 }, 0.1), 200)
equal(Presentation.snapValue(0.05, { 0.05, 1.05 }, 0.1), 0.05)
equal(Presentation.snapValue(0.15, { 0.05, 1.05 }, 0.1), 0.15)
equal(Presentation.snapValue(1.05, { 0.05, 1.05 }, 0.1), 1.05)
local halfwayPercent = slider({ 0, 1 }, 0.01, { display = "percent" })
equal(Presentation.toSliderValue(0.005, halfwayPercent), 1)
equal(Presentation.formatValue(0.5, slider({ 0, 1 }, 1)), "1")
equal(Presentation.formatValue(2.5, slider({ 0, 3 }, 1)), "3")
equal(Presentation.formatValue(-0.5, slider({ -1, 1 }, 1)), "-1")
equal(Presentation.formatValue(0.125, slider({ 0, 1 }, 0.01)), "0.13")
equal(Presentation.formatValue(2.675, slider({ 0, 3 }, 0.01)), "2.67")
equal(Presentation.formatValue(0.015, slider({ 0, 1 }, 0.01)), "0.01")
equal(Presentation.formatValue(0.105, slider({ 0, 2 }, 0.02, { unit = "×" })), "0.1×")

local raw = slider({ 0, 2 }, 0.05, { unit = "×" })
local percent = slider({ 0, 1 }, 0.01, { display = "percent" })
local coarsePercent = slider({ 0, 0.98 }, 0.07, { display = "percent" })
local offsetPercent = slider({ 0.005, 1.005 }, 0.01, { display = "percent" })
local depth = slider({ 0.1, 200 }, 0.1, { display = "normalized" })
local tint = slider({ 1, 10000 }, 1, { display = "normalized", scale = "logarithmic" })
equal({ Presentation.sliderFrom(raw), Presentation.sliderTo(raw), Presentation.sliderStep(raw) }, { 0, 2, 0.05 })
equal({ Presentation.sliderFrom(percent), Presentation.sliderTo(percent), Presentation.sliderStep(percent) }, { 0, 100, 1 })
equal(Presentation.sliderStep(coarsePercent), 7)
equal({ Presentation.sliderFrom(offsetPercent), Presentation.sliderTo(offsetPercent), Presentation.sliderStep(offsetPercent) }, { 0.5, 100.5, 1 })
equal({ Presentation.sliderFrom(depth), Presentation.sliderTo(depth), Presentation.sliderStep(depth) }, { 0, 1, 0 })
equal({ Presentation.sliderFrom(tint), Presentation.sliderTo(tint), Presentation.sliderStep(tint) }, { 0, 1, 0 })
equal(Presentation.toSliderValue(1, tint), 0)
equal(Presentation.toSliderValue(10000, tint), 1)
equal(Presentation.canonicalFromSlider(0.5, tint), 100)
local midpoint = Presentation.canonicalFromSlider(0.5, depth)
assert(math.abs(midpoint - 100.05) <= depth.ui.step / 2 + 1e-9)
assert(math.abs(Presentation.toSliderValue(midpoint, depth) - 0.5) <= depth.ui.step / (depth.range[2] - depth.range[1]))

equal(Presentation.stepCanonicalValue(1, 1, tint), 2)
equal(Presentation.stepCanonicalValue(2, -1, tint), 1)

-- A power scale runs the track in normalized space like logarithmic does, but it
-- may start at zero: position p is low + (high - low) * p^exponent.
local rough = slider({ 0, 1 }, 0.01, { display = "percent", scale = "power", exponent = 2 })
equal({ Presentation.sliderFrom(rough), Presentation.sliderTo(rough), Presentation.sliderStep(rough) }, { 0, 1, 0 })
equal(Presentation.toSliderValue(0, rough), 0)
equal(Presentation.toSliderValue(1, rough), 1)
equal(Presentation.toSliderValue(0.25, rough), 0.5)
equal(Presentation.canonicalFromSlider(0.5, rough), 0.25)
equal(Presentation.canonicalFromSlider(0, rough), 0)
equal(Presentation.formatValue(0.25, rough), "25%")
local depthPower = slider({ 0, 100 }, 0.1, { scale = "power", exponent = 2, unit = "px" })
equal(Presentation.canonicalFromSlider(0.5, depthPower), 25)
equal(Presentation.toSliderValue(25, depthPower), 0.5)
equal(Presentation.formatValue(25, depthPower), "25px")
equal(Presentation.stepCanonicalValue(25, 1, depthPower), 25.1)
-- The percent label on a curved track is a label, not a track: the logarithmic
-- slider keeps its normalized endpoints when its display is percent.
local percentLog = slider({ 0.01, 1 }, 0.01, { display = "percent", scale = "logarithmic" })
equal({ Presentation.sliderFrom(percentLog), Presentation.sliderTo(percentLog), Presentation.sliderStep(percentLog) }, { 0, 1, 0 })
equal(Presentation.toSliderValue(0.1, percentLog), 0.5)
equal(Presentation.formatValue(0.1, percentLog), "10%")
equal(Presentation.stepCanonicalValue(1, -1, tint), 1)
equal(Presentation.stepCanonicalValue(10000, 1, tint), 10000)
equal(Presentation.formatValue(0.08, slider({ 0, 1 }, 0.01, { display = "percent" })), "8%")
equal(Presentation.formatValue(0.14, slider({ 0, 0.98 }, 0.07, { display = "percent" })), "14%")
equal(Presentation.formatValue(0.015, slider({ 0.005, 1.005 }, 0.01, { display = "percent" })), "1.5%")
equal(Presentation.formatValue(6, slider({ -128, 128 }, 1, { unit = "px" })), "6px")
equal(Presentation.formatValue(0.5, slider({ 0, 2 }, 0.02, { unit = "×" })), "0.5×")
equal(Presentation.formatValue(20, slider({ 0.1, 200 }, 0.1, { display = "normalized" })), "0.1")
equal(Presentation.formatValue(20.2, slider({ 0.1, 200 }, 0.1, { display = "normalized" })), "0.101")
equal(Presentation.formatValue(0.0001, slider({ 0.000001, 1 }, 0.000001)), "0.0001")
equal(Presentation.formatValue(0.000001, slider({ 0.000001, 1 }, 0.000001)), "0.000001")
equal(Presentation.formatValue(0.00001, slider({ 0.000001, 1 }, 0.000001, { unit = "s" })), "0.00001s")
equal(Presentation.formatValue(-0.0, slider({ -1, 1 }, 0.000001, { unit = "px" })), "0px")

equal(Presentation.canonicalFromSliderStep(0.5497498749374688, 100, depth), 100.1)
equal(Presentation.canonicalFromSliderStep(0.4497498749374687, 100, depth), 99.9)
equal(Presentation.canonicalFromSliderStep(0.55, 100, tint), 101)
equal(Presentation.canonicalFromSliderStep(0.45, 100, tint), 99)
equal(Presentation.canonicalFromSliderStep(0.6, 100, tint), nil)

-- Queue golden vectors.
local result = Queue.enqueue(Queue.new(), sample("a.x", 1))
equal(result.launch, sample("a.x", 1))
equal(result.state.pending, {})

local state = Queue.enqueue(Queue.new(), sample("a.x", 1)).state
state = Queue.enqueue(state, sample("a.x", 2)).state
state = Queue.enqueue(state, sample("a.x", 3)).state
equal(drain(state), { sample("a.x", 3) })

state = Queue.enqueue(Queue.new(), unset("a.x")).state
state = Queue.enqueue(state, unset("b.y")).state
state = Queue.enqueue(state, unset("c.z")).state
equal(drain(state), { unset("b.y"), unset("c.z") })

state = Queue.enqueue(Queue.new(), sample("a.x", 1)).state
state = Queue.enqueue(state, sample("a.x", 2)).state
state = Queue.enqueue(state, release("b.y", true)).state
state = Queue.enqueue(state, sample("a.x", 3)).state
equal(drain(state), { sample("a.x", 2), release("b.y", true), sample("a.x", 3) })

state = Queue.enqueue(Queue.new(), sample("a.x", 0.1)).state
state = Queue.enqueue(state, sample("a.x", 0.2)).state
state = Queue.enqueue(state, release("a.x", 0.2)).state
local ran = drain(state)
equal(ran[#ran].sample, false)

result = Queue.enqueue(Queue.new(), release("a.x", 1))
state = Queue.enqueue(result.state, unset("b.y")).state
state = Queue.enqueue(state, sample("a.x", 2)).state
equal({ result.launch, table.unpack(drain(state)) }, { release("a.x", 1), unset("b.y"), sample("a.x", 2) })

equal(Queue.argvFor(sample("a.x", 0.5)), { "prism", "set", "a.x", "0.5" })
equal(Queue.argvFor(release("a.x", 0.5)), { "prism", "set", "a.x", "0.5" })
equal(Queue.argvFor(unset("a.x")), { "prism", "unset", "a.x" })
-- prism is the only backend: a retired transport verb must fail loudly, not
-- fall through to some other command.
equal(pcall(Queue.argvFor, { verb = "preview-show", output = "DP-1" }), false)
equal(pcall(Queue.argvFor, { verb = "preview-hide" }), false)
equal(Queue.affectsParams(sample("a.x", 1)), true)
equal(Queue.affectsParams(release("a.x", 1)), true)
equal(Queue.affectsParams(unset("a.x")), true)
equal(Queue.shouldRefresh(false, unset("a.x")), false)
equal(Queue.shouldRefresh(true, release("a.x", 1)), true)
equal(Queue.shouldRefresh(true, unset("a.x")), true)
equal(Queue.shouldRefresh(true, sample("a.x", 1)), false)
equal(Queue.shouldRefresh(true, sample("a.x", 2)), false)
equal(Queue.isSample(sample("a.x", 0.5)), true)
equal(Queue.isSample(release("a.x", 0.5)), false)
equal(Queue.isSample(unset("a.x")), false)

equal(Shell.quote("a'b"), "'a'\"'\"'b'")
equal(Shell.command({ "prism", "set", "name with space", "a'b" }), "'prism' 'set' 'name with space' 'a'\"'\"'b'")

-- Layer ranking. describe states the resolution order, so the panel ranks a
-- parameter's layer against the write target instead of carrying its own copy
-- that goes stale when a layer is added to the store.
local order = resolutionOrder
local ranks = Presentation.layerRanks(order)
equal(ranks, { default = 1, base = 2, wallpaper = 3, state = 4, profile = 5 })

local function layered(layer, control)
  return { key = "k." .. layer, layer = layer, ui = { control = control or "slider" } }
end
-- Shadowed means "the value comes from above where a write would land", so the
-- control is live but has no visible effect.
equal(Presentation.isShadowed(layered("wallpaper"), ranks, "base"), true)
equal(Presentation.isShadowed(layered("base"), ranks, "base"), false)
equal(Presentation.isShadowed(layered("default"), ranks, "base"), false)
equal(Presentation.isShadowed(layered("wallpaper"), ranks, "wallpaper"), false)
equal(Presentation.isShadowed(layered("base"), ranks, "wallpaper"), false)
equal(Presentation.isShadowed(layered("state"), ranks, "wallpaper"), true)

-- The advice is layer-specific: pinning the wallpaper makes it the target, but
-- it cannot outrank a state layer, so a state shadow offers no pin.
equal(Presentation.shadowHint(layered("wallpaper")), "Overridden by wallpaper; pin to edit")
equal(Presentation.shadowHint(layered("state")), "Overridden by state")

-- The wallpaper header row: what it names, how many keys it holds, and whether
-- the pin is available.
local headerParams = {
  layered("wallpaper"), layered("base"), layered("wallpaper", "toggle"), layered("wallpaper", "none"),
}
headerParams[1].key, headerParams[3].key = "a", "b"
local header = Presentation.wallpaperHeader({
  active = { wallpaper = { id = "f8eb0556", path = "/pics/Deep Field.jpg", pinned = false }, profile = nil },
  layers = order, target = "base", params = headerParams,
})
equal(header.name, "Deep Field.jpg")
equal(header.overrides, 2, "the CLI-only wallpaper parameter is not a visible override")
equal(header.pinned, false)
equal(header.canPin, true)

equal(Presentation.wallpaperHeader({ active = { wallpaper = nil, profile = nil }, params = {} }), nil,
  "no wallpaper is nothing to pin")

-- A loaded profile holds the write target, so the wallpaper cannot be pinned;
-- the reason has to stay readable, because a Noctalia toggle carries no
-- tooltip and a disabled Button's tooltip is unreachable.
local blocked = Presentation.wallpaperHeader({
  active = { wallpaper = { id = "f8eb0556", path = "/pics/a.jpg", pinned = false }, profile = "dusk" },
  layers = order, target = "profile", params = {},
})
equal(blocked.canPin, false)
assert(blocked.tooltip:find("dusk", 1, true), "the blocked pin must name the profile holding the target")

-- The pin is a transport verb like set and unset, and it changes the write
-- target, so the model must be re-read after it lands.
equal(Queue.argvFor({ verb = "pin", on = true }), { "prism", "context", "pin", "wallpaper" })
equal(Queue.argvFor({ verb = "pin", on = false }), { "prism", "context", "unpin", "wallpaper" })
equal(Queue.affectsParams({ verb = "pin", on = true }), true)

-- Panel layer rendering. The harness records write callbacks too, so a pin can
-- be completed and its reconciliation observed rather than only its argv.
local writeCallback
noctalia.runAsync = function(cmd, callback)
  commands[#commands + 1] = cmd
  if cmd:find("describe", 1, true) then described = callback else writeCallback = callback end
  return true
end

local function renderModel(next)
  model = next
  dofile(here .. "panel.luau")
  onOpen({})
  described({ exitCode = 0, stdout = "{}" })
  return rendered
end

local function labelSet(tree)
  local found = {}
  for _, label in ipairs(collect(tree, "label")) do found[label.props.text or ""] = true end
  return found
end

local function glyphButton(tree, glyph)
  for _, button in ipairs(collect(tree, "button")) do
    if button.props.glyph == glyph then return button end
  end
  return nil
end

local function cellFor(tree, key)
  for _, row in ipairs(collect(tree, "row")) do
    if row.props.key == key then return row end
  end
  return nil
end

local function layeredModel(overrides)
  local m = {
    active = { wallpaper = { id = "f8eb0556", path = "/pics/Deep Field.jpg", pinned = false } },
    profiles = {},
    layers = order,
    target = "base",
    params = {
      { key = "glass.enabled", value = true, default = true, layer = "wallpaper", fallback = true,
        effectiveDrag = "release", ui = { control = "toggle", group = "Title", order = 0, label = "Glass" } },
      { key = "compositor.gaps", value = 40, default = 24, layer = "wallpaper", fallback = 24,
        effectiveDrag = "release", range = { 0, 128 },
        ui = { control = "slider", group = "Glass", order = 10, step = 1, label = "Gaps" } },
      { key = "glass.ior", value = 1.5, default = 1.4, layer = "base", fallback = 1.4,
        effectiveDrag = "release", range = { 1, 2 },
        ui = { control = "slider", group = "Glass", order = 11, step = 0.01, label = "Ior" } },
      { key = "glass.focusSplit", value = true, default = true, layer = "wallpaper", fallback = true,
        effectiveDrag = "release", ui = { control = "toggle", group = "Focus", order = 200, label = "Focus-state glass", header = true } },
      { key = "glass.roughness", value = 0.2, default = 0.08, layer = "base", fallback = 0.1,
        effectiveDrag = "live", range = { 0, 1 },
        ui = { control = "slider", group = "Focus", order = 220, step = 0.01, label = "Blur", state = "focused", row = "Blur" } },
      { key = "glass.inactive.roughness", value = 0.5, default = 0.5, layer = "wallpaper", fallback = 0.5,
        effectiveDrag = "release", range = { 0, 1 },
        ui = { control = "slider", group = "Focus", order = 221, step = 0.01, label = "Unfocused blur", state = "unfocused", row = "Blur" } },
      { key = "glass.bypass.backdrop", value = false, default = false, layer = "default", fallback = false,
        effectiveDrag = "release", ui = { control = "toggle", group = "Focus", order = 400, label = "Bypass backdrop" } },
      { key = "debug.backdrop", value = false, default = false, layer = "wallpaper", fallback = false,
        ui = { control = "none", group = "Debug" } },
    },
    rack = { group = "Focus", devices = {
      { device = "backdrop", label = "Backdrop", category = "source", mix = "Blur", rows = {}, shared = {}, bypass = "glass.bypass.backdrop" },
    } },
  }
  for key, value in pairs(overrides or {}) do m[key] = value end
  return m
end

-- The header row names the wallpaper on screen and counts what it holds.
local tree = renderModel(layeredModel())
local shown = labelSet(tree)
assert(shown["Deep Field.jpg"], "the header row must name the active wallpaper")
assert(shown["4 overrides"], "the header row must count the wallpaper's visible keys")
local pin = glyphButton(tree, "pin")
assert(pin, "an unpinned wallpaper offers a pin button")
equal(pin.props.tooltip, "Pin to tune this wallpaper instead of the base values")
equal(pin.props.opacity, 1.0)

-- Shadowed rows: dimmed, and the hint says what covers them and what to do.
assert(cellFor(tree, "compositor.gaps").props.opacity < 1.0, "a wallpaper-layer row is dimmed under a base target")
equal(cellFor(tree, "glass.ior").props.opacity, 1.0, "a base-layer row is not dimmed under a base target")
assert(shown["Overridden by wallpaper; pin to edit"], "a shadowed row must say why it has no visible effect")

-- A matrix row's cells carry their own layers: dim only the shadowed half, and
-- let the shadow outrank the other half's Live marker.
equal(cellFor(tree, "glass.roughness").props.opacity, 1.0, "the base-layer focused cell keeps full strength")
assert(cellFor(tree, "glass.inactive.roughness").props.opacity < 1.0, "the wallpaper-layer unfocused cell dims")
assert(not shown["Live"], "a Live marker must not hide the other cell's shadow warning")

-- The title and section header toggles are shadowed too, and say so.
local toggles = collect(tree, "toggle")
equal(#toggles, 2, "title and Focus header toggles")
for _, toggle in ipairs(toggles) do
  assert(toggle.props.opacity < 1.0, "a shadowed header toggle dims like any other shadowed control")
end

-- Editing base beneath a wallpaper still writes, but the value it writes stays
-- covered: the row keeps its shadow and offers no reset to remove.
local gaps = model.params[2]
local slider = nil
for _, node in ipairs(collect(tree, "slider")) do
  if node.props.key == "compositor.gaps:slider" then slider = node end
end
slider.props.onChange(64)
slider.props.onDragEnd()
equal(gaps.shadowed, true, "writing under a shadow does not lift it")
equal(gaps.overridden, false, "the write landed in base, which is not where the value comes from")

-- A loaded profile holds the target, so the pin is greyed but still hoverable:
-- a disabled Button's tooltip is unreachable, so the reason would vanish.
local blockedTree = renderModel(layeredModel({
  active = { wallpaper = { id = "f8eb0556", path = "/pics/a.jpg", pinned = false }, profile = "dusk" },
  target = "profile",
}))
local blockedPin = glyphButton(blockedTree, "pin")
assert(blockedPin.props.opacity < 1.0, "a blocked pin is greyed by opacity")
assert(blockedPin.props.enabled ~= false, "a blocked pin stays enabled so its tooltip is reachable")
assert(blockedPin.props.tooltip:find("dusk", 1, true), "the greyed pin names the profile holding the target")
local commandsBefore = #commands
blockedPin.props.onClick()
equal(#commands, commandsBefore, "clicking a blocked pin enqueues nothing")

-- Pinning: the command goes out, and when it lands the panel re-reads the model
-- and every row that the wallpaper was covering becomes editable.
local pinTree = renderModel(layeredModel())
glyphButton(pinTree, "pin").props.onClick()
equal(commands[#commands], Shell.command({ "prism", "context", "pin", "wallpaper" }))
writeCallback({ exitCode = 0, stdout = "" })
assert(commands[#commands]:find("describe", 1, true), "a completed pin must re-read the model")
described({ exitCode = 0, stdout = "{}" })
model = layeredModel({
  active = { wallpaper = { id = "f8eb0556", path = "/pics/Deep Field.jpg", pinned = true } },
  target = "wallpaper",
})
described({ exitCode = 0, stdout = "{}" })
equal(cellFor(rendered, "compositor.gaps").props.opacity, 1.0, "pinning lifts the shadow off the wallpaper's rows")
equal(cellFor(rendered, "glass.ior").props.opacity, 1.0,
  "a base-layer row is below the pinned target, so a write to the wallpaper surfaces over it")
assert(glyphButton(rendered, "pin-filled"), "a pinned wallpaper shows the pinned glyph")
assert(labelSet(rendered)["Overridden by wallpaper; pin to edit"] == nil, "nothing is covered by the wallpaper once it is the target")

-- With no wallpaper there is nothing to pin and no header row to draw.
local bareTree = renderModel(layeredModel({ active = {}, rack = { group = "Focus", devices = {} }, params = {
  { key = "glass.enabled", value = true, default = true, layer = "base", fallback = true,
    effectiveDrag = "release", ui = { control = "toggle", group = "Title", order = 0, label = "Glass" } },
} }))
equal(glyphButton(bareTree, "pin"), nil, "no wallpaper means no pin button")

-- The layer order is part of the contract: without it the panel cannot rank a
-- layer against the target, and must say so instead of guessing.
local function panelError(next)
  renderModel(next)
  for _, label in ipairs(collect(rendered, "label")) do
    if label.props.color == "error" and (label.props.text or "") ~= "" then return label.props.text end
  end
  return nil
end
local missingLayers = layeredModel()
missingLayers.layers = nil
equal(panelError(missingLayers), "prism describe returned no layer order")
equal(panelError(layeredModel({ layers = {} })), "prism describe returned no layer order")
equal(panelError(layeredModel({ target = "theme" })), "prism describe reported target theme outside the layer order")
local unrankable = layeredModel()
unrankable.params[2].layer = "theme"
assert((panelError(unrankable) or ""):find("compositor.gaps", 1, true),
  "a parameter on an unrankable layer names itself")

-- The layer order is a ranking, so it has to be a dense list of distinct names.
-- A hole, a stray key, a non-string entry, or a repeat all rank silently wrong,
-- which is worse than refusing to draw.
equal(panelError(layeredModel({ layers = { "default", "base", 3, "state", "profile" } })),
  "prism describe returned a malformed layer order")
equal(panelError(layeredModel({ layers = { "default", nil, "wallpaper" } })),
  "prism describe returned a malformed layer order")
equal(panelError(layeredModel({ layers = { "default", "base", "wallpaper", "state", "profile", extra = "x" } })),
  "prism describe returned a malformed layer order")
equal(panelError(layeredModel({ layers = { "default", "base", "base", "state", "profile" } })),
  "prism describe returned a malformed layer order")

-- Every parameter is ranked, not just the visible ones: a CLI-only parameter on
-- an unknown layer is the same broken contract.
local hiddenUnrankable = layeredModel()
hiddenUnrankable.params[8].layer = "theme"
assert((panelError(hiddenUnrankable) or ""):find("debug.backdrop", 1, true),
  "a hidden parameter on an unrankable layer names itself")
-- A drawn parameter missing `layer` outright keeps its own message: that is the
-- symptom of an older CLI, and the contract note names it.
local visibleNoLayer = layeredModel()
visibleNoLayer.params[2].layer = nil
equal(panelError(visibleNoLayer), "compositor.gaps has no layer")

local hiddenNoLayer = layeredModel()
hiddenNoLayer.params[8].layer = nil
assert((panelError(hiddenNoLayer) or ""):find("debug.backdrop", 1, true),
  "a hidden parameter with no layer at all is refused")

-- Profile transport. Loading, clearing, saving, and deleting are all context
-- verbs, and each moves the write target or the resolved values, so each leaves
-- the model stale exactly as a parameter write does.
equal(Queue.argvFor({ verb = "activate", name = "dusk" }), { "prism", "context", "activate", "profile", "dusk" })
equal(Queue.argvFor({ verb = "deactivate" }), { "prism", "context", "deactivate", "profile" })
equal(Queue.argvFor({ verb = "save", name = "dusk" }), { "prism", "context", "save", "profile", "dusk" })
equal(Queue.argvFor({ verb = "delete", name = "dusk" }), { "prism", "context", "delete", "profile", "dusk" })
for _, item in ipairs({
  { verb = "activate", name = "dusk" }, { verb = "deactivate" },
  { verb = "save", name = "dusk" }, { verb = "delete", name = "dusk" },
}) do
  equal(Queue.affectsParams(item), true)
end

-- Names are the store's rule, checked here so a bad one never becomes a failed
-- command the user has to read out of a banner.
equal(Presentation.validProfileName("dusk"), true)
equal(Presentation.validProfileName("dusk-2.0_a"), true)
equal(Presentation.validProfileName("a b"), false)
equal(Presentation.validProfileName(""), false)
equal(Presentation.validProfileName("a/b"), false)

-- The selector doubles as the clear control: index 0 is "no profile", which
-- deactivates. It is not "base values" -- deactivating leaves the wallpaper
-- layer active, so what is on screen may still come from it; only the write
-- target returns to base.
local section = Presentation.profileSection({
  active = { profile = "dusk" }, profiles = { "dawn", "dusk", "noon" },
})
equal(section.options, { "No profile", "dawn", "dusk", "noon" })
equal(section.selectedIndex, 2)
equal(section.activeName, "dusk")

local none = Presentation.profileSection({ active = {}, profiles = { "dawn" } })
equal(none.options, { "No profile", "dawn" })
equal(none.selectedIndex, 0)
equal(none.activeName, nil)

-- The profile list is part of the contract, not an optional extra: an absent
-- field must report that, never quietly draw an empty selector.
equal(panelError(layeredModel({ profiles = "dusk" })), "prism describe returned no profile list")
equal(panelError(layeredModel({ profiles = { "dusk", 7 } })), "prism describe returned a malformed profile list")
local noProfiles = layeredModel()
noProfiles.profiles = nil
equal(panelError(noProfiles), "prism describe returned no profile list")

local function profileModel(overrides)
  local m = layeredModel({ profiles = { "dawn", "dusk" } })
  for key, value in pairs(overrides or {}) do m[key] = value end
  return m
end

local function selectWithOption(tree, option)
  for _, node in ipairs(collect(tree, "select")) do
    for _, candidate in ipairs(node.props.options or {}) do
      if candidate == option then return node end
    end
  end
  return nil
end

-- Loading and clearing both run through the one selector.
local profileTree = renderModel(profileModel())
local selector = selectWithOption(profileTree, "No profile")
assert(selector, "the panel offers a profile selector")
equal(selector.props.options, { "No profile", "dawn", "dusk" })
equal(selector.props.selectedIndex, 0)
selector.props.onChange(2)
equal(commands[#commands], Shell.command({ "prism", "context", "activate", "profile", "dusk" }))

local loadedTree = renderModel(profileModel({ active = { profile = "dusk" }, target = "profile" }))
equal(selectWithOption(loadedTree, "No profile").props.selectedIndex, 2)
selectWithOption(loadedTree, "No profile").props.onChange(0)
equal(commands[#commands], Shell.command({ "prism", "context", "deactivate", "profile" }))

-- Saving names the profile first, and entering it is a second command that only
-- runs once the save has actually landed.
local saveTree = renderModel(profileModel())
equal(#collect(saveTree, "input"), 0, "the name field stays out of the way until asked for")
glyphButton(saveTree, "device-floppy").props.onClick()
local nameField = collect(rendered, "input")[1]
assert(nameField, "the save button opens a name field")
nameField.props.onSubmit("dusk")
equal(commands[#commands], Shell.command({ "prism", "context", "save", "profile", "dusk" }))
writeCallback({ exitCode = 0, stdout = "" })
equal(commands[#commands], Shell.command({ "prism", "context", "activate", "profile", "dusk" }),
  "a landed save is entered, so the next edit goes into the profile just named")

-- A failed save must not be followed by an activate: the FIFO keeps going after
-- a failure, so an unconditional pair would enter a profile whose overwrite
-- never happened.
local failTree = renderModel(profileModel())
glyphButton(failTree, "device-floppy").props.onClick()
collect(rendered, "input")[1].props.onSubmit("dusk")
equal(commands[#commands], Shell.command({ "prism", "context", "save", "profile", "dusk" }))
local afterFailedSave = #commands
writeCallback({ exitCode = 1, stdout = "", stderr = "disk full" })
for index = afterFailedSave + 1, #commands do
  assert(not commands[index]:find("activate", 1, true), "a failed save must not activate")
end

-- A command error has to survive the refresh that follows it, or the reason a
-- profile would not load flashes past and the panel looks fine.
assert(commands[#commands]:find("describe", 1, true), "a finished batch still re-reads the model")
described({ exitCode = 0, stdout = "{}" })
local banner
for _, label in ipairs(collect(rendered, "label")) do
  if label.props.color == "error" and (label.props.text or "") ~= "" then banner = label.props.text end
end
equal(banner, "disk full", "a successful describe must not erase why the last command failed")

-- Names are checked before anything is queued.
local badTree = renderModel(profileModel())
glyphButton(badTree, "device-floppy").props.onClick()
local before = #commands
collect(rendered, "input")[1].props.onSubmit("a b")
equal(#commands, before, "an invalid name queues nothing")
local nameError
for _, label in ipairs(collect(rendered, "label")) do
  if label.props.color == "error" and (label.props.text or "") ~= "" then nameError = label.props.text end
end
assert((nameError or ""):find("letters", 1, true), "an invalid name says what a name may contain")

-- Delete follows the reset idiom: inert and dim with nothing loaded, live once
-- a profile is.
local deleteTree = renderModel(profileModel())
local trash = glyphButton(deleteTree, "trash")
assert(trash.props.opacity < 1.0, "delete is dim with no profile loaded")
local beforeDelete = #commands
trash.props.onClick()
equal(#commands, beforeDelete, "delete with nothing loaded enqueues nothing")

local loadedDelete = renderModel(profileModel({ active = { profile = "dusk" }, target = "profile" }))
local liveTrash = glyphButton(loadedDelete, "trash")
equal(liveTrash.props.opacity, 1.0)
liveTrash.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "context", "delete", "profile", "dusk" }))

local noActive = layeredModel()
noActive.active = nil
equal(panelError(noActive), "prism describe returned no active contexts")

-- A command's error outlives the refresh it triggers, but it must not outlive
-- the panel. The Luau runtime survives a close, so without this a failure from
-- one session greets the next one behind a model that is perfectly fine.
local function errorBanner(tree)
  for _, label in ipairs(collect(tree, "label")) do
    if label.props.color == "error" and (label.props.text or "") ~= "" then return label.props.text end
  end
  return nil
end

local reopenTree = renderModel(profileModel({ active = { profile = "dusk" }, target = "profile" }))
glyphButton(reopenTree, "trash").props.onClick()
writeCallback({ exitCode = 1, stdout = "", stderr = "profile in use" })
described({ exitCode = 0, stdout = "{}" })
equal(errorBanner(rendered), "profile in use", "the error survives the refresh it triggered")

onClose()
onOpen({})
described({ exitCode = 0, stdout = "{}" })
equal(errorBanner(rendered), nil, "opening the panel is a fresh gesture and starts without the last error")
