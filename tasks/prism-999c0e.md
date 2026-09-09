---
id: prism-999c0e
title: Align and justify sliders consistently across rack cards
status: todo
priority: 2
size: s
created: 2026-09-09T13:08:43Z
updated: 2026-09-09T13:08:43Z
depends: []
parent: prism-a03862
tags: [ui, noctalia]
source: docs/notes/2026-09-09-device-chain-rack-ui.png
---

Fix the uneven control alignment visible in the accepted rack screenshot. Align focused and unfocused slider tracks, formatted values, reset buttons, and their column headers across effect cards. Handle the different value formats (percentages and decimals) and the Tint color controls without shifting the matrix columns; check expanded rows too. Related: prism-9e449a solved the earlier flat matrix alignment, but the current rack needs a fresh visual pass. Acceptance: compare the real panel at its normal scale against the reference screenshot and confirm stable column alignment.

Reference: [desktop acceptance screenshot](../docs/notes/2026-09-09-device-chain-rack-ui.png), supplied by the user after accepting the rack on 2026-09-09.
