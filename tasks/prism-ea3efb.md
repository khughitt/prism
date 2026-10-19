---
id: prism-ea3efb
title: Bar widget flags a host-disabled Prism panel and revives it
status: todo
priority: 2
size: m
complexity: mid
process: planned
created: 2026-10-17T21:19:38Z
updated: 2026-10-19T00:01:53Z
depends: [prism-220e66]
parent: prism-ab3a3d
tags: [noctalia, ui]
agent: claude-code/claude-opus-5-5
---

Why: when a panel callback overruns Noctalia's 25 ms budget three times running (or five in a minute), the host disables the panel runtime until reload. The sliders still move but nothing applies, and the only sign is one 6 s toast. The user should see that the panel stopped and be able to bring it back without reading the log. From prism-dac509's spec, Follow-ups: the host's one-time notification is easy to miss; a panel-side heartbeat cannot run while the runtime is disabled. Upstream #3893 tracks the host side and would retire this work.

Established (probe prism-220e66, 2026-10-18, Noctalia 5.3.0; brief section "Probe result"):
- The bar widget's runtime keeps ticking while the panel's is disabled, and receives shared-state pushes (noctalia.state) from the panel whenever the panel runs.
- A panel beat written in update() goes stale on disable; a 1 s widget poll with a 3 s threshold saw it 2.6 s after the disable. noctalia.notify, setGlyph and setTooltip work from the widget.
- Rewriting the panel source with the same bytes from the widget (noctalia.writeFile) hot-reloads the panel within 1 ms, clears the disable and re-runs onOpen when the panel is open.
- A panel disabled while closed, then opened outside the widget, is invisible to the beat rule: onOpen is dropped. The widget caught it only by opening the panel itself and expecting an onOpen acknowledgement within 3 s. Super+P (dotfiles niri/config.kdl) opens the panel with `noctalia msg panel-toggle`, which no widget sees.
- Prism's plugin directory is a symlink into this checkout, so rewriting panel.luau touches a tracked file; a module the panel requires, kept out of git, reloads the owning entry the same way.
- No plugin API reports whether a panel is open.

Approach (alternative A, amended): the widget owns every open (onClick, and a widget onIpc "toggle" that Super+P calls instead of panel-toggle) and expects an onOpen acknowledgement; the panel beats into shared state while open and clears its open flag on close; the widget flags a missing acknowledgement or a stale beat with a lasting glyph and tooltip; a click revives the panel by rewriting a dedicated, untracked reload module.

Design to settle in the spec: the shared-state contract (keys, units, who clears what on load and close); the revive module's location and how it stays out of git; whether a click restarts the panel or only explains how (brief question 3); whether the widget also notifies, given the host toast (question 4); how a deliberate revive avoids a loop when the cause recurs at once; how the cost stays well under the budget in both runtimes; the Super+P change in dotfiles (a dots piece under prism-ab3a3d); and how to test it offline (plugin_test.lua, contract.test.mjs) and in-host.

Done: a disabled Prism panel shows a lasting bar glyph and tooltip within about 3 s while open, or on the next open however it is opened; a click revives it with onOpen re-run; a normal close or a never-opened panel never shows the notice; Super+P routes through the widget; the contract is documented in docs/notes/noctalia-plugin-contract.md.

Where to look: docs/notes/2026-10-17-panel-disabled-notice-brief.md (host code references, Probe result, alternatives); the probe plugin and host log attached to prism-220e66; integrations/noctalia-plugin/widget.luau and panel.luau (onOpen, onClose, update); docs/notes/noctalia-plugin-contract.md.

## Notes

- 2026-10-17T21:27:53Z (main): scope: briefed; parented under goal prism-ab3a3d, waits on probe prism-220e66 (can the bar widget see a stale panel heartbeat and hot-reload the panel?); host facts read from Noctalia fork 7f547389f, upstream #3893 still open 2026-10-12; brief: docs/notes/2026-10-17-panel-disabled-notice-brief.md
- 2026-10-18T23:57:40Z (probe/panel-revive): probe prism-220e66 (2026-10-18): alternative A works on Noctalia 5.3.0 — the widget keeps ticking, sees a stale beat ~2.6 s after the disable, can notify, and revives the panel by rewriting its source (hot reload clears unhealthy, re-runs onOpen). Two amendments: every open must go through the widget with an onOpen ack (Super+P's panel-toggle IPC is invisible, and a panel disabled while closed then opened shows no beat), and revive should rewrite an untracked reload module rather than the tracked panel.luau. See the brief's Probe result section.
