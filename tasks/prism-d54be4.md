---
id: prism-d54be4
title: "Per-parameter GPU cost estimates: guide exposed ranges and warn on demanding settings"
status: shelved
priority: 2
created: 2026-09-07T21:18:05Z
updated: 2026-09-29T22:43:31Z
depends: []
parent: prism-179840
tags: [material, performance, ui]
---

Cross-project idea (material x prism). For each material parameter a user can control (defs/glass.yaml: ior, thickness, distortionScale, backdropBlur, noise amount/type, ...), keep an estimate of its render cost, either a measured data-driven table or a cost function over the parameter value, including interactions between parameters (e.g. frosted backdrop plus high distortion detail). Use it in one or both ways: (1) inform the ranges Prism exposes in the defs so sliders stop where the cost curve turns steep; (2) surface an indication in the Noctalia panel when the user is requesting computationally demanding values or combinations. Open questions: where the estimates live (niri-material shader metadata vs a Prism-side table), how they are measured (frame time benchmarks per parameter sweep), and how the panel conveys cost (per-control hint vs a summary meter).

## Notes

- 2026-09-09T01:19:45Z (main): Weight the estimates by focus state: unfocused windows are the majority on screen, so glass.inactive.roughness 1, glass.inactive.anisotropicBlur, or glass.inactive.backdropBlur cost far more than the same value on the single focused window. prism-a4ef9a widened the split to 12 optics, so most demanding parameters now have an unfocused half. Relevant to prism-ed6be0.
- 2026-09-11T23:34:15Z (main): material-31074f (material) is the measurement side of these estimates: per-pass/per-parameter cost under a consistent capture protocol. Source: mindful:thought:a476e6bcd1fd4297b70824758235d821
- 2026-09-27T08:54:27Z (main): First isolated board-power data point (niri-material material-265eb0, 2026-09-27, RTX 3070, DRM 3440x1440@60): settled glass with jelly costs no resolvable idle power over plain glass (+0.015 W, upper 0.13 W); a lit drifting aurora costs +0.85 W at drift-hz 4 and +0.68 W at 2 Hz (reduced motion), all at P8. So drift-hz is the one exposed parameter here with a measured, steady cost, and halving it saves only ~20%. Evidence: niri-material docs/materials/2026-09-11-idle-budget-evidence.md.
- 2026-09-29T22:43:30Z (main): shelved: Wake when material-31074f supplies a reusable cost estimate with hardware/workload provenance, uncertainty, and focused/unfocused coverage; then unshelve and scope the warning or range consumer.
- 2026-09-29T22:43:31Z (main): scope: shelved; parented under prism-179840; reuse material-31074f rather than duplicate cost research; the recorded isolated power result is insufficient for general range limits or warnings; brief: docs/notes/2026-09-29-look-exploration-brief.md
