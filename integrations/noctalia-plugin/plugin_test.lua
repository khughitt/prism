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
local function failsAny(candidate, patterns)
  local ok, err = pcall(Presentation.sections, candidate)
  assert(not ok, "expected a failure, got none")
  for _, pattern in ipairs(patterns) do
    if tostring(err):find(pattern, 1, true) then return end
  end
  error("unexpected failure: " .. tostring(err))
end
fails({
  { key = "t", ui = { control = "toggle", group = "Title", order = 0 } },
  { key = "a", ui = { control = "slider", group = "Focus", order = 1, state = "focused", row = "Blur" } },
}, "Blur has no unfocused")
fails({
  { key = "a", ui = { control = "slider", group = "Focus", order = 1, state = "focused", row = "Blur" } },
  { key = "b", ui = { control = "slider", group = "Focus", order = 2, state = "focused", row = "Blur" } },
}, "Blur has two focused")
failsAny({
  { key = "a", ui = { control = "slider", group = "Focus", order = 1, state = "focused", row = "Blur" } },
  { key = "b", ui = { control = "slider", group = "Glass", order = 2, state = "unfocused", row = "Blur" } },
}, {"Blur has no unfocused", "Blur has no focused"})
fails({
  { key = "a", ui = { control = "toggle", group = "Focus", order = 1, header = true } },
  { key = "b", ui = { control = "toggle", group = "Focus", order = 2, header = true } },
}, "Focus has two header toggles")

local reusedLabel = {
  { key = "one.f", ui = { control = "slider", group = "One", order = 1, state = "focused", row = "Blur" } },
  { key = "one.u", ui = { control = "slider", group = "One", order = 2, state = "unfocused", row = "Blur" } },
  { key = "two.f", ui = { control = "slider", group = "Two", order = 3, state = "focused", row = "Blur" } },
  { key = "two.u", ui = { control = "slider", group = "Two", order = 4, state = "unfocused", row = "Blur" } },
}
local reused = Presentation.sections(reusedLabel)
equal(#reused, 2, "one section per group")
equal(reused[1].rows[1].focused.key, "one.f")
equal(reused[2].rows[1].focused.key, "two.f")

local counted = {
  { key = "g.lip", value = 9, neutral = 0, held = { "base", "scratch" }, ui = { control = "slider", group = "Glass", order = 1 } },
  { key = "f.split", value = false, neutralize = false, held = { "scratch" }, ui = { control = "toggle", group = "Focus", order = 2, header = true } },
  { key = "f.blur", value = 0.3, neutral = 0, held = { "wallpaper" }, ui = { control = "slider", group = "Focus", order = 3, state = "focused", row = "Blur" } },
  { key = "f.blur.off", value = 0.5, neutral = 0, held = {}, ui = { control = "slider", group = "Focus", order = 4, state = "unfocused", row = "Blur" } },
  { key = "f.sat", value = 1, neutral = 1, held = {}, ui = { control = "slider", group = "Focus", order = 5, state = "focused", row = "Sat" } },
  { key = "f.sat.off", value = 1, neutral = 1, held = {}, ui = { control = "slider", group = "Focus", order = 6, state = "unfocused", row = "Sat" } },
}
for _, param in ipairs(counted) do param.edited = Presentation.holds(param, "scratch") end
equal(#Presentation.pairsOf(counted), 2, "two matrix rows")
equal(Presentation.symmetricCount(counted), 1, "one pair differs")
equal(Presentation.neutralCount(counted), 3, "three eligible keys differ")
equal(Presentation.editedCount(counted), 2, "two keys are in scratch")
equal(Presentation.neutralCount({counted[2]}), 0, "an exempt parameter never counts")
equal(Presentation.holds(counted[3], "wallpaper"), true)
equal(Presentation.holds(counted[3], "scratch"), false)
equal(Queue.argvFor({verb = "reset", mode = "neutral"}), {"prism", "reset", "neutral"})
equal(Queue.argvFor({verb = "reset", mode = "revert", group = "Glass"}), {"prism", "reset", "revert", "--group", "Glass"})
assert(Queue.affectsParams({verb = "reset", mode = "neutral"}), "a reset moves the model")

-- The panel must give its scroll root the host-owned viewport height both
-- before and after the asynchronous model arrives.
local rendered
local described
-- The store's resolution order, low to high, as describe states it.
local resolutionOrder = { "default", "base", "profile", "wallpaper", "state", "scratch" }
local model = { active = {}, profiles = {}, layers = resolutionOrder, params = {
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
    key = "extra.dim", value = 0, default = 0, layer = "default", fallback = 0,
    effectiveDrag = "release", range = { 0, 1 },
    ui = { control = "slider", group = "Extra", order = 210, step = 0.01, label = "Dim", display = "percent", state = "focused", row = "Dim" },
  },
  {
    key = "extra.inactive.dim", value = 0, default = 0, layer = "default", fallback = 0,
    effectiveDrag = "release", range = { 0, 1 },
    ui = { control = "slider", group = "Extra", order = 211, step = 0.01, label = "Unfocused dim", display = "percent", state = "unfocused", row = "Dim" },
  },
}, rack = { group = "Focus", devices = {
  { device = "backdrop", label = "Backdrop", category = "source", mix = "Blur", rows = {}, shared = {}, bypass = "glass.bypass.backdrop" },
  { device = "saturation", label = "Saturation", category = "post", mix = "Saturation", rows = {}, shared = {}, bypass = "glass.bypass.saturation", requires = "backdrop" },
  { device = "noise", label = "Noise", category = "post", mix = "Noise", rows = {}, shared = { "glass.noiseType" }, bypass = "glass.bypass.noise" },
} } }

for _, param in ipairs(model.params) do
  param.held = param.layer == "default" and {} or { param.layer }
  if param.key == "glass.focusSplit" then param.neutralize = false
  elseif param.ui.control == "select" then param.neutral = param.values[1]
  elseif param.ui.control == "toggle" then param.neutral = false
  else param.neutral = 0 end
end
-- Blur is edited over base; gaps is the wallpaper's nudge.
model.params[4].layer, model.params[4].held = "scratch", { "base", "scratch" }
model.params[2].layer, model.params[2].held = "wallpaper", { "wallpaper" }

ui = setmetatable({}, { __index = function(_, kind)
  return function(props, children) return { kind = kind, props = props or {}, children = children or {} } end
end })
panel = {
  render = function(tree) rendered = tree end,
  setNeedsFrameTick = function() end,
  setWantsSecondTicks = function() end,
}
local commands = {}
local commandCallback
noctalia = {
  runAsync = function(cmd, callback)
    commands[#commands + 1] = cmd
    if cmd:find("describe", 1, true) then described = callback else commandCallback = callback end
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

-- Each section announces itself in its own theme role, so a group is findable
-- without reading: header label and separator share the section's color, and
-- adjacent sections never match.
local headerColors = {}
for _, label in ipairs(collect(rendered, "label")) do
  if label.props.fontWeight == "bold" and label.props.fontSize == 15 then
    headerColors[label.props.text] = label.props.color
  end
end
assert(headerColors["Glass"] and headerColors["Focus"] and headerColors["Extra"],
  "every section header is colored")
assert(headerColors["Glass"] ~= headerColors["Focus"]
  and headerColors["Focus"] ~= headerColors["Extra"]
  and headerColors["Glass"] ~= headerColors["Extra"], "no two sections share a color")
local separatorColors = {}
for _, separator in ipairs(collect(rendered, "separator")) do
  if separator.props.color ~= nil then separatorColors[#separatorColors + 1] = separator.props.color end
end
equal(separatorColors, { headerColors["Glass"], headerColors["Focus"], headerColors["Extra"] },
  "each section separator carries its section's color")
equal(Presentation.sectionColor(1), Presentation.sectionColor(4), "the section palette cycles")
assert(Presentation.sectionColor(1) ~= Presentation.sectionColor(2), "adjacent sections differ")

assert(labels["Focused"] and labels["Unfocused"], "matrix column labels missing")
assert(labels["Backdrop"] and labels["Gaps"], "row labels missing")
assert(labels["Saturation"], "second matrix row label missing")
assert(labels["Noise type"] == nil, "details stay hidden until a card is expanded")
-- Once the Noise card expands there are two selects. Find its parameter select
-- by options rather than by position.
local function paramSelect(tree)
  for _, node in ipairs(collect(tree, "select")) do
    if (node.props.options or {})[1] ~= "Default" then return node end
  end
  return nil
end
equal(#collect(rendered, "select"), 1, "only the profile selector while every card is collapsed")
local sliderKeys = {}
for _, slider in ipairs(collect(rendered, "slider")) do sliderKeys[slider.props.key] = true end
assert(sliderKeys["glass.roughness:slider"] and sliderKeys["glass.inactive.roughness:slider"], "matrix sliders missing")
assert(sliderKeys["glass.saturation:slider"] and sliderKeys["glass.inactive.saturation:slider"], "saturation matrix sliders missing")
equal(#collect(rendered, "toggle"), 2, "title and Focus header toggles")

-- The row reset is revert: present on every row, opacity and tooltip carry
-- the edited state, and it optimistically shows the fallback value.
local resetCandidates = {}
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Revert edit" or button.props.tooltip == "Not edited" then
    resetCandidates[#resetCandidates + 1] = button
  end
end
equal(#resetCandidates, 9, "a reset renders for every visible cell: gaps, three mix pairs, and the extra pair")
local editedResets = {}
for _, button in ipairs(resetCandidates) do
  if button.props.tooltip == "Revert edit" and button.props.opacity == 1.0 then editedResets[#editedResets + 1] = button end
end
equal(#editedResets, 1, "only the edited roughness offers a full-strength reset")
for _, button in ipairs(resetCandidates) do
  if button ~= editedResets[1] then assert(button.props.opacity < 1.0, "an unedited reset stays dim") end
end
local sectionResets = 0
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Revert section (1)" and button.props.opacity == 1.0 then sectionResets = sectionResets + 1 end
end
equal(sectionResets, 1, "the Focus rack counts its one edit")
assert(labels["Extra"], "extra section header missing")

-- Cards: one per device in rack order, each with a light whose glyph and color
-- say active, bypassed, or silenced by an upstream bypass.
local function byKey(tree, key, found)
  found = found or {}
  if type(tree) ~= "table" then return found end
  if tree.props and tree.props.key == key then found[#found + 1] = tree end
  for _, child in ipairs(tree.children or {}) do byKey(child, key, found) end
  return found
end
local roughnessReset
for _, button in ipairs(collect(byKey(rendered, "glass.roughness")[1], "button")) do
  if button.props.glyph == "restore" then roughnessReset = button end
end
assert(roughnessReset, "the edited roughness carries a reset")
equal(roughnessReset.props.tooltip, "Revert edit")
equal(roughnessReset.props.opacity, 1.0)
roughnessReset.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "unset", "glass.roughness" }))
equal(model.params[4].value, 0.1, "the reset shows the fallback before describe reconciles")
equal(model.params[4].edited, false)
commandCallback({exitCode = 0, stdout = ""})
described({exitCode = 0, stdout = "{}"})

local function buttonsByGlyph(tree, glyph)
  local found = {}
  for _, node in ipairs(collect(tree, "button")) do
    if node.props.glyph == glyph then found[#found + 1] = node end
  end
  return found
end
equal(#buttonsByGlyph(rendered, "baseline"), 4, "three sections and panel-wide")
equal(#buttonsByGlyph(rendered, "equal"), 3, "matrix sections and panel-wide")
local panelWide = buttonsByGlyph(rendered, "baseline")[1]
assert(panelWide.props.tooltip:find("everything", 1, true), "panel-wide tooltip names scope")
local beforeNeutral = {}
for index, param in ipairs(model.params) do beforeNeutral[index] = {param.value, param.overridden} end
panelWide.props.onClick()
equal(commands[#commands], Shell.command({"prism", "reset", "neutral"}))
commandCallback({exitCode = 0, stdout = ""})
described({exitCode = 0, stdout = "{}"})
for index, param in ipairs(model.params) do param.value, param.overridden = beforeNeutral[index][1], beforeNeutral[index][2] end
described({exitCode = 0, stdout = "{}"})
-- Labels do not honour width in the native host. Value columns must reserve
-- their space with a layout container, including non-slider and empty values.
local valueWidth
for _, key in ipairs({"compositor.gaps", "glass.roughness", "glass.saturation", "extra.dim"}) do
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

-- Matrix columns read unfocused left, focused right, and the header labels,
-- the section rows, and the rack cards all agree.
local function columnLabels(header)
  local texts = {}
  for _, node in ipairs(header.children) do
    if node.kind == "label" then texts[#texts + 1] = node.props.text end
  end
  return texts
end
equal(columnLabels(rackHeader), { "Unfocused", "Focused" }, "rack headers read unfocused left, focused right")
local extraHeader
for _, row in ipairs(collect(rendered, "row")) do
  if row.props.key == "Extra:columns" then extraHeader = row end
end
assert(extraHeader, "extra column header missing")
equal(columnLabels(extraHeader), { "Unfocused", "Focused" }, "section headers read unfocused left, focused right")
local extraRow = byKey(rendered, "Dim:row")[1].children[1]
equal(extraRow.children[2].props.key, "extra.inactive.dim", "the left cell is unfocused")
equal(extraRow.children[4].props.key, "extra.dim", "the right cell is focused")
local noiseCardRow = byKey(rendered, "noise:card")[1].children[1]
equal(noiseCardRow.children[2].props.key, "glass.inactive.noise", "the left mix cell is unfocused")
equal(noiseCardRow.children[4].props.key, "glass.noise", "the right mix cell is focused")

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
byKey(rendered, "compositor.gaps:name")[1].props.onClick()
assert(rendered == treeBeforeHelp, "parameter name clicks must not expand help")
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

-- A bypass the wallpaper nudges is not dimmed and still writes; the card's
-- hint says where the value comes from.
noiseBypass.effectiveDrag, noiseBypass.layer, noiseBypass.held = "release", "wallpaper", { "wallpaper" }
model.active = { wallpaper = { id = "f8eb0556", path = "/pics/Deep Field.jpg" } }
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })
equal(light("noise").props.opacity, 1.0, "nothing is shadowed any more")
local hintLabels = {}
for _, label in ipairs(collect(rendered, "label")) do hintLabels[label.props.text or ""] = true end
assert(hintLabels["wallpaper"], "a collapsed card reports the wallpaper's nudge")
local commandsBeforeNudgedLight = #commands
light("noise").props.onClick()
equal(#commands, commandsBeforeNudgedLight + 1, "a nudged bypass light writes like any other")
noiseBypass.layer, noiseBypass.held = "default", {}
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
local commandsBeforeExpansion = #commands
byKey(rendered, "glass.noise:name")[1].props.onClick()
equal(chevron("noise").props.tooltip, "Hide details", "card titles expand details")
chevron("noise").props.onClick()
equal(chevron("noise").props.tooltip, "Show details", "chevrons share the title's expansion state")
byKey(rendered, "glass.noise:name")[1].props.onClick()
equal(chevron("noise").props.tooltip, "Hide details")
byKey(rendered, "glass.noise:name")[1].props.onClick()
equal(chevron("noise").props.tooltip, "Show details", "card titles collapse details")
byKey(rendered, "glass.noise:name")[1].props.onClick()
equal(#commands, commandsBeforeExpansion, "expansion must not write parameters")
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
model.params[12].layer, model.params[12].held = "scratch", { "base", "scratch" }
described({ exitCode = 0, stdout = "{}" })
chevron("saturation").props.onClick()
local saturationCard = byKey(rendered, "saturation:card")[1]
local bypassReset
for _, button in ipairs(collect(saturationCard, "button")) do
  if button.props.tooltip == "Revert edit" and button.props.opacity == 1.0 then bypassReset = button end
end
assert(bypassReset, "the edited bypass row offers a full-strength reset")
bypassReset.props.onClick()
assert(commands[#commands]:find("'unset' 'glass.bypass.saturation'", 1, true), "bypass reset enqueues prism unset")
commandCallback({exitCode = 0, stdout = ""})
model.params[12].layer, model.params[12].held = "base", { "base" }
described({exitCode = 0, stdout = "{}"})

-- Expansion survives close and reopen within a session.
onClose()
onOpen({})
described({ exitCode = 0, stdout = "{}" })
equal(chevron("noise").props.tooltip, "Hide details")
chevron("noise").props.onClick()
equal(chevron("noise").props.tooltip, "Show details")

-- A plain matrix section outside the rack still renders.
local extraSliders = {}
for _, node in ipairs(collect(rendered, "slider")) do extraSliders[node.props.key] = true end
assert(extraSliders["extra.dim:slider"] and extraSliders["extra.inactive.dim:slider"],
  "extra matrix sliders missing")

-- A model without a rack is a contract error, named.
local savedRack = model.rack
model.rack = nil
dofile(here .. "panel.luau")
onOpen({})
described({ exitCode = 0, stdout = "{}" })
local errorLabel = collect(rendered, "label")[1]
equal(errorLabel.props.text, "prism describe returned no rack")
model.rack = savedRack

-- Clicking a reset with nothing edited must do nothing: the onClick guard
-- checks the live param, not just whether the button is drawn dim.
local uneditedReset
for _, button in ipairs(resetCandidates) do
  if button ~= editedResets[1] then uneditedReset = button break end
end
local commandCountBeforeGuard = #commands
uneditedReset.props.onClick()
equal(#commands, commandCountBeforeGuard, "clicking an unedited reset enqueues nothing")

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

-- The wallpaper header row: which wallpaper is on screen, and how many
-- visible keys its delta holds. Hidden keys and keys the wallpaper does not
-- hold never count, and a key scratch covers still counts for the wallpaper.
local function layered(held, control)
  return { key = "k" .. #held, held = held, layer = held[#held] or "default", ui = { control = control or "slider" } }
end
local header = Presentation.wallpaperHeader({
  active = { wallpaper = { id = "f8eb0556", path = "/pics/Deep Field.jpg" }, profile = nil },
  params = { layered({ "wallpaper" }), layered({ "base" }), layered({ "wallpaper", "scratch" }, "toggle"), layered({ "wallpaper" }, "none") },
})
equal(header.id, "f8eb0556")
equal(header.name, "Deep Field.jpg", "the header names the wallpaper by basename")
equal(header.look, "Default")
equal(header.tuned, 2, "the CLI-only wallpaper parameter is not a visible nudge")
equal(Presentation.wallpaperHeader({ active = { wallpaper = nil, profile = nil }, params = {} }), nil,
  "no wallpaper is no header")

-- Clear and commit name what they act on, and each moves the model.
equal(Queue.argvFor({ verb = "clear", id = "f8eb0556" }), { "prism", "context", "clear", "wallpaper", "f8eb0556" })
equal(Queue.argvFor({ verb = "commit", destination = "base" }), { "prism", "commit", "base" })
equal(Queue.argvFor({ verb = "commit", destination = "profile" }), { "prism", "commit", "profile" })
equal(Queue.argvFor({ verb = "commit", destination = "profile", target = "noon" }), { "prism", "commit", "profile", "noon" })
equal(Queue.argvFor({ verb = "commit", destination = "wallpaper", target = "f8eb0556" }), { "prism", "commit", "wallpaper", "f8eb0556" })
for _, item in ipairs({ { verb = "clear", id = "x" }, { verb = "commit", destination = "base" } }) do
  assert(Queue.affectsParams(item), item.verb .. " must leave the model stale")
end
for _, verb in ipairs({ "pin", "save" }) do
  local ok = pcall(Queue.argvFor, { verb = verb, name = "x" })
  assert(not ok, verb .. " is no longer a queue verb")
end

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
    active = { wallpaper = { id = "f8eb0556", path = "/pics/Deep Field.jpg" } },
    profiles = {},
    layers = resolutionOrder,
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
  for _, param in ipairs(m.params) do
    param.held = param.layer == "default" and {} or { param.layer }
    if param.ui.control ~= "none" then
      if param.key == "glass.focusSplit" then param.neutralize = false
      elseif param.ui.control == "toggle" then param.neutral = false
      else param.neutral = 0 end
    end
  end
  return m
end

-- The header row: a lit glyph while the wallpaper holds nudges, the count,
-- and a clear that names the wallpaper it acts on.
local tunedModel = layeredModel()
local tree = renderModel(tunedModel)
local shown = labelSet(tree)
assert(shown["4 for Default + this wallpaper"], "the header row must count the wallpaper's visible keys")
local photo = glyphButton(tree, "photo-filled")
assert(photo, "a tuned wallpaper shows the lit glyph")
equal(photo.props.tooltip, "Deep Field.jpg", "the basename lives in the tooltip")
local clear = glyphButton(tree, "eraser")
assert(clear, "a tuned wallpaper offers a clear button")
equal(clear.props.opacity, 1.0)
equal(clear.props.tooltip, "Clear Default + this wallpaper's 4 adjustments")
clear.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "context", "clear", "wallpaper", "f8eb0556",
  "--expect-look", "default", "--expect-wallpaper", "id:f8eb0556" }))
writeCallback({ exitCode = 0, stdout = "" })
assert(commands[#commands]:find("describe", 1, true), "a completed clear re-reads the model")
described({ exitCode = 0, stdout = "{}" })

-- Nothing is dimmed: scratch is topmost, so no write can be covered. A row the
-- wallpaper nudges carries a provenance marker instead.
equal(cellFor(tree, "compositor.gaps").props.opacity, 1.0)
assert(shown["wallpaper"], "a nudged row says where its value comes from")
assert(labelSet(tree)["Overridden by wallpaper; pin to edit"] == nil, "the shadow hint is gone")
for _, toggle in ipairs(collect(tree, "toggle")) do equal(toggle.props.opacity, nil, "no toggle dims") end

-- An untuned wallpaper draws the hollow glyph and an inert clear.
local untunedModel = layeredModel()
for _, param in ipairs(untunedModel.params) do
  if param.layer == "wallpaper" then param.layer, param.held = "default", {} end
end
local untunedTree = renderModel(untunedModel)
assert(glyphButton(untunedTree, "photo"), "an untuned wallpaper shows the hollow glyph")
local inertClear = glyphButton(untunedTree, "eraser")
assert(inertClear.props.opacity < 1.0)
equal(inertClear.props.tooltip, "This look + wallpaper holds no adjustments")
local beforeInert = #commands
inertClear.props.onClick()
equal(#commands, beforeInert, "an inert clear enqueues nothing")

-- Editing a row the wallpaper nudges marks it edited at once.
local editTree = renderModel(tunedModel)
local gaps = tunedModel.params[2]
local slider = nil
for _, node in ipairs(collect(editTree, "slider")) do
  if node.props.key == "compositor.gaps:slider" then slider = node end
end
slider.props.onChange(64)
slider.props.onDragEnd()
equal(gaps.edited, true, "the write landed in scratch")

-- With no wallpaper there is no header row.
local bareTree = renderModel(layeredModel({ active = {}, rack = { group = "Focus", devices = {} }, params = {
  { key = "glass.enabled", value = true, default = true, layer = "base", fallback = true, held = { "base" },
    effectiveDrag = "release", ui = { control = "toggle", group = "Title", order = 0, label = "Glass" } },
} }))
equal(glyphButton(bareTree, "eraser"), nil, "no wallpaper means no clear button")

-- A color control shows the chosen color: a swatch in the value column, which
-- a color cell has no text for.
local tintModel = layeredModel()
tintModel.params[#tintModel.params + 1] = {
  key = "glass.attenuationColor", value = "#3366cc", default = "#dfe8ff", layer = "base", fallback = "#dfe8ff",
  effectiveDrag = "release", neutral = "#ffffff", held = { "base" },
  ui = { control = "color", group = "Glass", order = 20, label = "Tint" },
}
local tintTree = renderModel(tintModel)
local tintCell = cellFor(tintTree, "glass.attenuationColor")
assert(tintCell, "the color row renders")
local swatchColumn = tintCell.children[1]
equal(swatchColumn.children[1].kind, "box", "a color cell's value column carries a swatch, not empty text")
equal(swatchColumn.children[1].props.fill, "#3366cc", "the swatch shows the current color")

-- The layer order is part of the contract: provenance must name a ranked layer.
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

local noHeld = layeredModel()
noHeld.params[2].held = nil
equal(panelError(noHeld), "compositor.gaps has no held layers")
local badHeld = layeredModel()
badHeld.params[2].held = { "theme" }
equal(panelError(badHeld), "compositor.gaps is held in theme, outside the layer order")
local withTarget = layeredModel({ target = "base" })
equal(panelError(withTarget), nil, "an older field the panel does not read is ignored")
local hiddenNoHeld = layeredModel()
hiddenNoHeld.params[8].held = nil
equal(panelError(hiddenNoHeld), "debug.backdrop has no held layers")
local hiddenMalformedHeld = layeredModel()
hiddenMalformedHeld.params[8].held = { "wallpaper", [3] = "scratch" }
equal(panelError(hiddenMalformedHeld), "debug.backdrop has no held layers")
local noNeutral = layeredModel()
noNeutral.params[2].neutral = nil
equal(panelError(noNeutral), "compositor.gaps must declare exactly one of neutral and neutralize")
local badNeutralize = layeredModel()
badNeutralize.params[4].neutralize = true
equal(panelError(badNeutralize), "glass.focusSplit has invalid neutralize value")
local missingDataFirst = layeredModel()
missingDataFirst.params[2].default, missingDataFirst.params[2].held = nil, nil
equal(panelError(missingDataFirst), "compositor.gaps has no default",
  "core parameter data is checked before reset metadata")

local hiddenNoLayer = layeredModel()
hiddenNoLayer.params[8].layer = nil
assert((panelError(hiddenNoLayer) or ""):find("debug.backdrop", 1, true),
  "a hidden parameter with no layer at all is refused")

-- Profile transport. Loading, clearing, and deleting are context verbs, and
-- each leaves the model stale exactly as a parameter write does.
equal(Queue.captureSlots({ active = {} }), { look = "default", wallpaper = "none" })
equal(Queue.captureSlots({ active = { profile = "Default", wallpaper = { id = "w1" } } }),
  { look = "profile:Default", wallpaper = "id:w1" })
equal(Queue.argvFor({ verb = "commit", destination = "wallpaper", target = "w1",
  expected = { look = "profile:Aurora", wallpaper = "id:w1" } }),
  { "prism", "commit", "wallpaper", "w1", "--expect-look", "profile:Aurora", "--expect-wallpaper", "id:w1" })
equal(Queue.argvFor({ verb = "clear", id = "w1", expected = { look = "default", wallpaper = "id:w1" } }),
  { "prism", "context", "clear", "wallpaper", "w1", "--expect-look", "default", "--expect-wallpaper", "id:w1" })
equal(Queue.argvFor({ verb = "activate", name = "dusk" }), { "prism", "context", "activate", "profile", "dusk" })
equal(Queue.argvFor({ verb = "deactivate" }), { "prism", "context", "deactivate", "profile" })
equal(Queue.argvFor({ verb = "delete", name = "dusk" }), { "prism", "context", "delete", "profile", "dusk" })
equal(Queue.argvFor({ verb = "rename", name = "dusk", newName = "dawn" }),
  { "prism", "context", "rename", "profile", "dusk", "dawn" })
for _, item in ipairs({
  { verb = "activate", name = "dusk" }, { verb = "deactivate" },
  { verb = "delete", name = "dusk" },
  { verb = "rename", name = "dusk", newName = "dawn" },
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

-- Index 0 is the Default look: the unnamed base values, truthful now that the
-- wallpaper delta shows on top of it exactly as on top of a profile.
local section = Presentation.profileSection({
  active = { profile = "dusk" }, profiles = { "dawn", "dusk", "noon" },
})
equal(section.options, { "Default", "dawn", "dusk", "noon" })
equal(section.selectedIndex, 2)
equal(section.activeName, "dusk")

local none = Presentation.profileSection({ active = {}, profiles = { "dawn" } })
equal(none.options, { "Default", "dawn" })
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
local selector = selectWithOption(profileTree, "Default")
assert(selector, "the panel offers a profile selector")
equal(selector.props.options, { "Default", "dawn", "dusk" })
equal(selector.props.selectedIndex, 0)
selector.props.onChange(2)
equal(commands[#commands], Shell.command({ "prism", "context", "activate", "profile", "dusk" }))

local loadedTree = renderModel(profileModel({ active = { profile = "dusk" } }))
equal(selectWithOption(loadedTree, "Default").props.selectedIndex, 2)
selectWithOption(loadedTree, "Default").props.onChange(0)
equal(commands[#commands], Shell.command({ "prism", "context", "deactivate", "profile" }))

-- A pick is optimistic, like a slider edit: the render that follows it already
-- declares the picked index. Noctalia re-applies selectedIndex on every render,
-- so a render that still declared the old model's index would snap the
-- selector back to the old name for the whole activate round trip, compositor
-- reload included. The describe that follows reconciles either way.
local pickTree = renderModel(profileModel({ active = { profile = "dawn" } }))
equal(selectWithOption(pickTree, "Default").props.selectedIndex, 1)
selectWithOption(pickTree, "Default").props.onChange(2)
equal(selectWithOption(rendered, "Default").props.selectedIndex, 2, "the pick shows at once")
equal(commands[#commands], Shell.command({ "prism", "context", "activate", "profile", "dusk" }))
writeCallback({ exitCode = 1, stdout = "", stderr = "profile dusk: no such context" })
assert(commands[#commands]:find("describe", 1, true), "a failed activate still re-reads the model")
-- The harness decodes describe output to the fixture by reference, so hand it
-- a fresh model the way the real describe would.
model = profileModel({ active = { profile = "dawn" } })
described({ exitCode = 0, stdout = "{}" })
equal(selectWithOption(rendered, "Default").props.selectedIndex, 1,
  "a failed activate is reconciled by the describe that follows")

local clearTree = renderModel(profileModel({ active = { profile = "dawn" } }))
selectWithOption(clearTree, "Default").props.onChange(0)
equal(selectWithOption(rendered, "Default").props.selectedIndex, 0, "clearing shows at once too")

-- Neutral lands in scratch above the profile, so nothing is cleared first.
local neutralTree = renderModel(profileModel({ active = { profile = "dawn" } }))
local wide = buttonsByGlyph(neutralTree, "baseline")[1]
assert(wide.props.tooltip:find("everything", 1, true), "the first baseline button is panel-wide")
local beforeWide = #commands
wide.props.onClick()
equal(#commands, beforeWide + 1, "one command")
equal(commands[#commands], Shell.command({ "prism", "reset", "neutral" }))
equal(selectWithOption(rendered, "Default").props.selectedIndex, 1, "the profile stays loaded")
writeCallback({ exitCode = 0, stdout = "" })
described({ exitCode = 0, stdout = "{}" })

-- Save-as is one command: commit profile <name> snapshots the screen and
-- loads the new profile, so the selector shows it at once.
local function state_activeProfile()
  local picked = selectWithOption(rendered, "Default")
  return picked.props.options[picked.props.selectedIndex + 1]
end
local saveTree = renderModel(profileModel())
equal(#collect(saveTree, "input"), 0, "the name field stays out of the way until asked for")
glyphButton(saveTree, "device-floppy").props.onClick()
local nameField = collect(rendered, "input")[1]
assert(nameField, "the save button opens a name field")
nameField.props.onSubmit("noon")
equal(commands[#commands], Shell.command({ "prism", "commit", "profile", "noon",
  "--expect-look", "default", "--expect-wallpaper", "id:f8eb0556" }))
equal(state_activeProfile(), "noon", "the pick shows at once")
writeCallback({ exitCode = 0, stdout = "" })
assert(commands[#commands]:find("describe", 1, true), "a finished batch still re-reads the model")
described({ exitCode = 0, stdout = "{}" })

-- A command error has to survive the refresh that follows it.
local failTree = renderModel(profileModel())
glyphButton(failTree, "device-floppy").props.onClick()
collect(rendered, "input")[1].props.onSubmit("noon")
writeCallback({ exitCode = 1, stdout = "", stderr = "disk full" })
described({ exitCode = 0, stdout = "{}" })
local banner
for _, label in ipairs(collect(rendered, "label")) do
  if label.props.color == "error" and label.props.visible then banner = label.props.text end
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

local function textButton(tree, text)
  for _, button in ipairs(collect(tree, "button")) do
    if button.props.text == text then return button end
  end
  return nil
end

local function bannerOf(tree)
  for _, label in ipairs(collect(tree, "label")) do
    if label.props.color == "error" and (label.props.text or "") ~= "" then return label.props.text end
  end
  return nil
end

-- Deleting is asked about in place: Noctalia has no dialog, so the question is
-- a row where the name field would be, and only ever about the loaded profile.
local loadedDelete = renderModel(profileModel({ active = { profile = "dusk" } }))
local liveTrash = glyphButton(loadedDelete, "trash")
equal(liveTrash.props.opacity, 1.0)
local beforeConfirm = #commands
liveTrash.props.onClick()
equal(#commands, beforeConfirm, "delete asks before it acts")
assert(labelSet(rendered)["Delete profile dusk?"], "the question names the profile")
textButton(rendered, "Cancel").props.onClick()
equal(#commands, beforeConfirm, "cancel deletes nothing")
equal(labelSet(rendered)["Delete profile dusk?"], nil, "cancel closes the question")
glyphButton(rendered, "trash").props.onClick()
textButton(rendered, "Delete").props.onClick()
equal(commands[#commands], Shell.command({ "prism", "context", "delete", "profile", "dusk",
  "--expect-look", "profile:dusk", "--expect-wallpaper", "none" }))
equal(labelSet(rendered)["Delete profile dusk?"], nil, "a confirmed delete closes the question")

-- Saving under a name that already exists asks first. The loaded profile's own
-- name does not: every edit already lands there, so a resave replaces nothing
-- the user has not already seen.
local overwriteTree = renderModel(profileModel())
glyphButton(overwriteTree, "device-floppy").props.onClick()
local beforeOverwrite = #commands
collect(rendered, "input")[1].props.onSubmit("dawn")
equal(#commands, beforeOverwrite, "an existing name is not replaced without asking")
assert(labelSet(rendered)["Replace profile dawn?"], "the question names the profile")
equal(#collect(rendered, "input"), 0, "the question takes the name field's place")
textButton(rendered, "Cancel").props.onClick()
equal(#commands, beforeOverwrite, "cancel saves nothing")
equal(labelSet(rendered)["Replace profile dawn?"], nil, "cancel closes the question")
glyphButton(rendered, "device-floppy").props.onClick()
collect(rendered, "input")[1].props.onSubmit("dawn")
textButton(rendered, "Replace").props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "profile", "dawn",
  "--expect-look", "default", "--expect-wallpaper", "id:f8eb0556" }))
writeCallback({ exitCode = 0, stdout = "" })
described({ exitCode = 0, stdout = "{}" })

-- Saving the loaded profile under its own name is the merging commit when
-- there are edits, and closes the field without a command when there are none.
local resaveTree = renderModel(profileModel({ active = { profile = "dusk" } }))
local beforeResave = #commands
glyphButton(resaveTree, "device-floppy").props.onClick()
collect(rendered, "input")[1].props.onSubmit("dusk")
equal(#commands, beforeResave, "nothing edited, nothing to commit")
equal(#collect(rendered, "input"), 0, "the field closes")
local editedModel = profileModel({ active = { profile = "dusk" } })
editedModel.params[3].layer, editedModel.params[3].held = "scratch", { "base", "scratch" }
renderModel(editedModel)
glyphButton(rendered, "device-floppy").props.onClick()
collect(rendered, "input")[1].props.onSubmit("dusk")
equal(commands[#commands], Shell.command({ "prism", "commit", "profile",
  "--expect-look", "profile:dusk", "--expect-wallpaper", "none" }), "with edits it is the merging commit")
writeCallback({ exitCode = 0, stdout = "" })
described({ exitCode = 0, stdout = "{}" })

-- The edits row: the count, keep-in-look, keep-for-wallpaper, revert,
-- symmetric, neutral. Every button keeps the reset idiom.
local function twoEdits()
  local m = profileModel({ active = { profile = "dusk", wallpaper = { id = "f8eb0556", path = "/pics/a.jpg" } } })
  m.params[3].layer, m.params[3].held = "scratch", { "base", "scratch" }
  m.params[5].layer, m.params[5].held = "scratch", { "base", "scratch" }
  return m
end
local editsModel = twoEdits()
local editsTree = renderModel(editsModel)
assert(labelSet(editsTree)["2 edits"], "the edits row counts scratch")
local keep = glyphButton(editsTree, "bookmark")
equal(keep.props.tooltip, "Keep 2 edits in profile dusk")
equal(keep.props.opacity, 1.0)
keep.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "profile",
  "--expect-look", "profile:dusk", "--expect-wallpaper", "id:f8eb0556" }))
equal(editsModel.params[3].edited, false, "the edits clear optimistically")
writeCallback({ exitCode = 0, stdout = "" })
described({ exitCode = 0, stdout = "{}" })
local wallpaperEditsTree = renderModel(twoEdits())
local keepWall = glyphButton(wallpaperEditsTree, "photo-check")
equal(keepWall.props.tooltip, "Keep 2 edits for dusk + this wallpaper")
keepWall.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "wallpaper", "f8eb0556",
  "--expect-look", "profile:dusk", "--expect-wallpaper", "id:f8eb0556" }))
writeCallback({ exitCode = 0, stdout = "" })
described({ exitCode = 0, stdout = "{}" })
local revertTree = renderModel(twoEdits())
local revert = buttonsByGlyph(revertTree, "restore")[1]
equal(revert.props.tooltip, "Revert 2 edits")
revert.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "reset", "revert" }))
writeCallback({ exitCode = 0, stdout = "" })
described({ exitCode = 0, stdout = "{}" })

local defaultEdits = profileModel({ active = {} })
defaultEdits.params[3].layer, defaultEdits.params[3].held = "scratch", { "scratch" }
local defaultTree = renderModel(defaultEdits)
equal(glyphButton(defaultTree, "bookmark").props.tooltip, "Keep 1 edit in Default")
glyphButton(defaultTree, "bookmark").props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "base",
  "--expect-look", "default", "--expect-wallpaper", "none" }))
writeCallback({ exitCode = 0, stdout = "" })
described({ exitCode = 0, stdout = "{}" })
local noWall = glyphButton(defaultTree, "photo-check")
assert(noWall.props.opacity < 1.0, "no wallpaper on screen, so keep-for-wallpaper is inert")
equal(noWall.props.tooltip, "No wallpaper on screen")
local beforeNoWall = #commands
noWall.props.onClick()
equal(#commands, beforeNoWall)

local cleanTree = renderModel(profileModel({ active = {} }))
assert(labelSet(cleanTree)["No edits"], "an empty scratch says so")
assert(glyphButton(cleanTree, "bookmark").props.opacity < 1.0)
equal(glyphButton(cleanTree, "bookmark").props.tooltip, "Nothing to keep")

-- Rename follows the reset idiom and reuses the name field, seeded with the
-- current name. A taken name is refused here, the way the store refuses it,
-- and the same name is a no-op that just closes the field.
local renameTree = renderModel(profileModel())
local pencil = glyphButton(renameTree, "pencil")
assert(pencil, "the profile row offers a rename button")
assert(pencil.props.opacity < 1.0, "rename is dim with no profile loaded")
pencil.props.onClick()
equal(#collect(rendered, "input"), 0, "rename with nothing loaded opens nothing")

local loadedRename = renderModel(profileModel({ active = { profile = "dusk" } }))
local livePencil = glyphButton(loadedRename, "pencil")
equal(livePencil.props.opacity, 1.0)
local beforeRename = #commands
livePencil.props.onClick()
local renameField = collect(rendered, "input")[1]
assert(renameField, "rename opens the name field")
equal(renameField.props.value, "dusk", "the field starts from the current name")
renameField.props.onSubmit("dawn")
equal(#commands, beforeRename, "a taken name queues nothing")
assert((bannerOf(rendered) or ""):find("already", 1, true), "a taken name says so")
assert(collect(rendered, "input")[1], "the field stays open to try again")
collect(rendered, "input")[1].props.onSubmit("dusk")
equal(#commands, beforeRename, "the same name changes nothing")
equal(#collect(rendered, "input"), 0, "and closes the field")
glyphButton(rendered, "pencil").props.onClick()
collect(rendered, "input")[1].props.onSubmit("noon")
equal(commands[#commands], Shell.command({ "prism", "context", "rename", "profile", "dusk", "noon",
  "--expect-look", "profile:dusk", "--expect-wallpaper", "none" }))
equal(#collect(rendered, "input"), 0, "a queued rename closes the field")

-- Enter is not the only submit: it needs keyboard focus, so the check beside
-- the field hands commitName the text onChange tracked.
local clickSave = renderModel(profileModel())
glyphButton(clickSave, "device-floppy").props.onClick()
local clickSaveField = collect(rendered, "input")[1]
clickSaveField.props.onChange("noon")
local check = glyphButton(rendered, "check")
assert(check, "the field has a submit button beside it")
check.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "profile", "noon",
  "--expect-look", "default", "--expect-wallpaper", "id:f8eb0556" }),
  "the check submits what onChange tracked")
equal(#collect(rendered, "input"), 0, "a clicked save closes the field")

local clickRename = renderModel(profileModel({ active = { profile = "dusk" } }))
glyphButton(clickRename, "pencil").props.onClick()
collect(rendered, "input")[1].props.onChange("noon")
glyphButton(rendered, "check").props.onClick()
equal(commands[#commands], Shell.command({ "prism", "context", "rename", "profile", "dusk", "noon",
  "--expect-look", "profile:dusk", "--expect-wallpaper", "none" }),
  "the check submits a rename too")

-- While a mode's field is open its icon stops offering that mode and is a
-- plain cancel instead; the other mode's icon still switches.
local cancelTree = renderModel(profileModel({ active = { profile = "dusk" } }))
glyphButton(cancelTree, "device-floppy").props.onClick()
local openCancel = glyphButton(rendered, "x")
assert(openCancel, "the open mode's icon becomes a cancel")
equal(openCancel.props.tooltip, "Cancel")
assert(glyphButton(rendered, "device-floppy") == nil, "no save affordance while its field is open")
assert(glyphButton(rendered, "pencil"), "the other mode still offers its switch")
openCancel.props.onClick()
equal(#collect(rendered, "input"), 0, "the cancel closes the field")
glyphButton(rendered, "pencil").props.onClick()
local renameCancel = glyphButton(rendered, "x")
assert(renameCancel, "rename's icon becomes a cancel too")
renameCancel.props.onClick()
equal(#collect(rendered, "input"), 0, "and closes the rename field")

-- The save and rename buttons share one field, so opening one closes the
-- other, and either closes a pending question. The field's key carries the
-- mode: Noctalia seeds an uncontrolled input once per slot, so the switch
-- must create a fresh slot or rename would keep save's buffer.
local switchTree = renderModel(profileModel({ active = { profile = "dusk" } }))
glyphButton(switchTree, "trash").props.onClick()
assert(labelSet(rendered)["Delete profile dusk?"])
glyphButton(rendered, "device-floppy").props.onClick()
equal(labelSet(rendered)["Delete profile dusk?"], nil, "opening the name field drops the question")
equal(collect(rendered, "input")[1].props.value, "", "save starts from an empty name")
equal(collect(rendered, "input")[1].props.key, "name-save", "save gets its own slot")
glyphButton(rendered, "pencil").props.onClick()
equal(collect(rendered, "input")[1].props.value, "dusk", "rename opens on a fresh slot seeded with the current name")
equal(collect(rendered, "input")[1].props.key, "name-rename", "rename gets a fresh slot, so the seed applies")
glyphButton(rendered, "x").props.onClick()
equal(#collect(rendered, "input"), 0, "the open mode's icon, now a plain cancel, closes it")

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

local reopenTree = renderModel(profileModel({ active = { profile = "dusk" } }))
glyphButton(reopenTree, "trash").props.onClick()
writeCallback({ exitCode = 1, stdout = "", stderr = "profile in use" })
described({ exitCode = 0, stdout = "{}" })
equal(errorBanner(rendered), "profile in use", "the error survives the refresh it triggered")

onClose()
onOpen({})
described({ exitCode = 0, stdout = "{}" })
equal(errorBanner(rendered), nil, "opening the panel is a fresh gesture and starts without the last error")

-- Following the rotation: the store is the only authority on which wallpaper
-- is active, so the panel re-reads describe every two seconds while open,
-- through the same stale-and-replay path as every other refresh.
;(function()
  local ticksWanted = nil
  panel.setWantsSecondTicks = function(value) ticksWanted = value end
  renderModel(profileModel())
  equal(ticksWanted, true, "opening the panel asks for second ticks")
  local beforeTicks = #commands
  update()
  equal(#commands, beforeTicks, "one tick is not yet a refresh")
  update()
  equal(#commands, beforeTicks + 1, "the second tick refreshes")
  assert(commands[#commands]:find("describe", 1, true))
  described({ exitCode = 0, stdout = "{}" })

-- During a drag the tick sets one flag and the refresh replays once the
-- panel is idle, however many ticks passed.
  local depthSlider
  for _, node in ipairs(collect(rendered, "slider")) do
    if node.props.key == "glass.roughness:slider" then depthSlider = node end
  end
  depthSlider.props.onChange(0.3)
  local beforeDrag = #commands
  update() update() update() update()
  equal(#commands, beforeDrag, "no describe lands during a drag")
  depthSlider.props.onDragEnd()
  equal(#commands, beforeDrag + 1, "the release writes")
  writeCallback({ exitCode = 0, stdout = "" })
  equal(#commands, beforeDrag + 2, "then one refresh, not four")
  assert(commands[#commands]:find("describe", 1, true))
  described({ exitCode = 0, stdout = "{}" })

  onClose()
  equal(ticksWanted, false, "closing the panel stops the tick")

-- A describe the tick launched must not land over a write that started after
-- it: a periodic describe now races every optimistic edit, not only drags.
-- The write invalidates the outstanding describe, whose result is dropped and
-- replayed once the queue drains.
  local raceTree = renderModel(profileModel({ active = { profile = "dawn" } }))
  update() update()
  assert(commands[#commands]:find("describe", 1, true), "the tick launched a describe")
  local staleDescribe = described
  selectWithOption(raceTree, "Default").props.onChange(2)
  equal(commands[#commands], Shell.command({ "prism", "context", "activate", "profile", "dusk" }))
  model = profileModel({ active = { profile = "dawn" } })
  staleDescribe({ exitCode = 0, stdout = "{}" })
  equal(selectWithOption(rendered, "Default").props.selectedIndex, 2,
    "an older describe must not overwrite the pick made after it launched")
  writeCallback({ exitCode = 0, stdout = "" })
  assert(commands[#commands]:find("describe", 1, true), "the invalidated describe is replayed once the write lands")
  model = profileModel({ active = { profile = "dusk" } })
  described({ exitCode = 0, stdout = "{}" })
  equal(selectWithOption(rendered, "Default").props.selectedIndex, 2)
end)()

-- Actions retain the slots represented by their rendered controls even when
-- the mutable model changes before the click, submit, or confirmation.
;(function()
local staleKeepModel = profileModel({ active = { profile = "dawn", wallpaper = { id = "w1", path = "/w" } } })
staleKeepModel.params[3].layer, staleKeepModel.params[3].held = "scratch", { "scratch" }
local staleKeepTree = renderModel(staleKeepModel)
staleKeepModel.active.profile = "dusk"
glyphButton(staleKeepTree, "photo-check").props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "wallpaper", "w1",
  "--expect-look", "profile:dawn", "--expect-wallpaper", "id:w1" }))

local staleNameModel = profileModel({ active = { profile = "dawn", wallpaper = { id = "w1", path = "/w" } } })
renderModel(staleNameModel)
glyphButton(rendered, "pencil").props.onClick()
local staleNameField = collect(rendered, "input")[1]
staleNameModel.active.profile = "dusk"
staleNameField.props.onSubmit("NewName")
equal(commands[#commands], Shell.command({ "prism", "context", "rename", "profile", "dawn", "NewName",
  "--expect-look", "profile:dawn", "--expect-wallpaper", "id:w1" }))

local staleSaveModel = profileModel({ active = { profile = "dawn", wallpaper = { id = "w1", path = "/w" } } })
renderModel(staleSaveModel)
glyphButton(rendered, "device-floppy").props.onClick()
local staleSaveField = collect(rendered, "input")[1]
staleSaveModel.active.profile = "dusk"
staleSaveField.props.onSubmit("NewName")
equal(commands[#commands], Shell.command({ "prism", "commit", "profile", "NewName",
  "--expect-look", "profile:dawn", "--expect-wallpaper", "id:w1" }))

local staleReplaceModel = profileModel({ active = { profile = "dawn", wallpaper = { id = "w1", path = "/w" } } })
renderModel(staleReplaceModel)
glyphButton(rendered, "device-floppy").props.onClick()
collect(rendered, "input")[1].props.onSubmit("dusk")
local staleReplace = textButton(rendered, "Replace")
staleReplaceModel.active.profile = nil
staleReplace.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "commit", "profile", "dusk",
  "--expect-look", "profile:dawn", "--expect-wallpaper", "id:w1" }))

local staleDeleteModel = profileModel({ active = { profile = "dawn", wallpaper = { id = "w1", path = "/w" } } })
renderModel(staleDeleteModel)
glyphButton(rendered, "trash").props.onClick()
local staleDelete = textButton(rendered, "Delete")
staleDeleteModel.active.profile = "dusk"
staleDelete.props.onClick()
equal(commands[#commands], Shell.command({ "prism", "context", "delete", "profile", "dawn",
  "--expect-look", "profile:dawn", "--expect-wallpaper", "id:w1" }))

local staleClearModel = layeredModel()
local staleClearTree = renderModel(staleClearModel)
staleClearModel.active.profile = "dusk"
glyphButton(staleClearTree, "eraser").props.onClick()
equal(commands[#commands], Shell.command({ "prism", "context", "clear", "wallpaper", "f8eb0556",
  "--expect-look", "default", "--expect-wallpaper", "id:f8eb0556" }))
end)()
