---
id: prism-d6b600
title: "Additional glass noise types (CIE, HSV, ...)"
status: idea
priority: 2
created: 2026-09-05T02:36:51Z
updated: 2026-09-05T02:36:51Z
depends: []
tags: [material, noise]
---

The glass postprocess applies screen-space noise after saturation. Explore noise applied in other color spaces or channels: CIE (Lab/Lch lightness-only or chroma-only grain), HSV (hue jitter, value grain), and others such as blue-noise dithering. Each type is a shader selector plus a config enum; Prism exposes it once the native enum exists.
