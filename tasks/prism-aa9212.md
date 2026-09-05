---
id: prism-aa9212
title: Two-section Prism panel with a focused/unfocused matrix
status: todo
priority: 2
size: m
created: 2026-09-05T08:13:14Z
updated: 2026-09-05T08:13:14Z
depends: []
tags: [noctalia, ui]
---

Restructure the Noctalia panel into two always-open sections: Glass (shared: spacing, tint color, refraction, depth, frosted backdrop, shape, motion) and Focus (a matrix of focused|unfocused sliders for terminal opacity, blur, tint distance, fringing, distortion, directional blur, with the focus-state toggle in the header). Drop terminal.window.opacity.* and their niri opacity rules; demote debug.backdrop to CLI-only. Defs gain ui.state and ui.row; presentation groups paired params into matrix rows; panel width grows to fit two sliders. Update node and Lua tests, the plugin contract note, and the README.
