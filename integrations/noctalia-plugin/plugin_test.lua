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
local function preview_show(output, side, diagnosticBackground)
  return { verb = "preview-show", output = output, side = side, diagnosticBackground = diagnosticBackground }
end
local function preview_hide() return { verb = "preview-hide" } end

local function drain(state)
  local ran = {}
  while true do
    local result = Queue.finish(state)
    state = result.state
    if result.drained then return ran end
    ran[#ran + 1] = result.launch
  end
end

-- Presentation golden vectors.
local params = {
  { key = "title.enabled", ui = { control = "toggle", group = "Title", order = 0 } },
  { key = "b.two", ui = { control = "toggle", group = "Beta", order = 20 } },
  { key = "q.one", ui = { control = "slider", group = "Quick", order = 50 } },
  { key = "a.one", ui = { control = "toggle", group = "Alpha", order = 10 } },
  { key = "hidden.one", ui = { control = "none", group = "CLI" } },
  { key = "b.one", ui = { control = "toggle", group = "Beta", order = 15 } },
}
equal(Presentation.titleParam(params).key, "title.enabled")
local groups = Presentation.groupParams(params)
equal(#groups, 3)
equal(groups[1], { name = "Quick", params = { params[3] } })
equal(groups[2], { name = "Alpha", params = { params[4] } })
equal(groups[3], { name = "Beta", params = { params[6], params[2] } })
equal(Presentation.modifiedCount({ { modified = true }, { modified = false }, { modified = true } }), 2)

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
state = Queue.enqueue(result.state, preview_hide()).state
state = Queue.enqueue(state, sample("a.x", 2)).state
equal({ result.launch, table.unpack(drain(state)) }, { release("a.x", 1), preview_hide(), sample("a.x", 2) })

equal(Queue.argvFor(sample("a.x", 0.5)), { "prism", "set", "a.x", "0.5" })
equal(Queue.argvFor(release("a.x", 0.5)), { "prism", "set", "a.x", "0.5" })
equal(Queue.argvFor(unset("a.x")), { "prism", "unset", "a.x" })
equal(Queue.argvFor(preview_show("DP-1", "right", true)), {
  "qs", "-c", "niri-glass", "ipc", "call", "prismGlass", "showPreview", "DP-1", "left", "true",
})
equal(Queue.argvFor(preview_hide()), { "qs", "-c", "niri-glass", "ipc", "call", "prismGlass", "hidePreview" })
equal(Queue.affectsParams(sample("a.x", 1)), true)
equal(Queue.affectsParams(release("a.x", 1)), true)
equal(Queue.affectsParams(unset("a.x")), true)
equal(Queue.affectsParams(preview_show("DP-1", "right", false)), false)
equal(Queue.affectsParams(preview_hide()), false)
equal(Queue.shouldRefresh(false, preview_hide()), false)
equal(Queue.shouldRefresh(true, release("a.x", 1)), true)
equal(Queue.shouldRefresh(true, preview_hide()), true)
equal(Queue.shouldRefresh(true, sample("a.x", 1)), false)
equal(Queue.shouldRefresh(true, sample("a.x", 2)), false)
equal(Queue.isSample(sample("a.x", 0.5)), true)
equal(Queue.isSample(release("a.x", 0.5)), false)
equal(Queue.isSample(unset("a.x")), false)

equal(Shell.quote("a'b"), "'a'\"'\"'b'")
equal(Shell.command({ "prism", "set", "name with space", "a'b" }), "'prism' 'set' 'name with space' 'a'\"'\"'b'")
