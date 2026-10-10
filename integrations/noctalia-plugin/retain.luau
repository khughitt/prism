-- Subtrees the panel built on an earlier render, each under the signature of
-- the inputs that shaped it. A unit whose signature is unchanged is handed back
-- whole; see docs/specs/2026-10-10-panel-render-budget-design.md.
local M = {}

function M.new()
  return { entries = {}, trace = nil }
end

function M.get(memo, id, signature, build)
  local entry = memo.entries[id]
  if entry ~= nil and entry.signature == signature then return entry.node end
  local node = build()
  memo.entries[id] = { signature = signature, node = node }
  if memo.trace ~= nil then memo.trace[#memo.trace + 1] = id end
  return node
end

-- Eviction follows the model's structure, not a render: a parent's hit skips
-- its children's lookups, so "unused this render" would drop nodes on screen.
function M.keep(memo, ids)
  for id in pairs(memo.entries) do
    if not ids[id] then memo.entries[id] = nil end
  end
end

function M.clear(memo)
  memo.entries = {}
end

return M
