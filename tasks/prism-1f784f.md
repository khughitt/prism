---
id: prism-1f784f
title: "Light bending, Head wander and Wander rate are wired but read as inert"
status: doing
priority: 2
size: s
complexity: mid
process: direct
owner: main
created: 2026-10-02T00:09:28Z
updated: 2026-10-07T10:06:38Z
started: 2026-10-07T10:06:38Z
depends: []
tags: [noctalia, ui, material]
agent: claude-code/claude-opus-5-5
---

Owner report (2026-10-01): the three Ring knobs seem to do nothing. They are wired: prism.kdl carries light-ior 4.5, ring-beam-noise 0.55 and ring-beam-noise-hz 12, and the native build reads them. Their effects are small. Light bending (light-ior) moves only the band's halo on the chamfer, and aurora if enabled. The native shader caps the shift at half ring-gap (material-a85a18 kept that cap), and the band core on the flat face never moves. Head wander and Wander rate modulate only the head's brightness while the beam runs, which at beamSpeed 4350 and decay 4150 is under a second, so 12 Hz flicker on a fast, fading head barely registers. Decide per knob: rewrite the label and description to say what it moves, narrow or move it to an advanced group, or ask niri-material for a stronger effect (material-4e3e9c covers embedding the band in the glass). Do not drop them without the owner's word.

## Notes

- 2026-10-02T00:14:54Z (main): Light bending: the 'no effect' finding (material-a85a18, byte-identical light-ior 1 vs 6) was at ring-gap 2. The owner now runs gap 6, which triples the cap to 3 px, so light-ior 4.5 may now move the halo. Re-measure with niri-material's ring_pair test at gap 6 before deciding this knob.
- 2026-10-02T00:14:54Z (main): Head wander: brightness flicker at 12 Hz on a fast, decaying head is below notice. Option to weigh against relabelling: wander the head's position or width (or default to about 3 Hz), visible at the same strength; that is a native change in niri-material ring.rs head_gain.
- 2026-10-07T10:06:38Z (main): started
  provenance: {"harness_session":"codex:01a115d3-f017-7310-9b8f-d57428601236","harness_session_source":"CODEX_THREAD_ID"}
