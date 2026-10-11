local pluginDir, inputDir = arg[1], arg[2]
local snapshot = dofile(inputDir .. '/model.lua')
dofile(inputDir .. '/assert-shapes.lua')(snapshot)
local canonical = dofile(pluginDir .. '/test_encode.lua')
local function copyOf(value)
  if type(value) ~= 'table' then return value end
  local result = {}
  for key, held in pairs(value) do result[key] = copyOf(held) end
  return result
end
local function unhooked(fn, value)
  local hook, mask, count = debug.gethook()
  debug.sethook()
  local result = fn(value)
  if hook then debug.sethook(hook, mask, count) end
  return result
end
local rendered, renderCount, frameRequested, secondRequested = nil, 0, false, false
local described, pendingWrite, launchCount, decodeCount, encodeCount
launchCount, decodeCount, encodeCount = 0, 0, 0
local decodeModel = snapshot
local boundary = {}
local uiIndex = function(_, kind)
  local constructor = function(props, children)
    return {kind = kind, props = props or {}, children = children or {}}
  end
  boundary[constructor] = 'fake ui constructor'
  return constructor
end
boundary[uiIndex] = 'fake ui lookup'
local ui = setmetatable({}, {__index = uiIndex})
local panel = {
  render = function(tree) rendered = tree; renderCount = renderCount + 1 end,
  setNeedsFrameTick = function(value) frameRequested = value end,
  setWantsSecondTicks = function(value) secondRequested = value end,
}
for name, fn in pairs(panel) do boundary[fn] = 'fake panel.' .. name end
local noctalia = {json = {
  decode = function() decodeCount = decodeCount + 1; return unhooked(copyOf, decodeModel) end,
  encode = function(value) encodeCount = encodeCount + 1; return unhooked(canonical, value) end,
}, runAsync = function(command, callback)
  launchCount = launchCount + 1
  if command:find('describe', 1, true) then described = callback else pendingWrite = callback end
  return true
end}
boundary[noctalia.json.decode] = 'fake native json.decode'
boundary[noctalia.json.encode] = 'fake native json.encode'
boundary[noctalia.runAsync] = 'fake native runAsync'
local env = {noctalia = noctalia, panel = panel, ui = ui}
setmetatable(env, {__index = _G})
env.require = function(name) return assert(loadfile(pluginDir .. '/' .. name:gsub('^%./', ''), 't', env))() end
assert(loadfile(pluginDir .. '/panel.luau', 't', env))()
local function upvalue(fn, wanted)
  local i = 1
  while true do
    local name, value = debug.getupvalue(fn, i)
    assert(name, 'missing upvalue ' .. wanted)
    if name == wanted then return value end
    i = i + 1
  end
end
local render, state = upvalue(env.onFrameTick, 'render'), upvalue(env.onFrameTick, 'state')
local Retain = env.require('./retain.luau')
local function collect(tree, found)
  found = found or {}
  if type(tree) ~= 'table' then return found end
  if tree.kind then found[#found + 1] = tree end
  for _, child in ipairs(tree.children or {}) do collect(child, found) end
  return found
end
local function slider(key)
  for _, node in ipairs(collect(rendered)) do
    if node.kind == 'slider' and node.props.key == key .. ':slider' then return node end
  end
  error('slider absent ' .. key)
end
local function escaped(value)
  return tostring(value):gsub('[%z\1-\31%%]', function(c) return string.format('%%%02X', string.byte(c)) end)
end
local function output(...)
  local fields = {...}
  for i, field in ipairs(fields) do fields[i] = escaped(field) end
  io.write(table.concat(fields, '\t'), '\n')
end
local function fidelity(value, path)
  if type(value) ~= 'table' then
    output('LEAF', path, type(value), type(value) == 'number' and string.format('%.17g', value) or tostring(value))
  else
    for key, held in pairs(value) do fidelity(held, path .. '/' .. tostring(key)) end
  end
end
fidelity(snapshot, '')
local expectedKeys = dofile(inputDir .. '/expected-keys.lua')
assert(#snapshot.params == #expectedKeys)
for i, key in ipairs(expectedKeys) do assert(snapshot.params[i].key == key) end
local callbackCounts = {describe = 0, write = 0, frame = 0, release = 0}
local serial = 0
local function answer()
  serial = serial + 1
  return {timedOut = false, exitCode = 0, stdout = 'snapshot-' .. serial, stderr = '', stdoutTruncated = false, stderrTruncated = false}
end
local function validateOpen()
  assert(state.open and state.model ~= nil and not state.errorText and secondRequested)
  assert(#state.structure.rack.cards == #snapshot.rack.devices)
  for _, card in ipairs(state.structure.rack.cards) do assert(state.expanded[card.device] == true) end
end
local function measure(name, action, expectedRenders, expectedMisses)
  validateOpen()
  local memo = env.retainedMemo()
  memo.trace = {}
  local previousRenders, previousLaunch, previousDecode, previousEncode = renderCount, launchCount, decodeCount, encodeCount
  local total, counts = 0, {}
  debug.sethook(function(event)
    local info = debug.getinfo(2, 'fSln')
    if info.func == debug.sethook or info.func == debug.gethook then return end
    local category = boundary[info.func] and 'fake_host' or info.what == 'C' and 'stdlib_C' or info.source:sub(-5) == '.luau' and 'production_Lua' or 'experiment_Lua'
    local label = boundary[info.func] or info.name or '(anonymous)'
    local key = info.source .. ':' .. info.linedefined .. ':' .. category .. (info.what == 'C' and ':' .. label or '')
    local row = counts[key]
    if not row then row = {source = info.source, line = info.linedefined, category = category, label = label, count = 0}; counts[key] = row end
    row.count = row.count + 1; total = total + 1
  end, 'c')
  action()
  debug.sethook()
  assert(renderCount - previousRenders == expectedRenders, name .. ' render count mismatch')
  if expectedMisses ~= nil then assert(#memo.trace == expectedMisses, name .. ' memo misses mismatch') end
  if expectedRenders > 0 then assert(#collect(rendered) > 0 and not rendered.children[1].props.visible) end
  validateOpen()
  output('PHASE', name, total, renderCount - previousRenders, #memo.trace,
    launchCount - previousLaunch, decodeCount - previousDecode, encodeCount - previousEncode)
  for _, row in pairs(counts) do output('CALL', name, row.category, row.source, row.line, row.count, row.label) end
  for _, id in ipairs(memo.trace) do output('MISS', name, id) end
  memo.trace = nil
end

env.onOpen({})
assert(described and renderCount == 1)
callbackCounts.describe = callbackCounts.describe + 1; described(answer())
assert(renderCount == 1 and frameRequested and state.renderPending)
callbackCounts.frame = callbackCounts.frame + 1; env.onFrameTick(16)
local collapsedButtons = {}
for _, node in ipairs(collect(rendered)) do
  if node.kind == 'button' and node.props.tooltip == 'Show details' then collapsedButtons[#collapsedButtons + 1] = node end
end
assert(#collapsedButtons == #snapshot.rack.devices, 'not every card has an expansion button')
for _, button in ipairs(collapsedButtons) do button.props.onClick() end
validateOpen()
-- Like the live cold gesture: freshly decoded entries, empty retained memo.
local expandedModel = state.model
callbackCounts.describe = callbackCounts.describe + 1; described(answer())
assert(state.model ~= expandedModel and state.renderPending)
Retain.clear(env.retainedMemo())
measure('expandedColdRender', render, 1, 142)
assert(#env.retainedMemo().entries > 0 or next(env.retainedMemo().entries) ~= nil)
measure('steadyWarmRender', render, 1, 0)
local dragged = slider('glass.inactive.roughness')
local before = renderCount
local newValue = dragged.props.min + (dragged.props.max - dragged.props.min) * 0.37
assert(math.abs(newValue - dragged.props.value) > 0.0001)
dragged.props.onChange(newValue)
assert(renderCount == before and state.drag and state.drag.dirty and frameRequested)
measure('dirtyDragTick', function() callbackCounts.frame = callbackCounts.frame + 1; env.onFrameTick(16) end, 1)
assert(not state.drag.dirty)
local previousEnqueued = state.enqueued
measure('release', function() callbackCounts.release = callbackCounts.release + 1; dragged.props.onDragEnd() end, 1, 0)
assert(state.drag == nil and state.enqueued == previousEnqueued + 1 and pendingWrite)
measure('writeCompletion', function() callbackCounts.write = callbackCounts.write + 1; pendingWrite(answer()) end, 1, 0)
assert(state.queue.inFlight == nil and described)
-- Fresh describe entries reflect the write and one additional changed value.
decodeModel = copyOf(snapshot)
for _, param in ipairs(decodeModel.params) do
  if param.key == 'glass.inactive.roughness' then
    param.value = state.structure.byKey[param.key].value
    if not (function() for _, layer in ipairs(param.held) do if layer == 'scratch' then return true end end end)() then param.held[#param.held + 1] = 'scratch' end
  elseif param.key == 'compositor.gaps' then
    param.value = param.value == param.range[2] and param.range[1] or param.value + param.ui.step
  end
end
local priorModel = state.model
measure('changedDescribe', function() callbackCounts.describe = callbackCounts.describe + 1; described(answer()) end, 0, 0)
assert(state.model ~= priorModel and state.renderPending and frameRequested)
measure('deferredDescribeRender', function() callbackCounts.frame = callbackCounts.frame + 1; env.onFrameTick(16) end, 1)
assert(not state.renderPending and state.model.params[1].key == snapshot.params[1].key)
output('CHECK', 'param_count', #snapshot.params)
output('CHECK', 'all_cards_expanded', #state.structure.rack.cards)
output('CHECK', 'final_render_count', renderCount)

assert(callbackCounts.describe == 3 and callbackCounts.write == 1 and callbackCounts.frame == 3 and callbackCounts.release == 1)
assert(launchCount == 3 and renderCount == 20)
for name, count in pairs(callbackCounts) do output('CHECK', name .. '_callback_count', count) end
output('CHECK', 'fake_launch_count', launchCount)
