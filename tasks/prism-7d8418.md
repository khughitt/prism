---
id: prism-7d8418
title: niri sink dry values while bypassed
status: done
priority: 2
size: s
parallel: true
owner: device-chain
created: 2026-09-09T09:25:49Z
updated: 2026-09-09T10:14:42Z
depends: [prism-1f9fa1]
parent: prism-9331c1
tags: [niri]
plan: docs/plans/2026-09-09-device-chain-rack.md
step: "Task 3: Dry values in the niri sink"
---

DRY table in render.js keyed by bypass param, applied in glassFor for both materials; Refraction also zeroes fringing and directional blur; cross-check against the rack file.

## Notes

- 2026-09-09T10:14:42Z (device-chain): All eight bypasses write dry values to both materials; refraction silences dependents and preserves stored optics.
