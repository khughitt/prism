---
id: prism-8eb713
title: Preserve bypass availability and shadow feedback on rack lights
status: done
priority: 2
size: s
owner: device-chain
created: 2026-09-09T10:44:21Z
updated: 2026-09-09T10:50:50Z
depends: []
parent: prism-9331c1
tags: [ui]
---

Fix final branch review finding in collapsed rack lights: disable writes for an unavailable bypass and expose its shadow hint while collapsed. Add focused Lua regressions, update the plan renderer and contract, and retain pending manual desktop acceptance.

## Notes

- 2026-09-09T10:50:50Z (device-chain): RED: focused Lua rejected the unavailable bypass light's write handler; GREEN: focused Lua, just gate (264 Node tests plus Lua), and Noctalia lint pass.
- 2026-09-09T10:50:50Z (device-chain): Preserved collapsed bypass availability and shadow feedback while retaining shadowed writes.
