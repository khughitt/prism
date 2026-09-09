---
id: prism-999c0e
title: Align and justify sliders consistently across rack cards
status: doing
priority: 2
size: s
owner: rack-ui-polish
created: 2026-09-09T13:08:43Z
updated: 2026-09-09T13:43:07Z
depends: []
parent: prism-a03862
tags: [ui, noctalia]
source: docs/notes/2026-09-09-device-chain-rack-ui.png
---

Fix the uneven control alignment visible in the accepted rack screenshot. Align focused and unfocused slider tracks, formatted values, reset buttons, and their column headers across effect cards. Handle the different value formats (percentages and decimals) and the Tint color controls without shifting the matrix columns; check expanded rows too. Related: prism-9e449a solved the earlier flat matrix alignment, but the current rack needs a fresh visual pass. Acceptance: compare the real panel at its normal scale against the reference screenshot and confirm stable column alignment.

Reference: [desktop acceptance screenshot](../docs/notes/2026-09-09-device-chain-rack-ui.png), supplied by the user after accepting the rack on 2026-09-09.

## Notes

- 2026-09-09T13:23:18Z (rack-ui-polish): Root cause confirmed in Noctalia: label props accept width but the label reconciler returns without applying it. Reserve formatted value width with a layout container; account for card padding in the matrix header.
- 2026-09-09T13:28:04Z (rack-ui-polish): Implemented fixed layout containers for value columns and matching rack-header/card insets. Lua regression reproduced the old failure and now passes; just gate passes 264 Node tests plus Lua; native plugin lint is clean. Live screenshot comparison remains before closeout.
- 2026-09-09T13:43:07Z (rack-ui-polish): User live review accepted alignment but found clipped expanded names. Native Spacer defaults to flexGrow=1 even with width set; set flexGrow=0 for all sized spacers (indentation, matrix header, profile name alignment). Lua regression fails before the fix and passes after it.
