---
id: prism-4de363
title: "Noise slider spans [0, 0.25] with finer steps"
status: todo
priority: 2
size: s
complexity: low
process: direct
created: 2026-10-10T16:18:11Z
updated: 2026-10-10T16:18:11Z
depends: []
tags: [defs, ui, material]
agent: claude-code/claude-opus-5-5
---

glass.noise and glass.inactive.noise currently span [0, 1] at step 0.01, and useful looks sit near the bottom (stored values are mostly 0-0.05). Narrow both to [0, 0.25] and drop ui.step to 0.0025 so the slider keeps ~100 steps across the new range; keep the percent display and check its precision shows the finer steps. Stored values above 0.25 (glass.noise 0.37, glass.inactive.noise 0.57 on 2026-10-10) clamp to 0.25 with a backup. Update the tests that pin the noise range and the shipped-slider step mapping check (one host step per canonical grid step).
