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
  naming = nil,
  errorSticky = false,
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
-- A shadowed control still writes; it is the value that cannot surface. Dimmer
-- than full strength, lighter than inert, because the control is still live.
local shadowedOpacity = 0.55
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
  if type(param.layer) ~= "string" then return param.key .. " has no layer" end
  if param.fallback == nil then return param.key .. " has no fallback" end
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
  elseif param.ui.control == "select" then
    if type(param.values) ~= "table" then return param.key .. " has no select values" end
  elseif param.ui.control ~= "toggle" and param.ui.control ~= "color" then
    return param.key .. " has unsupported control " .. tostring(param.ui.control)
  end
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

-- The order is a ranking, so it has to be a dense list of distinct names. A
-- hole, a stray key, a non-string entry, or a repeat each rank silently wrong,
-- and a wrong rank shadows the columns a user is trying to edit.
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
  if type(model.target) ~= "string" then return "prism describe returned no write target" end
  local orderError = layerOrderError(model.layers)
  if orderError then return orderError end
  local profileError = profileListError(model.profiles)
  if profileError then return profileError end
  -- describe always states the active slots, empty or not, so an absent object
  -- is a broken contract rather than "nothing is active".
  if type(model.active) ~= "table" then return "prism describe returned no active contexts" end
  local ranks = Presentation.layerRanks(model.layers)
  if ranks[model.target] == nil then
    return "prism describe reported target " .. model.target .. " outside the layer order"
  end
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

-- Overridden means "the value comes from where a write would land", so the row
-- has something to reset. Shadowed is the opposite end: the value comes from
-- above the target, so a write lands somewhere nothing can see.
local function markLayers(model)
  local ranks = Presentation.layerRanks(model.layers)
  for _, param in ipairs(model.params) do
    local visible = param.ui.control ~= "none"
    param.overridden = visible and param.layer == model.target
    param.shadowed = visible and Presentation.isShadowed(param, ranks, model.target)
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
    markLayers(model)
    state.model = model
    -- A command's error outlives the refresh it triggers. Clearing it here
    -- would flash the reason a profile would not load past the user and leave
    -- the panel looking fine.
    if not state.errorSticky then state.errorText = nil end
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
  if message then
    state.errorText = message
    state.errorSticky = true
  end

  local completed = state.queue.inFlight
  local shouldRefresh = Queue.shouldRefresh(state.batchAffectsParams, completed)
  -- A follow-up runs only once the command it depends on has landed. The FIFO
  -- keeps going after a failure, so an unconditional pair would enter a profile
  -- whose save never happened.
  if not message and completed and completed.activateAfter then
    enqueue({verb = "activate", name = completed.name})
  end
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
  if state.queue.inFlight == nil then
    state.errorText = nil
    state.errorSticky = false
  end
  local result = Queue.enqueue(state.queue, item)
  state.queue = result.state
  if result.launch then launch(result.launch) end
end

-- A shadowed row writes into the target as usual, but the target is not where
-- its value comes from, so `layer == target` stays false and there is still no
-- override on this row to remove.
local function updateParam(param, value)
  param.value = value
  if not param.shadowed then param.overridden = true end
end

local function writeParam(param, value)
  updateParam(param, value)
  enqueue({verb = "set", key = param.key, value = value, sample = false})
  render()
end

local function unsetParam(param)
  param.value = param.fallback
  param.overridden = false
  enqueue({verb = "unset", key = param.key})
  render()
end

local function resetGroup(params)
  for _, param in ipairs(params) do
    if param.overridden then unsetParam(param) end
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
    opacity = param.overridden and 1.0 or inertOpacity,
    tooltip = param.overridden and "Remove override" or "No override to remove",
    enabled = available,
    onClick = function() if param.overridden then unsetParam(param) end end,
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
-- on every row costs a line per row and distinguishes nothing. One row can hold
-- two parameters with different layers, so the hint is chosen across the whole
-- row: an unavailable consumer is an error and outranks everything, a shadow
-- explains why a working control has no visible effect, and Live is the mildest
-- of the three -- it must never crowd out the other cell's shadow.
local function rowHint(params)
  for _, param in ipairs(params) do
    if param.effectiveDrag == nil then
      return ui.label({text = "Unavailable", fontSize = 11, color = "error"})
    end
  end
  for _, param in ipairs(params) do
    if param.shadowed then
      return ui.label({text = Presentation.shadowHint(param), fontSize = 11, color = "on_surface_variant"})
    end
  end
  for _, param in ipairs(params) do
    if param.effectiveDrag == "live" then
      return ui.label({text = "Live", fontSize = 11, color = "on_surface_variant"})
    end
  end
  return nil
end

-- The leading column: label and its info button, at one fixed width so every
-- control column starts at the same x and the matrix header can reserve the
-- same span without guessing the button's natural width.
local function headCell(text, param, dimmed)
  return ui.row({width = headColumnWidth, gap = 6, align = "center", opacity = dimmed and shadowedOpacity or 1.0}, {
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
  return ui.row({
    key = param.key, gap = 6, align = "center", flexGrow = grow,
    opacity = param.shadowed and shadowedOpacity or 1.0,
  }, children)
end

local function paramRow(key, cells, hint)
  local children = {ui.row({gap = 8, align = "center"}, cells)}
  if hint then children[#children + 1] = ui.row({gap = 8, align = "center", justify = "end"}, {hint}) end
  return ui.column({key = key, gap = 2, paddingV = 2}, children)
end

local function singleRow(param)
  return paramRow(param.key .. ":row", {
    headCell(param.ui.label or param.key, param, param.shadowed),
    controlCell(param, 1),
  }, rowHint({param}))
end

-- The label heads both cells, so it only dims when the whole row is covered.
local function matrixRow(row)
  return paramRow(row.row .. ":row", {
    headCell(row.row, row.focused, row.focused.shadowed and row.unfocused.shadowed),
    controlCell(row.focused, 1),
    ui.separator({orientation = "vertical", spacing = 4}),
    controlCell(row.unfocused, 1),
  }, rowHint({row.focused, row.unfocused}))
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
  local overriddenCount = Presentation.overriddenCount(sectionParams)
  local toggle = section.toggle
  children[#children + 1] = ui.separator({spacing = 6})
  children[#children + 1] = ui.row({gap = 8, align = "center"}, {
    ui.label({text = section.name, fontSize = 15, fontWeight = "bold", flexGrow = 1}),
    ui.label({text = toggle and (toggle.ui.label or toggle.key) or "", fontSize = 12, color = "on_surface_variant", visible = toggle ~= nil}),
    ui.label({
      text = toggle and toggle.shadowed and Presentation.shadowHint(toggle) or "",
      fontSize = 11, color = "on_surface_variant", visible = toggle ~= nil and toggle.shadowed == true,
    }),
    toggle and ui.toggle({
      checked = toggle.value == true,
      enabled = toggle.effectiveDrag ~= nil,
      opacity = toggle.shadowed and shadowedOpacity or 1.0,
      onChange = function(value) writeParam(toggle, value == true or value == "true") end,
    }) or ui.spacer({}),
    ui.button({
      glyph = "restore",
      variant = "ghost",
      controlSize = "sm",
      opacity = overriddenCount > 0 and 1.0 or inertOpacity,
      tooltip = overriddenCount > 0 and ("Reset section (" .. overriddenCount .. ")") or "No overrides in this section",
      onClick = function() if overriddenCount > 0 then resetGroup(sectionParams) end end,
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

local function commitName(text)
  local name = trimmed(text)
  if not Presentation.validProfileName(name) then
    state.errorText = "A profile name may use letters, digits, dot, dash, and underscore"
    state.errorSticky = true
    render()
    return
  end
  state.naming = nil
  enqueue({verb = "save", name = name, activateAfter = true})
  render()
end

-- One selector loads and clears: index 0 is "no profile", which deactivates.
-- Save and delete follow the reset idiom - always in the tree, state carried by
-- opacity and tooltip, and the guard in the handler rather than `enabled`.
local function profileRow(section)
  local loaded = section.activeName ~= nil
  return ui.row({gap = 8, align = "center"}, {
    ui.label({text = "Profile", fontWeight = "medium", width = labelColumnWidth, maxLines = 1}),
    ui.select({
      options = section.options,
      selectedIndex = section.selectedIndex,
      controlSize = "sm",
      flexGrow = 1,
      onChange = function(index)
        index = tonumber(index) or -1
        if index == section.selectedIndex then return end
        if index == 0 then
          enqueue({verb = "deactivate"})
        else
          local name = section.options[index + 1]
          if name == nil then
            state.errorText = "Prism returned an invalid selection index"
            render()
            return
          end
          enqueue({verb = "activate", name = name})
        end
        render()
      end,
    }),
    ui.button({
      glyph = "device-floppy",
      variant = "ghost",
      controlSize = "sm",
      selected = state.naming ~= nil,
      tooltip = "Save the current values as a profile",
      onClick = function()
        state.naming = state.naming == nil and "" or nil
        render()
      end,
    }),
    ui.button({
      glyph = "trash",
      variant = "ghost",
      controlSize = "sm",
      opacity = loaded and 1.0 or inertOpacity,
      tooltip = loaded and ("Delete profile " .. section.activeName) or "No profile loaded to delete",
      onClick = function()
        if section.activeName == nil then return end
        enqueue({verb = "delete", name = section.activeName})
        render()
      end,
    }),
  })
end

local function nameRow()
  return ui.row({gap = 8, align = "center"}, {
    ui.spacer({width = labelColumnWidth}),
    ui.input({
      value = state.naming,
      placeholder = "Profile name",
      controlSize = "sm",
      flexGrow = 1,
      focus = true,
      submitOnEnter = true,
      onChange = function(text) state.naming = tostring(text or "") end,
      onSubmit = commitName,
    }),
  })
end

-- The wallpaper on screen, what it holds, and the pin that makes it the write
-- target. The pin stays enabled even when a profile blocks it: Noctalia gates a
-- Button's hit area on `enabled`, and the tooltip lives on that hit area, so a
-- disabled pin could not say why it is unavailable. Greyed by opacity, guarded
-- in the handler -- the same bargain every reset in this panel makes.
local function wallpaperHeaderRow(header)
  return ui.row({gap = 8, align = "center"}, {
    ui.label({text = header.name, fontWeight = "medium", maxWidth = labelColumnWidth, maxLines = 1}),
    ui.label({
      text = header.overrides .. (header.overrides == 1 and " override" or " overrides"),
      fontSize = 12, color = "on_surface_variant", flexGrow = 1,
    }),
    ui.button({
      glyph = header.pinned and "pin-filled" or "pin",
      variant = "ghost",
      controlSize = "sm",
      selected = header.pinned,
      opacity = header.canPin and 1.0 or inertOpacity,
      tooltip = header.tooltip,
      onClick = function()
        if not header.canPin then return end
        enqueue({verb = "pin", on = not header.pinned})
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
  if state.model == nil then
    children[#children + 1] = ui.label({text = "Loading Prism…", color = "on_surface_variant"})
  else
    local title = Presentation.titleParam(state.model.params)
    children[#children + 1] = ui.row({gap = 10, align = "center"}, {
      ui.label({text = "Prism", fontSize = 18, fontWeight = "bold", flexGrow = 1}),
      ui.label({
        text = title.shadowed and Presentation.shadowHint(title) or "",
        fontSize = 11, color = "on_surface_variant", visible = title.shadowed == true,
      }),
      ui.toggle({
        checked = title.value == true,
        enabled = title.effectiveDrag ~= nil,
        opacity = title.shadowed and shadowedOpacity or 1.0,
        onChange = function(value) writeParam(title, value == true or value == "true") end,
      }),
    })
    -- Profile sits above wallpaper in the resolution order, so it sits above it
    -- here too.
    children[#children + 1] = profileRow(Presentation.profileSection(state.model))
    if state.naming ~= nil then children[#children + 1] = nameRow() end
    local header = Presentation.wallpaperHeader(state.model)
    if header then children[#children + 1] = wallpaperHeaderRow(header) end
    for _, section in ipairs(Presentation.sections(state.model.params)) do appendSection(children, section) end
  end
  panel.render(ui.scroll({flexGrow = 1, gap = 6, padding = 16}, children))
end

-- Opening the panel is a fresh gesture, like starting a batch: the Luau runtime
-- survives a close, so a sticky command error would otherwise greet the next
-- session behind a model that reconciles perfectly well.
function onOpen(context)
  state.errorText = nil
  state.errorSticky = false
  refresh()
end

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
