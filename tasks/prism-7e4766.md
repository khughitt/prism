---
id: prism-7e4766
title: Let an unset glass.inactive.* follow its focused value instead of a fixed default
status: todo
priority: 2
size: m
created: 2026-09-08T22:56:48Z
updated: 2026-09-08T22:56:48Z
depends: []
tags: [defs, store, material]
---

Widening the focus matrix (prism-a4ef9a) made tuned focused values stop reaching the unfocused material: glass.backdropBlur=true on this host now frosts only the focused window, because glass.inactive.backdropBlur carries its own default of false. Every host that tuned attenuationColor, ior, thickness, distortionScale, or backdropBlur before the split has the same break.

Mechanism to design: a def-level marker (say 'inherits: focused') consulted when the twin is unset at every layer, so resolution falls back to the resolved focused value rather than the twin's default. It cannot be blanket inheritance - the six receding pairs (roughness, attenuationDistance, chromaticAberration, distortion, noise, saturation) ship divergent defaults on purpose, and an unset inactive.roughness must stay 0.5, not follow the focused 0.08. So the marker belongs on the five pairs that ship level.

Open question: what 'unset' means against context layers (prism-2f0b4b), where a wallpaper context may set the focused half only.

Cheaper alternative if this proves too subtle: a doctor check that warns when a focused optic is tuned and its twin still sits at the shipped default.
