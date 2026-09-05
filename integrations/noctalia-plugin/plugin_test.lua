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
equal(Presentation.overriddenCount({ { overridden = true }, { overridden = false }, { overridden = true } }), 2)

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
local model = { target = "base", params = {
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
} }

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
for _, label in ipairs(collect(rendered, "label")) do labels[label.props.text or ""] = true end
assert(labels["Glass"] and labels["Focus"], "section headers missing")
assert(labels["Focused"] and labels["Unfocused"], "matrix column labels missing")
assert(labels["Blur"] and labels["Gaps"], "row labels missing")
assert(labels["Saturation"], "second matrix row label missing")
local sliderKeys = {}
for _, slider in ipairs(collect(rendered, "slider")) do sliderKeys[slider.props.key] = true end
assert(sliderKeys["glass.roughness:slider"] and sliderKeys["glass.inactive.roughness:slider"], "matrix sliders missing")
assert(sliderKeys["glass.saturation:slider"] and sliderKeys["glass.inactive.saturation:slider"], "saturation matrix sliders missing")
equal(#collect(rendered, "toggle"), 2, "title and Focus header toggles")

-- Reset means "remove the override in the write target": visible only where
-- layer == target, and it optimistically shows the fallback value.
local visibleResets = {}
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Remove override" and button.props.visible then
    visibleResets[#visibleResets + 1] = button
  end
end
equal(#visibleResets, 1, "exactly the base-overridden roughness row offers a reset")
local sectionResets = 0
for _, button in ipairs(collect(rendered, "button")) do
  if button.props.tooltip == "Reset section (1)" and button.props.visible then sectionResets = sectionResets + 1 end
end
equal(sectionResets, 1, "the Focus section counts its one override")
visibleResets[1].props.onClick()
equal(model.params[4].value, 0.1, "reset shows the fallback, not the default, before describe reconciles")
equal(model.params[4].overridden, false)
assert(commands[#commands]:find("unset", 1, true) and commands[#commands]:find("glass.roughness", 1, true),
  "reset enqueues prism unset for the row")

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
