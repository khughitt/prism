local M = {}

function M.stepPrecision(step)
  local text = tostring(step):lower()
  local exponentAt = text:find("e-", 1, true)
  if exponentAt then
    local coefficient = text:sub(1, exponentAt - 1)
    local decimalAt = coefficient:find(".", 1, true)
    local fractional = decimalAt and #coefficient - decimalAt or 0
    return tonumber(text:sub(exponentAt + 2)) + fractional
  end
  local decimalAt = text:find(".", 1, true)
  return decimalAt and #text - decimalAt or 0
end

local function display(param) return param.ui.display or "raw" end
local function scale(param) return param.ui.scale or "linear" end
-- A curved track runs in normalized space whatever its label reads.
local function curved(param) return scale(param) ~= "linear" end

local function percentPrecision(param)
  return math.max(0, math.max(M.stepPrecision(param.ui.step), M.stepPrecision(param.range[1]),
    M.stepPrecision(param.range[2])) - 2)
end

local function multiplicationError(left, right, product)
  local splitter = 134217729 -- 2^27 + 1 splits an IEEE-754 double's significand.
  local splitLeft = splitter * left
  local leftHigh = splitLeft - (splitLeft - left)
  local leftLow = left - leftHigh
  local splitRight = splitter * right
  local rightHigh = splitRight - (splitRight - right)
  local rightLow = right - rightHigh
  return ((leftHigh * rightHigh - product) + leftHigh * rightLow + leftLow * rightHigh)
    + leftLow * rightLow
end

local function rounded(value, precision)
  local sign, magnitude = value < 0 and -1 or 1, math.abs(value)
  local factor = 10 ^ precision
  local scaled = magnitude * factor
  local whole = math.floor(scaled)
  local fraction = scaled - whole
  if fraction > 0.5 or fraction == 0.5 and multiplicationError(magnitude, factor, scaled) >= 0 then
    whole = whole + 1
  end
  local result = whole / factor
  if result % 1 == 0 then return sign * math.floor(result) end
  return sign * result
end

local function asPercent(value, param)
  return rounded(value * 100, percentPrecision(param))
end

local function normalized(value, param)
  local low, high = param.range[1], param.range[2]
  if scale(param) == "logarithmic" then return math.log(value / low) / math.log(high / low) end
  if scale(param) == "power" then return ((value - low) / (high - low)) ^ (1 / param.ui.exponent) end
  return (value - low) / (high - low)
end

local function denormalized(value, param)
  local low, high = param.range[1], param.range[2]
  if scale(param) == "logarithmic" then return low * (high / low) ^ value end
  if scale(param) == "power" then return low + value ^ param.ui.exponent * (high - low) end
  return low + value * (high - low)
end

function M.snapValue(value, range, step)
  local clamped = math.max(range[1], math.min(range[2], value))
  local snapped = range[1] + math.floor((clamped - range[1]) / step + 0.5) * step
  snapped = math.max(range[1], math.min(range[2], snapped))
  return rounded(snapped, math.max(M.stepPrecision(step), M.stepPrecision(range[1]), M.stepPrecision(range[2])))
end

local function normalizedTrack(param)
  return curved(param) or display(param) == "normalized"
end

function M.sliderFrom(param)
  if normalizedTrack(param) then return 0 end
  if display(param) == "percent" then return asPercent(param.range[1], param) end
  return param.range[1]
end

function M.sliderTo(param)
  if normalizedTrack(param) then return 1 end
  if display(param) == "percent" then return asPercent(param.range[2], param) end
  return param.range[2]
end

function M.sliderStep(param)
  if normalizedTrack(param) then return 0 end
  if display(param) == "percent" then return asPercent(param.ui.step, param) end
  return param.ui.step
end

function M.toSliderValue(value, param)
  if normalizedTrack(param) then return normalized(value, param) end
  if display(param) == "percent" then return asPercent(value, param) end
  return value
end

function M.canonicalFromSlider(value, param)
  local canonical = value
  if normalizedTrack(param) then
    canonical = denormalized(value, param)
  elseif display(param) == "percent" then
    canonical = value / 100
  end
  return M.snapValue(canonical, param.range, param.ui.step)
end

function M.stepCanonicalValue(value, direction, param)
  if direction == 0 then return value end
  return M.snapValue(value + (direction > 0 and 1 or -1) * param.ui.step, param.range, param.ui.step)
end

function M.canonicalFromSliderStep(value, currentValue, param)
  if M.sliderStep(param) ~= 0 then return nil end
  local current = M.toSliderValue(currentValue, param)
  local nativeStep = (M.sliderTo(param) - M.sliderFrom(param)) * 0.05
  local delta = value - current
  local tolerance = 1e-9 * math.max(1, math.abs(current), math.abs(value))
  if math.abs(math.abs(delta) - nativeStep) > tolerance then return nil end
  return M.stepCanonicalValue(currentValue, delta, param)
end

local function fixed(value, precision)
  local text = string.format("%." .. precision .. "f", value)
  if precision > 0 then text = text:gsub("0+$", ""):gsub("%.$", "") end
  return text == "-0" and "0" or text
end

function M.formatValue(value, param)
  local shown, precision, suffix = value, M.stepPrecision(param.ui.step), param.ui.unit or ""
  if display(param) == "percent" then
    shown, precision, suffix = asPercent(value, param), percentPrecision(param), "%"
  elseif display(param) == "normalized" then
    shown, precision = normalized(value, param), 3
  end
  return fixed(rounded(shown, precision), precision) .. suffix
end

function M.titleParam(params)
  local matches = {}
  for _, param in ipairs(params) do
    if param.ui.control ~= "none" and param.ui.group == "Title" then matches[#matches + 1] = param end
  end
  if #matches ~= 1 or matches[1].ui.control ~= "toggle" then
    error("Title must contain exactly one visible toggle")
  end
  return matches[1]
end

-- Sections are the panel's body: one per ui.group in order of first
-- appearance by ui.order. A toggle flagged ui.header is the section's header
-- control. Parameters with ui.state pair into matrix rows keyed by group and ui.row
-- (unfocused left, focused right); everything else is a single-parameter row.
function M.sections(params, skipGroup)
  local visible = {}
  for _, param in ipairs(params) do
    if param.ui.control ~= "none" and param.ui.group ~= "Title" and param.ui.group ~= skipGroup then
      visible[#visible + 1] = param
    end
  end
  table.sort(visible, function(a, b) return a.ui.order < b.ui.order end)

  local sections, byName, rowsByName = {}, {}, {}
  for _, param in ipairs(visible) do
    local section = byName[param.ui.group]
    if not section then
      section = { name = param.ui.group, toggle = nil, rows = {} }
      byName[param.ui.group] = section
      sections[#sections + 1] = section
    end
    if param.ui.state ~= nil then
      local id = param.ui.group .. "\0" .. param.ui.row
      local row = rowsByName[id]
      if not row then
        row = { row = param.ui.row }
        rowsByName[id] = row
        section.rows[#section.rows + 1] = row
      end
      if row[param.ui.state] ~= nil then
        error("row " .. param.ui.row .. " has two " .. param.ui.state .. " parameters")
      end
      row[param.ui.state] = param
    elseif param.ui.header == true then
      if section.toggle ~= nil then error("section " .. section.name .. " has two header toggles") end
      section.toggle = param
    else
      section.rows[#section.rows + 1] = { param = param }
    end
  end
  for _, row in pairs(rowsByName) do
    for _, state in ipairs({ "focused", "unfocused" }) do
      if row[state] == nil then error("row " .. row.row .. " has no " .. state .. " parameter") end
    end
  end
  return sections
end

function M.sectionParams(section)
  local list = {}
  if section.toggle then list[#list + 1] = section.toggle end
  for _, row in ipairs(section.rows) do
    if row.param then
      list[#list + 1] = row.param
    else
      list[#list + 1] = row.focused
      list[#list + 1] = row.unfocused
    end
  end
  return list
end

-- Which layers hold a key is the store's knowledge, stated per parameter in
-- `held`. The panel derives every count from it rather than from the value.
function M.holds(param, layer)
  for _, name in ipairs(param.held or {}) do
    if name == layer then return true end
  end
  return false
end

function M.editedCount(params)
  local count = 0
  for _, param in ipairs(params) do if param.edited then count = count + 1 end end
  return count
end

-- The active wallpaper as a header row: which one, and how many visible keys
-- its delta holds. The id travels with the row so clear and commit name what
-- they act on and a panel drawn before a rotation is refused, not obeyed.
function M.wallpaperHeader(model)
  local wallpaper = model.active.wallpaper
  if wallpaper == nil then return nil end
  local tuned = 0
  for _, param in ipairs(model.params) do
    if param.ui.control ~= "none" and M.holds(param, "wallpaper") then tuned = tuned + 1 end
  end
  return {
    id = wallpaper.id,
    name = tostring(wallpaper.path):match("([^/]+)$") or tostring(wallpaper.path),
    tuned = tuned,
  }
end

-- The store's rule for a context name, checked here so a bad one never becomes
-- a failed command the user has to read out of an error banner.
function M.validProfileName(name)
  return type(name) == "string" and name:match("^[A-Za-z0-9._%-]+$") ~= nil
end

function M.profileExists(model, name)
  for _, candidate in ipairs(model.profiles) do
    if candidate == name then return true end
  end
  return false
end

-- The selector doubles as the clear control: index 0 is the Default look, the
-- unnamed base values. It is truthful now that the wallpaper delta shows on
-- top of Default exactly as it shows on top of any profile.
function M.profileSection(model)
  local options = { "Default" }
  local selectedIndex = 0
  for index, name in ipairs(model.profiles) do
    options[index + 1] = name
    if name == model.active.profile then selectedIndex = index end
  end
  return { options = options, selectedIndex = selectedIndex, activeName = model.active.profile }
end

-- One color per device category. Noctalia gives a plugin no theme palette, so
-- these are constants; a card's fill is the same color at hex alpha 1f.
M.categoryColors = { source = "#5b9cf6", geometry = "#c78bfa", optic = "#4fd1c5", post = "#f6ad55" }

-- One theme role per section, so a group is findable without reading its
-- header. Roles resolve against the live theme; the cycle is longer than the
-- panel's section count, so no two sections ever share a color.
M.sectionColors = { "primary", "secondary", "tertiary" }

function M.sectionColor(index)
  return M.sectionColors[(index - 1) % #M.sectionColors + 1]
end

-- The rack: the group describe names, as an ordered list of device cards. Each
-- card owns one mix row (always shown), detail rows and shared keys (shown
-- when expanded), and its bypass key. The panel resolves row labels and keys
-- against params itself and refuses a rack that does not cover the group, so
-- a definition added without a device fails loudly instead of vanishing.
function M.rack(model)
  local rack = model.rack
  if type(rack) ~= "table" or type(rack.group) ~= "string" or type(rack.devices) ~= "table" then
    error("prism describe returned no rack", 0)
  end
  local rows, singles, header = {}, {}, nil
  for _, param in ipairs(model.params) do
    if param.ui.control ~= "none" and param.ui.group == rack.group then
      if param.ui.state ~= nil then
        local row = rows[param.ui.row] or { row = param.ui.row }
        if row[param.ui.state] ~= nil then
          error("row " .. param.ui.row .. " has two " .. param.ui.state .. " parameters")
        end
        row[param.ui.state] = param
        rows[param.ui.row] = row
      elseif param.ui.header == true then
        if header ~= nil then error("section " .. rack.group .. " has two header toggles") end
        header = param
      else
        singles[param.key] = param
      end
    end
  end
  local claimedRows, claimedKeys, byId, cards = {}, {}, {}, {}
  local function takeRow(label, id)
    local row = rows[label]
    if row == nil or row.focused == nil or row.unfocused == nil then
      error("device " .. id .. " names no matrix row " .. tostring(label))
    end
    if claimedRows[label] then error("row " .. label .. " belongs to two devices") end
    claimedRows[label] = true
    return row
  end
  local function takeKey(key, id)
    local param = singles[key]
    if param == nil then error("device " .. id .. " names no parameter " .. tostring(key)) end
    if claimedKeys[key] then error("parameter " .. key .. " belongs to two devices") end
    claimedKeys[key] = true
    return param
  end
  for _, device in ipairs(rack.devices) do
    local id = tostring(device.device)
    if M.categoryColors[device.category] == nil then
      error("device " .. id .. " has unknown category " .. tostring(device.category))
    end
    local card = { device = id, label = device.label, category = device.category, rows = {}, shared = {} }
    card.mix = takeRow(device.mix, id)
    for _, label in ipairs(device.rows or {}) do card.rows[#card.rows + 1] = takeRow(label, id) end
    for _, key in ipairs(device.shared or {}) do card.shared[#card.shared + 1] = takeKey(key, id) end
    card.bypass = takeKey(device.bypass, id)
    if device.requires ~= nil then
      card.requires = byId[device.requires]
        or error("device " .. id .. " requires unknown device " .. tostring(device.requires))
    end
    byId[id] = card
    cards[#cards + 1] = card
  end
  for label in pairs(rows) do
    if not claimedRows[label] then error("row " .. label .. " belongs to no device") end
  end
  for key in pairs(singles) do
    if not claimedKeys[key] then error("parameter " .. key .. " belongs to no device") end
  end
  for _, card in ipairs(cards) do
    card.bypassed = card.bypass.value == true
    card.silenced = card.requires ~= nil and card.requires.bypass.value == true
  end
  return { group = rack.group, header = header, cards = cards }
end

-- Bypass first: it is the first row of the expanded card.
function M.cardParams(card)
  local list = { card.bypass, card.mix.focused, card.mix.unfocused }
  for _, row in ipairs(card.rows) do
    list[#list + 1] = row.focused
    list[#list + 1] = row.unfocused
  end
  for _, param in ipairs(card.shared) do list[#list + 1] = param end
  return list
end

function M.rackParams(rack)
  local list = {}
  if rack.header then list[#list + 1] = rack.header end
  for _, card in ipairs(rack.cards) do
    for _, param in ipairs(M.cardParams(card)) do list[#list + 1] = param end
  end
  return list
end

function M.pairsOf(params)
  local rows, order = {}, {}
  for _, param in ipairs(params) do
    if param.ui.control ~= "none" and param.ui.state ~= nil then
      local id = param.ui.group .. "\0" .. param.ui.row
      if rows[id] == nil then rows[id], order[#order + 1] = {}, id end
      rows[id][param.ui.state] = param
    end
  end
  local list = {}
  for _, id in ipairs(order) do
    local row = rows[id]
    if row.focused ~= nil and row.unfocused ~= nil then list[#list + 1] = row end
  end
  return list
end

function M.symmetricCount(params)
  local count = 0
  for _, row in ipairs(M.pairsOf(params)) do
    if row.focused.value ~= row.unfocused.value then count = count + 1 end
  end
  return count
end

function M.neutralCount(params)
  local count = 0
  for _, param in ipairs(params) do
    if param.ui.control ~= "none" and param.neutralize ~= false and param.value ~= param.neutral then count = count + 1 end
  end
  return count
end

function M.visibleParams(model)
  local list = {}
  for _, param in ipairs(model.params) do
    if param.ui.control ~= "none" then list[#list + 1] = param end
  end
  return list
end

return M
