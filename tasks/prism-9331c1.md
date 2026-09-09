---
id: prism-9331c1
title: "Rack presentation: devices in shader order with a mix, details, bypass, and category light"
status: todo
priority: 2
size: l
created: 2026-09-09T03:03:30Z
updated: 2026-09-09T08:44:11Z
depends: []
parent: prism-a03862
tags: [ui, noctalia, niri, defs]
spec: docs/specs/2026-09-08-device-chain-rack-design.md
---

Implement docs/specs/2026-09-08-device-chain-rack-design.md: defs/rack/devices.yaml and its loader, eight glass.bypass.* keys, describe --json rack field, niri sink dry values (Refraction's also zeroing fringing and directional blur), and the panel's device cards with a bypass row that carries an individual reset. Three parallel tracks after the rack schema and key names are fixed: loader plus describe, sink plus manifest plus golden, and the Lua panel against a describe fixture; then an integration step. Terminal opacity moves to a Terminal group.

## Notes

- 2026-09-09T08:44:11Z (device-chain): Spec revised 2026-09-09 after review: rack file at defs/rack/devices.yaml (loadDefs scans every defs/*.yaml as a param list), a bypass row with unset per device, and Refraction bypass zeroes fringing and directional blur with a requires field in the rack
