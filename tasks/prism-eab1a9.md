---
id: prism-eab1a9
title: Move rack effect descriptions from info icons to label tooltips
status: doing
priority: 2
size: s
owner: rack-ui-polish
created: 2026-09-09T13:08:43Z
updated: 2026-09-09T13:28:04Z
depends: []
parent: prism-a03862
tags: [ui, noctalia]
source: docs/notes/2026-09-09-device-chain-rack-ui.png
---

Evaluate removing the separate circle-i icons from rack effect names and showing the existing descriptions when hovering over the names instead, to reduce clutter. Check the native host's tooltip/hit-area behavior before choosing the implementation; preserve keyboard access to the same help. Related: prism-33f4ae fixed inert tooltip hit areas on the earlier info buttons. Acceptance: descriptions remain discoverable and readable, without a dedicated info icon in every effect header.

Reference: [desktop acceptance screenshot](../docs/notes/2026-09-09-device-chain-rack-ui.png), supplied by the user after accepting the rack on 2026-09-09.

## Notes

- 2026-09-09T13:28:04Z (rack-ui-polish): Replaced row info icons with ghost name buttons carrying native tooltips. Pointer/keyboard activation toggles the same description inline without writes; Lua coverage passes, including fallback text. Full gate and native lint pass; live hover/keyboard acceptance remains before closeout.
