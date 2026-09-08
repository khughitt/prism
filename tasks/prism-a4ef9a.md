---
id: prism-a4ef9a
title: "Widen the focus matrix: per-state tint, refraction, depth, distortion detail, and frosted backdrop"
status: done
priority: 2
size: m
owner: main
created: 2026-09-08T22:31:49Z
updated: 2026-09-08T22:40:13Z
depends: []
tags: [material, niri, ui]
---

The Focus matrix splits only 7 optics (roughness, attenuationDistance, chromaticAberration, distortion, anisotropicBlur, noise, saturation). Add glass.inactive.* twins for attenuationColor, ior, thickness, distortionScale, and backdropBlur, moving those five out of the shared Glass group into the Focus matrix. Each twin defaults to its focused default, so the shipped look is unchanged and the split is opt-in tuning. Geometry (paneLip, paneShiftX/Y) and motion (jellyFlex, jellyRipple) stay shared: they resize/shift the slab or restart at the hard-cut swap (material-5a5fff), and per-state geometry risks niri's 'offset must not exceed bevel' and 'ring-inset + ring-width <= bevel' rejections. noiseType stays the one shared row in the matrix.

## Notes

- 2026-09-08T22:40:06Z (feat/glass-focus-coverage): Five twins added (backdropBlur, attenuationColor, ior, thickness, distortionScale), each defaulting to its focused value; niri sink renders them per state. defs.js needed one rule relaxed: ui.state/ui.row were slider-only, now allowed on slider|toggle|color (select stays single-row). Panel needed no change - controlCell and presentation.luau already pair on ui.state alone.
- 2026-09-08T22:40:13Z (feat/glass-focus-coverage): Focus matrix widened to 12 optic rows: frosted backdrop, tint, refraction, depth, and distortion detail now have glass.inactive.* twins, each defaulting to its focused value so the shipped pair is byte-identical to before. Geometry and pane motion stay shared. niri 26.04 (f0370f52) validates the divergent pair at both range extremes.
