---
id: prism-1ffd70
title: Rolling a slider turns on the device or section that disables it
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-10-10T16:18:11Z
updated: 2026-10-10T16:18:12Z
depends: []
tags: [ui, noctalia]
agent: claude-code/claude-opus-5-5
---

The dice (title-row button, r key, and the section dice) roll sliders whose effect is switched off, so the roll changes nothing visible. When a roll changes a slider, also enable what disables it: un-bypass the rack device whose mix, rows, or shared params it rolled (glass.bypass.<device> -> false), and turn on a section's header toggle (e.g. the Ring enable) when that section's sliders roll. The master Glass toggle (title row) is never flipped by a roll. Write the toggles through the same FIFO and optimistic update as the sliders, so revert undoes the whole roll.

Coordinate with prism-d2ba46 (roll only drawn, available sliders; stand down mid-drag): decide there whether collapsed cards' detail sliders roll at all, since enabling a device for a slider the user cannot see is surprising.

## Notes

- 2026-10-10T16:18:11Z (main): concerns: prism-84d308 extension — the roll it added should enable what disables the sliders it rolls
