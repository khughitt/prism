---
id: prism-067fc5
title: Say what light-ior does where the niri ring cap binds
status: idea
priority: 2
created: 2026-10-01T11:10:41Z
updated: 2026-10-09T04:34:40Z
depends: []
tags: []
agent: claude-code/claude-sonnet-5-5
---

niri-material material-a85a18 kept the ring's half-ring-gap cap on the shared light shift. On the live terminal-glass (ior 1.28, thickness 31.2, bevel 10, ring-gap 2) the chamfer's shared shift reaches the 1 px cap at every light-ior, so light-ior 6 no longer moves it. It still changes the uncapped chromatic-aberration offsets (blue about 0.27 px at light-ior 1, 0.10 at 6), ripple-tilted pixels while jelly is active, and aurora. The palette's light-ior definition could say so. Reference: niri-material docs/materials/material-config.md, the light-ior paragraphs.

## Notes

- 2026-10-09T04:34:40Z (main): scope: drop; the glass.lightIor description already says the shared shift stops at half the Gap while fringing and motion still respond (defs/glass.yaml, 50d5f15); proposal: drop as landed in 50d5f15
