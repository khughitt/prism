---
id: prism-66b025
title: Flex and Ripple sliders have no visible effect
status: todo
priority: 2
size: s
created: 2026-09-06T00:32:53Z
updated: 2026-09-06T00:32:53Z
depends: []
tags: [niri, bug]
---

The jelly Flex (glass.jellyFlex, [0, 0.02]) and Ripple (glass.jellyRipple, [0, 0.5]) sliders do not appear to change anything when windows move or focus changes. Verify the chain: the panel writes the value, the store resolves it, integrations/niri/render.js emits it, niri validate accepts it, and niri-material reads it (mat_jelly_ripple uniform, max_flex in render_helpers/material.rs). If prism emits correct values and the renderer ignores them, hand off to the niri-material dynamics task.
