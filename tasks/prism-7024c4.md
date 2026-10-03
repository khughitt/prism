---
id: prism-7024c4
title: "Glass edge optics keys: glass.bevelProfile, glass.reflection, glass.edgeHighlight"
status: todo
priority: 2
size: s
complexity: low
process: direct
created: 2026-10-03T00:52:40Z
updated: 2026-10-03T00:52:41Z
depends: [material-be611b]
tags: [glass]
agent: claude-code/claude-opus-5-5
---

niri material-be611b adds three glass parameters: bevel-profile (FloatOrInt<1,8>, default 1; 1 planar chamfer, 2 quarter-round, higher squircle), reflection (0-1, default 0; untinted scene reflection on the bevel) and edge-highlight (0-1, default 0; GGX key-light lobe on the bevel). Add Prism keys glass.bevelProfile, glass.reflection and glass.edgeHighlight (focused and glass.inactive.*), written as the native nodes bevel-profile, reflection and edge-highlight, with starting values the owner picks from the be611b contact sheet (niri plan docs/plans/2026-10-02-glass-edge-optics.md, Task 9). Blocked until those keys exist in an installed niri.
