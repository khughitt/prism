---
id: prism-aa9212
title: Two-section Prism panel with a focused/unfocused matrix
status: done
priority: 2
size: m
owner: feat/panel-matrix
created: 2026-09-05T08:13:14Z
updated: 2026-09-05T08:20:52Z
depends: []
tags: [noctalia, ui]
---

Restructure the Noctalia panel into two always-open sections: Glass (shared: spacing, tint color, refraction, depth, frosted backdrop, shape, motion) and Focus (a matrix of focused|unfocused sliders for terminal opacity, blur, tint distance, fringing, distortion, directional blur, with the focus-state toggle in the header). Drop terminal.window.opacity.* and their niri opacity rules; demote debug.backdrop to CLI-only. Defs gain ui.state and ui.row; presentation groups paired params into matrix rows; panel width grows to fit two sliders. Update node and Lua tests, the plugin contract note, and the README.

## Notes

- 2026-09-05T08:20:52Z (feat/panel-matrix): Panel is a Glass section plus a Focus matrix (focused|unfocused per optic, header toggle); terminal.window.opacity.* and their niri opacity rules removed; debug.backdrop CLI-only; defs gain ui.state/ui.row/ui.header with loader validation; 150 tests pass
