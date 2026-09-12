---
id: prism-77b856
title: Simplify rack bypass controls while preserving individual reset
status: todo
priority: 2
size: s
complexity: mid
created: 2026-09-09T13:08:43Z
updated: 2026-09-12T16:46:10Z
depends: []
parent: prism-a03862
tags: [ui, noctalia]
source: docs/notes/2026-09-09-device-chain-rack-ui.png
---

Review removing the expanded "Bypass <effect>" toggle rows, which repeat the card light's bypass control. Keep the light as the primary toggle and find a compact, discoverable way to reset each bypass override with unset. Removing the redundant toggle is a proposal to assess, not permission to remove inheritance/reset behavior: a plain set to false persists a context override. Preserve availability and wallpaper-shadow feedback. Acceptance: toggle, individual reset, and layer feedback remain usable with less duplication.

Reference: [desktop acceptance screenshot](../docs/notes/2026-09-09-device-chain-rack-ui.png), supplied by the user after accepting the rack on 2026-09-09.
