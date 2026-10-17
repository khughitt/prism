---
id: prism-220e66
title: Establish whether the bar widget can detect and revive a host-disabled panel
status: todo
priority: 3
size: s
complexity: mid
process: direct
created: 2026-10-17T21:26:39Z
updated: 2026-10-17T21:26:39Z
depends: []
parent: prism-ab3a3d
tags: [noctalia]
agent: claude-code/claude-opus-5-5
---

Question: While Noctalia holds a plugin panel runtime unhealthy, does the same plugin's bar widget keep running, see the panel's heartbeat go stale through noctalia.state, show its own notice (glyph, tooltip, noctalia.notify), and revive the panel by touching the panel source so the host hot-reloads it?
Where to start: docs/notes/2026-10-17-panel-disabled-notice-brief.md (Current behaviour lists the host code, read from the local fork of noctalia at 7f547389f, 2026-09-29); the panel's onOpen/onClose/update in integrations/noctalia-plugin/panel.luau; widget.luau. First check that the installed Noctalia still matches that code (script_runtime.cpp updateHealth/enqueue, plugin_panel.cpp reloadScript, plugin_state_store.h).
Bound: A throwaway probe plugin with its own id (a panel whose update() writes a beat and whose button busy-loops past 25 ms three times, and a widget that watches and polls), installed beside khughitt/prism and removed afterwards; never the prism plugin or its ~/.local/share symlink. Opening the probe panel uses the live desktop: ask the owner at that moment. No Prism implementation.
Expected result: Record on this task and in the brief, for each step (unhealthy panel, widget still ticking, state pushes delivered, stale beat seen, notify shown, touch-reload clears unhealthy and re-runs onOpen), whether it happened, the host log lines, and a recommendation among the brief's alternatives.
Ideas it wakes: On completion, run `tasks note prism-ea3efb --no-reviewed "<finding>"` before this result's branch merges.
