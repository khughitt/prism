---
id: prism-d0d4cb
title: Emit glass noise and saturation per focus state
status: todo
priority: 2
size: s
created: 2026-09-05T09:05:52Z
updated: 2026-09-05T09:49:39Z
depends: [material-1293e8]
parent: prism-63dd45
tags: [glass, noctalia]
spec: docs/specs/2026-09-05-glass-noise-saturation-focus-state-design.md
plan: docs/plans/2026-09-05-glass-noise-saturation-focus-state.md
---

Four Focus-matrix definitions (glass.noise, glass.inactive.noise, glass.saturation, glass.inactive.saturation), niri sink writes noise and saturation into both material definitions unconditionally, manifest binds, backdropBlur description drops the saturation/noise claim, README and plugin-contract row lists updated, tests across glass-defs, niri-render, plugin-presentation, and plugin_test.lua. Depends on material-1293e8 being installed: prism.kdl fails niri validate on a build without the grammar.
