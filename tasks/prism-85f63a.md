---
id: prism-85f63a
title: "Stacked noise: several grain generators with their own gain, type, and scale"
status: todo
priority: 2
size: l
complexity: high
created: 2026-09-09T03:03:30Z
updated: 2026-09-12T16:46:10Z
depends: [material-3fcba2]
parent: prism-a03862
tags: [material, bus, noctalia]
---

Hub goal. The first device that can exist more than once, which forces the chain-merge decision: does a layer replace the whole device list or patch devices by id, and how does a multi-instance device live on a flat scalar bus. Needs its own brainstorm and spec before prism work starts. The niri-material piece is known work and can start now: per-layer packed vec4 uniforms for gain, type, and scale after the mat_sig_impulse_* pattern, unrolled in GLSL ES 1.00, plus a per-layer seed scale so layers differ; note fine is nine hashes per layer. Shipped KDL keeps one noise node until prism can write more.
