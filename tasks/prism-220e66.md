---
id: prism-220e66
title: Establish whether the bar widget can detect and revive a host-disabled panel
status: doing
priority: 3
size: s
complexity: mid
process: direct
owner: probe/panel-revive
created: 2026-10-17T21:26:39Z
updated: 2026-10-18T23:57:18Z
started: 2026-10-18T23:13:50Z
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

## Notes

- 2026-10-18T23:13:50Z (main): started
  provenance: {"harness_session":"claude-code:54c1a369-6c78-496c-b6e6-1e4155c87326","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-18T23:14:09Z (probe/panel-revive): resumed
  provenance: {"harness_session":"claude-code:54c1a369-6c78-496c-b6e6-1e4155c87326","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-18T23:19:11Z (probe/panel-revive): host check: installed noctalia is the Arch package 5.3.0-1 (built 2026-10-15), not the fork; v5.3.0 script_runtime.cpp and plugin_state_store.cpp are byte-identical to fork 7f547389f, plugin_panel.cpp/plugin_widget.cpp differ only in scroll-into-view and colour defaults, so the brief's host facts hold (enqueue drop at script_runtime.cpp:341, Reload clears unhealthy :411, panel log plugin_panel.cpp:349, reloadScript re-runs onOpen :536). No API reports whether a panel is open.
- 2026-10-18T23:19:13Z (probe/panel-revive): host pointer (probe run): symlink ~/.local/share/noctalia/plugins/panelrevive -> ~/.cache/prism-probes/panelrevive, probe/panelrevive in [plugins].enabled, and "probe/panelrevive:widget" inserted before "clock" in [bar.default].end of ~/.local/state/noctalia/settings.toml; restore: the run script's EXIT trap disables the plugin, removes the line and the link, config-reloads, and diffs against ~/.cache/prism-probes/out/settings.toml.before
- 2026-10-18T23:57:05Z (probe/panel-revive): attached: panelrevive-probe.tar.gz (2771 bytes): probe/panelrevive plugin (panel + widget) and the self-cleaning run.sh used on 2026-10-18 against Noctalia 5.3.0
- 2026-10-18T23:57:07Z (probe/panel-revive): attached: log-slice.txt (38607 bytes): Noctalia host log for the 2026-10-18 probe run, 19:54:47-19:55:26
- 2026-10-18T23:57:18Z (probe/panel-revive): detached: log-slice.txt: carried machine paths; replaced by a redacted copy
