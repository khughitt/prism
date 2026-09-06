---
id: prism-66b025
title: Flex and Ripple sliders have no visible effect
status: done
priority: 2
size: s
owner: main
created: 2026-09-06T00:32:53Z
updated: 2026-09-06T00:47:17Z
depends: []
tags: [niri, bug]
---

The jelly Flex (glass.jellyFlex, [0, 0.02]) and Ripple (glass.jellyRipple, [0, 0.5]) sliders do not appear to change anything when windows move or focus changes. Verify the chain: the panel writes the value, the store resolves it, integrations/niri/render.js emits it, niri validate accepts it, and niri-material reads it (mat_jelly_ripple uniform, max_flex in render_helpers/material.rs). If prism emits correct values and the renderer ignores them, hand off to the niri-material dynamics task.

## Notes

- 2026-09-06T00:47:17Z (main): Verified 2026-09-05: store has jellyFlex 0.018 / jellyRipple 0.48, prism.kdl carries jelly-flex 0.018 / jelly-ripple 0.48, niri validate passes, and the running compositor logs 'loaded config' on each reload. Prism emits correctly; nothing to fix here.
- 2026-09-06T00:47:17Z (main): Why nothing is visible: the renderer caps the flex shear at 0.25 * min(bevel, thickness) = 3.75 px with bevel 15, applies it only to the inner chamfer edge, and only while a scroll/column/tile spring runs; interactive drag is excluded by design (animation_residual drops the grab offset). Ripple tilts the normal by activity * ripple; with ior 1.2 and thickness 26.3 the refraction tap moves at most about 1 px, through terminal transparency only. Handed to material-6d4de5.
- 2026-09-06T00:47:17Z (main): Not a prism defect: values reach the renderer intact; the renderer bounds the effect to a few px during springs and none during drag. Analysis recorded in notes and on material-6d4de5.
