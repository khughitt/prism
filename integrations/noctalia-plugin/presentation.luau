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

local function rounded(value, precision)
  return tonumber(string.format("%." .. precision .. "f", value))
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

function M.formatValue(value, param)
  local shown, precision, suffix = value, M.stepPrecision(param.ui.step), param.ui.unit or ""
  if display(param) == "percent" then
    shown, precision, suffix = asPercent(value, param), percentPrecision(param), "%"
  elseif display(param) == "normalized" then
    shown, precision = normalized(value, param), 3
  end
  return tostring(rounded(shown, precision)) .. suffix
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

function M.groupParams(params)
  local visible = {}
  for _, param in ipairs(params) do
    if param.ui.control ~= "none" and param.ui.group ~= "Title" then visible[#visible + 1] = param end
  end
  table.sort(visible, function(a, b) return a.ui.order < b.ui.order end)

  local groups, byName = {}, {}
  for _, param in ipairs(visible) do
    local group = byName[param.ui.group]
    if not group then
      group = { name = param.ui.group, params = {} }
      byName[param.ui.group] = group
      groups[#groups + 1] = group
    end
    group.params[#group.params + 1] = param
  end

  for index, group in ipairs(groups) do
    if group.name == "Quick" and index ~= 1 then
      table.remove(groups, index)
      table.insert(groups, 1, group)
      break
    end
  end
  return groups
end

function M.modifiedCount(params)
  local count = 0
  for _, param in ipairs(params) do if param.modified then count = count + 1 end end
  return count
end

return M
