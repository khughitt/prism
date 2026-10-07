---
id: prism-c45c6a
title: Adopt the owner's tuned ring and light values as Prism defaults
status: doing
priority: 2
size: xs
complexity: low
process: direct
owner: main
created: 2026-10-02T00:09:28Z
updated: 2026-10-07T10:01:38Z
started: 2026-10-07T10:01:38Z
depends: []
tags: [material]
agent: claude-code/claude-opus-5-5
---

Owner (2026-10-01): these live values are good defaults: ring focus true, colorSource familiar, color #ccccff, beamSpeed 4350, beamNoise 0.55, beamNoiseHz 12, decay 4150, gap 6, width 1.1, glow 1.2, lightIor 4.5. Set them as defs/glass.yaml defaults and update the render fixtures. Native niri defaults stay as they are unless the owner asks: Prism is where the look is chosen.

## Notes

- 2026-10-02T00:14:54Z (main): Before adopting decay 4150 as the default, look at a small window. Decay is a distance, so a pane with perimeter under 4150 px still completes the lap and is cut by the seam fade; only large panes (~6000 px at 1440p) show the die-before-lap look the owner judged. If small windows look wrong, the native fix is to cap decay at a fraction of the perimeter. Also save these values as a named profile (reference: material-519eeb).
- 2026-10-07T10:01:38Z (main): started
  provenance: {"harness_session":"claude-code:f04c10d8-ce2d-4eb0-91ca-69337ed4bca1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
