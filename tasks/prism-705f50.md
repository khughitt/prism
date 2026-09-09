---
id: prism-705f50
title: "Panel acceptance: the first Focus rows that are not sliders"
status: todo
priority: 2
size: s
created: 2026-09-09T01:19:27Z
updated: 2026-09-09T01:19:27Z
depends: []
tags: [noctalia, ui, material]
---

prism-a4ef9a made Frosted backdrop a toggle pair and Tint a color pair, the first matrix rows in the Focus group that are not sliders. The Lua tests prove the rows pair on ui.state; nothing has rendered them.

What to check in the live Noctalia panel: a color cell is ui.button with text = the hex value plus a palette glyph (panel.luau nativeControl), so its width follows its text and two of them sit in the focused|unfocused columns. controlCell gives every non-slider an empty label of valueColumnWidth and then a flexGrow spacer, which was tuned when every matrix row held a slider. Confirm the two columns still align with the slider rows above and below, that the reset affordance and the info button land where they do on a slider row, and that the matrix header 'Focused | Unfocused' still sits over the right controls.

Outcome: either a capture showing the rows are fine, or the panel.luau layout fix and a test that pins it.
