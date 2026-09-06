---
id: prism-5758d3
title: Optimize slider ranges and transforms in the glass defs
status: todo
priority: 2
size: m
created: 2026-09-06T00:32:53Z
updated: 2026-09-06T00:38:34Z
depends: [material-37cec9]
tags: [ui, defs, noctalia]
---

Many sliders in defs/glass.yaml have too wide a range or a linear scale where the effect is nonlinear, so instead of a slowly evolving effect there is a narrow, near-sigmoidal transition with a sharp turn and a long dead zone of saturated values. Per parameter: choose careful bounds, clip extreme or saturated values, and use log or other transforms where the visual response is multiplicative (scale: logarithmic already exists for distortionScale and tint distance). Use data to guide the choice: sweep each parameter and record where the visual effect stops changing (screenshots or the smoke harness in niri-material), then set bounds so the useful region fills the slider. Candidates: refraction, depth, blur, noise, saturation, flex, ripple.
