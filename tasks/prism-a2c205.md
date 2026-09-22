---
id: prism-a2c205
title: Decide whether Prism should expose the ring filament width
status: idea
priority: 3
created: 2026-09-22T13:19:50Z
updated: 2026-09-22T13:19:50Z
depends: []
tags: [niri]
agent: "claude-code/claude-opus-5[1m]"
---

prism-d8ee06's one unfinished clause. Native ring-width is >0 through 128, default 2.6; prism inherits it and emits nothing, which keeps the 'ring-width must be positive' validation error out of reach of a panel slider. The owner accepted the shipped filament on the 2026-09-21 ring beam sheets (niri-material docs/materials/2026-09-19-ring-beam-evidence.md), so the width is part of an accepted look rather than a gap. Reopen if the band should be tunable per profile; a slider would need a positive-only lower bound, not zero.
