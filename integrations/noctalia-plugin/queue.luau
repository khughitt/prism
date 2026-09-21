local M = {}

function M.new()
  return { inFlight = nil, pending = {} }
end

function M.isSample(item)
  return item ~= nil and item.verb == "set" and item.sample == true
end

-- Commits and clears write no parameter and the profile verbs write none
-- either, but each moves the resolved values or what the layers hold, so
-- every row's edited state has to be re-read once one lands.
local staleAfter = {
  set = true, unset = true, reset = true, commit = true, clear = true,
  activate = true, deactivate = true, delete = true, rename = true,
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

function M.captureSlots(model)
  local active = model.active
  return {
    look = active.profile == nil and "default" or "profile:" .. active.profile,
    wallpaper = active.wallpaper == nil and "none" or "id:" .. active.wallpaper.id,
  }
end

local function withExpected(argv, item)
  if item.expected ~= nil then
    argv[#argv + 1] = "--expect-look"
    argv[#argv + 1] = item.expected.look
    argv[#argv + 1] = "--expect-wallpaper"
    argv[#argv + 1] = item.expected.wallpaper
  end
  return argv
end

function M.argvFor(item)
  if item.verb == "set" then return { "prism", "set", item.key, tostring(item.value) } end
  if item.verb == "unset" then return { "prism", "unset", item.key } end
  if item.verb == "clear" then return withExpected({ "prism", "context", "clear", "wallpaper", item.id }, item) end
  if item.verb == "commit" then
    local argv = { "prism", "commit", item.destination }
    if item.target ~= nil then argv[#argv + 1] = item.target end
    return withExpected(argv, item)
  end
  if item.verb == "deactivate" then return { "prism", "context", "deactivate", "profile" } end
  if item.verb == "rename" then return withExpected({ "prism", "context", "rename", "profile", item.name, item.newName }, item) end
  if item.verb == "reset" then
    local argv = { "prism", "reset", item.mode }
    if item.group ~= nil then
      argv[#argv + 1] = "--group"
      argv[#argv + 1] = item.group
    end
    return argv
  end
  for _, verb in ipairs({ "activate", "delete" }) do
    if item.verb == verb then
      local argv = { "prism", "context", verb, "profile", item.name }
      return verb == "delete" and withExpected(argv, item) or argv
    end
  end
  error("unknown queue verb: " .. item.verb)
end

return M
