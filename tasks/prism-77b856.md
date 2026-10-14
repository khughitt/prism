---
id: prism-77b856
title: Simplify rack bypass controls while preserving individual reset
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-09-09T13:08:43Z
updated: 2026-10-14T13:59:48Z
depends: []
parent: prism-a03862
tags: [ui, noctalia]
source: docs/notes/2026-09-09-device-chain-rack-ui.png
---

Review removing the expanded "Bypass <effect>" toggle rows, which repeat the card light's bypass control. Keep the light as the primary toggle and find a compact, discoverable way to reset each bypass override with unset. Removing the redundant toggle is a proposal to assess, not permission to remove inheritance/reset behavior: a plain set to false persists a context override. Preserve availability and wallpaper-shadow feedback. Acceptance: toggle, individual reset, and layer feedback remain usable with less duplication.

Reference: [desktop acceptance screenshot](../docs/notes/2026-09-09-device-chain-rack-ui.png), supplied by the user after accepting the rack on 2026-09-09.

## Established (re-scope 2026-10-14)

- The duplication still stands. `deviceCard` in `integrations/noctalia-plugin/panel.luau` renders `singleRow(card.bypass)` first in the expanded details, while `lightRow` toggles the same key with a plain set. Its comment names the details row as the reset's carrier.
- `lightRow` is a clickable row holding a glyph because, when it was written, a toggle took no tooltip and a button took no color.
- The native Noctalia checkout (7f547389f, 2026-09-29) now lists `color`, `tooltip` and `onRightClick` on `button` (`src/ui/ui_tree_reconciler.cpp`, `kButton`). The installed shell (5.2.1) at the plugin's declared API 22 is not yet confirmed to match.

## Approach

- Lean: make the light a button. It carries the family color, a tooltip naming both actions, a plain set on `onClick` and the unset on `onRightClick`. Then drop the details row.
- Fallback, if the installed shell lacks those props: a small restore button beside the light, shown only while the bypass is overridden in the current layer.
- Either way, keep:
  - the three light states (active, bypassed, upstream-silenced)
  - availability dimming
  - the `rowHint` layer and wallpaper-shadow feedback

Done: one bypass control per card, an individual reset reachable without expanding the card, and `plugin_test.lua` cases for set, reset and the hint.

## Notes

- 2026-10-14T13:59:48Z (main): scope: rescoped; duplication confirmed in panel.luau deviceCard/lightRow at 8b9757a; Noctalia 7f547389f kButton accepts color, tooltip and onRightClick, so the lean is a light button with right-click reset (installed 5.2.1 at API 22 to confirm); process direct
