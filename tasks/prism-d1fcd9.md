---
id: prism-d1fcd9
title: Quality tier bound to power and thermal state
status: shelved
priority: 2
created: 2026-09-11T23:39:09Z
updated: 2026-10-14T11:11:41Z
depends: []
parent: prism-2f0b4b
tags: [profiles, performance, material]
---

A state profile (prism-9298b9) that activates a cheaper glass tier on battery, under thermal throttling, or when the render-cost counter reports sustained overrun, and returns to the full optic on AC. Needs a material-side quality scalar or the tiers from the cost-tiered inactive glass idea; the Prism side is the binding to the state source. Related: material-5d6b2c (resource-aware rendering goal), ops-71120e.

## Notes

- 2026-10-14T11:11:41Z (main): shelved: A cheaper glass tier with measured whole-scene savings and visual acceptance exists (material-a91346 cost-tiered inactive glass, or a quality scalar from material-31074f); then bind it to Noctalia's battery_plugged / power_profile_changed hooks through the state layer (prism-9298b9)
