---
id: prism-cc589b
title: "Replace prism's panel icon (a gem, or other options)"
status: todo
priority: 3
size: s
complexity: low
process: direct
created: 2026-10-09T14:58:40Z
updated: 2026-10-14T11:02:59Z
depends: []
parent: prism-67b1b2
tags: [quick-add, noctalia, ui]
source: "mindful:thought:831df9055e45b067f2ed480991d90d04"
agent: claude-code/claude-opus-5-5
---

Why: the bar shows Prism as a wand (integrations/noctalia-plugin/widget.luau, barWidget.setGlyph("wand")), which does not say what it controls or match the bar's other icons. Original capture: "prism - replace icon (gem? other options?)".

Done when:
- A candidate sheet shows the current wand (marked as the baseline) beside 6–8 tabler glyphs from Noctalia's set (assets/fonts/tabler.json and noctalia-tabler.ttf in the Noctalia checkout): prism, prism-light, diamond, diamonds, triangle, color-filter, contrast-2, blur. Each is shown at bar size next to the bar's other widget glyphs, with a short id per cell, following the image-sheet rules in the global instructions.
- The owner picks one from the sheet; that pick is the only judgment step.
- widget.luau sets the chosen glyph, `noctalia plugins lint integrations/noctalia-plugin` passes, and the bar shows it after a plugin reload (disable/enable khughitt/prism).

Handoff: docs/notes/2026-10-14-panel-ergonomics-brief.md.
