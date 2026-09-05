local Presentation = require("./presentation.luau")
local Queue = require("./queue.luau")
local Shell = require("./shell.luau")

local state = {
  model = nil,
  errorText = nil,
  queue = Queue.new(),
  batchAffectsParams = false,
  refreshPending = false,
  describeInvalidated = false,
  refreshAfterDrag = false,
  drag = nil,
  sampleElapsedMs = 0,
  renderedSliderCorrection = nil,
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
local inertOpacity = 0.35
local render
local refresh
local enqueue
local launch

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

local function visibleParamError(param, index)
  if type(param.key) ~= "string" or param.key == "" then return "parameter " .. index .. " has no key" end
  if param.value == nil then return param.key .. " has no value" end
  if param.default == nil then return param.key .. " has no default" end
  if type(param.modified) ~= "boolean" then return param.key .. " has invalid modified state" end
  if type(param.ui.group) ~= "string" or param.ui.group == "" then return param.key .. " has no UI group" end
  if type(param.ui.order) ~= "number" then return param.key .. " has no UI order" end
  if param.effectiveDrag ~= nil and param.effectiveDrag ~= "live" and param.effectiveDrag ~= "release" then
    return param.key .. " has invalid drag behavior"
  end
  if param.ui.control == "slider" then
    if type(param.range) ~= "table" or type(param.range[1]) ~= "number" or type(param.range[2]) ~= "number"
      or type(param.ui.step) ~= "number" or param.ui.step <= 0 then
      return param.key .. " has invalid slider metadata"
    end
  elseif param.ui.control == "select" and type(param.values) ~= "table" then
    return param.key .. " has no select values"
  elseif param.ui.control ~= "toggle" and param.ui.control ~= "color" then
    return param.key .. " has unsupported control " .. tostring(param.ui.control)
  end
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
  for index, param in ipairs(model.params) do
    if type(param) ~= "table" or type(param.ui) ~= "table" or type(param.ui.control) ~= "string" then
      return "parameter " .. index .. " has invalid UI metadata"
    end
    if param.ui.control ~= "none" then
      local message = visibleParamError(param, index)
      if message then return message end
    end
  end
  local titleOk, titleError = pcall(Presentation.titleParam, model.params)
  if not titleOk then return tostring(titleError) end
  local sectionsOk, sectionsError = pcall(Presentation.sections, model.params)
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

local function described(result)
  describeRunning = false
  local invalidated = state.describeInvalidated or state.drag ~= nil
  state.describeInvalidated = false
  local message = resultError(result, "prism describe")
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
    state.model = model
    state.errorText = nil
  end
  render()
  finishRefresh()
end

refresh = function()
  if describeRunning then
    state.refreshPending = true
    return
  end
  describeRunning = true
  state.describeInvalidated = state.drag ~= nil
  render()
  if not run({"prism", "describe", "--json"}, described) then
    describeRunning = false
    state.errorText = "Failed to launch prism describe"
    render()
    finishRefresh()
  end
end

local function finishWrite(result, launchError)
  local message = launchError or resultError(result, "Prism command")
  if message then state.errorText = message end

  local shouldRefresh = Queue.shouldRefresh(state.batchAffectsParams, state.queue.inFlight)
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
  state.batchAffectsParams = state.batchAffectsParams or Queue.affectsParams(item)
  if state.queue.inFlight == nil then state.errorText = nil end
  local result = Queue.enqueue(state.queue, item)
  state.queue = result.state
  if result.launch then launch(result.launch) end
end

local function updateParam(param, value)
  param.value = value
  param.modified = value ~= param.default
end

local function writeParam(param, value)
  updateParam(param, value)
  enqueue({verb = "set", key = param.key, value = value, sample = false})
  render()
end

local function unsetParam(param)
  updateParam(param, param.default)
  enqueue({verb = "unset", key = param.key})
  render()
end

local function resetGroup(params)
  for _, param in ipairs(params) do
    if param.modified then unsetParam(param) end
  end
end

local function beginDrag(param, sliderValue)
  sliderValue = tonumber(sliderValue)
  local correction = state.renderedSliderCorrection
  if correction and correction.key == param.key
    and math.abs(sliderValue - correction.expectedPresentationValue) < hostSliderEpsilon then
    state.renderedSliderCorrection = nil
    return
  end
  local canonical = Presentation.canonicalFromSlider(sliderValue, param)
  if not state.drag or state.drag.key ~= param.key then
    state.drag = {
      key = param.key,
      value = canonical,
      sliderValue = sliderValue,
      originValue = param.value,
      pendingSample = nil,
    }
    state.sampleElapsedMs = 0
    if describeRunning then state.describeInvalidated = true end
    if param.effectiveDrag == "live" then panel.setNeedsFrameTick(true) end
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
  render()
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

-- Always in the tree, dim while the parameter already holds its default. A
-- reset that appears with `modified` re-solves the row every time a drag
-- crosses the default, which resizes the slider under the pointer.
local function resetButton(param, available)
  return ui.button({
    glyph = "restore",
    variant = "ghost",
    controlSize = "sm",
    opacity = param.modified and 1.0 or inertOpacity,
    tooltip = param.modified and "Reset to default" or "Already at its default",
    enabled = available,
    onClick = function() if param.modified then unsetParam(param) end end,
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

-- Noctalia enables a Button's hit area only when the button carries a handler,
-- and a disabled hit area never opens the tooltip. The click itself does
-- nothing; it is what makes the description reachable on hover.
local function infoButton(param)
  return ui.button({
    glyph = "info-circle",
    variant = "ghost",
    controlSize = "sm",
    tooltip = param.description or param.key,
    onClick = function() end,
  })
end

-- Only exceptions are marked. Writing on release is the norm here, so saying it
-- on every row costs a line per row and distinguishes nothing.
local function exceptionHint(param)
  if param.effectiveDrag == nil then
    return ui.label({text = "Unavailable", fontSize = 11, color = "error"})
  end
  if param.effectiveDrag == "live" then
    return ui.label({text = "Live", fontSize = 11, color = "on_surface_variant"})
  end
  return nil
end

-- The leading column: label and its info button, at one fixed width so every
-- control column starts at the same x and the matrix header can reserve the
-- same span without guessing the button's natural width.
local function headCell(text, param)
  return ui.row({width = headColumnWidth, gap = 6, align = "center"}, {
    -- maxWidth, not width: a Label sizes to its text either way, so the cap is
    -- what keeps a long label from pushing its info button out of the span.
    ui.label({text = text, fontWeight = "medium", maxWidth = labelColumnWidth, maxLines = 1}),
    infoButton(param),
  })
end

-- A control cell: formatted value, native control, and reset. Shared by the
-- single rows and both halves of a matrix row.
local function controlCell(param, grow)
  local available = param.effectiveDrag ~= nil
  local formattedValue = param.ui.control == "slider" and Presentation.formatValue(param.value, param) or nil
  local children = {
    -- Rendered even when empty: a hidden child leaves the flex layout, which
    -- would pull the control left on every row without a formatted value.
    ui.label({text = formattedValue or "", fontSize = 12, color = "on_surface_variant", width = valueColumnWidth, textAlign = "end"}),
    nativeControl(param, available),
  }
  -- Sliders absorb the cell's slack themselves; the other controls keep their
  -- natural width, so the slack goes here to hold the reset at the right edge.
  if param.ui.control ~= "slider" then children[#children + 1] = ui.spacer({flexGrow = 1}) end
  children[#children + 1] = resetButton(param, available)
  return ui.row({key = param.key, gap = 6, align = "center", flexGrow = grow}, children)
end

local function paramRow(key, cells, hint)
  local children = {ui.row({gap = 8, align = "center"}, cells)}
  if hint then children[#children + 1] = ui.row({gap = 8, align = "center", justify = "end"}, {hint}) end
  return ui.column({key = key, gap = 2, paddingV = 2}, children)
end

local function singleRow(param)
  return paramRow(param.key .. ":row", {
    headCell(param.ui.label or param.key, param),
    controlCell(param, 1),
  }, exceptionHint(param))
end

local function matrixRow(row)
  return paramRow(row.row .. ":row", {
    headCell(row.row, row.focused),
    controlCell(row.focused, 1),
    ui.separator({orientation = "vertical", spacing = 4}),
    controlCell(row.unfocused, 1),
  }, exceptionHint(row.focused) or exceptionHint(row.unfocused))
end

-- Mirrors matrixRow's children exactly - fixed head, grow, separator, grow - so
-- each column title sits over the cell it names.
local function matrixHeader()
  return ui.row({gap = 8, align = "center"}, {
    ui.spacer({width = headColumnWidth}),
    ui.label({text = "Focused", fontSize = 12, color = "on_surface_variant", textAlign = "center", flexGrow = 1}),
    ui.separator({orientation = "vertical", spacing = 4}),
    ui.label({text = "Unfocused", fontSize = 12, color = "on_surface_variant", textAlign = "center", flexGrow = 1}),
  })
end

local function appendSection(children, section)
  local sectionParams = Presentation.sectionParams(section)
  local modifiedCount = Presentation.modifiedCount(sectionParams)
  local toggle = section.toggle
  children[#children + 1] = ui.separator({spacing = 6})
  children[#children + 1] = ui.row({gap = 8, align = "center"}, {
    ui.label({text = section.name, fontSize = 15, fontWeight = "bold", flexGrow = 1}),
    ui.label({text = toggle and (toggle.ui.label or toggle.key) or "", fontSize = 12, color = "on_surface_variant", visible = toggle ~= nil}),
    toggle and ui.toggle({
      checked = toggle.value == true,
      enabled = toggle.effectiveDrag ~= nil,
      onChange = function(value) writeParam(toggle, value == true or value == "true") end,
    }) or ui.spacer({}),
    ui.button({
      glyph = "restore",
      variant = "ghost",
      controlSize = "sm",
      opacity = modifiedCount > 0 and 1.0 or inertOpacity,
      tooltip = modifiedCount > 0 and ("Reset section (" .. modifiedCount .. ")") or "Section is at its defaults",
      onClick = function() if modifiedCount > 0 then resetGroup(sectionParams) end end,
    }),
  })
  local hasMatrix = false
  for _, row in ipairs(section.rows) do
    if row.param == nil then hasMatrix = true end
  end
  if hasMatrix then children[#children + 1] = matrixHeader() end
  for _, row in ipairs(section.rows) do
    children[#children + 1] = row.param and singleRow(row.param) or matrixRow(row)
  end
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
    for _, section in ipairs(Presentation.sections(state.model.params)) do appendSection(children, section) end
  end
  panel.render(ui.scroll({flexGrow = 1, gap = 6, padding = 16}, children))
end

function onOpen(context) refresh() end

function onClose()
  state.drag = nil
  state.sampleElapsedMs = 0
  panel.setNeedsFrameTick(false)
end

function onFrameTick(deltaMs)
  if not state.drag or not state.drag.pendingSample then return end
  state.sampleElapsedMs = state.sampleElapsedMs + deltaMs
  if state.sampleElapsedMs < 100 then return end
  state.sampleElapsedMs = 0
  enqueue(state.drag.pendingSample)
  state.drag.pendingSample = nil
end
