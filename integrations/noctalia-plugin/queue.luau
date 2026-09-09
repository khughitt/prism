local M = {}

function M.new()
  return { inFlight = nil, pending = {} }
end

function M.isSample(item)
  return item ~= nil and item.verb == "set" and item.sample == true
end

-- A pin writes no value and a profile verb writes no parameter, but each moves
-- the write target or the resolved values, so every row's override and shadow
-- state has to be re-read once one lands.
local staleAfter = {
  set = true, unset = true, pin = true,
  activate = true, deactivate = true, save = true, delete = true,
}

function M.affectsParams(item)
  return staleAfter[item.verb] == true
end

function M.shouldRefresh(batchAffectsParams, lastItem)
  return batchAffectsParams and not M.isSample(lastItem)
end

function M.enqueue(state, item)
  if state.inFlight == nil then
    return { state = { inFlight = item, pending = state.pending }, launch = item }
  end

  local pending = {}
  for index, value in ipairs(state.pending) do pending[index] = value end
  local last = pending[#pending]
  if M.isSample(item) and M.isSample(last) and last.key == item.key then
    pending[#pending] = item
  else
    pending[#pending + 1] = item
  end
  return { state = { inFlight = state.inFlight, pending = pending }, launch = nil }
end

function M.finish(state)
  if #state.pending > 0 then
    local next = state.pending[1]
    local pending = {}
    for index = 2, #state.pending do pending[#pending + 1] = state.pending[index] end
    return { state = { inFlight = next, pending = pending }, launch = next, drained = false }
  end
  return { state = M.new(), launch = nil, drained = true }
end

function M.argvFor(item)
  if item.verb == "set" then return { "prism", "set", item.key, tostring(item.value) } end
  if item.verb == "unset" then return { "prism", "unset", item.key } end
  if item.verb == "pin" then return { "prism", "context", item.on and "pin" or "unpin", "wallpaper" } end
  if item.verb == "deactivate" then return { "prism", "context", "deactivate", "profile" } end
  for _, verb in ipairs({ "activate", "save", "delete" }) do
    if item.verb == verb then return { "prism", "context", verb, "profile", item.name } end
  end
  error("unknown queue verb: " .. item.verb)
end

return M
