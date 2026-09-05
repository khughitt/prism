---
id: prism-e9d332
title: Turn off the gradient focus-ring when glass is enabled
status: todo
priority: 2
size: s
created: 2026-09-05T20:56:45Z
updated: 2026-09-05T20:56:45Z
depends: []
tags: [niri]
---

niri-material's ring of light focus response (material-26dd8a) lights every focused material window; its docs tell material users to set focus-ring { off; } or both rings draw. renderNiriFragment already emits a layout { gaps } block that niri merges with the host config, so emit focus-ring { off; } in that block whenever glass.enabled is true, and extend test/niri-render.test.js. Works against the installed compositor today (focus-ring is core niri syntax).
