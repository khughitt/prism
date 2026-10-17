"""Add the short-comparison probe to one exported plugin copy, in place.

Times host-invoked callbacks with os.clock() and logs one PRISMPROBE line per
span through noctalia.log. Key `c` expands every rack card, then the next ten
frame ticks each run one render with the retained memo cleared (a cold render).
"""
import sys
from pathlib import Path

root = Path(sys.argv[1])
tag = sys.argv[2]
panel = root / "panel.luau"
src = panel.read_text()

HEADER = f'''
local __probe = {{tag = "{tag}", seq = 0, cold = 0, nonce = tostring(os.time())}}
function __probe.emit(label, t0)
  local ms = (os.clock() - t0) * 1000
  __probe.seq = __probe.seq + 1
  noctalia.log(string.format("PRISMPROBE %s %s %d %s %.3f", __probe.nonce, __probe.tag, __probe.seq, label, ms))
end
noctalia.log(string.format("PRISMPROBE %s %s 0 loaded 0", __probe.nonce, __probe.tag))
function __probe.quiet(label, t0)
  if (os.clock() - t0) * 1000 >= 1 then __probe.emit(label, t0) end
end
'''

RUN = '''do
  local inner = run
  run = function(argv, callback)
    local label = "async:" .. tostring(argv[2])
    return inner(argv, function(...)
      local t0 = os.clock()
      callback(...)
      __probe.emit(label, t0)
    end)
  end
end

'''

END_DRAG = '''do
  local inner = endDrag
  endDrag = function(key)
    local t0 = os.clock()
    inner(key)
    __probe.emit("dragEnd", t0)
  end
end

'''

RENDER = '''do
  local inner = render
  render = function()
    local t0 = os.clock()
    inner()
    __probe.emit("render", t0)
  end
end

'''

TAIL = '''
function __probe.startCold()
  for _, card in ipairs(state.structure.rack.cards) do state.expanded[card.device] = true end
  __probe.done = true
  __probe.cold = 10
  panel.setNeedsFrameTick(true)
  noctalia.log("PRISMPROBE " .. __probe.nonce .. " " .. __probe.tag .. " 0 coldStart 0")
end

do
  local innerOpen = onOpen
  onOpen = function(context)
    local t0 = os.clock()
    local _ = state
    innerOpen(context)
    if not __probe.done and not PROBE_NO_ARM then __probe.armed = 3 end
    __probe.emit("open", t0)
  end
  local innerUpdate = update
  update = function()
    local t0 = os.clock()
    innerUpdate()
    if __probe.armed ~= nil then
      __probe.armed = __probe.armed - 1
      if __probe.armed <= 0 and state.structure ~= nil then
        __probe.armed = nil
        __probe.startCold()
      end
    end
    __probe.quiet("update", t0)
  end
  local innerTick = onFrameTick
  onFrameTick = function(deltaMs)
    local t0 = os.clock()
    innerTick(deltaMs)
    if __probe.cold > 0 and state.drag == nil and state.model ~= nil and not state.renderPending then
      local c0 = os.clock()
      Retain.clear(memo)
      render()
      __probe.emit("coldRender", c0)
      __probe.cold = __probe.cold - 1
      panel.setNeedsFrameTick(__probe.cold > 0)
    end
    __probe.quiet("frameTick", t0)
  end
  local innerKey = onKey
  onKey = function(chord, pressed)
    noctalia.log("PRISMPROBE " .. __probe.nonce .. " " .. __probe.tag .. " 0 keyRaw:" .. tostring(chord) .. " 0")
    if chord == "c" then
      if pressed and state.structure ~= nil then __probe.startCold() end
      return
    end
    local t0 = os.clock()
    innerKey(chord, pressed)
    __probe.quiet("key", t0)
  end
end
'''


def insert_before(text, anchor, block):
    assert text.count(anchor) == 1, anchor
    return text.replace(anchor, block + anchor)


requires_end = 'local Retain = require("./retain.luau")\n'
src = insert_before(src, requires_end, "")
src = src.replace(requires_end, requires_end + HEADER, 1)
src = insert_before(src, "local function trimmed(value)", RUN)
src = insert_before(src, "local function selectIndex(param)", END_DRAG)
src = insert_before(src, "-- Opening the panel is a fresh gesture", RENDER)
src = src + TAIL
panel.write_text(src)

manifest = root / "plugin.toml"
toml = manifest.read_text()
anchor = 'capture_keys = ["shift+question",'
assert toml.count(anchor) == 1
manifest.write_text(toml.replace(anchor, 'capture_keys = ["c", "shift+question",'))
