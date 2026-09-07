---
id: prism-d6b600
title: "Additional glass noise types (CIE, HSV, ...)"
status: todo
priority: 2
size: m
created: 2026-09-05T02:36:51Z
updated: 2026-09-07T01:07:17Z
depends: [material-6e7352]
tags: [material, noise]
spec: docs/specs/2026-09-06-glass-noise-type-design.md
---

Goal: the Focus section gains a shared Noise type select (white, fine, lightness; Prism default fine) and the niri sink writes noise <amount> type=<type> into terminal-glass and terminal-glass-inactive. Mechanism decided 2026-09-06: an optional type property on niri-material's glass noise node (omitted keeps today's white grain byte-identical; fine is high-pass bell-shaped hash grain; lightness applies it to Oklab L), not a texture tile and not per-state types. Two pieces: the native selector in niri-material, then the Prism definition, sink, tests and live select check, which cannot land until the native build is installed because the generated fragment fails niri validate without the property. Desktop acceptance after install decides whether lightness stays.

## Notes

- 2026-09-06T00:32:54Z (main): Observed 2026-09-05: current RGB white noise looks too grainy and coarse; native work filed as material-6e7352
- 2026-09-07T01:07:17Z (glass-noise-types): Scoped 2026-09-06 after brainstorming: shader-only type selector chosen over a blue-noise texture and over a spike; chroma/hue grain and dithering left out
