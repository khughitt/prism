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
  previewVisible = false,
  diagnosticBackground = false,
  expandedGroups = {},
}

local describeRunning = false
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
  local groupsOk, groupsError = pcall(Presentation.groupParams, model.params)
  if not groupsOk then return tostring(groupsError) end
  return nil
end

local function originOutput()
  local output = noctalia.state.get("originOutput")
  if output == nil then output = noctalia.focusedOutputName() end
  return output
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
  local canonical = Presentation.canonicalFromSlider(tonumber(sliderValue), param)
  if not state.drag or state.drag.key ~= param.key then
    state.drag = {key = param.key, value = canonical, pendingSample = nil}
    state.sampleElapsedMs = 0
    if describeRunning then state.describeInvalidated = true end
    if param.effectiveDrag == "live" then panel.setNeedsFrameTick(true) end
  else
    state.drag.value = canonical
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
  state.drag = nil
  state.sampleElapsedMs = 0
  panel.setNeedsFrameTick(false)
  enqueue({verb = "set", key = param.key, value = drag.value, sample = false})
  render()
end

local function previewItem()
  local output = originOutput()
  if output == nil then
    state.errorText = "No output is available for the preview"
    state.previewVisible = false
    return nil
  end
  return {verb = "preview-show", output = output, side = "left", diagnosticBackground = state.diagnosticBackground}
end

local function setPreview(value)
  state.previewVisible = value == true or value == "true"
  if state.previewVisible then
    local item = previewItem()
    if item then enqueue(item) end
  else
    enqueue({verb = "preview-hide"})
  end
  render()
end

local function setDiagnosticBackground(value)
  state.diagnosticBackground = value == true or value == "true"
  if state.previewVisible then
    local item = previewItem()
    if item then enqueue(item) end
  end
  render()
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

local function resetButton(param, available)
  return ui.button({
    glyph = "restore",
    controlSize = "sm",
    tooltip = "Reset to default",
    visible = param.modified,
    enabled = available,
    onClick = function() unsetParam(param) end,
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

local function parameterRow(param)
  local available = param.effectiveDrag ~= nil
  local notInPreview = state.previewVisible and param.ui.affectsPreview ~= true
  local releaseHint = param.effectiveDrag == "release"

  return ui.column({key = param.key, gap = 4, paddingV = 4, opacity = notInPreview and 0.55 or 1}, {
    ui.row({gap = 8, align = "center"}, {
      ui.column({gap = 2, flexGrow = 1}, {
        ui.label({text = param.ui.label or param.key, fontWeight = "medium"}),
        ui.label({text = param.description or "", fontSize = 12, color = "on_surface_variant", maxLines = 2}),
      }),
      nativeControl(param, available),
      resetButton(param, available),
    }),
    ui.row({gap = 8, align = "center", justify = "end"}, {
      ui.label({text = "Not in preview", fontSize = 11, color = "on_surface_variant", visible = notInPreview}),
      ui.label({text = "On release", fontSize = 11, color = "on_surface_variant", visible = releaseHint}),
      ui.label({text = "Unavailable", fontSize = 11, color = "error", visible = param.effectiveDrag == nil}),
    }),
  })
end

local function diagnosticRows()
  return {
    ui.row({gap = 8, align = "center"}, {
      ui.label({text = "Preview", flexGrow = 1}),
      ui.toggle({checked = state.previewVisible, onChange = setPreview}),
    }),
    ui.row({gap = 8, align = "center"}, {
      ui.label({text = "Diagnostic background", flexGrow = 1}),
      ui.toggle({checked = state.diagnosticBackground, onChange = setDiagnosticBackground}),
    }),
    ui.label({
      text = "Dimmed settings are not reflected in the preview",
      fontSize = 11,
      color = "on_surface_variant",
      visible = state.previewVisible,
    }),
  }
end

local function appendGroup(children, group)
  local expanded = group.name == "Quick" or state.expandedGroups[group.name] == true
  local modifiedCount = Presentation.modifiedCount(group.params)
  if group.name ~= "Quick" then
    children[#children + 1] = ui.row({gap = 8, align = "center"}, {
      ui.button({
        text = group.name .. (modifiedCount > 0 and " (" .. modifiedCount .. ")" or ""),
        glyph = expanded and "chevron-down" or "chevron-right",
        variant = "ghost",
        contentAlign = "start",
        flexGrow = 1,
        onClick = function()
          state.expandedGroups[group.name] = not expanded
          render()
        end,
      }),
      ui.button({
        glyph = "restore",
        variant = "ghost",
        controlSize = "sm",
        tooltip = "Reset group",
        visible = modifiedCount > 0,
        onClick = function() resetGroup(group.params) end,
      }),
    })
  end
  if not expanded then return end
  for _, param in ipairs(group.params) do children[#children + 1] = parameterRow(param) end
  if group.name == "Diagnostics" then
    for _, row in ipairs(diagnosticRows()) do children[#children + 1] = row end
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
    local titleNotInPreview = state.previewVisible and title.ui.affectsPreview ~= true
    children[#children + 1] = ui.row({gap = 10, align = "center", opacity = titleNotInPreview and 0.55 or 1}, {
      ui.label({text = "Prism", fontSize = 18, fontWeight = "bold", flexGrow = 1}),
      ui.label({text = "Not in preview", fontSize = 11, color = "on_surface_variant", visible = titleNotInPreview}),
      ui.toggle({
        checked = title.value == true,
        enabled = title.effectiveDrag ~= nil,
        onChange = function(value) writeParam(title, value == true or value == "true") end,
      }),
    })
    for _, group in ipairs(Presentation.groupParams(state.model.params)) do appendGroup(children, group) end
  end
  panel.render(ui.scroll({gap = 8, padding = 16}, children))
end

function onOpen(context) refresh() end

function onClose()
  state.drag = nil
  state.sampleElapsedMs = 0
  state.previewVisible = false
  panel.setNeedsFrameTick(false)
  enqueue({verb = "preview-hide"})
end

function onFrameTick(deltaMs)
  if not state.drag or not state.drag.pendingSample then return end
  state.sampleElapsedMs = state.sampleElapsedMs + deltaMs
  if state.sampleElapsedMs < 100 then return end
  state.sampleElapsedMs = 0
  enqueue(state.drag.pendingSample)
  state.drag.pendingSample = nil
end
