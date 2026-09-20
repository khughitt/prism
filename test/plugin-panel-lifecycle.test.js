import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const pluginDir = fileURLToPath(new URL('../integrations/noctalia-plugin/', import.meta.url));

test('slider reconciliation leaves no drag while later real changes still work', () => {
  const script = String.raw`
local pluginDir = arg[1]
local hostEpsilon = 0.0001

local function newHost()
  local host = {
    calls = {},
    deferredReconcile = {},
    deferReconcileCallbacks = false,
    frameTicks = false,
    reconcileCallbacks = 0,
    sliders = {},
    suppressNextReconcileCallback = false,
  }
  local model = {active = {}, profiles = {"new"}, layers = {"default", "base", "profile", "wallpaper", "state", "scratch"},
    rack = {group = "Focus", devices = {
      {device = "noise", label = "Noise", category = "post", mix = "Noise", rows = {}, shared = {}, bypass = "glass.bypass.noise"},
    }}, params = {
    {
      key = "glass.enabled", value = true, default = true, layer = "default", fallback = true,
      effectiveDrag = "release", description = "",
      ui = {control = "toggle", group = "Title", order = 0, label = "Enabled"},
    },
    {
      key = "glass.depth", value = 100, default = 100, layer = "default", fallback = 100,
      effectiveDrag = "live", description = "", range = {0.1, 200},
      ui = {control = "slider", group = "Quick", order = 1, label = "Depth", step = 0.1, display = "normalized"},
    },
    {
      key = "glass.focusSplit", value = true, default = true, layer = "default", fallback = true,
      effectiveDrag = "release", description = "",
      ui = {control = "toggle", group = "Focus", order = 200, label = "Focus-state glass", header = true},
    },
    {
      key = "glass.noise", value = 0, default = 0, layer = "default", fallback = 0,
      effectiveDrag = "release", description = "", range = {0, 1},
      ui = {control = "slider", group = "Focus", order = 320, label = "Noise", step = 0.01, state = "focused", row = "Noise"},
    },
    {
      key = "glass.inactive.noise", value = 0.02, default = 0.02, layer = "default", fallback = 0.02,
      effectiveDrag = "release", description = "", range = {0, 1},
      ui = {control = "slider", group = "Focus", order = 321, label = "Unfocused noise", step = 0.01, state = "unfocused", row = "Noise"},
    },
    {
      key = "glass.bypass.noise", value = false, default = false, layer = "default", fallback = false,
      effectiveDrag = "release", description = "",
      ui = {control = "toggle", group = "Focus", order = 470, label = "Bypass noise"},
    },
  }}

  for _, param in ipairs(model.params) do
    param.held = param.layer == "default" and {} or {param.layer}
    if param.key == "glass.focusSplit" then param.neutralize = false
    elseif param.ui.control == "toggle" then param.neutral = false
    else param.neutral = 0 end
  end

  local function node(kind, props, children)
    return {kind = kind, props = props or {}, children = children or {}}
  end
  local ui = {}
  for _, kind in ipairs({"button", "column", "glyph", "input", "label", "row", "scroll", "select", "separator", "slider", "spacer", "toggle"}) do
    ui[kind] = function(props, children) return node(kind, props, children) end
  end

  local function setSliderValue(slider, value, fromReconcile)
    value = math.max(slider.min, math.min(slider.max, value))
    if math.abs(value - slider.value) < hostEpsilon then return end
    slider.value = value
    if not slider.onChange then return end
    if fromReconcile and host.suppressNextReconcileCallback then
      host.suppressNextReconcileCallback = false
      return
    end
    if fromReconcile then
      host.reconcileCallbacks = host.reconcileCallbacks + 1
      if host.deferReconcileCallbacks then
        host.deferredReconcile[#host.deferredReconcile + 1] = {slider = slider, value = value}
        return
      end
    end
    slider.onChange(value)
  end

  local function reconcile(tree)
    if type(tree) ~= "table" then return end
    if tree.kind == "slider" then
      local props = tree.props
      local slider = host.sliders[props.key]
      if not slider then
        slider = {value = props.min, lastScalar = nil, min = props.min, max = props.max}
        host.sliders[props.key] = slider
      end
      slider.min, slider.max, slider.enabled = props.min, props.max, props.enabled
      if slider.lastScalar == nil or slider.lastScalar ~= props.value then
        slider.lastScalar = props.value
        setSliderValue(slider, props.value, true)
      end
      slider.onChange = props.onChange
      slider.onDragEnd = props.onDragEnd
    end
    for _, child in ipairs(tree.children or {}) do reconcile(child) end
  end

  local panel = {}
  function panel.render(tree) host.tree = tree; reconcile(tree) end
  function panel.setNeedsFrameTick(value) host.frameTicks = value end
  function panel.setWantsSecondTicks() end

  local noctalia = {
    state = {get = function() return nil end},
    json = {decode = function() return model end},
    focusedOutputName = function() return "DP-1" end,
  }
  function noctalia.runAsync(command, callback)
    host.calls[#host.calls + 1] = {command = command, callback = callback}
    return true
  end

  local env = {noctalia = noctalia, panel = panel, ui = ui}
  setmetatable(env, {__index = _G})
  env.require = function(name)
    local path = name:gsub("^%./", "")
    return assert(loadfile(pluginDir .. path, "t", env))()
  end
  assert(loadfile(pluginDir .. "panel.luau", "t", env))()

  function host.complete(index, failure)
    local call = assert(host.calls[index], "missing host call " .. index)
    call.callback({
      timedOut = false, exitCode = failure and 1 or 0, stdout = "{}", stderr = failure or "",
      stdoutTruncated = false, stderrTruncated = false,
    })
  end
  function host.open()
    env.onOpen({})
    host.complete(1)
  end
  function host.slider(key)
    return assert(host.sliders[(key or "glass.depth") .. ":slider"], "missing production slider")
  end
  function host.change(value, key)
    setSliderValue(host.slider(key), value, false)
  end
  function host.release(key)
    host.slider(key).onDragEnd()
  end
  function host.switchProfile()
    local params = {}
    for index, param in ipairs(model.params) do
      local fresh = {}
      for key, value in pairs(param) do fresh[key] = value end
      params[index] = fresh
    end
    params[2].value, params[2].layer, params[2].held = 120, "profile", {"profile"}
    model = {active = {profile = "new"}, profiles = {"new"}, layers = model.layers, rack = model.rack, params = params}
  end
  function host.pickProfile(index)
    local function find(tree)
      if tree.kind == "select" and tree.props.options[1] == "Default" then return tree end
      for _, child in ipairs(tree.children or {}) do
        local found = find(child)
        if found then return found end
      end
    end
    local selector = assert(find(host.tree), "missing profile selector")
    assert(selector.props.enabled ~= false, "selection remains enabled")
    -- Native model updates and user same-option clicks are silent.
    index = index or 1
    if selector.props.selectedIndex ~= index then selector.props.onChange(index) end
  end
  function host.editCount()
    local function find(tree)
      if tree.kind == "label" and (tree.props.text == "No edits" or tree.props.text == "1 edit" or tree.props.text == "2 edits") then
        return tree.props.text
      end
      for _, child in ipairs(tree.children or {}) do
        local found = find(child)
        if found then return found end
      end
    end
    return find(host.tree)
  end
  function host.flushReconcile()
    local pending = host.deferredReconcile
    host.deferredReconcile = {}
    for _, event in ipairs(pending) do event.slider.onChange(event.value) end
  end
  function host.find(kind, prop, value)
    local function find(tree)
      if tree.kind == kind and tree.props[prop] == value then return tree end
      for _, child in ipairs(tree.children or {}) do
        local found = find(child)
        if found then return found end
      end
    end
    return find(host.tree)
  end
  function host.track(value, key)
    for _, param in ipairs(model.params) do
      if param.key == (key or "glass.depth") then return env.require("./presentation.luau").toSliderValue(value, param) end
    end
  end
  function host.pairModel(look, depth, noise, saved, scratch)
    local params = {}
    for index, param in ipairs(model.params) do
      local fresh = {}
      for key, value in pairs(param) do fresh[key] = value end
      fresh.layer, fresh.held = "default", {}
      params[index] = fresh
    end
    for _, index in ipairs({2, 4}) do
      local param = params[index]
      param.value = index == 2 and depth or noise
      param.fallback = param.value
      local edited = scratch == true or (type(scratch) == "table" and scratch[index])
      param.layer = edited and "scratch" or (saved and "wallpaper" or "profile")
      param.held = edited and {"profile", "scratch"} or (saved and {"profile", "wallpaper"} or {"profile"})
    end
    model = {active = {profile = look, wallpaper = {id = "w1", path = "/pics/W.jpg"}},
      profiles = {"Aurora", "Dark"}, layers = model.layers, rack = model.rack, params = params}
  end
  function host.tick() env.update(); env.update() end
  return host
end

local host = newHost()
host.open()
local slider = host.slider()
host.change(slider.value + 0.05)
host.release()
assert(host.reconcileCallbacks == 1, "canonical render did not synchronously invoke onChange exactly once")
assert(host.frameTicks == false, "synthetic corrected onChange left frame ticks enabled")
assert(host.calls[2].command == "'prism' 'set' 'glass.depth' '100.1'", "final write was not the canonical step")
host.complete(2)
assert(host.calls[3] and host.calls[3].command == "'prism' 'describe' '--json'", "drained final write did not refresh")
host.complete(3)
host.change(host.slider().value + 0.01)
assert(host.frameTicks == true, "subsequent genuine onChange did not start a normal interaction")

local backtrackHost = newHost()
backtrackHost.open()
local origin = backtrackHost.slider().value
backtrackHost.change(origin + 0.02)
backtrackHost.change(origin)
backtrackHost.release()
assert(backtrackHost.calls[2].command == "'prism' 'set' 'glass.depth' '100'",
  "dragging back to the starting value must keep the real release")

local silentHost = newHost()
silentHost.open()
local silentSlider = silentHost.slider()
silentHost.change(silentSlider.value + 0.05)
silentHost.suppressNextReconcileCallback = true
silentHost.release()
local expected = silentHost.slider().value
-- A no-op callback after a silent correction is harmless; a later changed value is real input.
silentHost.slider().value = expected + 0.01
silentHost.change(expected)
assert(silentHost.frameTicks == false, "a no-op callback started a drag")
silentHost.change(expected + 0.02)
assert(silentHost.frameTicks == true, "a later changed value did not start a real drag")

local profileHost = newHost()
profileHost.open()
assert(profileHost.editCount() == "No edits")
profileHost.deferReconcileCallbacks = true
profileHost.pickProfile()
assert(profileHost.calls[2].command == "'prism' 'context' 'activate' 'profile' 'new'")
profileHost.complete(2)
assert(profileHost.calls[3].command == "'prism' 'describe' '--json'")
profileHost.switchProfile()
profileHost.complete(3)
assert(#profileHost.deferredReconcile == 1, "the profile's changed slider emitted a native callback")
profileHost.flushReconcile()
assert(profileHost.editCount() == "No edits", "profile selection fabricated a scratch edit")
assert(profileHost.frameTicks == false, "profile selection left a synthetic drag active")
assert(#profileHost.calls == 3, "profile selection issued a synthetic set")
profileHost.tick()
assert(profileHost.calls[4] and profileHost.calls[4].command == "'prism' 'describe' '--json'",
  "a synthetic drag blocked the periodic refresh")

-- The open-panel pair round trip, through both native callback schedules.
for _, deferred in ipairs({false, true}) do
  local pairs = newHost()
  pairs.pairModel("Aurora", 100, 0.1, false)
  pairs.open()
  pairs.deferReconcileCallbacks = deferred
  assert(pairs.editCount() == "No edits")
  pairs.change(pairs.track(110)); pairs.release()
  pairs.change(0.2, "glass.noise"); pairs.release("glass.noise")
  assert(pairs.editCount() == "2 edits")
  pairs.pickProfile(2)
  assert(pairs.editCount() == "No edits", "selection must clear pending edits optimistically")
  pairs.complete(2); pairs.complete(3)
  assert(pairs.calls[4].command == "'prism' 'context' 'activate' 'profile' 'Dark'")
  pairs.complete(4)
  pairs.pairModel("Dark", 140, 0.3, true)
  pairs.complete(5); pairs.flushReconcile()
  assert(not pairs.frameTicks, "immediate reconciliation with the previous closure started a phantom drag")
  assert(pairs.editCount() == "No edits")
  assert(pairs.slider().value == pairs.track(140) and pairs.slider("glass.noise").value == 0.3)
  assert(pairs.find("label", "text", "2 for Dark + this wallpaper"))
  assert(#pairs.calls == 5, "model echoes cannot write scratch")
  pairs.pickProfile(1); pairs.complete(6)
  pairs.pairModel("Aurora", 110, 0.2, true)
  pairs.complete(7); pairs.flushReconcile()
  assert(pairs.editCount() == "No edits")
  assert(pairs.slider().value == pairs.track(110) and pairs.slider("glass.noise").value == 0.2)
  assert(pairs.find("label", "text", "2 for Aurora + this wallpaper"))
  pairs.find("button", "tooltip", "Show details").props.onClick()
  pairs.tick(); pairs.pairModel("Aurora", 110, 0.2, true); pairs.complete(8); pairs.flushReconcile()
  assert(pairs.editCount() == "No edits" and #pairs.calls == 8)
  assert(pairs.slider().value == pairs.track(110) and pairs.slider("glass.noise").value == 0.2)
  pairs.change(pairs.track(115)); pairs.release()
  assert(pairs.calls[9].command == "'prism' 'set' 'glass.depth' '115'")
  assert(pairs.editCount() == "1 edit", "a genuine move after selection must still work")
  for _, call in ipairs(pairs.calls) do assert(not call.command:find("'context' 'wallpaper'", 1, true)) end
end

-- A queued slider write is real incoming scratch; action closures from before
-- selection, fields, and confirmations must remain inert until accepted describe.
local pending = newHost()
pending.pairModel("Aurora", 100, 0.1, true, true)
pending.open()
local oldKeep = pending.find("button", "glyph", "bookmark")
local oldClear = pending.find("button", "glyph", "eraser")
pending.find("button", "glyph", "device-floppy").props.onClick()
local oldField = pending.find("input", "placeholder", "Profile name")
pending.pickProfile(2)
local function assertPending(host)
  for _, glyph in ipairs({"bookmark", "photo-check", "eraser", "device-floppy", "pencil", "trash"}) do
    local button = host.find("button", "glyph", glyph)
    assert(button and button.props.enabled == false, glyph .. " must stay disabled pending describe")
    button.props.onClick()
  end
end
assertPending(pending)
oldKeep.props.onClick(); oldClear.props.onClick(); oldField.props.onSubmit("Snapshot")
assert(#pending.calls == 2, "stale actions bypassed selectionPending")
assert(pending.slider().enabled ~= false, "sliders must remain enabled")
pending.change(pending.track(130)); pending.release()
assert(#pending.calls == 2, "slider writes must queue behind activation")
pending.complete(2)
assert(pending.calls[3].command == "'prism' 'set' 'glass.depth' '130'")
pending.complete(3)
assertPending(pending)
pending.complete(4, "describe unavailable")
assertPending(pending)
pending.tick()
pending.pairModel("Dark", 130, 0.3, false, {[2] = true})
pending.complete(5)
assert(pending.editCount() == "1 edit")
assert(pending.find("button", "glyph", "bookmark").props.enabled ~= false)

-- A failed selection restores true scratch and leaves the command error visible.
local failed = newHost()
failed.pairModel("Aurora", 100, 0.1, false, true); failed.open()
failed.pickProfile(2)
assert(failed.editCount() == "No edits")
failed.complete(2, "invalid incoming pair")
assertPending(failed)
failed.pairModel("Aurora", 100, 0.1, false, true); failed.complete(3)
assert(failed.editCount() == "2 edits")
assert(failed.find("label", "text", "invalid incoming pair"))

-- Failed Keep reconciles optimistically cleared flags from the unchanged store.
for _, glyph in ipairs({"bookmark", "photo-check"}) do
  local keep = newHost()
  keep.pairModel("Aurora", 100, 0.1, false, true); keep.open()
  keep.find("button", "glyph", glyph).props.onClick()
  assert(keep.editCount() == "No edits")
  keep.complete(2, "pair changed")
  keep.pairModel("Aurora", 100, 0.1, false, true); keep.complete(3)
  assert(keep.editCount() == "2 edits" and keep.find("label", "text", "pair changed"))
end

-- Captured destructive confirmations cannot act during pending selection.
for _, action in ipairs({"Delete", "Replace"}) do
  local confirm = newHost()
  confirm.pairModel("Aurora", 100, 0.1, true); confirm.open()
  if action == "Delete" then
    confirm.find("button", "glyph", "trash").props.onClick()
  else
    confirm.find("button", "glyph", "device-floppy").props.onClick()
    confirm.find("input", "placeholder", "Profile name").props.onSubmit("Dark")
  end
  local oldConfirm = confirm.find("button", "text", action)
  confirm.pickProfile(2); oldConfirm.props.onClick()
  assert(#confirm.calls == 2, "captured " .. action .. " bypassed pending selection")
end

-- Recovery restores preserved scratch on its accepted authoritative model too.
failed.pickProfile(0); failed.complete(4)
failed.pairModel(nil, 100, 0.1, false, true); failed.complete(5)
assert(failed.editCount() == "2 edits")

-- Delayed periodic describe cannot unlock actions; rapid selections replay once.
local rapid = newHost()
rapid.pairModel("Aurora", 100, 0.1, false, true); rapid.open(); rapid.tick()
rapid.pickProfile(2); rapid.pickProfile(1)
rapid.pairModel("Aurora", 100, 0.1, false, true); rapid.complete(2)
assertPending(rapid)
rapid.complete(3)
assert(rapid.calls[4].command == "'prism' 'context' 'activate' 'profile' 'Aurora'")
rapid.complete(4)
assertPending(rapid)
rapid.pairModel("Aurora", 100, 0.1, true); rapid.complete(5)
assert(#rapid.calls == 5 and rapid.editCount() == "No edits")

-- Save As also keeps actions blocked past drain, until its new ownership lands.
local saving = newHost()
saving.pairModel("Aurora", 100, 0.1, false); saving.open()
saving.find("button", "glyph", "device-floppy").props.onClick()
saving.find("input", "placeholder", "Profile name").props.onSubmit("Saved")
assertPending(saving); saving.complete(2); assertPending(saving)
saving.pairModel("Saved", 100, 0.1, false); saving.complete(3)
assert(saving.find("button", "glyph", "device-floppy").props.enabled ~= false)
`;
  const result = spawnSync('lua', ['-', `${pluginDir}/`], { input: script, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
