---
id: prism-a4ef9a
title: "Widen the focus matrix: per-state tint, refraction, depth, distortion detail, and frosted backdrop"
status: doing
priority: 2
size: m
owner: main
created: 2026-09-08T22:31:49Z
updated: 2026-09-08T22:31:58Z
depends: []
tags: [material, niri, ui]
---

The Focus matrix splits only 7 optics (roughness, attenuationDistance, chromaticAberration, distortion, anisotropicBlur, noise, saturation). Add glass.inactive.* twins for attenuationColor, ior, thickness, distortionScale, and backdropBlur, moving those five out of the shared Glass group into the Focus matrix. Each twin defaults to its focused default, so the shipped look is unchanged and the split is opt-in tuning. Geometry (paneLip, paneShiftX/Y) and motion (jellyFlex, jellyRipple) stay shared: they resize/shift the slab or restart at the hard-cut swap (material-5a5fff), and per-state geometry risks niri's 'offset must not exceed bevel' and 'ring-inset + ring-width <= bevel' rejections. noiseType stays the one shared row in the matrix.
