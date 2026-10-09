---
id: prism-2a8fea
title: "Expose the rigid tilt keys: glass.view.tilt, tiltSettle, distance"
status: idea
priority: 2
created: 2026-10-09T20:42:55Z
updated: 2026-10-09T20:42:59Z
depends: []
tags: [niri]
source: niri-material docs/specs/2026-10-09-transient-rigid-tilt-design.md §9
agent: claude-code/claude-opus-5-5
---

niri-material's transient rigid tilt (material-abc08c, docs/specs/2026-10-09-transient-rigid-tilt-design.md in niri-material) adds response-block keys view-tilt (0-20 degrees, default 0 = off), view-tilt-settle (100-5000 ms, default 900) and view-distance (1.5-50, default 6). Map them as glass.view.tilt, glass.view.tiltSettle and glass.view.distance. The keys exist only once that work lands in a niri build Prism targets; preset values come from the owner's clip review (spec §8.4). Successor to the dropped prism-96bc50 (view-perspective and view-parallax are not ported).
