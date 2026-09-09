---
id: prism-1f9fa1
title: "Rack contract: bypass keys, Terminal group, rack file, sink bindings"
status: done
priority: 2
size: s
owner: device-chain
created: 2026-09-09T09:26:05Z
updated: 2026-09-09T10:05:55Z
depends: []
parent: prism-9331c1
tags: [defs, niri]
plan: docs/plans/2026-09-09-device-chain-rack.md
step: "Task 1: The contract: bypass keys, the Terminal group, the rack file, and the sink bindings"
---

Eight glass.bypass.* bool toggles, terminal opacity to group Terminal, defs/rack/devices.yaml in shader order, niri manifest binds. Lands first; the other tracks build on these names.

## Notes

- 2026-09-09T10:05:20Z (device-chain): Red: updated contract tests failed on missing Terminal group and bypass keys. Green: focused glass and presentation tests pass 23/23 after adding the eight bool defs, rack contract, Terminal grouping, and manifest bindings.
- 2026-09-09T10:05:55Z (device-chain): Added bypass defs, Terminal grouping, rack device contract, and niri bindings; focused and full tests pass.
