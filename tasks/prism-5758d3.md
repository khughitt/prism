---
id: prism-5758d3
title: Optimize slider ranges and transforms in the glass defs
status: done
priority: 2
size: m
created: 2026-09-06T00:32:53Z
updated: 2026-09-07T00:29:18Z
depends: [material-37cec9, material-48dc76]
tags: [ui, defs, noctalia]
---

Many sliders in defs/glass.yaml have too wide a range or a linear scale where the effect is nonlinear, so instead of a slowly evolving effect there is a narrow, near-sigmoidal transition with a sharp turn and a long dead zone of saturated values. Per parameter: choose careful bounds, clip extreme or saturated values, and use log or other transforms where the visual response is multiplicative (scale: logarithmic already exists for distortionScale and tint distance). Use data to guide the choice: sweep each parameter and record where the visual effect stops changing (screenshots or the smoke harness in niri-material), then set bounds so the useful region fills the slider. Candidates: refraction, depth, blur, noise, saturation, flex, ripple.

## Notes

- 2026-09-06T00:47:17Z (main): From prism-66b025: jelly-flex's [0, 0.02] range only sets how fast the shear saturates toward a renderer cap of 0.25 * bevel depth; the amplitude is set by bevel, not the slider. Rescoping the range is pointless until material-6d4de5 decides the cap.
- 2026-09-07T00:03:24Z (main): material-48dc76 done 2026-09-06: sweep tables for every candidate are in niri-material docs/materials/2026-09-06-glass-parameter-sweep-evidence.md (Part 2 has a Summary for prism-5758d3 table). Note Prism's Blur slider is glass.roughness, not niri's blur block. Findings: roughness is steepest (61% of its change in the first tenth of [0,1]; log-scale candidate), thickness front-loads at the edge (useful 0-40 of [0,200]; face flat at distortion 0), noise is near linear over [0,1] (keep), saturation is linear and symmetric about 1 until it clips past 2.5 (consider capping). ior from Part 1: edge change concentrates in 1.0-1.7, face keeps changing to 3.
- 2026-09-07T00:29:18Z (slider-ranges): Met. Refraction narrowed to [1,2]; depth to [0,100] on a power curve; roughness (the Blur slider) on a power curve; noise and saturation kept on evidence (near linear; clip past 2.5 measured on one backdrop only); flex and ripple deferred to material-6d4de5's cap decision per the 2026-09-06 note. Mechanism: scale power with ui.exponent.
