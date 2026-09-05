import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const pluginDir = fileURLToPath(new URL('../integrations/noctalia-plugin/', import.meta.url));

test('canonical correction ignores only the synchronous reconciler callback', () => {
  const script = String.raw`
local pluginDir = arg[1]
local hostEpsilon = 0.0001

local function newHost()
  local host = {
    calls = {},
    frameTicks = false,
    reconcileCallbacks = 0,
    sliders = {},
    suppressNextReconcileCallback = false,
  }
  local model = {target = "base", params = {
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
  }}

  local function node(kind, props, children)
    return {kind = kind, props = props or {}, children = children or {}}
  end
  local ui = {}
  for _, kind in ipairs({"button", "column", "label", "row", "scroll", "select", "separator", "slider", "spacer", "toggle"}) do
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
    if fromReconcile then host.reconcileCallbacks = host.reconcileCallbacks + 1 end
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
  function panel.render(tree) reconcile(tree) end
  function panel.setNeedsFrameTick(value) host.frameTicks = value end

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

local silentHost = newHost()
silentHost.open()
local silentSlider = silentHost.slider()
silentHost.change(silentSlider.value + 0.05)
silentHost.suppressNextReconcileCallback = true
silentHost.release()
local expected = silentHost.slider().value
-- Return through the same value later, when a stale suppression would swallow genuine input.
silentHost.slider().value = expected + 0.01
silentHost.change(expected)
assert(silentHost.frameTicks == true, "callback suppression survived a render that emitted no callback")
`;
  const result = spawnSync('lua', ['-', `${pluginDir}/`], { input: script, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
