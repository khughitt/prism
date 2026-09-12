---
id: prism-d54be4
title: "Per-parameter GPU cost estimates: guide exposed ranges and warn on demanding settings"
status: idea
priority: 2
created: 2026-09-07T21:18:05Z
updated: 2026-09-11T23:34:15Z
depends: []
tags: [material, performance, ui]
---

Cross-project idea (material x prism). For each material parameter a user can control (defs/glass.yaml: ior, thickness, distortionScale, backdropBlur, noise amount/type, ...), keep an estimate of its render cost, either a measured data-driven table or a cost function over the parameter value, including interactions between parameters (e.g. frosted backdrop plus high distortion detail). Use it in one or both ways: (1) inform the ranges Prism exposes in the defs so sliders stop where the cost curve turns steep; (2) surface an indication in the Noctalia panel when the user is requesting computationally demanding values or combinations. Open questions: where the estimates live (niri-material shader metadata vs a Prism-side table), how they are measured (frame time benchmarks per parameter sweep), and how the panel conveys cost (per-control hint vs a summary meter).

## Notes

- 2026-09-09T01:19:45Z (main): Weight the estimates by focus state: unfocused windows are the majority on screen, so glass.inactive.roughness 1, glass.inactive.anisotropicBlur, or glass.inactive.backdropBlur cost far more than the same value on the single focused window. prism-a4ef9a widened the split to 12 optics, so most demanding parameters now have an unfocused half. Relevant to prism-ed6be0.
- 2026-09-11T23:34:15Z (main): material-31074f (material) is the measurement side of these estimates: per-pass/per-parameter cost under a consistent capture protocol. Source: mindful:thought:a476e6bcd1fd4297b70824758235d821
