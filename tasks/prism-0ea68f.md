---
id: prism-0ea68f
title: Emit light-ior in the niri glass block
status: todo
priority: 2
size: s
complexity: low
created: 2026-09-05T17:14:03Z
updated: 2026-09-12T16:46:10Z
depends: []
tags: [niri]
---

niri-material material-26dd8a adds glass { light-ior } (1..12, default 6) as a multiplier on the focus filament's light path. The filament's shift is capped at half ring-inset, so at Prism's ior 1.24 every light-ior value saturates the cap and the knob only widens the chromatic split; deriving it from ior buys nothing there. Wait for niri-material material-a85a18 to settle the model before emitting the line. When it does: add a palette-overridable definition, emit 'light-ior <v>' in every glass block integrations/niri/render.js writes, and extend test/niri-render.test.js. Lands only after the native build is installed, since niri validate rejects the line until then.
