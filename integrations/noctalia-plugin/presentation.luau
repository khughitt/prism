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
  return (value - low) / (high - low)
end

local function denormalized(value, param)
  local low, high = param.range[1], param.range[2]
  if scale(param) == "logarithmic" then return low * (high / low) ^ value end
  return low + value * (high - low)
end

function M.snapValue(value, range, step)
  local clamped = math.max(range[1], math.min(range[2], value))
  local snapped = range[1] + math.floor((clamped - range[1]) / step + 0.5) * step
  snapped = math.max(range[1], math.min(range[2], snapped))
  return rounded(snapped, math.max(M.stepPrecision(step), M.stepPrecision(range[1]), M.stepPrecision(range[2])))
end

function M.sliderFrom(param)
  if display(param) == "percent" then return asPercent(param.range[1], param) end
  if display(param) == "normalized" or scale(param) == "logarithmic" then return 0 end
  return param.range[1]
end

function M.sliderTo(param)
  if display(param) == "percent" then return asPercent(param.range[2], param) end
  if display(param) == "normalized" or scale(param) == "logarithmic" then return 1 end
  return param.range[2]
end

function M.sliderStep(param)
  if display(param) == "percent" then return asPercent(param.ui.step, param) end
  if display(param) == "normalized" or scale(param) == "logarithmic" then return 0 end
  return param.ui.step
end

function M.toSliderValue(value, param)
  if display(param) == "percent" then return asPercent(value, param) end
  if display(param) == "normalized" or scale(param) == "logarithmic" then return normalized(value, param) end
  return value
end

function M.canonicalFromSlider(value, param)
  local canonical = value
  if display(param) == "percent" then
    canonical = value / 100
  elseif display(param) == "normalized" or scale(param) == "logarithmic" then
    canonical = denormalized(value, param)
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
-- control. Sliders with ui.state pair into matrix rows keyed by ui.row
-- (focused left, unfocused right); everything else is a single-parameter row.
function M.sections(params)
  local visible = {}
  for _, param in ipairs(params) do
    if param.ui.control ~= "none" and param.ui.group ~= "Title" then visible[#visible + 1] = param end
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
      local row = rowsByName[param.ui.row]
      if not row then
        row = { row = param.ui.row, section = section.name }
        rowsByName[param.ui.row] = row
        section.rows[#section.rows + 1] = row
      elseif row.section ~= section.name then
        error("row " .. param.ui.row .. " spans sections " .. row.section .. " and " .. section.name)
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
    row.section = nil
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

function M.modifiedCount(params)
  local count = 0
  for _, param in ipairs(params) do if param.modified then count = count + 1 end end
  return count
end

return M
