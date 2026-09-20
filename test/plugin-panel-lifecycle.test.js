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
  for _, kind in ipairs({"button", "column", "glyph", "label", "row", "scroll", "select", "separator", "slider", "spacer", "toggle"}) do
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
      slider.min, slider.max = props.min, props.max
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

  function host.complete(index)
    local call = assert(host.calls[index], "missing host call " .. index)
    call.callback({
      timedOut = false, exitCode = 0, stdout = "{}", stderr = "",
      stdoutTruncated = false, stderrTruncated = false,
    })
  end
  function host.open()
    env.onOpen({})
    host.complete(1)
  end
  function host.slider()
    return assert(host.sliders["glass.depth:slider"], "missing production slider")
  end
  function host.change(value)
    setSliderValue(host.slider(), value, false)
  end
  function host.release()
    host.slider().onDragEnd()
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
  function host.pickProfile()
    local function find(tree)
      if tree.kind == "select" and tree.props.options[1] == "Default" then return tree end
      for _, child in ipairs(tree.children or {}) do
        local found = find(child)
        if found then return found end
      end
    end
    assert(find(host.tree), "missing profile selector").props.onChange(1)
  end
  function host.editCount()
    local function find(tree)
      if tree.kind == "label" and (tree.props.text == "No edits" or tree.props.text == "1 edit") then
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
`;
  const result = spawnSync('lua', ['-', `${pluginDir}/`], { input: script, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
