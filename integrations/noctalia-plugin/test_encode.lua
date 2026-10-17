-- Stable text for test host digests; keys sort and numbers keep their precision.
local function encode(value)
  if type(value) == "number" then return string.format("%.17g", value) end
  if type(value) ~= "table" then return type(value) == "string" and string.format("%q", value) or tostring(value) end
  local keys = {}
  for key in pairs(value) do keys[#keys + 1] = key end
  table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
  local parts = {}
  for _, key in ipairs(keys) do parts[#parts + 1] = tostring(key) .. "=" .. encode(value[key]) end
  return "{" .. table.concat(parts, ",") .. "}"
end

return encode
