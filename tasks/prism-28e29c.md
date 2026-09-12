---
id: prism-28e29c
title: Expose the ring of light in the palette
status: todo
priority: 2
size: m
complexity: low
created: 2026-09-05T20:56:45Z
updated: 2026-09-12T16:46:10Z
depends: [material-8c69c9]
tags: [niri]
---

niri-material material-26dd8a adds a response block to material definitions: focus "ring-light"|"none" (default ring-light), ring-inset (5), ring-width (2.6, > 0), ring-color ("#ccccff"), ring-drift-hz (15; 0 or 1..30 in tenths). Add palette parameters for the ring (color from the palette accent, drift rate, focus on/off) and emit a response "default" { ... } block inside both terminal-glass definitions integrations/niri/render.js writes; extend test/niri-render.test.js. The generated fragment fails niri validate until the native build is installed (niri-material material-8c69c9), so this lands only after that pin. light-ior stays with prism-0ea68f.
