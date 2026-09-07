---
id: prism-5e6a52
title: Power slider scale for the panel and def loader
status: done
priority: 2
size: s
owner: slider-ranges
created: 2026-09-07T00:24:00Z
updated: 2026-09-07T00:26:16Z
depends: []
parent: prism-5758d3
tags: [ui, defs]
---

scale: power with a required ui.exponent (> 1): position p maps to low + (high - low) * p^exponent. Unlike logarithmic it accepts a range starting at 0, which roughness and depth need (0 is the stored unfocused roughness and the only value that skips the blur pyramid). Non-linear scales always run the panel slider in normalized space; display governs only the label, so percent labels are allowed on curved sliders and the percent-must-be-linear rule goes. Decided in the prism-5758d3 brainstorm on 2026-09-06.

## Notes

- 2026-09-07T00:26:16Z (slider-ranges): scale: power with ui.exponent > 1 lands in the def loader and the panel presentation; a curved scale always runs the track in normalized space and display governs only the label, so percent labels are allowed on curved sliders and the percent-must-be-linear rule is gone. Covered by test/defs.test.js and plugin_test.lua.
