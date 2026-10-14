---
id: prism-c0500d
title: Find whether the panel can tell that no unfocused glass window is in view
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-10-14T11:02:12Z
updated: 2026-10-14T11:02:12Z
depends: []
parent: prism-67b1b2
tags: [noctalia, niri]
source: docs/notes/2026-10-14-panel-ergonomics-brief.md
agent: claude-code
---

Question: While the Prism panel is open on an output, can it determine from niri IPC whether that output's active workspace shows a terminal.apps window other than the active one (so both terminal-glass and terminal-glass-inactive are on screen), and which of the cheap remedies (a panel hint, scrolling a neighbouring column into view, spawning a probe terminal) keeps the active window active?
Where to start: integrations/niri/render.js assignmentRule (materials are assigned by is-active, which per niri's window-rule docs stays true for the workspace's active window while a layer surface holds keyboard focus); niri-ipc WindowLayout (pos_in_scrolling_layout, tile_size) and Workspace scrolling_view_pos in the niri-material checkout; the panel's originOutput state (widget.luau).
Bound: Read-only IPC probes plus one reproduction each with one and with two terminals on the workspace, panel open; confirm by observation that the active window keeps the focused material while the panel has focus. No panel implementation and no change to the user's window layout beyond the probe.
Expected result: Record the visibility rule, whether each remedy preserves the active window, and a recommendation on this task and in docs/notes/2026-10-14-panel-ergonomics-brief.md.
Ideas it wakes: On completion, run `tasks note prism-1c111f --no-reviewed "<finding>"` before this result's branch merges.
