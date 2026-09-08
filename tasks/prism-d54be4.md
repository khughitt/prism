---
id: prism-d54be4
title: "Per-parameter GPU cost estimates: guide exposed ranges and warn on demanding settings"
status: idea
priority: 2
created: 2026-09-07T21:18:05Z
updated: 2026-09-07T21:18:05Z
depends: []
tags: [material, performance, ui]
---

Cross-project idea (material x prism). For each material parameter a user can control (defs/glass.yaml: ior, thickness, distortionScale, backdropBlur, noise amount/type, ...), keep an estimate of its render cost, either a measured data-driven table or a cost function over the parameter value, including interactions between parameters (e.g. frosted backdrop plus high distortion detail). Use it in one or both ways: (1) inform the ranges Prism exposes in the defs so sliders stop where the cost curve turns steep; (2) surface an indication in the Noctalia panel when the user is requesting computationally demanding values or combinations. Open questions: where the estimates live (niri-material shader metadata vs a Prism-side table), how they are measured (frame time benchmarks per parameter sweep), and how the panel conveys cost (per-control hint vs a summary meter).
