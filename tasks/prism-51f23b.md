---
id: prism-51f23b
title: Emit the glass noise type and expose it as a Focus select
status: todo
priority: 2
size: m
created: 2026-09-07T01:05:12Z
updated: 2026-09-07T01:07:17Z
depends: []
parent: prism-d6b600
tags: [glass, noctalia, niri]
spec: docs/specs/2026-09-06-glass-noise-type-design.md
---

Prism piece of prism-d6b600: the glass.noiseType enum definition (white, fine, lightness; default fine) rendered as a select under the Noise row, the niri sink writing noise <amount> type=<type> into both materials, the manifest binding, tests, docs, and the live panel check of the select control. Lands only after the native build with the type property is installed, because the generated fragment fails niri validate without it.
