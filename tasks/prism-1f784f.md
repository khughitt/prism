---
id: prism-1f784f
title: "Light bending, Head wander and Wander rate are wired but read as inert"
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-10-02T00:09:28Z
updated: 2026-10-02T00:09:28Z
depends: []
tags: [noctalia, ui, material]
agent: claude-code/claude-opus-5-5
---

Owner report (2026-10-01): the three Ring knobs seem to do nothing. They are wired: prism.kdl carries light-ior 4.5, ring-beam-noise 0.55 and ring-beam-noise-hz 12, and the native build reads them. Their effects are small. Light bending (light-ior) moves only the band's halo on the chamfer, and aurora if enabled. The native shader caps the shift at half ring-gap (material-a85a18 kept that cap), and the band core on the flat face never moves. Head wander and Wander rate modulate only the head's brightness while the beam runs, which at beamSpeed 4350 and decay 4150 is under a second, so 12 Hz flicker on a fast, fading head barely registers. Decide per knob: rewrite the label and description to say what it moves, narrow or move it to an advanced group, or ask niri-material for a stronger effect (material-4e3e9c covers embedding the band in the glass). Do not drop them without the owner's word.
