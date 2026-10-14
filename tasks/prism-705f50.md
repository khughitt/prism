---
id: prism-705f50
title: "Panel acceptance: the first Focus rows that are not sliders"
status: todo
priority: 2
size: xs
complexity: low
process: direct
created: 2026-09-09T01:19:27Z
updated: 2026-10-14T14:15:06Z
depends: []
tags: [noctalia, ui, material]
---

prism-a4ef9a made Frosted backdrop a toggle pair and Tint a color pair, the first matrix rows in the Focus group that are not sliders. The Lua tests prove the rows pair on ui.state; nothing has rendered them.

What to check in the live Noctalia panel: a color cell is ui.button with text = the hex value plus a palette glyph (panel.luau nativeControl), so its width follows its text and two of them sit in the focused|unfocused columns. controlCell gives every non-slider an empty label of valueColumnWidth and then a flexGrow spacer, which was tuned when every matrix row held a slider. Confirm the two columns still align with the slider rows above and below, that the reset affordance and the info button land where they do on a slider row, and that the matrix header 'Focused | Unfocused' still sits over the right controls.

Outcome: either a capture showing the rows are fine, or the panel.luau layout fix and a test that pins it.

## Established (re-scope 2026-10-14, at 4bb72f3)

- The Tint color pair has been seen. The owner's accepted rack screenshot (`docs/notes/2026-09-09-device-chain-rack-ui.png`) shows the Tint card with two color buttons in the Focused and Unfocused columns. Its resets align with the slider cards' resets, and the header sits over the right controls.
- That shows the 09-09 layout. The color cell has changed since:
  - `e232a5a` and `d7c0b4e` (2026-10-03) put a 28×16 swatch in the reserved value column, and show pickers only under manual, with a reported source swatch otherwise.
  - `b5ebd22` (2026-10-10) added keyboard focus to slider cells only.
- The Frosted backdrop toggle pair (`glass.backdropBlur` and its twin) now sits inside the Backdrop card's expanded details (`defs/rack/devices.yaml`). It is not in the screenshot, and nothing has shown it rendered.

## Remaining

- One look at the current panel with Backdrop expanded (the toggle pair against the Blur slider row) and at the Tint card's current color cells. The look is the owner's, or an agent's capture with the owner's go-ahead for the desktop.
- If either misaligns, fix it in `controlCell` (`integrations/noctalia-plugin/panel.luau`) and pin the fix in `plugin_test.lua`.

## Notes

- 2026-10-14T14:15:06Z (main): scope: rescoped; the Tint color pair is seen and aligned in the accepted 2026-09-09 rack screenshot; narrowed to the redesigned color cell (e232a5a, d7c0b4e) and the Frosted backdrop toggle pair in Backdrop's expanded details, which no capture shows; process direct
