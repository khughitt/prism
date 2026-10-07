---
id: prism-7024c4
title: "Glass edge optics keys: glass.bevelProfile, glass.reflection, glass.edgeHighlight"
status: todo
priority: 2
size: s
complexity: low
process: direct
created: 2026-10-03T00:52:40Z
updated: 2026-10-06T23:35:49Z
depends: [material-be611b]
tags: [glass]
agent: claude-code/claude-opus-5-5
---

niri material-be611b adds three glass parameters: bevel-profile (FloatOrInt<1,8>, default 1; 1 planar chamfer, 2 quarter-round, higher squircle), reflection (0-1, default 0; untinted scene reflection on the bevel) and edge-highlight (0-1, default 0; GGX key-light lobe on the bevel). Add Prism keys glass.bevelProfile, glass.reflection and glass.edgeHighlight (focused and glass.inactive.*), written as the native nodes bevel-profile, reflection and edge-highlight, with starting values the owner picks from the be611b contact sheet (niri plan docs/plans/2026-10-02-glass-edge-optics.md, Task 9). Blocked until those keys exist in an installed niri.

## Notes

- 2026-10-06T23:35:49Z (main): Unblocked 2026-10-06: niri material-be611b merged into materials-26.04 (23a2e37b), not yet pushed or installed. Owner's starting values from the glass-edge sheet (cell inactive-k2-r0.6-h0-g0): bevel-profile 2, reflection 0.6, edge-highlight 0; the pick was on the inactive look (thickness 62.3, attenuation #2e3034 at 42). Still needs the keys in an installed niri (arch package pin rollout) before Prism writes them live.
