local Presentation = require("./presentation.luau")
local Queue = require("./queue.luau")
local Shell = require("./shell.luau")

local state = {
  model = nil,
  selectionPending = false,
  errorText = nil,
  queue = Queue.new(),
  batchAffectsParams = false,
  refreshPending = false,
  describeInvalidated = false,
  refreshAfterDrag = false,
  drag = nil,
  -- The one name field, shared by save and rename: {mode, text}, or nil.
  naming = nil,
  -- A destructive action waiting for its answer: {kind, name}, or nil.
  confirm = nil,
  errorSticky = false,
  ticks = 0,
  sampleElapsedMs = 0,
  renderedSliderCorrection = nil,
  expanded = {},
  -- The keyboard's current slider, by key, and the sliders in the order the
  -- last render drew them. Keyed so a refresh keeps it; rebuilt per render so
  -- a collapsed card simply drops out of the walk.
  focus = nil,
  focusOrder = {},
  -- Writes enqueued so far, and the describe output and write count the model
  -- on screen came from: an identical answer with no write since changes nothing.
  enqueued = 0,
  shownStdout = nil,
  shownEnqueued = 0,
}

local describeRunning = false
-- Noctalia Slider::setValue suppresses changes smaller than this epsilon.
local hostSliderEpsilon = 0.0001
-- Fixed row geometry. Every row reserves the same widths whether or not its
-- parameter has a value to show, so nothing moves when a value crosses its
-- default or a control changes state.
local labelColumnWidth = 150
local headColumnWidth = 190
local valueColumnWidth = 56
local cardPadding = 6
local inertOpacity = 0.35
-- A control that is unavailable, or a bypassed card, dims without going inert.
local dimOpacity = 0.55
local render
local refresh
local enqueue
local launch
local gates = {}
local attached = {}

local function gateOf(param) return gates[param.key] or "control" end
-- A read-only color is drawn beside its select, never as a row of its own.
local function rowHidden(param) return gateOf(param) ~= "control" end

local function run(argv, callback)
  return noctalia.runAsync(Shell.command(argv), callback, 10000)
end

local function trimmed(value)
  return tostring(value or ""):match("^%s*(.-)%s*$")
end

local function resultError(result, label)
  if result.timedOut then return label .. " timed out" end
  if result.exitCode ~= 0 then
    local stderr = trimmed(result.stderr)
    return stderr ~= "" and stderr or label .. " exited " .. tostring(result.exitCode)
  end
  if result.stdoutTruncated or result.stderrTruncated then return label .. " output was truncated" end
  return nil
end

local function denseStringArray(value)
  if type(value) ~= "table" then return false end
  local count = 0
  for _ in pairs(value) do count = count + 1 end
  if count ~= #value then return false end
  for index = 1, #value do
    if type(value[index]) ~= "string" or value[index] == "" then return false end
  end
  return true
end

local function visibleParamError(param, index)
  if type(param.key) ~= "string" or param.key == "" then return "parameter " .. index .. " has no key" end
  if param.value == nil then return param.key .. " has no value" end
  if param.default == nil then return param.key .. " has no default" end
  if type(param.layer) ~= "string" then return param.key .. " has no layer" end
  if param.fallback == nil then return param.key .. " has no fallback" end
  if not denseStringArray(param.held) then return param.key .. " has no held layers" end
  if (param.neutral ~= nil) == (param.neutralize ~= nil) then
    return param.key .. " must declare exactly one of neutral and neutralize"
  end
  if param.neutralize ~= nil and param.neutralize ~= false then
    return param.key .. " has invalid neutralize value"
  end
  if type(param.ui.group) ~= "string" or param.ui.group == "" then return param.key .. " has no UI group" end
  if type(param.ui.order) ~= "number" then return param.key .. " has no UI order" end
  if param.effectiveDrag ~= nil and param.effectiveDrag ~= "live" and param.effectiveDrag ~= "release" then
    return param.key .. " has invalid drag behavior"
  end
  if param.effective ~= nil and (type(param.effective) ~= "table"
    or type(param.effective.value) ~= "string" or type(param.effective.from) ~= "string") then
    return param.key .. " has a malformed effective color"
  end
  if param.ui.control == "slider" then
    if type(param.range) ~= "table" or type(param.range[1]) ~= "number" or type(param.range[2]) ~= "number"
      or type(param.ui.step) ~= "number" or param.ui.step <= 0 then
      return param.key .. " has invalid slider metadata"
    end
  elseif param.ui.control == "select" then
    if type(param.values) ~= "table" then return param.key .. " has no select values" end
  elseif param.ui.control ~= "toggle" and param.ui.control ~= "color" then
    return param.key .. " has unsupported control " .. tostring(param.ui.control)
  end
  return nil
end

-- The order is a ranking, so it has to be a dense list of distinct names. A
-- hole, a stray key, a non-string entry, or a repeat breaks provenance.
local function layerOrderError(layers)
  if type(layers) ~= "table" then return "prism describe returned no layer order" end
  if next(layers) == nil then return "prism describe returned no layer order" end
  if not denseStringArray(layers) then return "prism describe returned a malformed layer order" end
  local seen = {}
  for _, name in ipairs(layers) do
    if seen[name] then return "prism describe returned a malformed layer order" end
    seen[name] = true
  end
  return nil
end

-- No saved profiles is an empty list, not an absent field: an absent one would
-- draw an empty selector that looks like an answer.
local function profileListError(profiles)
  if type(profiles) ~= "table" then return "prism describe returned no profile list" end
  if not denseStringArray(profiles) then return "prism describe returned a malformed profile list" end
  return nil
end

local function validateModel(model)
  if type(model) ~= "table" or type(model.params) ~= "table" or #model.params == 0 then
    return "prism describe returned an invalid parameter array"
  end
  for key in pairs(model.params) do
    if type(key) ~= "number" or key < 1 or key > #model.params or key % 1 ~= 0 then
      return "prism describe returned an invalid parameter array"
    end
  end
  local orderError = layerOrderError(model.layers)
  if orderError then return orderError end
  local profileError = profileListError(model.profiles)
  if profileError then return profileError end
  -- describe always states the active slots, empty or not, so an absent object
  -- is a broken contract rather than "nothing is active".
  if type(model.active) ~= "table" then return "prism describe returned no active contexts" end
  local ranks = {}
  for index, name in ipairs(model.layers) do ranks[name] = index end
  for index, param in ipairs(model.params) do
    if type(param) ~= "table" or type(param.ui) ~= "table" or type(param.ui.control) ~= "string" then
      return "parameter " .. index .. " has invalid UI metadata"
    end
    if param.ui.control ~= "none" then
      local message = visibleParamError(param, index)
      if message then return message end
    end
    -- Every parameter is ranked, not only the drawn ones: a CLI-only parameter
    -- on an unknown layer is the same broken contract, just quieter. This sits
    -- after the visible checks so a drawn parameter missing `layer` outright
    -- still reports that, which is the older-CLI symptom the contract note
    -- names.
    if ranks[param.layer] == nil then
      return tostring(param.key) .. " reports layer " .. tostring(param.layer) .. " outside the layer order"
    end
    if not denseStringArray(param.held) then return tostring(param.key) .. " has no held layers" end
    for _, name in ipairs(param.held) do
      if ranks[name] == nil then
        return tostring(param.key) .. " is held in " .. tostring(name) .. ", outside the layer order"
      end
    end
  end
  local gatesOk, gatesError = pcall(Presentation.gates, model.params)
  if not gatesOk then return tostring(gatesError) end
  local titleOk, titleError = pcall(Presentation.titleParam, model.params)
  if not titleOk then return tostring(titleError) end
  local rackOk, rackError = pcall(Presentation.rack, model)
  if not rackOk then return tostring(rackError) end
  local sectionsOk, sectionsError = pcall(Presentation.sections, model.params, model.rack.group)
  if not sectionsOk then return tostring(sectionsError) end
  return nil
end

local function finishRefresh()
  if state.drag or state.queue.inFlight ~= nil then return end
  if state.refreshPending or state.refreshAfterDrag then
    state.refreshPending = false
    state.refreshAfterDrag = false
    refresh()
  end
end

-- Edited means scratch holds the key. Nothing is ever shadowed: scratch is
-- the topmost layer, so every write shows. A row the wallpaper nudges is
-- marked so the user can see which rows a wallpaper changes.
local function markEdits(model)
  for _, param in ipairs(model.params) do
    local visible = param.ui.control ~= "none"
    param.edited = visible and Presentation.holds(param, "scratch")
    param.fromWallpaper = visible and param.layer == "wallpaper"
  end
end

local function described(result)
  describeRunning = false
  local invalidated = state.describeInvalidated or state.drag ~= nil
  state.describeInvalidated = false
  local message = resultError(result, "prism describe")
  -- The two-second re-read almost always answers what is already on screen.
  -- Decoding and rebuilding the tree for it costs most of the host's 25 ms
  -- per-callback CPU budget, so that answer is a no-op.
  if not message and not invalidated and state.errorText == nil
    and result.stdout == state.shownStdout and state.enqueued == state.shownEnqueued then
    finishRefresh()
    return
  end
  local model
  if not message then
    local decodeError
    model, decodeError = noctalia.json.decode(result.stdout)
    if model == nil then message = decodeError or "prism describe returned invalid JSON" end
  end
  if not message then message = validateModel(model) end

  if message then state.errorText = message end
  if invalidated then
    state.refreshAfterDrag = true
  elseif not message then
    markEdits(model)
    state.model = model
    state.shownStdout = result.stdout
    state.shownEnqueued = state.enqueued
    state.selectionPending = false
    -- A command's error outlives the refresh it triggers. Clearing it here
    -- would flash the reason a profile would not load past the user and leave
    -- the panel looking fine.
    if not state.errorSticky then state.errorText = nil end
  end
  render()
  finishRefresh()
end

refresh = function()
  -- A reopen must not snapshot an outstanding write; replay once after drain.
  if describeRunning or state.queue.inFlight ~= nil then
    state.refreshPending = true
    return
  end
  describeRunning = true
  state.describeInvalidated = state.drag ~= nil
  -- No render here: every caller renders once itself, and a second full render
  -- in the same callback overran the host's CPU budget and disabled the panel.
  if not run({"prism", "describe", "--json"}, described) then
    describeRunning = false
    state.errorText = "Failed to launch prism describe"
    render()
    finishRefresh()
  end
end

local function finishWrite(result, launchError)
  local message = launchError or resultError(result, "Prism command")
  if message then
    state.errorText = message
    state.errorSticky = true
  end

  local completed = state.queue.inFlight
  local shouldRefresh = Queue.shouldRefresh(state.batchAffectsParams, completed)
  local next = Queue.finish(state.queue)
  state.queue = next.state
  if next.launch then
    launch(next.launch)
  elseif next.drained then
    state.batchAffectsParams = false
    if shouldRefresh then state.refreshAfterDrag = true end
    finishRefresh()
  end
  render()
end

launch = function(item)
  if not run(Queue.argvFor(item), function(result) finishWrite(result, nil) end) then
    finishWrite(nil, "Failed to launch Prism command")
  end
end

enqueue = function(item)
  state.enqueued = state.enqueued + 1
  state.batchAffectsParams = state.batchAffectsParams or Queue.affectsParams(item)
  if state.queue.inFlight == nil then
    state.errorText = nil
    state.errorSticky = false
  end
  -- A describe already in flight would land over this write's optimistic
  -- change. Mark it stale the way beginDrag does; described() then keeps the
  -- current model and finishRefresh replays once the queue drains.
  if describeRunning then state.describeInvalidated = true end
  local result = Queue.enqueue(state.queue, item)
  state.queue = result.state
  if result.launch then launch(result.launch) end
end

local function updateParam(param, value)
  param.value = value
  param.edited = true
end

local function writeParam(param, value)
  updateParam(param, value)
  enqueue({verb = "set", key = param.key, value = value, sample = false})
  render()
end

local function unsetParam(param)
  param.value = param.fallback
  param.edited = false
  enqueue({verb = "unset", key = param.key})
  render()
end

local function resetAction(mode, group, params)
  return function()
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

-- A commit keeps every value and moves the edits into a persisted layer, so
-- the optimistic change is only that nothing is edited any more.
local function commitAction(item, params)
  item.expected = item.expected or Queue.captureSlots(state.model)
  return function()
    if state.selectionPending then return end
    for _, param in ipairs(params) do param.edited = false end
    if item.destination == "profile" and item.target ~= nil then
      state.selectionPending = true
      if not Presentation.profileExists(state.model, item.target) then
        state.model.profiles[#state.model.profiles + 1] = item.target
        table.sort(state.model.profiles)
      end
      state.model.active.profile = item.target
    end
    enqueue(item)
    render()
  end
end

local function beginDrag(param, sliderValue)
  -- Synchronous reconciliation can call the previous render's closure.
  for _, current in ipairs(state.model.params) do
    if current.key == param.key then param = current; break end
  end
  sliderValue = tonumber(sliderValue)
  local correction = state.renderedSliderCorrection
  if correction and correction.key == param.key
    and math.abs(sliderValue - correction.expectedPresentationValue) < hostSliderEpsilon then
    state.renderedSliderCorrection = nil
    return
  end
  -- Noctalia emits onChange when reconciliation applies the value we rendered.
  if math.abs(sliderValue - Presentation.toSliderValue(param.value, param)) < hostSliderEpsilon then return end
  local canonical = Presentation.canonicalFromSlider(sliderValue, param)
  if not state.drag or state.drag.key ~= param.key then
    state.drag = {
      key = param.key,
      value = canonical,
      sliderValue = sliderValue,
      originValue = param.value,
      pendingSample = nil,
      dirty = false,
    }
    state.sampleElapsedMs = 0
    if describeRunning then state.describeInvalidated = true end
    -- Every drag needs the tick, not only live-mode ones: it is what throttles
    -- the render below to one per frame instead of one per pointer-move event.
    panel.setNeedsFrameTick(true)
  else
    state.drag.value = canonical
    state.drag.sliderValue = sliderValue
  end
  updateParam(param, canonical)
  if param.effectiveDrag == "live" then
    state.drag.pendingSample = {verb = "set", key = param.key, value = canonical, sample = true}
  elseif param.effectiveDrag == "release" then
    state.drag.pendingSample = nil
  end
  -- A native slider can fire onChange far faster than the panel can render a
  -- full tree of sections and rack cards; rendering here on every event once
  -- blew the host's per-callback CPU budget and got the panel disabled.
  -- onFrameTick flushes this at most once per rendered frame instead.
  state.drag.dirty = true
end

local function endDrag(param)
  local drag = state.drag
  if not drag or drag.key ~= param.key then return end
  -- ponytail: A pointer release after exactly Noctalia's 5% step is indistinguishable until it exposes interaction source.
  local canonical = Presentation.canonicalFromSliderStep(drag.sliderValue, drag.originValue, param)
  local correctedSliderValue
  if canonical ~= nil then
    drag.value = canonical
    updateParam(param, canonical)
    correctedSliderValue = Presentation.toSliderValue(canonical, param)
  end
  state.drag = nil
  state.sampleElapsedMs = 0
  panel.setNeedsFrameTick(false)
  enqueue({verb = "set", key = param.key, value = drag.value, sample = false})
  if correctedSliderValue ~= nil then
    state.renderedSliderCorrection = {key = param.key, expectedPresentationValue = correctedSliderValue}
  end
  render()
  state.renderedSliderCorrection = nil
end

local function selectIndex(param)
  for index, value in ipairs(param.values) do
    if value == param.value then return index - 1 end
  end
  return 0
end

local function selectOptions(param)
  local options = {}
  for index, value in ipairs(param.values) do options[index] = tostring(value) end
  return options
end

-- Always in the tree so the slider keeps its geometry during a drag.
local function resetButton(param, available)
  return ui.button({
    glyph = "restore",
    variant = "ghost",
    controlSize = "sm",
    opacity = param.edited and 1.0 or inertOpacity,
    tooltip = param.edited and "Revert edit" or "Not edited",
    enabled = available,
    onClick = function() if param.edited then unsetParam(param) end end,
  })
end

local function nativeControl(param, available)
  if param.ui.control == "toggle" then
    return ui.toggle({
      checked = param.value == true,
      enabled = available,
      onChange = function(value) writeParam(param, value == true or value == "true") end,
    })
  end
  if param.ui.control == "select" then
    return ui.select({
      options = selectOptions(param),
      selectedIndex = selectIndex(param),
      controlSize = "sm",
      enabled = available,
      onChange = function(index)
        local value = param.values[(tonumber(index) or -1) + 1]
        if value == nil then
          state.errorText = "Prism returned an invalid selection index"
          render()
          return
        end
        writeParam(param, value)
      end,
    })
  end
  if param.ui.control == "slider" then
    return ui.slider({
      key = param.key .. ":slider",
      min = Presentation.sliderFrom(param),
      max = Presentation.sliderTo(param),
      step = Presentation.sliderStep(param),
      value = Presentation.toSliderValue(param.value, param),
      controlSize = "sm",
      flexGrow = 1,
      enabled = available,
      onChange = function(value) beginDrag(param, value) end,
      onDragEnd = function() endDrag(param) end,
    })
  end
  return ui.button({
    text = tostring(param.value),
    glyph = "palette",
    controlSize = "sm",
    enabled = available,
    onClick = function()
      if not noctalia.openColorPicker(tostring(param.value), function(color)
        if color ~= nil then writeParam(param, color) end
      end) then
        state.errorText = "Failed to open the color picker"
        render()
      end
    end,
  })
end

-- Only buttons expose native tooltips, and their hit area needs a handler.
-- Card titles toggle details; ordinary parameter names only expose hover help.
local function nameButton(text, param, onClick)
  return ui.button({
    key = param.key .. ":name", text = text,
    variant = "ghost", controlSize = "sm", contentAlign = "start", flexGrow = 1,
    tooltip = param.description or param.key,
    onClick = onClick or function() end,
  })
end

-- A wallpaper's nudge says where a value comes from, and Live is the mildest
-- of the three hints.
local function rowHint(params)
  for _, param in ipairs(params) do
    if param.effectiveDrag == nil then
      return ui.label({text = "Unavailable", fontSize = 11, color = "error"})
    end
  end
  for _, param in ipairs(params) do
    if param.fromWallpaper then
      return ui.label({text = "wallpaper", fontSize = 11, color = "on_surface_variant"})
    end
  end
  for _, param in ipairs(params) do
    if param.effectiveDrag == "live" then
      return ui.label({text = "Live", fontSize = 11, color = "on_surface_variant"})
    end
  end
  return nil
end

-- The leading column reserves one fixed span for the name and its help
-- target, shared by ordinary rows, cards, and the matrix header. Sized
-- spacers need explicit zero growth: the native spacer defaults to grow=1.
local function headCell(text, param, indent)
  indent = indent or 0
  local children = {}
  if indent > 0 then children[#children + 1] = ui.spacer({width = indent, flexGrow = 0}) end
  children[#children + 1] = nameButton(text, param)
  return ui.row({width = headColumnWidth, gap = 6, align = "center", opacity = 1.0}, children)
end

-- A color its source supplies: the swatch shows what the sink installed, and a
-- lock stands beside the select that chose the source. Only buttons carry a
-- tooltip, so the lock is an enabled button whose click does nothing.
local function sourceSwatch(color)
  return ui.box({
    width = 28, height = 16, radius = 4,
    fill = color.effective ~= nil and color.effective.value or nil,
    border = "on_surface_variant/0.4",
    borderWidth = 1,
  })
end

local function sourceLock(color)
  local effective = color.effective
  local tooltip = effective ~= nil
    and ("From " .. effective.from .. ", as of the last apply. Select the manual source to edit.")
    or "No rendered color: the tint is bypassed, glass is off, or prism has not applied this source yet."
  return ui.button({glyph = "lock", variant = "ghost", controlSize = "sm", tooltip = tooltip, onClick = function() end})
end

-- The card head's mix row cannot be hidden, so a read-only mix color keeps its
-- own swatch and lock in place of the picker.
local function readOnlyCell(param, grow)
  return ui.row({key = param.key, gap = 6, align = "center", flexGrow = grow, opacity = 1.0}, {
    ui.row({width = valueColumnWidth, justify = "end", align = "center"}, {sourceSwatch(param)}),
    sourceLock(param),
    ui.spacer({flexGrow = 1}),
  })
end

-- A control cell: formatted value, native control, and reset. Shared by the
-- single rows and both halves of a matrix row.
local function controlCell(param, grow)
  if gateOf(param) == "effective" then return readOnlyCell(param, grow) end
  local color = attached[param.key]
  local available = param.effectiveDrag ~= nil
  local formattedValue = param.ui.control == "slider" and Presentation.formatValue(param.value, param) or nil
  local focused = false
  if param.ui.control == "slider" then
    state.focusOrder[#state.focusOrder + 1] = param
    focused = state.focus == param.key
  end
  local children = {
    -- The native label ignores width. Its container reserves the value column,
    -- even when empty, so value length and control kind never shift the track.
    -- A color cell has no text there: the swatch is the value, and its border
    -- keeps a pale tint visible on a pale surface.
    ui.row({width = valueColumnWidth, justify = "end", align = "center"}, {
      color ~= nil and sourceSwatch(color) or param.ui.control == "color" and ui.box({
        width = 28, height = 16, radius = 4,
        fill = tostring(param.value),
        border = "on_surface_variant/0.4",
        borderWidth = 1,
      }) or ui.label({text = formattedValue or "", fontSize = 12, color = "on_surface_variant", maxWidth = valueColumnWidth, maxLines = 1, textAlign = "end"}),
    }),
    nativeControl(param, available),
  }
  if color ~= nil then children[#children + 1] = sourceLock(color) end
  -- Sliders absorb the cell's slack themselves; the other controls keep their
  -- natural width, so the slack goes here to hold the reset at the right edge.
  if param.ui.control ~= "slider" then children[#children + 1] = ui.spacer({flexGrow = 1}) end
  children[#children + 1] = resetButton(param, available)
  return ui.row({
    key = param.key, gap = 6, align = "center", flexGrow = grow, radius = 6,
    fill = focused and "primary/0.12" or nil,
    opacity = 1.0,
  }, children)
end

local function paramRow(key, cells, hint)
  local children = {ui.row({gap = 8, align = "center"}, cells)}
  if hint then children[#children + 1] = ui.row({gap = 8, align = "center", justify = "end"}, {hint}) end
  return ui.column({key = key, gap = 2, paddingV = 2}, children)
end

-- A subgroup's name heads its rows; a name may say whom the rows reach.
local function subgroupHeading(group, name)
  return ui.row({key = group .. ":" .. name .. ":subgroup", paddingV = 2}, {
    ui.label({text = name, fontSize = 12, fontWeight = "bold", color = "on_surface_variant"}),
  })
end

local function singleRow(param, indent)
  return paramRow(param.key .. ":row", {
    headCell(param.ui.label or param.key, param, indent),
    controlCell(param, 1),
  }, rowHint({param}))
end

-- The label heads both cells.
local function matrixRow(row, indent)
  return paramRow(row.row .. ":row", {
    headCell(row.row, row.focused, indent),
    controlCell(row.unfocused, 1),
    ui.separator({orientation = "vertical", spacing = 4}),
    controlCell(row.focused, 1),
  }, rowHint({row.focused, row.unfocused}))
end

-- Mirrors matrixRow's children exactly - fixed head, grow, separator, grow - so
-- each column title sits over the cell it names.
local function matrixHeader(group, inset)
  return ui.row({key = group .. ":columns", gap = 8, align = "center", paddingH = inset or 0}, {
    ui.spacer({width = headColumnWidth, flexGrow = 0}),
    ui.label({text = "Unfocused", fontSize = 12, color = "on_surface_variant", textAlign = "center", flexGrow = 1}),
    ui.separator({orientation = "vertical", spacing = 4}),
    ui.label({text = "Focused", fontSize = 12, color = "on_surface_variant", textAlign = "center", flexGrow = 1}),
  })
end

local detailIndent = 26
local lightWidth = 20

-- The light: family color while the device is active, grey and hollow while
-- its own bypass is set, hollow in the family color while the device it
-- requires is bypassed. A glyph in a clickable row, because a toggle carries
-- no tooltip and a button no color at the API this plugin declares. The click
-- is a plain set when available: the bypass row inside the card carries the reset.
local function lightRow(card)
  local available = card.bypass.effectiveDrag ~= nil
  local color = card.bypassed and "on_surface_variant" or Presentation.familyColors[card.family]
  local name = (card.bypassed or card.silenced) and "circle" or "circle-filled"
  return ui.row({
    key = card.device .. ":light", width = lightWidth, align = "center", justify = "center",
    opacity = available and 1.0 or dimOpacity,
    onClick = available and function() writeParam(card.bypass, not (card.bypass.value == true)) end or nil,
  }, {
    ui.glyph({name = name, size = 12, color = color}),
  })
end

-- The card's head spans the same fixed width as every other head cell, so the
-- mix cells line up under the matrix header: light, chevron, name.
local function cardHead(card, expanded)
  local mix = card.mix
  local function toggleExpanded()
    state.expanded[card.device] = not expanded
    render()
  end
  return ui.row({width = headColumnWidth, gap = 6, align = "center", opacity = 1.0}, {
    lightRow(card),
    ui.button({
      glyph = expanded and "chevron-down" or "chevron-right",
      variant = "ghost",
      controlSize = "sm",
      tooltip = expanded and "Hide details" or "Show details",
      onClick = toggleExpanded,
    }),
    nameButton(card.label, mix.focused, toggleExpanded),
  })
end

local function deviceCard(card)
  local expanded = state.expanded[card.device] == true
  local mix = card.mix
  local children = {
    ui.row({gap = 8, align = "center"}, {
      cardHead(card, expanded),
      controlCell(mix.unfocused, 1),
      ui.separator({orientation = "vertical", spacing = 4}),
      controlCell(mix.focused, 1),
    }),
  }
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
    children[#children + 1] = singleRow(card.bypass, detailIndent)
    for _, row in ipairs(card.rows) do
      if not rowHidden(row.focused) then children[#children + 1] = matrixRow(row, detailIndent) end
    end
    for _, param in ipairs(card.shared) do
      if not rowHidden(param) then children[#children + 1] = singleRow(param, detailIndent) end
    end
  end
  return ui.column({
    key = card.device .. ":card", gap = 2, paddingV = 4, paddingH = cardPadding, radius = 8,
    fill = Presentation.familyColors[card.family] .. "1f",
    opacity = card.bypassed and dimOpacity or 1.0,
  }, children)
end

local function resetModeButton(spec)
  return ui.button({
    glyph = spec.glyph,
    variant = "ghost",
    controlSize = "sm",
    enabled = spec.enabled ~= false,
    opacity = spec.count > 0 and 1.0 or inertOpacity,
    tooltip = spec.count > 0 and spec.active or spec.inert,
    onClick = function() if spec.enabled ~= false and spec.count > 0 then spec.act() end end,
  })
end

local function resetModeButtons(scope, group, params)
  local edited = Presentation.editedCount(params)
  local buttons = {resetModeButton({
    glyph = "restore", count = edited,
    active = scope == "everything" and ("Revert " .. edited .. (edited == 1 and " edit" or " edits"))
      or ("Revert " .. scope .. " (" .. edited .. ")"),
    inert = "No edits in this " .. scope,
    act = resetAction("revert", group, params),
  })}
  if #Presentation.pairsOf(params) > 0 then
    local differing = Presentation.symmetricCount(params)
    buttons[#buttons + 1] = resetModeButton({
      glyph = "equal", count = differing,
      active = "Mirror focused onto unfocused (" .. differing .. ")",
      inert = "Focused and unfocused already match",
      act = resetAction("symmetric", group, params),
    })
  end
  local away = Presentation.neutralCount(params)
  buttons[#buttons + 1] = resetModeButton({
    glyph = "baseline", count = away,
    active = "Neutralize " .. scope .. " (" .. away .. ")",
    inert = scope == "everything" and "Everything is already neutral" or "Section is already neutral",
    act = resetAction("neutral", group, params),
  })
  return buttons
end

local function sectionHeader(name, toggle, sectionParams, color)
  local children = {
    ui.label({text = name, fontSize = 15, fontWeight = "bold", flexGrow = 1, color = color}),
    ui.label({text = toggle and (toggle.ui.label or toggle.key) or "", fontSize = 12, color = "on_surface_variant", visible = toggle ~= nil}),
    toggle and ui.toggle({
      checked = toggle.value == true,
      enabled = toggle.effectiveDrag ~= nil,
      onChange = function(value) writeParam(toggle, value == true or value == "true") end,
    }) or ui.spacer({}),
  }
  for _, button in ipairs(resetModeButtons("section", name, sectionParams)) do children[#children + 1] = button end
  return ui.row({gap = 8, align = "center"}, children)
end

-- Keep-in-look goes to the loaded profile, else to Default.
local function keepInLook(model)
  return {verb = "commit", destination = model.active.profile ~= nil and "profile" or "base"}
end

-- The edits row: what scratch holds, where to keep it, and the three resets
-- over everything.
local function editsRow(model)
  local params = Presentation.visibleParams(model)
  local edited = Presentation.editedCount(params)
  local plural = edited == 1 and " edit" or " edits"
  local look = model.active.profile ~= nil and ("profile " .. model.active.profile) or "Default"
  local wallpaper = model.active.wallpaper
  local children = {
    ui.label({text = edited > 0 and (edited .. plural) or "No edits", fontSize = 12, color = "on_surface_variant", flexGrow = 1}),
    resetModeButton({
      glyph = "bookmark", count = edited, enabled = not state.selectionPending,
      active = "Keep " .. edited .. plural .. " in " .. look,
      inert = "Nothing to keep",
      act = commitAction(keepInLook(model), params),
    }),
    resetModeButton({
      glyph = "photo-check", count = wallpaper ~= nil and edited or 0, enabled = not state.selectionPending,
      active = "Keep " .. edited .. plural .. " for " .. (model.active.profile or "Default") .. " + this wallpaper",
      inert = wallpaper == nil and "No wallpaper on screen" or "Nothing to keep",
      act = commitAction({verb = "commit", destination = "wallpaper", target = wallpaper and wallpaper.id}, params),
    }),
  }
  for _, button in ipairs(resetModeButtons("everything", nil, params)) do children[#children + 1] = button end
  return ui.row({gap = 8, align = "center"}, children)
end

local function appendSection(children, section, color)
  local sectionParams = Presentation.sectionParams(section)
  children[#children + 1] = ui.separator({spacing = 6, color = color})
  children[#children + 1] = sectionHeader(section.name, section.toggle, sectionParams, color)
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
      children[#children + 1] = row.param and singleRow(row.param) or matrixRow(row)
    end
  end
end

local function appendRack(children, rack, color)
  children[#children + 1] = ui.separator({spacing = 6, color = color})
  children[#children + 1] = sectionHeader(rack.group, rack.header, Presentation.rackParams(rack), color)
  children[#children + 1] = matrixHeader(rack.group, cardPadding)
  for _, card in ipairs(rack.cards) do children[#children + 1] = deviceCard(card) end
end

local function showNameError(text)
  state.errorText = text
  state.errorSticky = true
  render()
end

-- Save and rename share the field. A save under a taken name becomes a
-- question rather than a command. A rename onto a taken name is refused.
local function commitName(text, naming)
  local name = trimmed(text)
  if state.selectionPending or state.naming ~= naming then return end
  if not Presentation.validProfileName(name) then
    showNameError("A profile name may use letters, digits, dot, dash, and underscore")
    return
  end
  local active = naming.activeName
  if naming.mode == "rename" then
    if name ~= active then
      if Presentation.profileExists(state.model, name) then
        showNameError("A profile named " .. name .. " already exists")
        return
      end
      enqueue({verb = "rename", name = active, newName = name, expected = naming.expected})
    end
  elseif name ~= active and Presentation.profileExists(state.model, name) then
    state.confirm = {kind = "replace", name = name, expected = naming.expected}
  elseif name == active and Presentation.editedCount(Presentation.visibleParams(state.model)) == 0 then
    -- Nothing to commit: the field just closes.
  else
    commitAction({verb = "commit", destination = "profile", target = name ~= active and name or nil,
      expected = naming.expected},
      Presentation.visibleParams(state.model))()
  end
  state.naming = nil
  render()
end

-- One field and one question share the space under the profile row, so
-- opening either closes the other.
local function toggleNaming(mode, text, expected, activeName)
  if state.selectionPending then return end
  state.confirm = nil
  if state.naming ~= nil and state.naming.mode == mode then
    state.naming = nil
  else
    state.naming = {mode = mode, text = text, expected = expected, activeName = activeName}
  end
  render()
end

local function ask(kind, name, expected)
  if state.selectionPending then return end
  state.naming = nil
  state.confirm = {kind = kind, name = name, expected = expected}
  render()
end

local function focusIndex()
  for index, param in ipairs(state.focusOrder) do
    if param.key == state.focus then return index end
  end
  return nil
end

-- From nowhere, j starts at the top and k at the bottom; at an edge the walk
-- stays put rather than wrapping, so a held key settles instead of cycling.
-- Arrows reach the panel before a focused field, so an open name field stops
-- the walk and the nudge.
local function moveFocus(delta)
  local order = state.focusOrder
  if state.naming ~= nil or #order == 0 then return end
  local index = focusIndex()
  if index == nil then
    index = delta > 0 and 1 or #order
  else
    index = math.max(1, math.min(#order, index + delta))
  end
  state.focus = order[index].key
  render()
end

-- One ui.step in canonical units through the same write a released drag makes.
local function nudgeFocused(direction)
  if state.naming ~= nil then return end
  local index = focusIndex()
  if index == nil then return end
  local param = state.focusOrder[index]
  if param.effectiveDrag == nil then return end
  local value = Presentation.stepCanonicalValue(param.value, direction, param)
  if value == param.value then return end
  writeParam(param, value)
end

-- The keyboard save is the bookmark: the edits go to the loaded look. An open
-- name field is what is being saved, so it is submitted instead.
local function saveShortcut()
  if state.model == nil or state.selectionPending then return end
  if state.naming ~= nil then
    commitName(state.naming.text, state.naming)
    return
  end
  local params = Presentation.visibleParams(state.model)
  if Presentation.editedCount(params) == 0 then return end
  commitAction(keepInLook(state.model), params)()
end

-- One selector loads and clears: index 0 is "no profile", which deactivates.
-- Save, rename, and delete follow the reset idiom - always in the tree, state
-- carried by opacity and tooltip. Pair actions are disabled until selection
-- reconciles. While a mode's field is open its icon turns into a plain cancel:
-- a floppy that closes the field reads as a broken save.
local function profileRow(section)
  local loaded = section.activeName ~= nil
  local mode = state.naming ~= nil and state.naming.mode or nil
  local expected = Queue.captureSlots(state.model)
  return ui.row({gap = 8, align = "center"}, {
    ui.label({text = "Profile", fontWeight = "medium", width = labelColumnWidth, maxLines = 1}),
    ui.select({
      options = section.options,
      selectedIndex = section.selectedIndex,
      controlSize = "sm",
      flexGrow = 1,
      -- Optimistic, like a slider edit: Noctalia re-applies selectedIndex on
      -- every render, so the render below must already declare the pick or
      -- the selector snaps back to the old name for the whole round trip.
      -- The describe that follows the command reconciles either way.
      onChange = function(index)
        index = tonumber(index) or -1
        if index == section.selectedIndex then return end
        local name = section.options[index + 1]
        if name == nil then
          state.errorText = "Prism returned an invalid selection index"
          render()
          return
        end
        state.selectionPending = true
        state.naming, state.confirm = nil, nil
        for _, param in ipairs(state.model.params) do param.edited = false end
        state.model.active.profile = index ~= 0 and name or nil
        enqueue(index == 0 and {verb = "deactivate"} or {verb = "activate", name = name})
        render()
      end,
    }),
    ui.button({
      glyph = mode == "save" and "x" or "device-floppy",
      enabled = not state.selectionPending,
      variant = "ghost",
      controlSize = "sm",
      tooltip = mode == "save" and "Cancel" or "Save what is on screen as a profile",
      onClick = function() toggleNaming("save", "", expected, section.activeName) end,
    }),
    ui.button({
      glyph = mode == "rename" and "x" or "pencil",
      enabled = not state.selectionPending,
      variant = "ghost",
      controlSize = "sm",
      opacity = loaded and 1.0 or inertOpacity,
      tooltip = mode == "rename" and "Cancel"
        or (loaded and ("Rename profile " .. section.activeName) or "No profile loaded to rename"),
      onClick = function()
        if section.activeName == nil then return end
        toggleNaming("rename", section.activeName, expected, section.activeName)
      end,
    }),
    ui.button({
      glyph = "trash",
      enabled = not state.selectionPending,
      variant = "ghost",
      controlSize = "sm",
      opacity = loaded and 1.0 or inertOpacity,
      tooltip = loaded and ("Delete profile " .. section.activeName) or "No profile loaded to delete",
      onClick = function()
        if section.activeName == nil then return end
        ask("delete", section.activeName, expected)
      end,
    }),
  })
end

-- Noctalia's input is uncontrolled: value seeds the host buffer once per
-- slot, so the key carries the mode and switching modes re-seeds. Enter is
-- not the only submit, since it needs keyboard focus: the check submits what
-- onChange tracked.
local function nameRow()
  local naming = state.naming
  local renaming = naming.mode == "rename"
  return ui.row({gap = 8, align = "center"}, {
    ui.spacer({width = labelColumnWidth, flexGrow = 0}),
    ui.input({
      key = "name-" .. naming.mode,
      value = naming.text,
      placeholder = renaming and "New name" or "Profile name",
      controlSize = "sm",
      flexGrow = 1,
      focus = true,
      submitOnEnter = true,
      onChange = function(text) naming.text = tostring(text or "") end,
      onSubmit = function(text) commitName(text, naming) end,
    }),
    ui.button({
      glyph = "check",
      enabled = not state.selectionPending,
      variant = "ghost",
      controlSize = "sm",
      tooltip = renaming and "Rename to this name" or "Save under this name",
      onClick = function() commitName(naming.text, naming) end,
    }),
  })
end

-- Noctalia has no dialog, so a destructive action asks in the row the name
-- field would occupy: the question, the action named plainly, and a cancel.
local confirmActions = {
  replace = {label = "Replace", question = "Replace profile %s?"},
  delete = {label = "Delete", question = "Delete profile %s?"},
}

local function confirmRow()
  local confirm = state.confirm
  local action = confirmActions[confirm.kind]
  local params = Presentation.visibleParams(state.model)
  return ui.row({gap = 8, align = "center"}, {
    ui.spacer({width = labelColumnWidth, flexGrow = 0}),
    ui.label({text = string.format(action.question, confirm.name), flexGrow = 1, maxLines = 1}),
    ui.button({
      text = action.label,
      enabled = not state.selectionPending,
      variant = "destructive",
      controlSize = "sm",
      onClick = function()
        if state.selectionPending then return end
        state.confirm = nil
        if confirm.kind == "replace" then
          commitAction({verb = "commit", destination = "profile", target = confirm.name,
            expected = confirm.expected}, params)()
        else
          enqueue({verb = "delete", name = confirm.name, expected = confirm.expected})
        end
        render()
      end,
    }),
    ui.button({
      text = "Cancel",
      variant = "ghost",
      controlSize = "sm",
      onClick = function()
        state.confirm = nil
        render()
      end,
    }),
  })
end

-- The wallpaper on screen: a lit glyph while its delta holds nudges, the
-- count, and a clear that names the wallpaper so a stale panel is refused.
local function wallpaperHeaderRow(header)
  local tuned = header.tuned > 0
  local plural = header.tuned == 1 and " adjustment" or " adjustments"
  local expected = Queue.captureSlots(state.model)
  return ui.row({gap = 8, align = "center"}, {
    ui.button({
      glyph = tuned and "photo-filled" or "photo",
      variant = "ghost", controlSize = "sm",
      tooltip = header.name,
      onClick = function() end,
    }),
    ui.label({
      text = header.tuned .. " for " .. header.look .. " + this wallpaper",
      fontSize = 12, color = "on_surface_variant", flexGrow = 1,
    }),
    ui.button({
      glyph = "eraser", variant = "ghost", controlSize = "sm",
      enabled = not state.selectionPending,
      opacity = tuned and 1.0 or inertOpacity,
      tooltip = tuned and ("Clear " .. header.look .. " + this wallpaper's " .. header.tuned .. plural) or "This look + wallpaper holds no adjustments",
      onClick = function()
        if state.selectionPending or not tuned then return end
        enqueue({verb = "clear", id = header.id, expected = expected})
        render()
      end,
    }),
  })
end

render = function()
  local children = {
    ui.label({
      text = state.errorText,
      color = "error",
      visible = state.errorText ~= nil,
      maxLines = 3,
    }),
  }
  state.focusOrder = {}
  if state.model == nil then
    children[#children + 1] = ui.label({text = "Loading Prism…", color = "on_surface_variant"})
  else
    local title = Presentation.titleParam(state.model.params)
    children[#children + 1] = ui.row({gap = 10, align = "center"}, {
      ui.label({text = "Prism", fontSize = 18, fontWeight = "bold", flexGrow = 1}),
      ui.toggle({
        checked = title.value == true,
        enabled = title.effectiveDrag ~= nil,
        onChange = function(value) writeParam(title, value == true or value == "true") end,
      }),
    })
    -- The profile selector and wallpaper header stay together above the edits.
    children[#children + 1] = profileRow(Presentation.profileSection(state.model))
    if state.naming ~= nil then children[#children + 1] = nameRow() end
    if state.confirm ~= nil then children[#children + 1] = confirmRow() end
    local header = Presentation.wallpaperHeader(state.model)
    if header then children[#children + 1] = wallpaperHeaderRow(header) end
    children[#children + 1] = editsRow(state.model)
    gates = Presentation.gates(state.model.params)
    attached = Presentation.attachedSwatches(state.model.params, gates)
    local rack = Presentation.rack(state.model)
    local sections = Presentation.sections(state.model.params, rack.group)
    local rackPlaced = false
    local sectionIndex = 0
    for _, section in ipairs(sections) do
      if not rackPlaced and rack.header ~= nil and section.rows[1] ~= nil then
        local first = section.rows[1].param or section.rows[1].focused
        if first.ui.order > rack.header.ui.order then
          sectionIndex = sectionIndex + 1
          appendRack(children, rack, Presentation.sectionColor(sectionIndex))
          rackPlaced = true
        end
      end
      sectionIndex = sectionIndex + 1
      appendSection(children, section, Presentation.sectionColor(sectionIndex))
    end
    if not rackPlaced then
      sectionIndex = sectionIndex + 1
      appendRack(children, rack, Presentation.sectionColor(sectionIndex))
    end
  end
  panel.render(ui.scroll({flexGrow = 1, gap = 6, padding = 16}, children))
end

-- Opening the panel is a fresh gesture, like starting a batch: the Luau runtime
-- survives a close, so a sticky command error would otherwise greet the next
-- session behind a model that reconciles perfectly well. The host's second
-- tick drives the periodic refresh that follows a wallpaper rotation.
function onOpen(context)
  state.errorText = nil
  state.errorSticky = false
  state.ticks = 0
  panel.setWantsSecondTicks(true)
  render()
  refresh()
end

function onClose()
  state.drag = nil
  state.sampleElapsedMs = 0
  panel.setNeedsFrameTick(false)
  panel.setWantsSecondTicks(false)
end

-- Every second tick asks for a describe. A drag or a busy queue turns it into
-- the one pending flag finishRefresh already replays, so a long drag replays
-- one refresh rather than one per tick.
function update()
  state.ticks = state.ticks + 1
  if state.ticks % 2 ~= 0 then return end
  if state.drag or state.queue.inFlight ~= nil or describeRunning then
    state.refreshPending = true
    return
  end
  refresh()
end

function onFrameTick(deltaMs)
  if not state.drag then return end
  if state.drag.dirty then
    state.drag.dirty = false
    render()
  end
  if not state.drag.pendingSample then return end
  state.sampleElapsedMs = state.sampleElapsedMs + deltaMs
  if state.sampleElapsedMs < 100 then return end
  state.sampleElapsedMs = 0
  enqueue(state.drag.pendingSample)
  state.drag.pendingSample = nil
end

-- Every captured chord, spelled as the manifest spells it, and the action it
-- dispatches. onKey reads only this table, and keyTable exposes it to the
-- conformance test, so a chord cannot be captured without an action here.
local keyActions = {
  k = {action = "up"}, Up = {action = "up"},
  j = {action = "down"}, Down = {action = "down"},
  h = {action = "prev"}, Left = {action = "prev"},
  l = {action = "next"}, Right = {action = "next"},
  ["ctrl+s"] = {action = "save"},
}

local handlers = {
  up = function() moveFocus(-1) end,
  down = function() moveFocus(1) end,
  prev = function() nudgeFocused(-1) end,
  next = function() nudgeFocused(1) end,
  save = saveShortcut,
}

function keyTable()
  return keyActions
end

function onKey(chord, pressed)
  if not pressed then return end
  local entry = keyActions[chord]
  if entry == nil then return end
  handlers[entry.action](entry.arg)
end
